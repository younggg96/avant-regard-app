"use client";

/**
 * SWR-backed hook that turns the live `/api/buyer-stores` dataset into
 * atlas markers. Uses the same fetcher (`getAllStores`) and cache key
 * shape (`["buyer-stores-all"]`) as the /stores list view, so navigating
 * between /stores and /atlas reuses the cached payload — no extra
 * roundtrip the second time.
 */

import { useMemo } from "react";
import useSWR from "swr";
import {
  getAllStores,
  type BuyerStore,
} from "@/lib/services/buyer-store";
import {
  aggregateCitiesFromStores,
  FALLBACK_ATLAS_CITIES,
  type AtlasCity,
} from "./cities";

export interface UseAtlasCitiesResult {
  /** Always non-empty: live aggregated cities, or fallback dataset. */
  cities: readonly AtlasCity[];
  /** True before the first successful fetch resolves. */
  isLoading: boolean;
  /** True when we are currently rendering the bundled fallback. */
  isFallback: boolean;
  /** Last fetch error, if any. */
  error: unknown;
}

export function useAtlasCities(): UseAtlasCitiesResult {
  const { data, error, isLoading } = useSWR<BuyerStore[]>(
    ["buyer-stores-all"],
    () => getAllStores(),
    { revalidateOnFocus: false },
  );

  const cities = useMemo(() => {
    if (!data) return FALLBACK_ATLAS_CITIES;
    const aggregated = aggregateCitiesFromStores(data);
    return aggregated.length > 0 ? aggregated : FALLBACK_ATLAS_CITIES;
  }, [data]);

  return {
    cities,
    isLoading: isLoading && !data,
    isFallback: !data || cities === FALLBACK_ATLAS_CITIES,
    error,
  };
}
