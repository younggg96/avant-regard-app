/**
 * Centralised runtime configuration for the web app.
 * Mirrors the role of frontend/src/config/env.ts on the mobile side.
 */

export const config = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
    "https://api.avantregard.com",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    "https://avantregard.com",
  appStoreUrl:
    process.env.NEXT_PUBLIC_APP_STORE_URL ||
    "https://apps.apple.com/app/avant-regard/id0000000000",
  playStoreUrl:
    process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
    "https://play.google.com/store/apps/details?id=com.avantregard",
} as const;

export type AppConfig = typeof config;
