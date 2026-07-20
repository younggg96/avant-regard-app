/**
 * 图片优化工具：按尺寸预设生成图片 URL。
 *
 * ## 架构
 * 后端暴露一条代理路由 `GET /api/files/image?url=...&w=...&q=...`，
 * 内部用 Pillow 做 resize + WebP/JPEG 编码 + 磁盘缓存。客户端所有
 * Storage 图片都通过这条路由拉取，命中缓存时后端零处理成本、直接
 * sendfile 返回，未命中才跑一次转换。
 *
 * ## 为什么不用存储端原生 transform
 * 本项目用 MemFire Cloud 的托管 Storage（`*.baseapi.memfiredb.com`），
 * 实测其服务未部署 `render/image` 转换端点（返回 404 Route not found），
 * 尽管其 SDK 文档描述了 `transform` 契约。那套能力只在自托管 Supabase
 * 配 imgproxy 时才真正生效。所以我们在自己的后端做了一层。
 *
 * ## URL 改写规则
 * - `size === ORIGINAL`、开关关闭、或 URL 不是 Storage 对象 → 原样透传。
 * - 其它 → 改写为
 *   `${API_BASE}/api/files/image?url=<encoded>&w=W&q=Q&fmt=webp&v=V`。
 *   显式固定 `fmt=webp`（expo-image 全平台支持），让 URL 完全决定响应
 *   内容 —— 这样 CDN / 共享缓存不需要按 `Accept` 头拆分缓存键，也
 *   杜绝了「CDN 把按 Accept 协商出的 WebP 错发给不支持的客户端」。
 *
 * ## 兼容面
 * 代码不假设 host 是 MemFireDB；只要原 URL 包含 `/storage/v1/object/public/`
 * 就会走代理 —— 同时覆盖 Supabase 官方域名、MemFire Cloud、任何兼容
 * Supabase Storage API 的实现。非 Storage URL（品牌官网、第三方 CDN、
 * 本地 `file://`、占位图）直接透传。
 */

import { config } from "../config/env";

/**
 * 图片尺寸预设
 */
export enum ImageSize {
  /** 缩略图：用于真正的小图场景（头像 20-60dp、小标签图） */
  THUMBNAIL = "thumbnail",
  /**
   * 瀑布流卡片封面：推荐 / 关注 / 个人主页两列瀑布流的 PostCard 封面专用。
   * 覆盖 @3x DPR 设备上两列布局的物理像素（≈555–645 px），避免用 THUMBNAIL
   * 导致的放大模糊，也比 MEDIUM 省 ~30% 带宽。
   */
  FEED_CARD = "feed_card",
  /** 中等尺寸：用于单列 feed、评论图、分享图 */
  MEDIUM = "medium",
  /** 大图：用于详情页、全屏查看 */
  LARGE = "large",
  /** 原始尺寸：不进行优化 */
  ORIGINAL = "original",
}

/**
 * 每个预设对应的转换参数。`width` 对齐常见终端物理像素：
 *  - THUMBNAIL 400px 覆盖 20-60dp 小图 @3x（头像等），对列表中的小头像远远够用
 *  - FEED_CARD 640px 覆盖 2 列瀑布流卡片 @3x（≈185–215dp × 3）——
 *      iPhone 15 Pro / 16 Pro Max 级别都能做到物理像素 1:1，不再放大
 *  - MEDIUM 800px 覆盖单列 feed、评论图、分享图
 *  - LARGE 1440px 覆盖详情页放大预览（不做 zoom 时足够锐利）
 *
 * `quality` 在 20-100 区间里选：75~85 是视觉无损临界值，越低体积越小
 * 但开始出现 JPEG 块状伪影。与后端 `_transform_bytes` 默认质量对齐。
 */
const IMAGE_SIZE_CONFIG: Record<
  ImageSize,
  { width: number; quality: number }
> = {
  [ImageSize.THUMBNAIL]: { width: 400, quality: 75 },
  [ImageSize.FEED_CARD]: { width: 640, quality: 80 },
  [ImageSize.MEDIUM]: { width: 800, quality: 80 },
  [ImageSize.LARGE]: { width: 1440, quality: 85 },
  [ImageSize.ORIGINAL]: { width: 0, quality: 100 },
};

