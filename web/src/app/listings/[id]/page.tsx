/**
 * /listings/[id] —— C2C 单品详情页 SSR 壳.
 *
 * 为什么不复用 `/stores/[id]/products/[productId]`：个人卖家的单品没有
 * storeId，构造不出那条路径。交易大厅、报价中心、我的发布都指向这里。
 *
 * 这里只负责 SEO metadata + 404 兜底，交互全在 `<ListingDetailView>`。
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { config } from "@/lib/config";
import { getServerT } from "@/lib/i18n/server";
import type { Listing } from "@/lib/services/listing";
import { ListingDetailView } from "@/app/listings/[id]/view";

export const revalidate = 60;

/**
 * 服务端直取公开单品端点，匿名可访问；解包 FastAPI `{code, message, data}`
 * 信封。不走 `apiClient`（它依赖客户端 zustand auth store）。
 */
async function fetchListing(productId: string): Promise<Listing | null> {
  try {
    const res = await fetch(
      `${config.apiBaseUrl}/api/store-merchants/products/${encodeURIComponent(productId)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: number; data?: Listing };
    if (json && typeof json === "object" && "code" in json) {
      return json.code === 0 && json.data ? json.data : null;
    }
    return json as unknown as Listing;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const t = getServerT();
  const { id } = await params;
  const listing = await fetchListing(id);
  if (!listing) return { title: t("productMeta.fallbackTitle") };
  return {
    title: t("productMeta.titleTemplate", { name: listing.title }),
    description: listing.description ?? listing.title,
    openGraph: {
      title: listing.title,
      description: listing.description ?? listing.title,
      images: listing.images?.[0] ? [listing.images[0]] : undefined,
    },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await fetchListing(id);
  if (!listing) notFound();
  return <ListingDetailView initialListing={listing} />;
}
