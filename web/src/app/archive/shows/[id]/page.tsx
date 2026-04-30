import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ApiError,
  getShowById,
  getShowPosts,
} from "@/lib/api";
import { getServerT } from "@/lib/i18n/server";
import ShowDetailView from "./view";

export const revalidate = 300;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const t = getServerT();
  try {
    const show = await getShowById(params.id);
    if (!show) return { title: t("archiveShowDetail.fallbackTitle") };
    const title = show.title || `${show.brand} ${show.season}`;
    return {
      title: `${title} · ${t("archiveShowDetail.fallbackTitle")}`,
      description: show.description || `${show.brand} ${show.season}${t("archiveShowDetail.metaDescSuffix")}`,
      alternates: { canonical: `/archive/shows/${show.id}` },
      openGraph: {
        title,
        images: show.coverImage ? [{ url: show.coverImage }] : undefined,
      },
    };
  } catch {
    return { title: t("archiveShowDetail.fallbackTitle") };
  }
}

export default async function ShowDetailPage({ params }: PageProps) {
  try {
    const show = await getShowById(params.id);
    if (!show) notFound();

    const posts = await getShowPosts(show.id).catch(() => []);

    return <ShowDetailView show={show} posts={posts} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