/**
 * Storage 原始对象路径前缀。基于 path 而非 host 判断，可以同时覆盖
 * Supabase 官方 `*.supabase.co` 与 MemFire Cloud `*.memfiredb.com`。
 */
const OBJECT_PUBLIC_PATH = "/storage/v1/object/public/";

/**
 * 图片转换总开关。
 *
 * 打开时所有 Storage URL 会改写为 `${API_BASE}/api/files/image?...`，
 * 由后端代理路由做实时转换。关闭时退化为透传原图（历史行为）。
 *
 * 线上紧急情况下，把这里置 `false` 即可立刻回退到直拉 Storage，而不
 * 需要等后端发版或回滚。
 */
const IMAGE_TRANSFORM_ENABLED = true;

/**
 * 客户端图片缓存版本。
 *
 * expo-image 的磁盘缓存以完整 URL 为 key。历史版本曾把低分辨率位图写入
 * SDImageCache；只改服务端字节无法让已安装客户端丢弃旧条目。版本号进入
 * URL 后会自然生成新的缓存 key，同时不影响后端按 url/w/q/fmt 复用变体。
 * 以后改变编码或尺寸策略时递增此值即可，无需用户卸载 App。
 */
const IMAGE_CACHE_VERSION = 2;

/**
 * 代理路由 URL。API_BASE 去掉可能的末尾 `/`，避免拼出 `//api/files/image`
 * 这种双斜杠路径（FastAPI 默认会 308 重定向，多一次 RTT 且破坏
 * CORS preflight 缓存）。
 */
const IMAGE_PROXY_ENDPOINT = `${config.EXPO_PUBLIC_API_BASE_URL.replace(
  /\/+$/,
  "",
)}/api/files/image`;

function canTransform(url: string): boolean {
  return url.includes(OBJECT_PUBLIC_PATH);
}

/**
 * 生成优化后的图片URL。
 *
 * @param url 原始图片URL
 * @param size 目标尺寸
 * @returns 优化后的图片URL（若不可转换则原样返回）
 */
export function getOptimizedImageUrl(
  url: string,
  size: ImageSize = ImageSize.MEDIUM,
): string {
  if (!url || url.trim() === "") {
    return url;
  }

  if (size === ImageSize.ORIGINAL) {
    return url;
  }

  if (!IMAGE_TRANSFORM_ENABLED) {
    return url;
  }

  if (!canTransform(url)) {
    return url;
  }

  const { width, quality } = IMAGE_SIZE_CONFIG[size];

  // URL 必须 encode：原 Storage URL 里可能有 `+`、空格（中文文件名
  // 转码后）、`?token=` 等字符，不 encode 会被后端的 query parser 错
  // 误截断。`encodeURIComponent` 覆盖 RFC3986 里所有 reserved char。
  const encoded = encodeURIComponent(url);
  return `${IMAGE_PROXY_ENDPOINT}?url=${encoded}&w=${width}&q=${quality}&fmt=webp&v=${IMAGE_CACHE_VERSION}`;
}

/**
 * 生成缩略图URL（快捷方法）
 */
export function getThumbnailUrl(url: string): string {
  return getOptimizedImageUrl(url, ImageSize.THUMBNAIL);
}

/**
 * 生成中等尺寸URL（快捷方法）
 */
export function getMediumUrl(url: string): string {
  return getOptimizedImageUrl(url, ImageSize.MEDIUM);
}

/**
 * 生成大图URL（快捷方法）
 */
export function getLargeUrl(url: string): string {
  return getOptimizedImageUrl(url, ImageSize.LARGE);
}

/**
 * 根据容器宽度自动选择合适的图片尺寸
 */
export function getAutoSizedUrl(url: string, containerWidth: number): string {
  if (containerWidth <= 300) {
    return getOptimizedImageUrl(url, ImageSize.THUMBNAIL);
  } else if (containerWidth <= 800) {
    return getOptimizedImageUrl(url, ImageSize.MEDIUM);
  } else {
    return getOptimizedImageUrl(url, ImageSize.LARGE);
  }
}
