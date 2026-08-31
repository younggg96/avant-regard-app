"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth/store";
import { logout as logoutApi } from "@/lib/auth/service";

export function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logoutLocal = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (!tgt.closest("[data-user-menu]")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hydrated) {
    return (
      <div
        aria-hidden
        className="h-8 w-8 rounded-full bg-[var(--canvas-raised)]"
      />
    );
  }

  if (!isAuthed || !user) {
    return (
      <div className="flex items-center gap-3 font-label text-[13px]">
        <Link href="/auth/login" className="link-muted hidden sm:inline">
          {t("auth.login")}
        </Link>
        <Link
          href="/auth/register"
          className="rounded border border-[var(--ink)] px-3 py-1.5 text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
        >
          {t("auth.register")}
        </Link>
      </div>
    );
  }

  const handleLogout = async () => {
    const token = useAuthStore.getState().getAccessToken();
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        /* best effort */
      }
    }
    logoutLocal();
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  const initial = (user.username || user.name || "A").trim().charAt(0).toUpperCase();

  return (
    <div data-user-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas-soft)] font-label text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
      >
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.username}
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--canvas)] shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-3">
            <div className="font-label text-[13px] font-medium text-[var(--ink)]">
              {user.username}
            </div>
            {user.phone && (
              <div className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                {user.phone}
              </div>
            )}
          </div>
          <nav className="flex flex-col py-1 font-label text-[13px]">
            <MenuItem href="/me" onSelect={() => setOpen(false)}>
              {t("userMenu.me")}
            </MenuItem>
            <MenuItem href="/me/chats" onSelect={() => setOpen(false)}>
              {t("userMenu.messages")}
            </MenuItem>
            <MenuItem href="/me/notifications" onSelect={() => setOpen(false)}>
              {t("userMenu.notifications")}
            </MenuItem>
            <MenuItem href="/settings" onSelect={() => setOpen(false)}>
              {t("userMenu.settings")}
            </MenuItem>
            {user.is_admin && (
              <MenuItem href="/admin" onSelect={() => setOpen(false)}>
                {t("userMenu.admin")}
              </MenuItem>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="border-t border-[var(--border)] px-3 py-2 text-left text-red-600 transition-colors hover:bg-[var(--canvas-raised)] dark:text-red-400"
            >
              {t("userMenu.logout")}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  children,
  onSelect,
}: {
  href: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onSelect}
      className="px-3 py-2 text-[var(--ink)] transition-colors hover:bg-[var(--canvas-raised)]"
    >
      {children}
    </Link>
  );
}
