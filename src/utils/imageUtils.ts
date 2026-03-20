/**
 * 图片优化工具函数
 * 用于生成优化后的图片URL，支持不同尺寸和质量
 */

/**
 * 图片尺寸预设
 */
export enum ImageSize {
  /** 缩略图：用于列表、网格等小图展示 */
  THUMBNAIL = 'thumbnail',
  /** 中等尺寸：用于卡片、详情页预览 */
  MEDIUM = 'medium',
  /** 大图：用于详情页、全屏查看 */
  LARGE = 'large',
  /** 原始尺寸：不进行优化 */
  ORIGINAL = 'original',
}

/**
 * 图片尺寸配置
 */
const IMAGE_SIZE_CONFIG: Record<ImageSize, { width: number; quality?: number }> = {
  [ImageSize.THUMBNAIL]: { width: 300, quality: 75 },
  [ImageSize.MEDIUM]: { width: 800, quality: 85 },
  [ImageSize.LARGE]: { width: 1200, quality: 90 },
  [ImageSize.ORIGINAL]: { width: 0, quality: 100 },
};

/**
 * 检查URL是否为Supabase Storage URL
 */
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co') && url.includes('/storage/v1/object/public/');
}

/**
 * 从Supabase Storage URL中提取文件路径
 */
function extractStoragePath(url: string): string | null {
  if (!isSupabaseStorageUrl(url)) {
    return null;
  }
  
  // Supabase Storage URL格式: https://xxx.supabase.co/storage/v1/object/public/bucket/path
  const match = url.match(/\/storage\/v1\/object\/public\/([^?]+)/);
  return match ? match[1] : null;
}

/**
 * 生成优化后的图片URL
 * 
 * 注意：Supabase Storage 本身不支持图片转换，但我们可以：
 * 1. 使用第三方图片优化服务（如 Cloudinary, Imgix）
 * 2. 或者在上传时生成多个尺寸
 * 
 * 当前实现：返回原始URL，但添加了尺寸标识用于后续优化
 * 
 * @param url 原始图片URL
 * @param size 目标尺寸
 * @returns 优化后的图片URL
 */
export function getOptimizedImageUrl(
  url: string,
  size: ImageSize = ImageSize.MEDIUM
): string {
  if (!url || url.trim() === '') {
    return url;
  }

  // 如果不是Supabase Storage URL，直接返回
  if (!isSupabaseStorageUrl(url)) {
    return url;
  }

  // 如果请求原始尺寸，直接返回
  if (size === ImageSize.ORIGINAL) {
    return url;
  }

  // 获取配置
  const config = IMAGE_SIZE_CONFIG[size];
  
  // TODO: 如果未来集成了图片优化服务（如 Cloudinary），可以在这里添加转换逻辑
  // 例如：return `${url}?width=${config.width}&quality=${config.quality}`;
  
  // 当前返回原始URL，但可以添加查询参数用于标识
  // 这样前端可以根据需要选择是否使用优化服务
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_size=${size}&_width=${config.width}`;
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
