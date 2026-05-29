/**
 * 环境变量配置
 * 从 .env 文件读取环境变量
 */

import Constants from "expo-constants";
import {
  EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WEB_URL,
  EXPO_PUBLIC_WECHAT_APP_ID,
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
} from "@env";

/**
 * Which App Store flavor is this binary? The two variants are baked at
 * build time by `app.config.js` (driven by `APP_VARIANT`):
 *   CN → scheme "avantregard",   bundle id "com.yanggg96.avant-regard"
 *   NA → scheme "avantregardna", bundle id "com.yanggg96.avant-regard.na"
 * We detect it at runtime from the resolved Expo config so feature defaults
 * (e.g. the phone country code) can differ per region.
 */
function detectIsNorthAmerica(): boolean {
  const cfg = (Constants.expoConfig ?? (Constants as { manifest?: unknown }).manifest) as
    | {
        scheme?: string | string[];
        ios?: { bundleIdentifier?: string };
        android?: { package?: string };
      }
    | undefined;
  const rawScheme = cfg?.scheme;
  const scheme = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme;
  if (typeof scheme === "string" && scheme.toLowerCase() === "avantregardna") {
    return true;
  }
  const bundleId = cfg?.ios?.bundleIdentifier ?? cfg?.android?.package ?? "";
  return /\.na$/i.test(bundleId);
}

/** True on the North America (北美版) build, false on the China (中国版) build. */
export const IS_NA = detectIsNorthAmerica();

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
