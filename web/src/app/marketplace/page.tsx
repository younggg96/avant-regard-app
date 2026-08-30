"use client";

/**
 * /marketplace —— 交易大厅.
 *
 * 对齐移动端 `frontend/src/screens/Marketplace/MarketplaceScreen.tsx`：
 *   - 搜索框 + 下拉建议（品牌 / 单品 / 秀场 / 关键词）
 *   - 热门品牌横滑 + 「更多」全品牌弹层
 *   - 「大家都在看」策展位（仅在无筛选的默认视图出现）
 *   - 富筛选（品类 / 成色 / 颜色 / 尺码 / 卖家类型 / 价格区间）+ 排序
 *   - 结果网格 + 分页
 *
 * 状态全部落在 URL 上（q / sort / page + 各筛选维度），分享与刷新友好，
 * 浏览器前进后退也能用。价格输入在面板内部本地暂存，失焦或回车才写 URL。
 *
 * 与 `/stores`（买手店）是两条独立的线：这里卖的是 C2C 单品，
 * 详情页走 `/listings/[id]`（没有 storeId）。
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, X } from "lucide-react";
import useSWR from "swr";

import { EmptyState, LoadingState } from "@/components/admin/ui";
import { ListingCard } from "@/components/trading/ListingCard";
import {
  countActiveFilters,
  filterStateToQuery,
  MarketplaceFilters,
  parseFilterState,
  toFilterParams,
  type MarketplaceFilterState,
} from "@/components/trading/MarketplaceFilters";
import {
  marketplaceService,
  type MarketplaceSearchSuggestion,
  type MarketplaceSort,
} from "@/lib/services/marketplace";

const PAGE_SIZE = 24;
const SUGGESTION_DEBOUNCE_MS = 250;

const SORT_OPTIONS: ReadonlyArray<{ value: MarketplaceSort; labelKey: string }> =
  [
    { value: "newest", labelKey: "trading.marketplace.sortNewest" },
    { value: "featured", labelKey: "trading.marketplace.sortFeatured" },
    { value: "price_asc", labelKey: "trading.marketplace.sortPriceAsc" },
    { value: "price_desc", labelKey: "trading.marketplace.sortPriceDesc" },
  ];

function MarketplacePageInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();

  const q = sp.get("q") || "";
  const sort = (sp.get("sort") as MarketplaceSort | null) || "newest";
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const filters = useMemo(() => parseFilterState(sp), [sp]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [brandsModalOpen, setBrandsModalOpen] = useState(false);

  const patchUrl = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const qs = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") qs.delete(k);
        else qs.set(k, String(v));
      }
      const s = qs.toString();
      router.replace(`/marketplace${s ? `?${s}` : ""}`);
    },
    [router, sp],
  );

  const filterParams = useMemo(() => toFilterParams(filters), [filters]);
  const activeCount = countActiveFilters(filters);
  /** 默认视图 = 无搜索词、无筛选、第一页。策展位只在这时出现。 */
  const isDefaultView = !q && activeCount === 0 && page === 1;

  const { data, isLoading, error } = useSWR(
    ["marketplace-listings", q, sort, page, filterParams],
    () =>
      marketplaceService.search({
        ...filterParams,
        q: q || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const { data: popularBrands = [] } = useSWR(
    ["marketplace-popular-brands"],
    () => marketplaceService.popularBrands(10),
    { revalidateOnFocus: false },
  );

  const { data: curated = [] } = useSWR(
    isDefaultView ? ["marketplace-curated"] : null,
    () => marketplaceService.curated(8),
    { revalidateOnFocus: false },
  );

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 筛选变化后回到第一页，否则会停在一个空的尾页上。
  const setFiltersAndReset = (next: MarketplaceFilterState) => {
    patchUrl({ ...filterStateToQuery(next), page: undefined });
  };

  return (
    <section className="mx-auto max-w-content px-6 py-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
            {t("trading.marketplace.title")}
          </h1>
          <p className="mt-2 font-serif text-[15px] text-black/60 dark:text-white/50">
            {t("trading.marketplace.subtitle")}
          </p>
        </div>
        <Link
          href="/me/listings/new"
          className="rounded bg-[var(--ink)] px-4 py-2 font-label text-[12px] text-[var(--canvas)] transition-opacity hover:opacity-80"
        >
          {t("trading.publishListing")}
        </Link>
      </header>

      <SearchBox
        value={q}
        onSubmit={(next) => patchUrl({ q: next, page: undefined })}
        onPickBrand={(brand) => {
          // 必须一次写完：两次 patchUrl 读的是同一份 sp 快照，
          // 后一次会把前一次刚写进去的品牌参数覆盖掉。
          patchUrl({
            ...filterStateToQuery({ ...filters, brands: [brand] }),
            q: undefined,
            page: undefined,
          });
        }}
      />

      {popularBrands.length > 0 && (
        <div className="mb-6 mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {t("trading.marketplace.popularBrands")}
            </h2>
            <button
              type="button"
              onClick={() => setBrandsModalOpen(true)}
              className="font-label text-[12px] text-[color:var(--ink-muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
            >
              {t("trading.marketplace.allBrands")}
            </button>
          </div>
          <div className="-mx-6 overflow-x-auto px-6">
            <div className="flex min-w-max gap-4">
              {popularBrands.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() =>
                    setFiltersAndReset({ ...filters, brands: [b.name] })
                  }
                  className="w-[76px] shrink-0 text-center"
                >
                  <span className="block size-[68px] overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas-raised)]">
                    {b.imageUrl && (
                      <Image
                        src={b.imageUrl}
                        alt={b.name}
                        width={68}
                        height={68}
                        className="size-full object-cover"
                      />
                    )}
                  </span>
                  <span className="mt-1.5 block truncate font-label text-[11px] text-[var(--ink)]">
                    {b.name}
                  </span>
                  <span className="block font-label text-[10px] text-[color:var(--ink-muted)]">
                    {t("trading.marketplace.listingCount", {
                      count: b.listingCount,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDefaultView && curated.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("trading.marketplace.curated")}
          </h2>
          <div className="-mx-6 overflow-x-auto px-6">
            <div className="flex min-w-max gap-4">
              {curated.map((p) => (
                <div key={p.id} className="w-[160px] shrink-0">
                  <ListingCard listing={p} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 结果栏：数量 + 排序 + 窄屏筛选入口 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="relative inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-label text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--ink)] lg:hidden"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t("trading.marketplace.filters")}
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-[var(--ink)] px-1.5 font-label text-[10px] text-[var(--canvas)]">
                {activeCount}
              </span>
            )}
          </button>
          <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("trading.marketplace.resultCount", { count: total })}
          </span>
        </div>
        <select
          value={sort}
          onChange={(e) => patchUrl({ sort: e.target.value, page: undefined })}
          className="rounded border border-[var(--border)] bg-[var(--canvas)] px-2.5 py-1.5 font-label text-[12px] text-[var(--ink)] outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={`${panelOpen ? "block" : "hidden"} lg:block`}>
          <MarketplaceFilters state={filters} onChange={setFiltersAndReset} />
        </aside>

        <div>
          {error ? (
            <p className="py-16 text-center font-label text-[13px] text-red-600">
              {error instanceof Error ? error.message : t("common.loadFailed")}
            </p>
          ) : isLoading && products.length === 0 ? (
            <LoadingState />
          ) : products.length === 0 ? (
            <EmptyState message={t("trading.marketplace.empty")} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ListingCard key={p.id} listing={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3 font-label text-[12px]">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => patchUrl({ page: page - 1 })}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-40"
              >
                {t("common.previousPage")}
              </button>
              <span className="text-[color:var(--ink-muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => patchUrl({ page: page + 1 })}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-40"
              >
                {t("common.nextPage")}
              </button>
            </div>
          )}
        </div>
      </div>

      {brandsModalOpen && (
        <AllBrandsModal
          onClose={() => setBrandsModalOpen(false)}
          onPick={(brand) => {
            setFiltersAndReset({ ...filters, brands: [brand] });
            setBrandsModalOpen(false);
          }}
        />
      )}
    </section>
  );
}

// ───────────────────────── 搜索框 + 下拉建议 ─────────────────────────

function SearchBox({
  value,
  onSubmit,
  onPickBrand,
}: {
  value: string;
  onSubmit: (q: string) => void;
  onPickBrand: (brand: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [suggestions, setSuggestions] = useState<MarketplaceSearchSuggestion[]>(
    [],
  );
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(value), [value]);

  // 输入建议：防抖 250ms，避免每敲一个字母打一次后端。
  useEffect(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      marketplaceService
        .searchSuggestions(trimmed)
        .then((res) => {
          if (!cancelled) setSuggestions(res);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, SUGGESTION_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);

  // 点击外部收起下拉。
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (s: MarketplaceSearchSuggestion) => {
    setOpen(false);
    if (s.type === "brand" && s.brand) {
      onPickBrand(s.brand);
      return;
    }
    if (s.type === "product" && s.productId) {
      router.push(`/listings/${s.productId}`);
      return;
    }
    if (s.type === "show" && s.showId) {
      router.push(`/archive/shows/${s.showId}`);
      return;
    }
    setDraft(s.query);
    onSubmit(s.query);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setOpen(false);
            onSubmit(draft.trim());
          }
        }}
        placeholder={t("trading.marketplace.searchPlaceholder")}
        className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2.5 font-label text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ink)]"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[360px] overflow-y-auto rounded border border-[var(--border)] bg-[var(--canvas)] py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.type}-${s.label}-${i}`}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--canvas-raised)]"
              >
                {s.imageUrl ? (
                  <Image
                    src={s.imageUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="size-8 shrink-0 rounded bg-[var(--canvas-raised)]" />
                )}
                <span className="min-w-0 flex-1 truncate font-label text-[13px] text-[var(--ink)]">
                  {s.label}
                </span>
                <span className="shrink-0 font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                  {t(`trading.marketplace.suggestion_${s.type}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── 全品牌弹层 ─────────────────────────

function AllBrandsModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (brand: string) => void;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useSWR(
    ["marketplace-all-brands", keyword],
    () => marketplaceService.allBrands({ keyword, pageSize: 120 }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const brands = data?.brands ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-[var(--border)] bg-[var(--canvas)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="font-serif text-[18px] text-[var(--ink)]">
            {t("trading.marketplace.allBrands")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("trading.marketplace.brandSearchPlaceholder")}
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] outline-none focus:border-[var(--ink)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && brands.length === 0 ? (
            <LoadingState />
          ) : brands.length === 0 ? (
            <EmptyState message={t("trading.marketplace.noBrands")} />
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {brands.map((b) => (
                <button
                  key={`${b.brandId ?? "x"}-${b.name}`}
                  type="button"
                  onClick={() => onPick(b.name)}
                  className="text-center"
                >
                  <span className="block aspect-square overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas-raised)]">
                    {b.imageUrl && (
                      <Image
                        src={b.imageUrl}
                        alt={b.name}
                        width={96}
                        height={96}
                        className="size-full object-cover"
                      />
                    )}
                  </span>
                  <span className="mt-1.5 block truncate font-label text-[11px] text-[var(--ink)]">
                    {b.name}
                  </span>
                  <span className="block font-label text-[10px] text-[color:var(--ink-muted)]">
                    {b.listingCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplacePageInner />
    </Suspense>
  );
}
