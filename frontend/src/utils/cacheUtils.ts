import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import { useAuthStore } from "../store/authStore";

/**
 * 用户偏好类的 key, 通常不会跟随"清除缓存"一起被清掉.
 * 增删时注意同步 frontend/src/i18n/index.ts 等模块.
 */
const PRESERVED_KEYS: ReadonlySet<string> = new Set([
  "app_language",
]);

/**
 * 「内容缓存」key 的前缀白名单 —— 只登记那些可以从服务端重新拉回来、
 * 丢掉不产生任何用户可见损失的条目.
 *
 * 刻意用白名单而非黑名单: 以后新增的持久化 key (登录态 / 草稿 / 偏好 /
 * 本地记录) 默认不会被温和清理误删, 必须显式登记才会进这个集合.
 */
const CONTENT_CACHE_KEY_PREFIXES: readonly string[] = [
  // Discover 各 Tab 的首屏缓存, 见 services/feedCacheService.ts.
  // 推荐 Tab 的 key 因历史原因没有前缀, 单独列一条.
  "avant-regard-feed-cache",
  "avant-regard-tab-cache:",
  // 上次 JS 崩溃现场, 见 bootstrap/crashStorage.ts
  "__last_js_crash__",
];

function isContentCacheKey(key: string): boolean {
  return CONTENT_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * 清 expo-image 的内存 + 磁盘缓存.
 *
 * iOS 上 expo-image 底层是 SDWebImage, 磁盘缓存落在 app sandbox 的
 * `Library/Caches/com.hackemist.SDImageCache/`, 平时只有卸载重装才会被
 * 系统回收 —— 它通常也是整个 app 占用空间最大的一块.
 *
 * 顺序必须先内存后磁盘: 反过来的话已解码的 bitmap 还留在内存里,
 * 用户点完按钮在 UI 上看不到任何变化.
 *
 * 失败只返回 false 不抛: 调用方的 AsyncStorage 部分已经清成功了,
 * 不该因为图片缓存报错就把整个操作当成失败回滚.
 */
async function clearImageCache(): Promise<boolean> {
  try {
    await ExpoImage.clearMemoryCache();
    await ExpoImage.clearDiskCache();
    return true;
  } catch (error) {
    console.warn("[cacheUtils] clear image cache failed:", error);
    return false;
  }
}

export interface ClearLocalCacheOptions {
  /** 保留用户偏好(语言等). 默认 true. */
  preservePreferences?: boolean;
  /** 额外要保留的 key. */
  extraKeep?: string[];
}

export interface ClearLocalCacheResult {
  removed: number;
  kept: string[];
}

/**
 * 清除本地 AsyncStorage 缓存.
 *
 * 默认会保留语言偏好等 user preference key, 调用方可以通过 preservePreferences=false
 * 来强制全清. 不抛错时返回 { removed, kept }, 失败时抛.
 */
export async function clearLocalCache(
  options?: ClearLocalCacheOptions,
): Promise<ClearLocalCacheResult> {
  const preserve = options?.preservePreferences !== false;
  const extra = new Set(options?.extraKeep ?? []);

  const keys = await AsyncStorage.getAllKeys();
  const toKeep: string[] = [];
  const toRemove: string[] = [];

  for (const key of keys) {
    if ((preserve && PRESERVED_KEYS.has(key)) || extra.has(key)) {
      toKeep.push(key);
    } else {
      toRemove.push(key);
    }
  }

  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }

  return { removed: toRemove.length, kept: toKeep };
}

export interface ClearCacheResult {
  /** 被删掉的 AsyncStorage key 数量. */
  removedKeys: number;
  /**
   * 图片缓存是否清理成功. false 表示 expo-image 报错了 ——
   * AsyncStorage 那部分仍然已经清干净, 调用方可据此决定文案.
   */
  imageCacheCleared: boolean;
}

/**
 * 温和清理: 只清「可以重新拉回来的内容缓存」+ 图片缓存.
 *
 * 保留登录态、发帖草稿、语言/主题偏好、等级提示已读位 —— 用户点完不用
 * 重新登录, 也不会丢任何自己写过的东西, 代价只是下次冷启动少了首屏
 * 秒开的缓存、图片要重新下载一遍.
 *
 * 这是设置页「清除缓存」对应的行为.
 */
export async function clearContentCache(): Promise<ClearCacheResult> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(isContentCacheKey);

  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }

  const imageCacheCleared = await clearImageCache();
  return { removedKeys: toRemove.length, imageCacheCleared };
}

/**
 * 彻底重置: 清空整个 AsyncStorage (含登录态、草稿、语言偏好) + 图片缓存,
 * 并立刻清空内存里的登录态, 让本地状态等同于刚装完 app.
 *
 * 必须先停掉 token 自动刷新、再清落盘、最后 logout —— 否则 persist
 * 中间件会在下一次 set() (最常见的就是定时 refreshTokens) 把刚删掉的
 * `avant-regard-auth` 重新写回磁盘, 出厂重置等于白做.
 *
 * 语言偏好也会被清掉 (`preservePreferences: false`) —— 「等同刚装完」
 * 的语义要求如此, 重启后会回到默认语言.
 *
 * 聊天 / 通知 / 收藏等未持久化的内存 store 清不掉, 调用方仍应提示用户
 * 手动杀掉进程重开 —— 项目没有装 expo-updates / react-native-restart.
 *
 * 这是设置页「恢复出厂设置」对应的行为.
 */
export async function resetToFactoryState(): Promise<ClearCacheResult> {
  const auth = useAuthStore.getState();
  // 先停定时器, 避免清完磁盘后仍有 in-flight / 排队中的 refresh 写回 token.
  auth.stopAutoRefresh();

  const { removed } = await clearLocalCache({ preservePreferences: false });
  const imageCacheCleared = await clearImageCache();

  // 清内存登录态; persist 会把「已登出」快照写回 AsyncStorage,
  // 比留下一个空洞 key 更干净, 也立刻把用户踢回登录页.
  auth.logout();

  return { removedKeys: removed, imageCacheCleared };
}

/**
 * 登录页「报告问题」用的清缓存: 清掉 AsyncStorage 里除语言偏好外的全部
 * 数据 + 图片缓存. 比 clearContentCache 更彻底 (会清草稿), 但不会登出
 * —— 登录页本身就在未登录态, 不需要动 authStore.
 */
export async function clearLocalCacheKeepingPreferences(): Promise<ClearCacheResult> {
  const { removed } = await clearLocalCache({ preservePreferences: true });
  const imageCacheCleared = await clearImageCache();
  return { removedKeys: removed, imageCacheCleared };
}
