"use client";

/**
 * 店铺详情页 · 商品网格组件.
 *
 * 3 个主 Tab 全部复用这个组件：
 *   - 店铺首页 "近期上新" 区块 → preview=true, isNew=true, pageSize=8, 带"查看全部 →"
 *   - 全部商品 Tab → 全量分页，可叠加 categoryId / hasDiscount filter
 *   - 上新 Tab   → isNew=true，全量分页
 *
 * 设计：
 *   - filter 通过 props 传入；内部维护 page / items / loading；filter 改变时 reset page.
 *   - 商品点击跳 `/stores/[storeId]/products/[productId]` 新页.
 *   - 价格展示：有折扣价时红色粗体 + 原价划线；否则原价粗体.
 *
 * 为什么"近期上新"用同一个组件：预览 8 件就是 filter + pageSize 的特例，没必要
 * 再造一个；用 `preview` 属性控制"是否显示加载更多"和右上角的"查看全部 →".
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatPriceCents,
  storeProductService,
  type StoreProduct,
} from "@/lib/services/store-product";

export interface ProductGridFilters {
  categoryId?: number;
  isNew?: boolean;
  hasDiscount?: boolean;
  searchQuery?: string;
}

interface Props {
  storeId: string;
  filters?: ProductGridFilters;
  /** 预览模式：固定 pageSize、不显示加载更多、右上角展示"查看全部"链接. */
  preview?: {
    pageSize: number;
    title: string;
    viewAllHref: string;
  };
  /** 列数（sm 断点起算）；默认 2/3/4 响应式；详情页"近期上新"用 4 列铺满. */
  columns?: "default" | "dense";
}

const DEFAULT_PAGE_SIZE = 24;

export function StoreProductGrid({ storeId, filters, preview, columns = "default" }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 稳定 key 供 useEffect 依赖：filter 对象引用不保证稳定.
  const filterKey = JSON.stringify(filters ?? {});

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setErr(null);
        const pageSize = preview?.pageSize ?? DEFAULT_PAGE_SIZE;
        const res = await storeProductService.listPublicProducts(storeId, {
          ...(filters ?? {}),
          page: targetPage,
          pageSize,
        });
        setItems((prev) => (append ? [...prev, ...res.products] : res.products));
        setTotal(res.total ?? 0);
        setPage(targetPage);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t("common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // storeId / preview.pageSize / filterKey 变化时重拉. filters 本体通过 JSON 序列化比较.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeId, preview?.pageSize, filterKey],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const hasMore = !preview && items.length < total;

  const gridClass =
    columns === "dense"
      ? "grid grid-cols-2 gap-4 md:grid-cols-4"
      : "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4";

  if (loading) {
    return (
      <div className={`${gridClass}`}>
        {Array.from({ length: preview?.pageSize ?? 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] animate-pulse rounded-lg bg-[var(--canvas-soft)]"
          />
        ))}
      </div>
    );
  }

  if (err && items.length === 0) {
    return (
      <div className="grid place-items-center gap-2 py-20 font-label text-[13px]">
        <span className="text-red-600">{err}</span>
        <button
          onClick={() => fetchPage(1, false)}
          className="rounded border border-[var(--border)] px-3 py-1 text-[var(--ink)] hover:border-[var(--ink)]"
        >
          {t("common.clickRetry")}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-20 font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("store.noProducts")}
      </div>
    );
  }

  return (
    <div>
      {preview && (
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-serif text-[18px] text-[var(--ink)]">
            {preview.title}
          </h3>
          <Link
            href={preview.viewAllHref}
            className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            {t("store.viewAll")}
          </Link>
        </div>
      )}

      <ul className={gridClass}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} storeId={storeId} />
        ))}
      </ul>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchPage(page + 1, true)}
            disabled={loadingMore}
            className="rounded border border-[var(--border)] bg-[var(--canvas)] px-5 py-2 font-label text-[13px] text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-50"
          >
            {loadingMore ? t("common.loadingEllipsis") : t("store.loadMore", { remaining: total - items.length })}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  storeId,
}: {
  product: StoreProduct;
  storeId: string;
}) {
  const cover = product.images?.[0];
  return (
    <li>
      <Link
        href={`/stores/${encodeURIComponent(storeId)}/products/${product.id}`}
        className="group block"
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-raised)]">
          {cover ? (
            // sizes 对应上面的列数：手机 2 列、md 3–4 列、xl 4 列。
            <Image
              src={cover}
              alt={product.title}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center font-label text-[11px] text-[color:var(--ink-muted)]">
              No image
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {product.isNew && (
              <span className="rounded bg-[var(--ink)] px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest text-[var(--canvas)]">
                NEW
              </span>
            )}
            {product.hasDiscount && (
              <span className="rounded bg-red-600 px-1.5 py-0.5 font-label text-[10px] uppercase tracking-widest text-white">
                SALE
              </span>
            )}
          </div>
        </div>
        <div className="mt-2">
          <h4 className="truncate font-serif text-[14px] text-[var(--ink)]">
            {product.title}
          </h4>
          {(product.brand || product.categoryName) && (
            <div className="mt-0.5 truncate font-label text-[11px] text-[color:var(--ink-muted)]">
              {product.brand || product.categoryName}
            </div>
          )}
          <div className="mt-1 flex items-baseline gap-2">
            {product.hasDiscount && product.discountPriceCents != null ? (
              <>
                <span className="font-serif text-[14px] font-semibold text-red-600">
                  {formatPriceCents(product.discountPriceCents, product.currency)}
                </span>
                <span className="font-label text-[11px] text-[color:var(--ink-muted)] line-through">
                  {formatPriceCents(product.priceCents, product.currency)}
                </span>
              </>
            ) : (
              <span className="font-serif text-[14px] font-semibold text-[var(--ink)]">
                {formatPriceCents(product.priceCents, product.currency)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
