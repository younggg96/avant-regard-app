"use client";

/**
 * /stores main page — map + list. Entirely client-rendered because:
 *  1. maplibre-gl needs window/document,
 *  2. filters must update the map and list in sync without a round-trip.
 *
 * Filters (country / city / brand / search / openOnly) live in URL search
 * params so the state is shareable & back-button friendly. Stores are fetched
 * via SWR with the filter params as the key.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { StoreMap, type LngLat } from "@/components/stores/StoreMap";
import { apiClient } from "@/lib/api-client";
import type { BuyerStore } from "@/lib/api";

interface StoreListResp {
  stores: BuyerStore[];
  total: number;
}

// How many stores the list + map should show by default. Rendering thousands
// of DOM markers chokes the browser and swamps the sidebar with content the
// user almost never scrolls through.
const NEARBY_LIMIT = 20;

// Haversine great-circle distance in kilometers. Good enough for sorting
// stores by proximity — we don't need geodesic precision.
function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasCoords = (s: BuyerStore): s is BuyerStore & { coordinates: LngLat } =>
  !!s.coordinates &&
  s.coordinates.latitude !== 0 &&
  s.coordinates.longitude !== 0;

// Mirrors the backend cap on `/api/buyer-stores` (`pageSize ∈ [1, 200]`).
// Requesting more than 200 in a single call returns HTTP 422.
const STORE_PAGE_MAX = 200;

/**
 * Pull every store matching `filters` by paging through `/api/buyer-stores`
 * at the backend's max page size. Uses bounded chunks so a filter that
 * matches thousands of rows still completes (stops when the accumulator
 * reaches `total` or a short page is returned).
 */
async function fetchAllStores(
  filters: Record<string, unknown>,
): Promise<StoreListResp> {
  const first = await apiClient.get<StoreListResp>(`/api/buyer-stores`, {
    ...filters,
    page: 1,
    pageSize: STORE_PAGE_MAX,
  });
  const acc: BuyerStore[] = [...first.stores];
  const total = first.total ?? acc.length;

  for (let page = 2; acc.length < total; page++) {
    const next = await apiClient.get<StoreListResp>(`/api/buyer-stores`, {
      ...filters,
      page,
      pageSize: STORE_PAGE_MAX,
    });
    if (!next.stores?.length) break;
    acc.push(...next.stores);
    if (next.stores.length < STORE_PAGE_MAX) break;
  }
  return { stores: acc, total };
}

