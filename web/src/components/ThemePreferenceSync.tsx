"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth/store";
import { userInfoService } from "@/lib/services/user-info";

export function ThemePreferenceSync() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    userInfoService
      .get(user.userId)
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
        } else {
          setTheme("system");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTheme("system");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setTheme, updateUser, user?.userId]);

  return null;
}
