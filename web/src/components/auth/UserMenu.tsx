"use client";

/**
 * Header user menu.
 *
 * Anonymous state → "登录 / 注册" link.
 * Authenticated state → avatar + dropdown (我的 / 设置 / 登出).
 *
 * Uses a native `<details>` for zero-dependency outside-click + keyboard-escape
 * behaviour; styled via CSS so it feels like a Figma-designed dropdown.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/store";
import { logout as logoutApi } from "@/lib/auth/service";

export function UserMenu() {
  const router = useRouter();
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
          登录
        </Link>
        <Link
          href="/auth/register"
          className="rounded border border-[var(--ink)] px-3 py-1.5 text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
        >
          注册
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt={user.username}
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
              我的
            </MenuItem>
            <MenuItem href="/me/chats" onSelect={() => setOpen(false)}>
              私信
            </MenuItem>
            <MenuItem href="/me/notifications" onSelect={() => setOpen(false)}>
              通知
            </MenuItem>
            <MenuItem href="/settings" onSelect={() => setOpen(false)}>
              设置
            </MenuItem>
            {user.is_admin && (
              <MenuItem href="/admin" onSelect={() => setOpen(false)}>
                管理后台
              </MenuItem>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="border-t border-[var(--border)] px-3 py-2 text-left text-red-600 transition-colors hover:bg-[var(--canvas-raised)] dark:text-red-400"
            >
              登出
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
