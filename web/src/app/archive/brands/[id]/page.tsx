import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ApiError,
  getBrandById,
  getBrandPosts,
  getShowsByBrand,
  type Show,
} from "@/lib/api";
import { getServerT } from "@/lib/i18n/server";
import BrandDetailView from "./view";

export const revalidate = 300;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const t = getServerT();
  try {
    const brand = await getBrandById(params.id);
    if (!brand) return { title: t("archiveBrandDetail.fallbackTitle") };
    return {
      title: `${brand.name} · ${t("archiveBrandDetail.metaTitleSuffix")}`,
      description:
        [
          brand.country,
          brand.category,
          brand.founder && t("archiveBrandDetail.metaFoundedBy", { founder: brand.founder }),
        ]
          .filter(Boolean)
          .join(" · ") || `${brand.name}${t("archiveBrandDetail.metaDescSuffix")}`,
      alternates: { canonical: `/archive/brands/${brand.id}` },
      openGraph: {
        title: brand.name,
        images: brand.coverImage ? [{ url: brand.coverImage }] : undefined,
      },
    };
  } catch {
    return { title: t("archiveBrandDetail.fallbackTitle") };
  }
}

export default async function BrandDetailPage({ params }: PageProps) {
  try {
    const brand = await getBrandById(params.id);
    if (!brand) notFound();

    const [shows, posts] = await Promise.all([
      getShowsByBrand(brand.name).catch(() => [] as Show[]),
      getBrandPosts(brand.id).catch(() => []),
    ]);

    return <BrandDetailView brand={brand} shows={shows} posts={posts} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
