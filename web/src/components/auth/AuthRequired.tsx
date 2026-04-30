"use client";

/**
 * Client-side auth guard.
 *
 * - While the Zustand store is still rehydrating, we render nothing to avoid
 *   a flash of "please log in" for already-logged-in users.
 * - Once hydrated, unauthenticated users are redirected to `/auth/login` with
 *   the current path preserved as the `next` param.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { useTranslation } from "react-i18next";

export function AuthRequired({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/auth/login?next=${next}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {t("auth.loadingAuth")}
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
