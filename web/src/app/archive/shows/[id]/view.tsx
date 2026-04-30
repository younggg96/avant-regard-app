"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FadeImage } from "@/components/FadeImage";
import { PostCard } from "@/components/PostCard";
import type { Show } from "@/lib/api";
import type { Post } from "@/lib/types";

interface ShowDetailViewProps {
  show: Show;
  posts: Post[];
}

export default function ShowDetailView({ show, posts }: ShowDetailViewProps) {
  const { t } = useTranslation();

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <nav className="mb-10 flex items-center gap-3 font-label text-sm">
        <Link href="/archive/shows" className="link-muted">
          {t("archiveShowDetail.backShows")}
        </Link>
        {show.brand && (
          <>
            <span className="text-black/20 dark:text-white/20">/</span>
            <span className="text-[color:var(--ink-muted)]">{show.brand}</span>
          </>
        )}
      </nav>

      <header className="space-y-4">
        <p className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
          {show.season}
          {show.year ? ` · ${show.year}` : ""}
          {show.category ? ` · ${show.category}` : ""}
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
          {show.title || `${show.brand} ${show.season}`}
        </h1>
        {show.designer && (
          <p className="font-serif text-[15px] text-[color:var(--ink-muted)]">
            Designer · {show.designer}
          </p>
        )}
      </header>

      {show.coverImage && (
        <div className="relative mt-10 aspect-[4/5] w-full overflow-hidden rounded bg-[var(--canvas-raised)]">
          <FadeImage
            src={show.coverImage}
            alt={show.title || show.brand}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {show.description && (
        <p className="mt-10 whitespace-pre-wrap font-serif text-[16px] leading-relaxed text-black/75 dark:text-white/70">
          {show.description}
        </p>
      )}

      {show.showUrl && (
        <a
          href={show.showUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 inline-flex items-center gap-1 font-label text-[13px] text-[var(--ink)] underline-offset-4 hover:underline"
        >
          {t("archiveShowDetail.viewReport")}
        </a>
      )}

      <section className="mt-14 border-t pt-10 border-black/[0.06] dark:border-white/[0.08]">
        <h2 className="mb-6 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
          Related Posts · {posts.length}
        </h2>
        {posts.length === 0 ? (
          <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
            {t("archiveShowDetail.noPosts")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <PostCard key={p.id} post={p} priority={i < 4} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
