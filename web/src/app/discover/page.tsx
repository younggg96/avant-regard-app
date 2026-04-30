import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { getFeed } from "@/lib/api";
import type { FeedItem } from "@/lib/types";
import { DiscoverPageView } from "@/app/discover/view";

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("meta.discoverTitle"),
    description: t("meta.discoverDescription"),
    alternates: { canonical: "/discover" },
  };
}

export const revalidate = 60;

export default async function DiscoverPage() {
  let items: FeedItem[] = [];
  let error: string | null = null;

  try {
    const feed = await getFeed({ limit: 30 });
    items = feed.items;
  } catch (err) {
    error = err instanceof Error ? err.message : null;
  }

  return <DiscoverPageView initialItems={items} initialError={error} />;
}
