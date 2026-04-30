"use client";

/**
 * Client-side admin guard.
 *
 * Extends AuthRequired: waits for hydration, redirects unauthenticated
 * users to login, and bounces non-admin users back to `/`.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { useTranslation } from "react-i18next";

export function AdminRequired({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.user?.is_admin);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || "/admin");
      router.replace(`/auth/login?next=${next}`);
    } else if (!isAdmin) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, isAdmin, pathname, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {t("admin.loading")}
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return <>{children}</>;
}
