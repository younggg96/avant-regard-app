import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Refresh token 的安全存储。
 *
 * 背景：以前 refresh token 和其它状态一起被 zustand persist 明文写进
 * AsyncStorage。refresh token 是长期有效的敏感凭证，一旦泄露等于账号被盗；
 * 而且 AsyncStorage 的写入失败被静默吞掉，导致「轮换后的新 refresh token 没
 * 存住 → 下次冷启动用旧 token → 401 → 被强制登出」——这是用户反馈「很久没
 * 用就要重新登录」的重要嫌疑之一。
 *
 * 这里把 refresh token 单独放进系统 Keychain / Keystore（iOS Keychain、
 * Android EncryptedSharedPreferences），并且每次写入后回读校验，写失败不再
 * 静默。Web 等没有 SecureStore 的平台回退到 AsyncStorage。
 */

const REFRESH_TOKEN_KEY = "avant-regard-refresh-token";

// SecureStore 仅在原生平台可用；Web/其它平台回退 AsyncStorage。
const canUseSecureStore = Platform.OS === "ios" || Platform.OS === "android";

// iOS Keychain 可访问性：设备首次解锁后即可读取，覆盖「后台被唤醒时刷新
// token」的场景（AFTER_FIRST_UNLOCK 比默认的 WHEN_UNLOCKED 更宽松，避免锁屏
// 状态下刷新失败）。
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * 写入 refresh token，并回读校验是否真的落盘。
 * @returns true 表示写入并校验成功；false 表示写入失败（调用方应记录日志）。
 */
export async function saveRefreshToken(token: string): Promise<boolean> {
  if (!token) {
    await deleteRefreshToken();
    return true;
  }
  try {
    if (canUseSecureStore) {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_KEY,
        token,
        secureStoreOptions
      );
    } else {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    }

    // 回读校验：确认新（轮换后的）token 真的落盘了。
    const stored = await getRefreshToken();
    const ok = stored === token;
    if (!ok) {
      console.error(
        "[auth] saveRefreshToken 写入后回读不一致，refresh token 可能未持久化"
      );
    }
    return ok;
  } catch (error) {
    console.error("[auth] saveRefreshToken 失败:", error);
    return false;
  }
}

/** 读取 refresh token；读不到返回 null。 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    if (canUseSecureStore) {
      return (await SecureStore.getItemAsync(
        REFRESH_TOKEN_KEY,
        secureStoreOptions
      )) ?? null;
    }
    return (await AsyncStorage.getItem(REFRESH_TOKEN_KEY)) ?? null;
  } catch (error) {
    console.error("[auth] getRefreshToken 失败:", error);
    return null;
  }
}

/** 删除 refresh token（登出时调用）。两处都清，避免残留。 */
export async function deleteRefreshToken(): Promise<void> {
  try {
    if (canUseSecureStore) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
    }
    // 无论平台都尝试清 AsyncStorage：兼容早期回退写入 / 迁移遗留。
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("[auth] deleteRefreshToken 失败:", error);
  }
}
