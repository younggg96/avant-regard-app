import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 用户偏好类的 key, 通常不会跟随"清除缓存"一起被清掉.
 * 增删时注意同步 frontend/src/i18n/index.ts 等模块.
 */
const PRESERVED_KEYS: ReadonlySet<string> = new Set([
  "app_language",
]);

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
