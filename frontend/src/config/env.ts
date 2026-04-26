/**
 * 环境变量配置
 * 从 .env 文件读取环境变量
 */

import {
  EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WECHAT_APP_ID,
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK,
} from "@env";

export const config = {
  EXPO_PUBLIC_API_BASE_URL: EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080",
  EXPO_PUBLIC_WECHAT_APP_ID: EXPO_PUBLIC_WECHAT_APP_ID || "",
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK: EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || "",
} as const;

export default config;
