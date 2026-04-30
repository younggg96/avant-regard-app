"use client";

/**
 * /me/notifications — all notifications (read + unread).
 *
 * Renders a single flat, reverse-chronological feed (matches the mobile app).
 * Each item has:
 *  - unread dot indicator,
 *  - click handler → mark as read (optimistic) and navigate to actionData target,
 *  - inline delete button.
 *
 * "Mark all as read" is a top-right action that fires a single batched POST
 * and locally zeros the `isRead` flag on every row.
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useTranslation } from "react-i18next";
import {
  notificationService,
  type Notification,
} from "@/lib/services/notification";
import { isRenderableImage } from "@/lib/isRenderableImage";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isLoading, error } = useSWR<Notification[]>(
    ["notifications-all"],
    () => notificationService.getAll(),
    { refreshInterval: 30_000 },
  );

  const unreadCount = (data ?? []).filter((n) => !n.isRead).length;

  const onMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    mutate<Notification[]>(
      ["notifications-all"],
      (current) => (current ?? []).map((n) => ({ ...n, isRead: true })),
      { revalidate: false },
    );
  };

  const onItemClick = async (n: Notification) => {
    if (!n.isRead) {
      notificationService.markAsRead(n.id).catch(() => {});
      mutate<Notification[]>(
        ["notifications-all"],
        (current) =>
          (current ?? []).map((it) =>
            it.id === n.id ? { ...it, isRead: true } : it,
          ),
        { revalidate: false },
      );
    }

    const a = n.actionData;
    if (!a) return;
    if (a.externalUrl) {
      window.open(a.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (a.postId) {
      router.push(`/posts/${a.postId}`);
    } else if (a.userId) {
      router.push(`/users/${a.userId}`);
    }
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.delete(id);
    mutate<Notification[]>(
      ["notifications-all"],
      (current) => (current ?? []).filter((n) => n.id !== id),
      { revalidate: false },
    );
  };

  return (
    <section className="min-w-0">
      <header className="mb-6 flex items-end justify-between gap-3 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
            {t("notification.title")}
          </h1>
          <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
            {unreadCount > 0 ? t("notification.unreadCount", { count: unreadCount }) : t("notification.allRead")}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="font-label text-[12px] text-[var(--ink)] underline-offset-4 hover:underline"
          >
            {t("notification.markAllRead")}
          </button>
        )}
      </header>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("common.loading")}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-4 font-serif text-sm text-red-600 dark:text-red-400">
          {t("me.loadFailed")}：{(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          {t("notification.noNotifications")}
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)] bg-[var(--canvas)]">
          {data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onItemClick(n)}
                className={`flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--canvas-raised)] ${
                  !n.isRead ? "bg-[var(--canvas-soft)]" : ""
                }`}
              >
                <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                  {isRenderableImage(n.avatar) ? (
                    <Image
                      src={n.avatar}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-label text-[12px] uppercase text-[color:var(--ink-muted)]">
                      {n.type.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {!n.isRead && (
                    <span className="absolute right-0 top-0 block h-2.5 w-2.5 rounded-full border-2 border-[var(--canvas)] bg-red-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-[15px] text-black dark:text-white">
                      {n.title}
                    </span>
                    <span className="shrink-0 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                      {n.timestamp}
                    </span>
                  </div>
                  {n.message && (
                    <div className="mt-1 line-clamp-2 font-label text-[12px] text-[color:var(--ink-muted)]">
                      {n.message}
                    </div>
                  )}
                </div>

                {n.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                )}

                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onDelete(n.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onDelete(n.id, e as unknown as React.MouseEvent);
                  }}
                  className="shrink-0 self-center font-label text-[11px] text-[color:var(--ink-muted)] opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                >
                  {t("notification.deleteLabel")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
