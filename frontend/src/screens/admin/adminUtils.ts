import { Alert } from "react-native";
import i18n from "@/i18n";
import { config } from "../../config/env";
import { useAuthStore } from "../../store/authStore";

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const formatAdminDate = (dateString: string) => {
  const date = new Date(dateString);
  const locale = i18n.language?.startsWith("zh") ? "zh-CN" : "en-US";
  return date.toLocaleDateString(locale);
};

export const getPostTypeName = (type: string) => {
  const key = `admin.postType_${type}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : type;
};

export const getLinkTypeName = (type: string) => {
  const key = `admin.linkType_${type}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : type;
};

/**
 * 图片上传选项。
 *
 * 历史 `uploadImageFromUri` 直接 `fetch` 没有任何超时 / 重试 / 取消机制,
 * 一旦网络中途断开 (移动信号切换 / 5G→Wi-Fi 抖动) fetch 会一直 pending,
 * 调用方 finally 永远不触发, UI 上的 spinner 卡死, 用户必须杀进程才能恢复.
 *
 * 新版本默认值:
 *   - timeoutMs   : 单次尝试最长 90s, 超时主动 abort.
 *   - maxAttempts : 失败时再重试 1 次 (共最多 2 次), 退避 ~800ms.
 *   - signal      : 调用方可以传一个外部 AbortController 实现"用户取消上传".
 */
export interface UploadImageOptions {
  /** 单次尝试的硬超时, 默认 90s. */
  timeoutMs?: number;
  /** 最大尝试次数 (含首次), 默认 2. 网络瞬断或 5xx 才会重试. */
  maxAttempts?: number;
  /** 调用方控制的取消 signal —— 取消时不会再重试, 立刻抛 "cancelled". */
  signal?: AbortSignal;
}

const UPLOAD_DEFAULT_TIMEOUT_MS = 90_000;
const UPLOAD_DEFAULT_ATTEMPTS = 2;

/** 用户主动取消时抛出的错误, 调用方据此区分"失败"与"取消". */
export class UploadCancelledError extends Error {
  constructor(message = "upload cancelled") {
    super(message);
    this.name = "UploadCancelledError";
  }
}

/**
 * 上传单张图片到后端 `/api/files/upload-image`, 自带超时 + 重试 + 取消.
 *
 * 失败语义:
 *   - 用户取消 (`options.signal.abort()`) → `UploadCancelledError`, 不重试.
 *   - 网络错误 / 超时 / HTTP 5xx → 重试到 maxAttempts, 仍失败抛 Error.
 *   - HTTP 4xx 或后端 `code !== 0` → 立即抛 Error, 不重试 (重试也无意义).
 */
export const uploadImageFromUri = async (
  uri: string,
  options: UploadImageOptions = {},
): Promise<string> => {
  const {
    timeoutMs = UPLOAD_DEFAULT_TIMEOUT_MS,
    maxAttempts = UPLOAD_DEFAULT_ATTEMPTS,
    signal: userSignal,
  } = options;

  const filename = uri.split("/").pop() || "image.jpg";
  const extMatch = /\.(\w+)$/.exec(filename);
  const contentType = extMatch ? `image/${extMatch[1].toLowerCase()}` : "image/jpeg";

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (userSignal?.aborted) throw new UploadCancelledError();

    const timeoutCtl = new AbortController();
    const timeoutTimer = setTimeout(
      () => timeoutCtl.abort(),
      timeoutMs,
    );
    const onUserAbort = () => timeoutCtl.abort();
    if (userSignal) userSignal.addEventListener("abort", onUserAbort);

    try {
      const formData = new FormData();
      formData.append("file", { uri, name: filename, type: contentType } as any);

      const token = useAuthStore.getState().getAccessToken();
      const response = await fetch(
        `${config.EXPO_PUBLIC_API_BASE_URL}/api/files/upload-image`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: timeoutCtl.signal,
        },
      );

      // HTTP 层错误: 5xx 走重试, 4xx 立即终止
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errMsg = `HTTP ${response.status} ${text || response.statusText || ""}`.trim();
        if (response.status >= 500 && attempt < maxAttempts) {
          lastError = new Error(errMsg);
        } else {
          throw new Error(errMsg);
        }
      } else {
        const data = await response.json();
        if (data?.code === 0 && data?.data?.url) {
          return data.data.url as string;
        }
        // 业务层错误码 —— 不重试, 重试结果一定一样.
        throw new Error(data?.message || i18n.t("admin.uploadFailed"));
      }
    } catch (err) {
      if (userSignal?.aborted) throw new UploadCancelledError();
      // AbortError (来自超时 controller) → 视为可重试网络问题
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || /aborted/i.test(err.message));
      const isNetwork =
        err instanceof TypeError && /network/i.test(String(err.message));
      lastError = err;
      if ((isAbort || isNetwork) && attempt < maxAttempts) {
        // 简单线性退避, 给网络一点恢复时间
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      if (attempt >= maxAttempts) {
        if (isAbort) {
          throw new Error(i18n.t("admin.uploadFailed"));
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timeoutTimer);
      if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(i18n.t("admin.uploadFailed"));
};

export const pickAndUploadImage = async (
  aspect: [number, number] = [1, 1]
): Promise<string | null> => {
  const ImagePicker = require("expo-image-picker");

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(i18n.t("common.permissionDenied"), i18n.t("common.photoPermissionRequired"));
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return uploadImageFromUri(result.assets[0].uri);
  }
  return null;
};
