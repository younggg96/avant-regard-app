/**
 * /stores/[id] — 买手店详情页（服务端壳）.
 *
 * 这里只负责 SEO metadata 和 404 兜底：
 *   - 服务端拉一次 `getStoreById` 拿 title / description；
 *   - 把实际渲染委托给客户端 `<StoreDetailView>`，因为顶部 Tab 切换、入口卡片
 *     点击跳 Tab、关注按钮、商品网格加载更多都需要客户端交互，不适合 SSR.
 *
 * 渲染职责 := metadata + 404；UI := StoreDetailView.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreById } from "@/lib/api";
import { StoreDetailView } from "./view";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const store = await getStoreById(id);
  if (!store) return { title: "买手店 | Avant Regard" };
  return {
    title: `${store.name} · 买手店 | Avant Regard`,
    description: store.description ?? `${store.name} · ${store.city}`,
    openGraph: {
      title: store.name,
      description: store.description ?? `${store.name} · ${store.city}`,
      images: store.images?.[0] ? [store.images[0]] : undefined,
    },
  };
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStoreById(id);
  if (!store) notFound();

  return <StoreDetailView initialStore={store} />;
}
