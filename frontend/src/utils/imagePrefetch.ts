/**
 * 图片预取：把即将出现在屏幕上的图片提前下到 expo-image 磁盘缓存。
 *
 * 典型用法：列表可见窗口变化时，对下一屏的 6–8 张封面调用
 * `prefetchImages`。用户滚到那里时图片已经在磁盘上，直接解码显示，
 * 不再有"灰块 → 慢慢加载"的过程。不要预取整页或 ORIGINAL，避免
 * 低优先级资源反过来抢占首屏带宽和蜂窝流量。
 *
 * 设计取舍：
 * - `cachePolicy: "disk"`：预取只落磁盘、不占内存缓存。真正显示时
 *   expo-image 从磁盘读 + 解码进内存，避免预取把可视图片挤出内存缓存。
 * - 会话级去重：同一个 URL 一个 app 生命周期内只发一次预取请求。
 *   feed 的 replay 模式会循环同一批帖子，没有这层去重每次翻页都会
 *   重复触发几十个 no-op 请求。
 * - 失败静默：预取是纯优化，任何失败都不影响正常显示路径（显示时
 *   会正常重新请求）。
 */
import { Image } from "expo-image";
import { getOptimizedImageUrl, ImageSize } from "./imageUtils";
import { isVideoUrl } from "../services/postService";

const prefetchedUrls = new Set<string>();

// 防御性上限：长会话（几小时刷 feed）里 Set 无限增长会浪费内存。
// 超过后整体清空 —— 代价只是老图可能多发一次 prefetch 请求，而那些
// 请求会命中磁盘缓存立即返回。
const MAX_TRACKED_URLS = 3000;

/**
 * 预取一批图片到磁盘缓存。
 *
 * @param uris 原始图片 URL（Storage 原图地址）
 * @param size 与真正显示时一致的尺寸预设 —— 必须匹配，否则预取的
 *   URL 和显示的 URL 不同，缓存不共享，预取白做。
 */
export function prefetchImages(
  uris: Array<string | null | undefined>,
  size: ImageSize = ImageSize.FEED_CARD
): void {
  const targets: string[] = [];
  for (const uri of uris) {
    if (!uri || isVideoUrl(uri)) continue;
    const optimized = getOptimizedImageUrl(uri, size);
    if (!optimized || prefetchedUrls.has(optimized)) continue;
    prefetchedUrls.add(optimized);
    targets.push(optimized);
  }
  if (targets.length === 0) return;

  if (prefetchedUrls.size > MAX_TRACKED_URLS) {
    prefetchedUrls.clear();
  }

  void Image.prefetch(targets, { cachePolicy: "disk" }).catch(() => {
    // 预取失败不影响显示路径，静默忽略。
  });
}
