import type { Metadata } from "next";
import Link from "next/link";
import { FadeImage } from "@/components/FadeImage";
import { ApiError, getShows, type Show } from "@/lib/api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "秀场 · Archive",
  description: "浏览 Avant Regard 收录的时装秀，按季度与年份筛选。",
  alternates: { canonical: "/archive/shows" },
};

interface Props {
  searchParams: {
    year?: string;
    category?: string;
    keyword?: string;
    page?: string;
  };
}

export default async function ShowsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const year = searchParams.year ? parseInt(searchParams.year, 10) : undefined;
  const category = searchParams.category || undefined;
  const keyword = searchParams.keyword || undefined;

  try {
    const res = await getShows({
      page,
      pageSize: 60,
      year: Number.isNaN(year!) ? undefined : year,
      category,
      keyword,
    });

    const totalPages = Math.max(
      1,
      Math.ceil(res.total / (res.pageSize ?? 60)),
    );

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
              ← 品牌档案
            </Link>
          </nav>
          <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
            秀场
          </h1>
          <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
            {res.total} 场 · 第 {page} / {totalPages} 页
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
            placeholder="搜索品牌、标题或设计师…"
            className="min-w-[240px] flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
          />
          <input
            type="number"
            name="year"
            defaultValue={year}
            placeholder="年份"
            className="w-24 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
          />
          <input
            type="text"
            name="category"
            defaultValue={category}
            placeholder="分类"
            className="w-28 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-[var(--ink)] px-4 py-2 font-label text-[13px] text-[var(--canvas)] hover:opacity-85"
          >
            筛选
          </button>
          {(keyword || year || category) && (
            <Link
              href="/archive/shows"
              className="font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            >
              清除
            </Link>
          )}
        </form>

        {res.shows.length === 0 ? (
          <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 text-center font-serif text-sm text-[color:var(--ink-muted)]">
            没有匹配的秀场。
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {res.shows.map((s) => (
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
                ← 上一页
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
                下一页 →
              </Link>
            )}
          </nav>
        )}
      </section>
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return (
        <p className="mx-auto max-w-content px-6 py-24 text-center font-serif text-[color:var(--ink-muted)]">
          秀场加载失败：{err.message}
        </p>
      );
    }
    throw err;
  }
}

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
