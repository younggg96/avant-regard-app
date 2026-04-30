import type { Metadata } from "next";
import { ApiError, getShows } from "@/lib/api";
import { getServerT } from "@/lib/i18n/server";
import ShowsView from "./view";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("archiveShows.metaTitle"),
    description: t("archiveShows.metaDescription"),
    alternates: { canonical: "/archive/shows" },
  };
}

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

    return (
      <ShowsView
        shows={res.shows}
        total={res.total}
        page={page}
        totalPages={totalPages}
        keyword={keyword}
        year={Number.isNaN(year!) ? undefined : year}
        category={category}
      />
    );
  } catch (err) {
    if (err instanceof ApiError) {
      const t = getServerT();
      return (
        <p className="mx-auto max-w-content px-6 py-24 text-center font-serif text-[color:var(--ink-muted)]">
          {t("archiveShows.loadError", { message: err.message })}
        </p>
      );
    }
    throw err;
  }
}
