/**
 * 环境变量配置
 * 从 .env 文件读取环境变量
 */

import {
  EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WEB_URL,
  EXPO_PUBLIC_WECHAT_APP_ID,
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
} from "@env";

// Marketing / compliance site that hosts public pages like /privacy.
// Flavor-specific because the two App Store apps point to different domains:
//   CN  → https://avantregard.com   (matches `api.avantregard.com`)
//   NA  → https://avantregards.com  (matches `api.avantregards.com`)
// Used by the SMS opt-in disclosure link so Twilio toll-free verification
// always points to the live Privacy URL of the same brand.
const DEFAULT_WEB_URL = "https://avantregard.com";

export const config = {
  EXPO_PUBLIC_API_BASE_URL: EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080",
  EXPO_PUBLIC_WEB_URL: EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL,
  EXPO_PUBLIC_WECHAT_APP_ID: EXPO_PUBLIC_WECHAT_APP_ID || "",
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK: EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || "",
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
} as const;

export default config;
