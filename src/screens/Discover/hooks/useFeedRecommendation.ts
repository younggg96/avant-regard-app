import { useState, useCallback, useRef } from "react";
import { getFeed, FeedItem, Post } from "../../../services/postService";

const EXCLUDE_IDS_MAX_SIZE = 200;
const PAGE_SIZE = 30;

interface UseFeedRecommendationReturn {
  feedItems: FeedItem[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setBoostBrand: (brandId: number | null) => void;
  boostBrandId: number | null;
}

/**
 * Feed v2 recommendation hook.
 *
 * Manages:
 *  - exclude_ids sliding window (Rule 1: dedup, max 200 entries)
 *  - Negative IDs in exclude_ids encode already-seen show card IDs
 *  - boost_brand_id session state (Rule 5/6: brand affinity)
 *  - Cursor-free pagination: entirely driven by exclude_ids, no offset
 */
export const useFeedRecommendation = (): UseFeedRecommendationReturn => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [boostBrandId, setBoostBrandId] = useState<number | null>(null);

  const excludeIdsRef = useRef<number[]>([]);
  const requestInFlight = useRef(false);

  const extractExcludeIds = (items: FeedItem[]): number[] => {
    const ids: number[] = [];
    for (const item of items) {
      if (item.type === "post") {
        ids.push((item.data as Post).id);
      } else {
        const showId = Number(item.data.id);
        if (!isNaN(showId)) {
          ids.push(-showId);
        }
      }
    }
    return ids;
  };

  const trimExcludeIds = (ids: number[]): number[] => {
    if (ids.length > EXCLUDE_IDS_MAX_SIZE) {
      return ids.slice(ids.length - EXCLUDE_IDS_MAX_SIZE);
    }
    return ids;
  };

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);
    excludeIdsRef.current = [];

    try {
      const resp = await getFeed({
        limit: PAGE_SIZE,
        excludeIds: [],
        boostBrandId,
      });

      setFeedItems(resp.items);
      setHasMore(
        resp.items.filter((i) => i.type === "post").length >= PAGE_SIZE
      );

      excludeIdsRef.current = extractExcludeIds(resp.items);
    } catch (err) {
      console.error("[FeedV2] refresh failed:", err);
    } finally {
      setRefreshing(false);
      requestInFlight.current = false;
    }
  }, [boostBrandId]);

  const loadMore = useCallback(async () => {
    if (requestInFlight.current || !hasMore) return;
    requestInFlight.current = true;
    setLoading(true);

    try {
      const resp = await getFeed({
        limit: PAGE_SIZE,
        excludeIds: excludeIdsRef.current,
        boostBrandId,
      });

      setFeedItems((prev) => [...prev, ...resp.items]);

      const postCount = resp.items.filter((i) => i.type === "post").length;
      setHasMore(postCount >= PAGE_SIZE);

      const newIds = extractExcludeIds(resp.items);
      excludeIdsRef.current = trimExcludeIds([
        ...excludeIdsRef.current,
        ...newIds,
      ]);
    } catch (err) {
      console.error("[FeedV2] loadMore failed:", err);
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  }, [hasMore, boostBrandId]);

  const setBoostBrand = useCallback((brandId: number | null) => {
    setBoostBrandId(brandId);
  }, []);

  return {
    feedItems,
    loading,
    refreshing,
    hasMore,
    refresh,
    loadMore,
    setBoostBrand,
    boostBrandId,
  };
};

export default useFeedRecommendation;
