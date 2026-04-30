import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ApiError,
  getCommunityBySlug,
  getCommunityPosts,
} from "@/lib/api";
import { formatCount } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { CommunityDetailView } from "./view";

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const t = getServerT();
  try {
    const c = await getCommunityBySlug(params.slug);
    return {
      title: `${c.name} · ${t("communitiesPage.pageTitle")}`,
      description:
        c.description ||
        t("communityDetail.metaDescTemplate", {
          name: c.name,
          memberCount: formatCount(c.memberCount),
          postCount: formatCount(c.postCount),
        }),
      alternates: { canonical: `/communities/${c.slug}` },
      openGraph: {
        title: c.name,
        description: c.description,
        images: c.coverUrl ? [{ url: c.coverUrl }] : undefined,
      },
    };
  } catch {
    return { title: t("communityDetail.fallbackTitle") };
  }
}

export default async function CommunityPage({ params }: PageProps) {
  try {
    const community = await getCommunityBySlug(params.slug);
    const posts = await getCommunityPosts(community.id).catch(() => []);

    return <CommunityDetailView community={community} posts={posts} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
