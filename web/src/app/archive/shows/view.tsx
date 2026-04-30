"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FadeImage } from "@/components/FadeImage";
import type { Show } from "@/lib/api";

function ShowTile({ show }: { show: Show }) {
  return (
    <Link
      href={`/archive/shows/${show.id}`}
      className="group block overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--canvas-raised)]">
        {show.coverImage && (
          <FadeImage
            src={show.coverImage}
            alt={show.title || `${show.brand} ${show.season}`}
            fill
            sizes="(max-width: 640px) 50vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate font-serif text-[13px] text-black dark:text-white">
          {show.brand}
        </p>
        <p className="mt-0.5 font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {show.season}
          {show.year ? ` · ${show.year}` : ""}
        </p>
      </div>
    </Link>
  );
}

interface ShowsViewProps {
  shows: Show[];
  total: number;
  page: number;
  totalPages: number;
  keyword?: string;
  year?: number;
  category?: string;
}

export default function ShowsView({
  shows,
  total,
  page,
  totalPages,
  keyword,
  year,
  category,
}: ShowsViewProps) {
  const { t } = useTranslation();

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    if (keyword) qs.set("keyword", keyword);
    if (category) qs.set("category", category);
    if (year) qs.set("year", String(year));
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/archive/shows?${s}` : "/archive/shows";
  };

  return (
    <section className="mx-auto max-w-content px-6 py-12 md:py-16">
      <header className="mb-10">
        <nav className="mb-4 font-label text-sm">
          <Link href="/archive/brands" className="link-muted">
            {t("archiveShows.backBrands")}
          </Link>
        </nav>
        <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
          {t("archiveShows.pageTitle")}
        </h1>
        <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
          {t("archiveShows.countLabel", { total, page, totalPages })}
        </p>
      </header>

      <form
        action="/archive/shows"
        method="get"
        className="mb-10 flex flex-wrap items-center gap-3"
      >
        <input
          type="search"
          name="keyword"
          defaultValue={keyword}
          placeholder={t("archiveShows.searchPlaceholder")}
          className="min-w-[240px] flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <input
          type="number"
          name="year"
          defaultValue={year}
          placeholder={t("archiveShows.yearPlaceholder")}
          className="w-24 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <input
          type="text"
          name="category"
          defaultValue={category}
          placeholder={t("archiveShows.categoryPlaceholder")}
          className="w-28 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-[var(--ink)] px-4 py-2 font-label text-[13px] text-[var(--canvas)] hover:opacity-85"
        >
          {t("archiveShows.filterBtn")}
        </button>
        {(keyword || year || category) && (
          <Link
            href="/archive/shows"
            className="font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {t("archiveShows.clearBtn")}
          </Link>
        )}
      </form>

      {shows.length === 0 ? (
        <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 text-center font-serif text-sm text-[color:var(--ink-muted)]">
          {t("archiveShows.noResults")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shows.map((s) => (
            <ShowTile key={s.id} show={s} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-2 font-label text-[13px]">
          {page > 1 && (
            <Link
              href={hrefFor(page - 1)}
              className="rounded border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--canvas-raised)]"
            >
              {t("archiveShows.prevPage")}
            </Link>
          )}
          <span className="px-3 text-[color:var(--ink-muted)]">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={hrefFor(page + 1)}
              className="rounded border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--canvas-raised)]"
            >
              {t("archiveShows.nextPage")}
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
