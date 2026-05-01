"use client";

/**
 * Shared "my posts collection" list component.
 *
 * Used by /me/likes, /me/favorites, /me/wants — three near-identical pages
 * that only differ in (1) the fetcher URL (2) the title/empty-copy. We keep
 * rendering in one place so headline tone and empty states stay in sync.
 */

import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { PostCard } from "@/components/PostCard";
import { useAuthStore } from "@/lib/auth/store";
import type { Post } from "@/lib/types";

interface MyPostListProps {
  title: string;
  description: string;
  emptyCopy: string;
  fetcher: (userId: number) => Promise<Post[]>;
  swrKey: string;
}

export function MyPostList({
  title,
  description,
  emptyCopy,
  fetcher,
  swrKey,
}: MyPostListProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId;

  const { data, error, isLoading } = useSWR<Post[]>(
    userId ? [swrKey, userId] : null,
    () => fetcher(userId!),
  );

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          {description}
        </p>
      </header>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("common.loadingEllipsis")}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-4 font-serif text-sm text-red-600 dark:text-red-400">
          {t("common.loadFailedWithMessage", {
            message: (error as Error).message,
          })}
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          {emptyCopy}
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((post, i) => (
            <PostCard key={post.id} post={post} priority={i < 4} />
          ))}
        </div>
      )}
    </section>
  );
}
