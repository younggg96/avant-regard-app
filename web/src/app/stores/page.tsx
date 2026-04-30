"use client";

/**
 * /stores — 买手店.
 *
 * 两个 Tab：
 *   1. 列表（默认）：2 / 3 / 4 列响应式网格；走 `/api/buyer-stores/all`（入驻
 *      优先 + 每条带 `hasMerchant` 徽章）；点击卡片跳 `/stores/[id]`.
 *   2. 地图：视口驱动渲染 marker + 底部 aside 同步高亮，和 iOS BuyerMapScreen
 *      功能对齐 —— pan / zoom 触发 `/api/buyer-stores/viewport`，"附近"走
 *      `/api/buyer-stores/nearby`.
 *
 * 共享层：
 *   - URL filter  (country / city / brand / q / open / view) —— Tab 切换也走 URL,
 *     分享 / 刷新友好；
 *   - 高级筛选（styles / hasPhone）/ filterSheet / detailSheet；
 *   - 收藏 hook —— 两个 Tab 都需要显示 ♥ 徽章.
 *
 * 状态分区：
 *   - URL state (sp): country / city / brand / q / open / view
 *   - Local state:   advanced filters（styles / hasPhone）/ nearbyMode /
 *                     selectedStore / regionRef
 *   - Remote state:  countries, cities, 全量 stores（仅 map 兜底用）+
 *                     viewportStores（地图 + 底部卡片） + favorites.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  StoreMap,
  type LngLat,
  type MapRegion,
} from "@/components/stores/StoreMap";
import {
  StoreFilterSheet,
  type StoreFilters,
} from "@/components/stores/StoreFilterSheet";
import { StoreDetailSheet } from "@/components/stores/StoreDetailSheet";
import { StoresListView } from "@/components/stores/StoresListView";
import {
  getCityDisplayName,
  getCountryDisplayName,
} from "@/components/stores/storeI18n";
import {
  getAllStores,
  getNearbyStores,
  getStoreCities,
  getStoreCountries,
  getStoresInViewport,
  hasValidCoordinates,
  type BuyerStore,
} from "@/lib/services/buyer-store";
import { useStoreFavorites } from "@/lib/hooks/useStoreFavorites";

type ViewMode = "list" | "map";

/**
 * 顶部 Tab 按钮 —— 定义在 `StoresPageInner` 之前，规避 Next dev HMR 下
 * function declaration 不会被及时 hoist 的边缘情况.
 */
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 transition-colors ${
        active
          ? "border-[var(--ink)] text-[var(--ink)]"
          : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}

const NEARBY_RADIUS_KM = 100;
const VIEWPORT_DEBOUNCE_MS = 300;
const FAVORITE_COUNT_SYNC_DEBOUNCE_MS = 120;

// Haversine great-circle distance in km. Good enough for "is this store
// within 100km of the user" sorting.
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

function StoresPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // ---------- URL-driven filters (shareable state) ----------
  const urlFilters = useMemo(
    () => ({
      country: sp.get("country") || "",
      city: sp.get("city") || "",
      brand: sp.get("brand") || "",
      searchQuery: sp.get("q") || "",
      openOnly: sp.get("open") === "1",
    }),
    [sp],
  );

  // 视图模式：list 默认，map 走地图. view 也放 URL，刷新 / 分享都保留.
  const view: ViewMode = sp.get("view") === "map" ? "map" : "list";

  // ---------- Local advanced filters (too numerous for URL) ----------
  const [styles, setStyles] = useState<string[]>([]);
  const [hasPhone, setHasPhone] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const combinedFilters: StoreFilters = useMemo(
    () => ({ ...urlFilters, styles, hasPhone }),
    [urlFilters, styles, hasPhone],
  );

  const hasActiveFilters =
    !!urlFilters.country ||
    !!urlFilters.city ||
    !!urlFilters.brand ||
    !!urlFilters.searchQuery ||
    urlFilters.openOnly ||
    styles.length > 0 ||
    hasPhone;

  const activeFilterCount =
    (urlFilters.country ? 1 : 0) +
    (urlFilters.city ? 1 : 0) +
    (urlFilters.brand ? 1 : 0) +
    (urlFilters.searchQuery ? 1 : 0) +
    (urlFilters.openOnly ? 1 : 0) +
    (styles.length > 0 ? 1 : 0) +
    (hasPhone ? 1 : 0);

  // ---------- Full store set (used for filter counts + nearby fallback) ----------
  const {
    data: allStores,
    error: storesError,
    isLoading: isLoadingStores,
    mutate: reloadStores,
  } = useSWR<BuyerStore[]>(
    ["buyer-stores-all"],
    () => getAllStores(),
    { revalidateOnFocus: false },
  );
  // Memoize the safe-array alias so downstream `useMemo` / `useEffect`
  // don't re-run on every parent render (lint rule: exhaustive-deps).
  const stores = useMemo(() => allStores ?? [], [allStores]);

  const { data: countries = [] } = useSWR<string[]>(
    ["buyer-store-countries"],
    () => getStoreCountries(),
    { revalidateOnFocus: false },
  );

  const { data: cities = [] } = useSWR<string[]>(
    urlFilters.country
      ? ["buyer-store-cities", urlFilters.country]
      : null,
    () => getStoreCities(urlFilters.country),
    { revalidateOnFocus: false },
  );

  // Store-count aggregations for the chip rows and filter sheet. Computed
  // from the full set so counts don't jump around as filters change.
  const countryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stores) m[s.country] = (m[s.country] ?? 0) + 1;
    return m;
  }, [stores]);

  const cityCounts = useMemo(() => {
    const m: Record<string, number> = {};
    const scope = urlFilters.country
      ? stores.filter((s) => s.country === urlFilters.country)
      : stores;
    for (const s of scope) m[s.city] = (m[s.city] ?? 0) + 1;
    return m;
  }, [stores, urlFilters.country]);

  const sortedCountries = useMemo(
    () =>
      [...countries].sort(
        (a, b) => (countryCounts[b] ?? 0) - (countryCounts[a] ?? 0),
      ),
    [countries, countryCounts],
  );

  const sortedCities = useMemo(
    () =>
      [...cities].sort(
        (a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0),
      ),
    [cities, cityCounts],
  );

  // ---------- Geolocation + nearby mode ----------
  const [userPos, setUserPos] = useState<LngLat | null>(null);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "pending" | "granted" | "denied"
  >("idle");
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyStores, setNearbyStores] = useState<BuyerStore[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);

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
        // Auto-enable nearby mode once we have the location — mirrors the
        // iOS behavior where the map snaps to the user immediately.
        setNearbyMode(true);
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Fetch nearby stores whenever nearby mode is on and we have a location.
  useEffect(() => {
    if (!nearbyMode || !userPos) {
      setNearbyStores([]);
      return;
    }
    let cancelled = false;
    setIsNearbyLoading(true);
    getNearbyStores(userPos, NEARBY_RADIUS_KM)
      .then((result) => {
        if (!cancelled) setNearbyStores(result);
      })
      .catch(() => {
        // Fallback: compute locally from the full set when the API rejects.
        if (cancelled) return;
        const local = stores.filter((s) => {
          if (!hasValidCoordinates(s)) return false;
          return distanceKm(userPos, s.coordinates) <= NEARBY_RADIUS_KM;
        });
        setNearbyStores(local);
      })
      .finally(() => {
        if (!cancelled) setIsNearbyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nearbyMode, userPos, stores]);

  // ---------- Filtered store set (counts + "matches filter" logic) ----------
  // These are the stores that pass the *current* filter set; used both to
  // tell the user "N stores match" and to dim non-matching markers on the map.
  const filteredStores = useMemo(() => {
    if (nearbyMode) return nearbyStores;
    if (!hasActiveFilters) return stores;

    const q = urlFilters.searchQuery.toLowerCase();
    return stores.filter((s) => {
      if (urlFilters.country && s.country !== urlFilters.country) return false;
      if (urlFilters.city && s.city !== urlFilters.city) return false;
      if (urlFilters.brand) {
        const needle = urlFilters.brand.toLowerCase();
        const hit = s.brands.some((b) => b.toLowerCase().includes(needle));
        if (!hit) return false;
      }
      if (urlFilters.openOnly && !s.isOpen) return false;
      if (hasPhone && !(s.phone && s.phone.length > 0)) return false;
      if (styles.length > 0) {
        const storeStyles = s.style.map((x) => x.toLowerCase());
        const hitStyle = styles.some((sel) =>
          storeStyles.some((ss) => ss.includes(sel.toLowerCase())),
        );
        if (!hitStyle) return false;
      }
      if (q) {
        const hay = [
          s.name,
          s.address,
          s.city,
          s.country,
          ...(s.brands ?? []),
          ...(s.style ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    nearbyMode,
    nearbyStores,
    hasActiveFilters,
    stores,
    urlFilters.country,
    urlFilters.city,
    urlFilters.brand,
    urlFilters.openOnly,
    urlFilters.searchQuery,
    styles,
    hasPhone,
  ]);

  const filteredIdSet = useMemo(
    () => new Set(filteredStores.map((s) => s.id)),
    [filteredStores],
  );

  // ---------- Viewport-bound stores (rendered on the map) ----------
  const [viewportStores, setViewportStores] = useState<BuyerStore[] | null>(
    null,
  );
  const regionRef = useRef<MapRegion | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchViewport = useCallback(
    async (region: MapRegion) => {
      try {
        const result = await getStoresInViewport({
          ne_lat: region.ne_lat,
          ne_lng: region.ne_lng,
          sw_lat: region.sw_lat,
          sw_lng: region.sw_lng,
          country: urlFilters.country || undefined,
          city: urlFilters.city || undefined,
          brand: urlFilters.brand || undefined,
          style: styles.length === 1 ? styles[0] : undefined,
          styles: styles.length > 1 ? styles : undefined,
          openOnly: urlFilters.openOnly || undefined,
          hasPhone: hasPhone || undefined,
          searchQuery: urlFilters.searchQuery || undefined,
        });
        setViewportStores(result);
      } catch {
        // Fallback: filter the full set by the region rectangle.
        const local = stores.filter((s) => {
          if (!hasValidCoordinates(s)) return false;
          const { latitude, longitude } = s.coordinates;
          return (
            latitude <= region.ne_lat &&
            latitude >= region.sw_lat &&
            longitude <= region.ne_lng &&
            longitude >= region.sw_lng
          );
        });
        setViewportStores(local);
      }
    },
    [
      urlFilters.country,
      urlFilters.city,
      urlFilters.brand,
      urlFilters.searchQuery,
      urlFilters.openOnly,
      styles,
      hasPhone,
      stores,
    ],
  );

  const handleRegionChange = useCallback(
    (region: MapRegion) => {
      regionRef.current = region;
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = setTimeout(() => {
        void fetchViewport(region);
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [fetchViewport],
  );

  // Re-fetch when filters change (if we already know a region).
  useEffect(() => {
    if (!regionRef.current) return;
    void fetchViewport(regionRef.current);
  }, [fetchViewport]);

  // Clear debounce timer on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    };
  }, []);

  // ---------- Display list for the bottom carousel + sidebar ----------
  // Use the viewport stores if we have them, otherwise fall back to the
  // filtered set so first paint still renders something useful.
  const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const baseDisplay = viewportStores ?? filteredStores;
  const displayStores = useMemo(() => {
    if (!selectedStore) return baseDisplay;
    // Ensure the selected store always appears so the user doesn't lose it
    // after panning away.
    if (baseDisplay.some((s) => s.id === selectedStore.id)) return baseDisplay;
    return [selectedStore, ...baseDisplay];
  }, [baseDisplay, selectedStore]);

  // ---------- Favorites ----------
  const {
    isLoggedIn,
    isFavorited,
    toggleFavorite,
    getFavoriteCount,
    syncCountsFromStores,
  } = useStoreFavorites();

  // Sync favorite counts whenever the backend sends us fresh store lists.
  // Debounced to avoid thrashing the count map when viewport / nearby /
  // filtered lists churn in quick succession.
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      syncCountsFromStores([
        ...stores,
        ...nearbyStores,
        ...(viewportStores ?? []),
      ]);
    }, FAVORITE_COUNT_SYNC_DEBOUNCE_MS);
    return () => {
      if (syncRef.current) clearTimeout(syncRef.current);
    };
  }, [stores, nearbyStores, viewportStores, syncCountsFromStores]);

  // ---------- URL mutation helpers ----------
  const patchUrl = useCallback(
    (patch: Partial<Record<string, string>>) => {
      const qs = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") qs.delete(k);
        else qs.set(k, v);
      }
      const s = qs.toString();
      router.replace(`/stores${s ? `?${s}` : ""}`);
    },
    [router, sp],
  );

  const resetAllFilters = useCallback(() => {
    setStyles([]);
    setHasPhone(false);
    router.replace("/stores");
  }, [router]);

  const handleFilterChange = useCallback(
    (patch: Partial<StoreFilters>) => {
      // Toggling any filter should exit nearby mode (user is intentionally
      // narrowing by metadata, not proximity).
      if (
        patch.country !== undefined ||
        patch.city !== undefined ||
        patch.brand !== undefined ||
        patch.openOnly !== undefined ||
        patch.searchQuery !== undefined
      ) {
        setNearbyMode(false);
      }

      const urlPatch: Record<string, string> = {};
      if (patch.country !== undefined) urlPatch.country = patch.country;
      if (patch.city !== undefined) urlPatch.city = patch.city;
      if (patch.brand !== undefined) urlPatch.brand = patch.brand;
      if (patch.searchQuery !== undefined) urlPatch.q = patch.searchQuery;
      if (patch.openOnly !== undefined)
        urlPatch.open = patch.openOnly ? "1" : "";
      if (Object.keys(urlPatch).length > 0) patchUrl(urlPatch);

      if (patch.styles !== undefined) setStyles(patch.styles);
      if (patch.hasPhone !== undefined) setHasPhone(patch.hasPhone);
    },
    [patchUrl],
  );

  // ---------- Event handlers ----------
  const handleSelectStore = useCallback((store: BuyerStore) => {
    setSelectedStore(store);
    setShowDetail(true);
  }, []);

  const closeDetail = useCallback(() => {
    setShowDetail(false);
  }, []);

  const toggleNearby = useCallback(() => {
    if (!userPos && geoStatus !== "pending") {
      // Re-attempt geolocation if the first try failed.
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        setGeoStatus("pending");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserPos({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setGeoStatus("granted");
            setNearbyMode(true);
          },
          () => setGeoStatus("denied"),
        );
        return;
      }
    }
    setNearbyMode((v) => !v);
  }, [userPos, geoStatus]);

  const setView = useCallback(
    (next: ViewMode) => {
      // `list` 是默认值，用 clear 代替显式 ?view=list 保持 URL 更干净.
      patchUrl({ view: next === "map" ? "map" : "" });
    },
    [patchUrl],
  );

  // ---------- Render ----------
  return (
    <section className="mx-auto max-w-content px-6 py-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
            买手店
          </h1>
          <p className="mt-2 font-serif text-[15px] text-black/60 dark:text-white/50">
            探索全球收录的独立买手店，按地区 · 品牌 · 风格筛选。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/stores/submit"
            className="rounded border border-[var(--border)] px-3 py-2 font-label text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
          >
            + 推荐买手店
          </Link>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="relative rounded bg-black px-3 py-2 font-label text-[12px] font-medium text-white dark:bg-white dark:text-black"
          >
            高级筛选
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 font-label text-[10px] font-semibold leading-none text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ----- Search row ----- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          key={urlFilters.searchQuery}
          defaultValue={urlFilters.searchQuery}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              patchUrl({ q: (e.target as HTMLInputElement).value });
            }
          }}
          placeholder="搜索店名 / 地址 / 品牌…"
          className="min-w-[240px] flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
        />
        <button
          type="button"
          onClick={toggleNearby}
          disabled={geoStatus === "pending"}
          className={`rounded border px-3 py-2 font-label text-[12px] transition-colors ${
            nearbyMode
              ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
              : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
          } ${geoStatus === "pending" ? "opacity-60" : ""}`}
        >
          📍 {nearbyMode ? "附近已开启" : "附近"}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-[var(--border)] px-3 py-2 font-label text-[12px] text-[var(--ink)]">
          <input
            type="checkbox"
            checked={urlFilters.openOnly}
            onChange={(e) =>
              handleFilterChange({ openOnly: e.target.checked })
            }
            className="h-4 w-4 accent-black dark:accent-white"
          />
          仅营业中
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="font-label text-[12px] text-[color:var(--ink-muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* ----- Country chip row ----- */}
      <div className="-mx-6 mb-2 overflow-x-auto px-6">
        <div className="flex min-w-max gap-2">
          {sortedCountries.map((c) => {
            const active = urlFilters.country === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  handleFilterChange({
                    country: active ? "" : c,
                    city: active ? urlFilters.city : "",
                  })
                }
                className={`whitespace-nowrap rounded border px-3 py-1.5 font-label text-[12px] transition-colors ${
                  active
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
                }`}
              >
                {getCountryDisplayName(c)}
                {countryCounts[c] ? (
                  <span className="ml-1 opacity-60">{countryCounts[c]}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ----- City chip row (only when country is selected) ----- */}
      {urlFilters.country && sortedCities.length > 0 && (
        <div className="-mx-6 mb-4 overflow-x-auto px-6">
          <div className="flex min-w-max gap-2">
            {sortedCities.slice(0, 30).map((c) => {
              const active = urlFilters.city === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    handleFilterChange({ city: active ? "" : c })
                  }
                  className={`whitespace-nowrap rounded border px-3 py-1.5 font-label text-[12px] transition-colors ${
                    active
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
                  }`}
                >
                  {getCityDisplayName(c)}
                  {cityCounts[c] ? (
                    <span className="ml-1 opacity-60">{cityCounts[c]}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ----- View switcher (list / map) ----- */}
      <div className="mb-4 flex items-center gap-1 border-b border-[var(--border)] font-label text-[13px]">
        <TabButton
          active={view === "list"}
          onClick={() => setView("list")}
          label="买手店列表"
        />
        <TabButton
          active={view === "map"}
          onClick={() => setView("map")}
          label="买手店地图"
        />
      </div>

      {/* ----- Status line (map-specific hints) ----- */}
      {view === "map" && (
        <div className="mb-3 flex flex-wrap items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
          {isLoadingStores && <span>加载中…</span>}
          {storesError && (
            <button
              type="button"
              onClick={() => reloadStores()}
              className="text-red-600 underline-offset-4 hover:underline"
            >
              加载失败，点击重试
            </button>
          )}
          {nearbyMode && (
            <span>
              附近模式：{NEARBY_RADIUS_KM}km 范围内 {nearbyStores.length} 家店铺
              {isNearbyLoading && "…"}
            </span>
          )}
          {!nearbyMode && hasActiveFilters && (
            <span>按筛选条件匹配 {filteredStores.length} 家门店</span>
          )}
          {geoStatus === "pending" && <span>正在获取当前位置…</span>}
          {geoStatus === "denied" && !nearbyMode && (
            <span>定位未开启 / 被拒绝</span>
          )}
        </div>
      )}

      {/* ----- List view ----- */}
      {view === "list" && (
        <StoresListView
          filters={urlFilters}
          isFavorited={isFavorited}
        />
      )}

      {/* ----- Map view: map + sidebar list ----- */}
      {view === "map" && (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative">
          <StoreMap
            stores={displayStores}
            selectedId={selectedStore?.id ?? null}
            onSelect={handleSelectStore}
            userPosition={userPos}
            filteredIds={hasActiveFilters ? filteredIdSet : null}
            onRegionChange={handleRegionChange}
            autoFit={viewportStores == null}
            className="h-[calc(100vh-20rem)] min-h-[480px] w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-raised)]"
          />

          {/* Floating bottom count badge */}
          <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-[var(--canvas)]/90 px-3 py-1.5 font-label text-[11px] text-[var(--ink)] shadow-sm backdrop-blur">
            视口内 {baseDisplay.length} 家店铺
          </div>
        </div>

        <aside className="flex min-h-[480px] flex-col rounded border border-[var(--border)] bg-[var(--canvas-soft)]">
          <div className="border-b border-[var(--border)] px-4 py-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {displayStores.length} / {filteredStores.length} 家门店
          </div>
          <ul className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {displayStores.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleSelectStore(s)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--canvas-raised)] ${
                    selectedStore?.id === s.id
                      ? "bg-[var(--canvas-raised)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-[15px] text-black dark:text-white">
                      {s.name}
                    </span>
                    {s.isOpen && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-label text-[10px] uppercase text-green-700 dark:text-green-300">
                        Open
                      </span>
                    )}
                    {isFavorited(s.id) && (
                      <span className="rounded-full bg-black/10 px-2 py-0.5 font-label text-[10px] uppercase text-black/70 dark:bg-white/10 dark:text-white/70">
                        ♥
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
                  {(getFavoriteCount(s.id) > 0 || s.brands.length > 0) && (
                    <span className="flex items-center gap-2 font-label text-[11px] text-[color:var(--ink-muted)]">
                      {getFavoriteCount(s.id) > 0 && (
                        <span>{getFavoriteCount(s.id)} 人关注</span>
                      )}
                      {s.brands.length > 0 && (
                        <span className="truncate italic">
                          · {s.brands.slice(0, 3).join(" / ")}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!isLoadingStores && displayStores.length === 0 && (
              <li className="px-4 py-8 text-center font-serif text-sm text-[color:var(--ink-muted)]">
                没有匹配的门店。
              </li>
            )}
          </ul>
        </aside>
      </div>
      )}

      {/* ----- Filter sheet ----- */}
      <StoreFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={combinedFilters}
        onChange={handleFilterChange}
        onReset={() => {
          setStyles([]);
          setHasPhone(false);
          router.replace("/stores");
        }}
        countries={countries}
        cities={cities}
        countryCounts={countryCounts}
        cityCounts={cityCounts}
        matchCount={filteredStores.length}
      />

      {/* ----- Store detail sheet ----- */}
      <StoreDetailSheet
        store={showDetail ? selectedStore : null}
        onClose={closeDetail}
        isFavorited={selectedStore ? isFavorited(selectedStore.id) : false}
        favoriteCount={
          selectedStore ? getFavoriteCount(selectedStore.id) : 0
        }
        onToggleFavorite={() => {
          if (!selectedStore) return;
          void toggleFavorite(selectedStore.id);
        }}
        isLoggedIn={isLoggedIn}
      />
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
