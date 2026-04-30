"use client";

/**
 * 买手店列表视图（List Tab）.
 *
 * 职责：对齐移动端 `AllBuyerStoresScreen`，提供 2/3/4 列响应式网格 + 分页 +
 * "已入驻"徽章，点击卡片跳 `/stores/[id]`.
 *
 * 和 Map Tab 的关系：
 *   - 搜索关键字 / 国家 / 城市等共享 URL filter；由父 page 传下来；
 *   - 但 list 走分页端点 `/api/buyer-stores/all`，不和 map 共享 `allStores`
 *     的全量缓存（map 用全量给视口兜底，list 按页拉取更省带宽）；
 *   - 点击卡片：走 Link 跳转 `/stores/[id]`，不像 map 那样浮出抽屉 —— 因为
 *     list 本身没有"保留 map 视口"的需求，直接跳详情更顺；
 *
 * 状态：
 *   - page: 当前加载到第几页；filter 变化时 reset 为 1；
 *   - items: 累积分页结果；filter 变化时清空重拉；
 *   - hasMore: 来自后端 total，用来决定是否显示"加载更多"按钮.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAllBuyerStores,
  type BuyerStore,
  type BuyerStoreFilterParams,
} from "@/lib/services/buyer-store";
import {
  getCityDisplayName,
  getCountryDisplayName,
} from "@/components/stores/storeI18n";

const PAGE_SIZE = 30;

interface Props {
  /** 来自父级 URL filter 的搜索条件；变化即重置分页重新拉. */
  filters: Pick<
    BuyerStoreFilterParams,
    "country" | "city" | "brand" | "searchQuery" | "openOnly" | "style"
  >;
  /** 直接复用父级 useStoreFavorites 的 isFavorited 以避免构造 Set. */
  isFavorited: (storeId: string) => boolean;
}

export function StoresListView({ filters, isFavorited }: Props) {
  const [items, setItems] = useState<BuyerStore[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters 变化时 reset —— 用 JSON string 作为稳定 key，避免对象引用导致
  // 的无效重拉. 前端只依赖 filters 内容.
  const filterKey = JSON.stringify(filters);
  const filterKeyRef = useRef(filterKey);

  const loadPage = useCallback(
    async (targetPage: number, opts?: { append?: boolean }) => {
      const append = opts?.append ?? targetPage > 1;
      try {
        if (append) setIsLoadingMore(true);
        else setIsLoading(true);
        setError(null);
        const res = await getAllBuyerStores({
          ...filters,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setItems((prev) => (append ? [...prev, ...res.stores] : res.stores));
        setTotal(res.total ?? 0);
        setPage(targetPage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters],
  );

  // 初次挂载 + filter 变化：reset 到 page 1.
  useEffect(() => {
    filterKeyRef.current = filterKey;
    void loadPage(1, { append: false });
    // 故意只依赖 filterKey：loadPage 随 filters 更新，但 JSON 序列化已覆盖了内容变化.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const hasMore = items.length < total;

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20 font-label text-[13px] text-[color:var(--ink-muted)]">
        加载中…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="grid place-items-center gap-2 py-20 font-label text-[13px] text-[color:var(--ink-muted)]">
        <span className="text-red-600">{error}</span>
        <button
          onClick={() => loadPage(1, { append: false })}
          className="rounded border border-[var(--border)] px-3 py-1 text-[var(--ink)] hover:border-[var(--ink)]"
        >
          点击重试
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-20 font-label text-[13px] text-[color:var(--ink-muted)]">
        没有匹配的门店。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        共 {total} 家门店
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((s) => (
          <StoreCard
            key={s.id}
            store={s}
            isFavorited={isFavorited(s.id)}
          />
        ))}
      </ul>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => loadPage(page + 1, { append: true })}
            disabled={isLoadingMore}
            className="rounded border border-[var(--border)] bg-[var(--canvas)] px-5 py-2 font-label text-[13px] text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-50"
          >
            {isLoadingMore ? "加载中…" : `加载更多（剩余 ${total - items.length}）`}
          </button>
        </div>
      )}
    </div>
  );
}

function StoreCard({
  store,
  isFavorited,
}: {
  store: BuyerStore;
  isFavorited: boolean;
}) {
  const cover = store.images?.[0];
  return (
    <li>
      <Link
        href={`/stores/${encodeURIComponent(store.id)}`}
        className="group block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] transition-colors hover:border-[var(--ink)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--canvas-raised)]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={store.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              No image
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {store.hasMerchant && (
              <span className="rounded bg-[var(--ink)] px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-[var(--canvas)]">
                已入驻
              </span>
            )}
            {store.isOpen && (
              <span className="rounded bg-green-600 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-white">
                营业中
              </span>
            )}
          </div>
          {isFavorited && (
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 font-label text-[12px] text-white">
              ♥
            </span>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-serif text-[15px] text-[var(--ink)]">
              {store.name}
            </h3>
            {typeof store.favoriteCount === "number" && store.favoriteCount > 0 && (
              <span className="whitespace-nowrap font-label text-[11px] text-[color:var(--ink-muted)]">
                ♥ {store.favoriteCount}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {getCountryDisplayName(store.country)} ·{" "}
            {getCityDisplayName(store.city)}
          </div>
          {store.brands.length > 0 && (
            <div className="mt-2 truncate font-label text-[12px] italic text-[color:var(--ink-muted)]">
              {store.brands.slice(0, 3).join(" / ")}
              {store.brands.length > 3 && " …"}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
