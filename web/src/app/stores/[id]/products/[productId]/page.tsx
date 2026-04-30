/**
 * /stores/[id]/products/[productId] —— 商品详情页 SSR 壳.
 *
 * 职责：SEO metadata + 404 兜底. 交互部分（图片轮播 / 点赞 / 评论）落在
 * `<ProductDetailView>` 客户端组件里.
 *
 * 端点：`GET /api/store-merchants/products/{productId}` —— 未登录也能访问.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import type { StoreProduct } from "@/lib/services/store-product";
import { ProductDetailView } from "./view";

export const revalidate = 60;

/**
 * 服务端直取 `/api/store-merchants/products/{id}`，匿名可访问；解包
 * FastAPI `{code, message, data}` 信封. 不走 `apiClient`（它依赖客户端
 * zustand auth store），也不复用 `@/lib/api#request`（它未 export）.
 */
async function fetchProduct(productId: string): Promise<StoreProduct | null> {
  try {
    const res = await fetch(
      `${config.apiBaseUrl}/api/store-merchants/products/${encodeURIComponent(productId)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: number;
      data?: StoreProduct;
    };
    if (json && typeof json === "object" && "code" in json) {
      return json.code === 0 && json.data ? json.data : null;
    }
    return json as unknown as StoreProduct;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const product = await fetchProduct(productId);
  if (!product) return { title: "商品 | Avant Regard" };
  return {
    title: `${product.title} · 商品 | Avant Regard`,
    description: product.description ?? product.title,
    openGraph: {
      title: product.title,
      description: product.description ?? product.title,
      images: product.images?.[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}) {
  const { id: storeId, productId } = await params;
  const product = await fetchProduct(productId);
  if (!product) notFound();
  return <ProductDetailView storeId={storeId} initialProduct={product} />;
}
