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
  /**
   * App Store listing for the iOS app.
   * Only referenced by the dedicated `/app` landing page — the rest of the
   * web experience stays app-agnostic by design.
   */
  appStoreUrl:
    process.env.NEXT_PUBLIC_APP_STORE_URL ||
    "https://apps.apple.com/us/app/avant-regard/id6756938671",
} as const;

export type AppConfig = typeof config;