// `useSearchParams()` must live under <Suspense> so `next build` can prerender
// the outer shell without bailing to full CSR. Inner component owns the hooks;
// default export below provides the boundary.
function StoresPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const filters = useMemo(
    () => ({
      country: sp.get("country") || undefined,
      city: sp.get("city") || undefined,
      brand: sp.get("brand") || undefined,
      searchQuery: sp.get("q") || undefined,
      openOnly: sp.get("open") === "1" ? true : undefined,
    }),
    [sp],
  );

  const { data, error, isLoading } = useSWR<StoreListResp>(
    ["buyer-stores", JSON.stringify(filters)],
    () => fetchAllStores(filters),
  );

  const stores = data?.stores ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Geolocation: requested once on mount, one-shot. Three possible outcomes:
  //   - granted  → `userPos` set, "nearby" mode becomes the default
  //   - denied / unavailable → `geoStatus` records the reason; we still
  //     trim the visible list to NEARBY_LIMIT so the sidebar doesn't explode
  //   - pending  → brief loading hint above the map
  const [userPos, setUserPos] = useState<LngLat | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "pending" | "granted" | "denied">("idle");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const hasActiveFilters = !!(
    filters.country ||
    filters.city ||
    filters.brand ||
    filters.searchQuery ||
    filters.openOnly
  );

  // Decide which stores surface on the map + list. Priority:
  //   1. "显示全部" toggled on → every store, unfiltered.
  //   2. User typed any filter → respect the filter; don't second-guess it
  //      with geolocation proximity.
  //   3. Geolocation granted → sort by distance from the user, take top N.
  //   4. Fallback (no location, no filters) → stable first-N slice so the
  //      sidebar stays readable instead of listing thousands of rows.
  const visibleStores = useMemo(() => {
    if (showAll) return stores;
    if (hasActiveFilters) return stores;
    if (userPos) {
      const withCoords = stores.filter(hasCoords);
      const sorted = withCoords
        .map((s) => ({ s, d: distanceKm(userPos, s.coordinates) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, NEARBY_LIMIT)
        .map((x) => x.s);
      return sorted;
    }
    return stores.slice(0, NEARBY_LIMIT);
  }, [stores, showAll, hasActiveFilters, userPos]);

  const onUpdate = (patch: Partial<Record<string, string>>) => {
    const qs = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") qs.delete(k);
      else qs.set(k, v);
    }
    const s = qs.toString();
    router.replace(`/stores${s ? `?${s}` : ""}`);
  };

  return (
    <section className="mx-auto max-w-content px-6 py-10 md:py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
          买手店地图
        </h1>
        <p className="mt-3 font-serif text-[15px] text-black/60 dark:text-white/50">
          探索全球收录的独立买手店。
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          key={filters.searchQuery ?? ""}
          defaultValue={filters.searchQuery ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate({ q: (e.target as HTMLInputElement).value });
            }
          }}
          placeholder="搜索店名 / 地址 / 品牌…"
          className="min-w-[240px] flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <input
          key={"country-" + (filters.country ?? "")}
          defaultValue={filters.country ?? ""}
          onBlur={(e) => onUpdate({ country: e.target.value })}
          placeholder="国家"
          className="w-28 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <input
          key={"city-" + (filters.city ?? "")}
          defaultValue={filters.city ?? ""}
          onBlur={(e) => onUpdate({ city: e.target.value })}
          placeholder="城市"
          className="w-28 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <input
          key={"brand-" + (filters.brand ?? "")}
          defaultValue={filters.brand ?? ""}
          onBlur={(e) => onUpdate({ brand: e.target.value })}
          placeholder="品牌"
          className="w-32 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          <input
            type="checkbox"
            checked={!!filters.openOnly}
            onChange={(e) => onUpdate({ open: e.target.checked ? "1" : "" })}
          />
          仅营业中
        </label>
        {(filters.country || filters.city || filters.brand || filters.searchQuery || filters.openOnly) && (
          <button
            type="button"
            onClick={() => router.replace("/stores")}
            className="font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
          >
            清除
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        {geoStatus === "pending" && <span>正在获取当前位置…</span>}
        {geoStatus === "granted" && !hasActiveFilters && !showAll && (
          <span>
            已按距离显示你附近的 {visibleStores.length} 家门店
          </span>
        )}
        {geoStatus === "denied" && !hasActiveFilters && !showAll && (
          <span>未开启定位，默认展示前 {visibleStores.length} 家门店</span>
        )}
        {hasActiveFilters && (
          <span>按筛选条件匹配 {stores.length} 家门店</span>
        )}
        {!hasActiveFilters && stores.length > visibleStores.length && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-label text-[12px] text-[var(--ink)] underline-offset-4 hover:underline"
          >
            {showAll ? "只显示附近" : `显示全部 ${stores.length} 家`}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <StoreMap
          stores={visibleStores}
          selectedId={selectedId}
          onSelect={(s) => setSelectedId(s.id)}
          userPosition={userPos}
        />

        <aside className="flex min-h-[480px] flex-col rounded border border-[var(--border)] bg-[var(--canvas-soft)]">
          <div className="border-b border-[var(--border)] px-4 py-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {isLoading
              ? "加载中…"
              : error
                ? "加载失败"
                : `${visibleStores.length} / ${data?.total ?? stores.length} 家门店`}
          </div>
          <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {visibleStores.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--canvas-raised)] ${
                    selectedId === s.id
                      ? "bg-[var(--canvas-raised)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[15px] text-black dark:text-white">
                      {s.name}
                    </span>
                    {s.isOpen && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-label text-[10px] uppercase text-green-700 dark:text-green-300">
                        Open
                      </span>
                    )}
                  </div>
                  <span className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                    {[s.country, s.city].filter(Boolean).join(" · ")}
                  </span>
                  {s.address && (
                    <span className="truncate font-label text-[12px] text-[color:var(--ink-muted)]">
                      {s.address}
                    </span>
                  )}
                  <Link
                    href={`/stores/${encodeURIComponent(s.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-flex items-center gap-1 font-label text-[11px] text-[var(--ink)] underline-offset-4 hover:underline"
                  >
                    查看详情 →
                  </Link>
                </button>
              </li>
            ))}
            {!isLoading && visibleStores.length === 0 && (
              <li className="px-4 py-6 text-center font-serif text-sm text-[color:var(--ink-muted)]">
                没有匹配的门店。
              </li>
            )}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={null}>
      <StoresPageInner />
    </Suspense>
  );
}
