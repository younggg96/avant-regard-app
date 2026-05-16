"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth/store";
import { userInfoService } from "@/lib/services/user-info";

/**
 * One-shot bridge that pulls the signed-in user's `preferredTheme` from the
 * backend and hands it to next-themes — but only when the browser doesn't
 * already know what the user prefers.
 *
 * Why one-shot:
 *   1. The user's manual toggle (ThemeToggle / ThemeSegmented) is the source
 *      of truth as soon as it fires. If a slower in-flight GET resolved with
 *      the *previous* server value, calling `setTheme` again would visibly
 *      flip the page back, which read as light/dark "flicker" on /atlas.
 *   2. React Strict Mode (dev) double-mounts effects, so a naive sync
 *      would fire two parallel GETs and two `setTheme` calls per session.
 *   3. After the first sync we mark the user as synced; subsequent renders
 *      don't re-run, even if the user object reference churns elsewhere.
 *
 * On error we deliberately leave next-themes alone — falling back to
 * "system" would override whatever choice the user already made locally.
 */
export function ThemePreferenceSync() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { setTheme } = useTheme();
  const syncedUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    const userId = user?.userId;
    if (!userId) return;
    if (syncedUserIdRef.current === userId) return;
    if (user?.preferredTheme) {
      syncedUserIdRef.current = userId;
      return;
    }
    syncedUserIdRef.current = userId;

    let cancelled = false;
    userInfoService
      .get(userId)
      .then((info) => {
        if (cancelled) return;
        const preferredTheme = info.preferredTheme;
        if (
          preferredTheme === "system" ||
          preferredTheme === "light" ||
          preferredTheme === "dark"
        ) {
          setTheme(preferredTheme);
          updateUser({ preferredTheme });
        }
      })
      .catch(() => {
        /* keep whatever next-themes already resolved */
      });
    return () => {
      cancelled = true;
    };
  }, [setTheme, updateUser, user?.userId, user?.preferredTheme]);

  return null;
}
