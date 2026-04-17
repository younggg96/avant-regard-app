"use client";

import { useEffect } from "react";
import { config } from "@/lib/config";

/**
 * On mobile devices, automatically send the visitor to the correct store
 * listing. Desktop users see the normal download page (both CTAs shown).
 *
 * Behaviour intentionally matches what most marketing sites do:
 *  - Only redirects when the URL contains `?auto=1` (opt-in, e.g. from
 *    QR codes or SMS shortlinks) to avoid trapping desktop-to-mobile
 *    inspection or crawlers.
 */
export function SmartRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") !== "1") return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      window.location.replace(config.appStoreUrl);
    } else if (isAndroid) {
      window.location.replace(config.playStoreUrl);
    }
  }, []);

  return null;
}
