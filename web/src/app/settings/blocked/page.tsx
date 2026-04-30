"use client";

/**
 * /settings/blocked — list of users I've blocked.
 *
 * Each row shows the user plus an "取消屏蔽" action. Unblocking is optimistic:
 * remove the row locally, fire the DELETE, roll back on error.
 */

import Image from "next/image";
import { useTranslation } from "react-i18next";
import useSWR, { mutate } from "swr";
import { moderationService, type BlockedUser } from "@/lib/services/moderation";
import { isRenderableImage } from "@/lib/isRenderableImage";

export default function BlockedUsersPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR<BlockedUser[]>(
    ["blocked-users"],
    () => moderationService.getBlockedUsers(),
  );

  const onUnblock = async (u: BlockedUser) => {
    const prev = data ?? [];
    mutate<BlockedUser[]>(
      ["blocked-users"],
      (current) => (current ?? []).filter((x) => x.userId !== u.userId),
      { revalidate: false },
    );
    try {
      await moderationService.unblockUser(u.userId);
    } catch (err) {
      mutate<BlockedUser[]>(["blocked-users"], prev, { revalidate: false });
      alert(err instanceof Error ? err.message : t("settings.unblockFailed"));
    }
  };

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {t("settings.blockedUsers")}
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          {t("settings.blockedUsersDesc")}
        </p>
      </header>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("common.loadingEllipsis")}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-4 font-serif text-sm text-red-600 dark:text-red-400">
          {t("common.loadFailed")}：{(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          {t("settings.noBlockedUsers")}
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)] bg-[var(--canvas)]">
          {data.map((u) => (
            <li
              key={u.userId}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                {isRenderableImage(u.avatarUrl) && (
                  <Image
                    src={u.avatarUrl}
                    alt={u.username}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 truncate font-serif text-[15px] text-black dark:text-white">
                @{u.username}
              </div>
              <button
                type="button"
                onClick={() => onUnblock(u)}
                className="shrink-0 rounded border border-[var(--border)] px-3 py-1.5 font-label text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
              >
                {t("settings.unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
