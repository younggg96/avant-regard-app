import { useState, useCallback, useRef, Dispatch, SetStateAction } from "react";
import { getFeed, FeedItem, Post } from "../../../services/postService";

const EXCLUDE_IDS_MAX_SIZE = 200;
const PAGE_SIZE = 30;
// Mirrors backend STAGE2_END (STAGE1_SIZE + STAGE2_SIZE = 6 + 20). Below this
// cursor the server is still in the Stage 1+2 path and can return short pages
// by design (first page is ~26 items, not PAGE_SIZE). So we only flag
// "no more data" once we've crossed into Stage 3.
const STAGE2_END = 26;

interface UseFeedRecommendationReturn {
  feedItems: FeedItem[];
  setFeedItems: Dispatch<SetStateAction<FeedItem[]>>;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setBoostBrand: (brandId: number | null) => void;
  boostBrandId: number | null;
}

/**
 * Feed v2.1 recommendation hook — drives the three-stage server dispatch.
 *
 * Client responsibilities:
 *   • Maintain a sliding `exclude_ids` window (Rule 1 dedup, bounded at 200).
 *     Negative IDs encode already-seen show cards.
 *   • Track `skip` = number of post items already consumed. The server uses
 *     this to choose Stage 1+2 (skip==0) vs Stage 3 (skip>=STAGE2_END=26).
 *   • Hold a session-only `boost_brand_id` so recent brand affinity is
 *     reflected in Stage 2 scoring without being persisted.
 */
export const useFeedRecommendation = (): UseFeedRecommendationReturn => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [boostBrandId, setBoostBrandId] = useState<number | null>(null);

  const excludeIdsRef = useRef<number[]>([]);
  const postSkipRef = useRef<number>(0);
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

  const countPosts = (items: FeedItem[]): number =>
    items.reduce((acc, it) => acc + (it.type === "post" ? 1 : 0), 0);

  const trimExcludeIds = (ids: number[]): number[] =>
    ids.length > EXCLUDE_IDS_MAX_SIZE
      ? ids.slice(ids.length - EXCLUDE_IDS_MAX_SIZE)
      : ids;

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);

    const isFirstLoad = excludeIdsRef.current.length === 0;

    try {
      const resp = await getFeed({
        limit: PAGE_SIZE,
        excludeIds: excludeIdsRef.current,
        boostBrandId,
        skip: 0,
        forceFresh: true,
      });

      const newItems = resp.items;
      const postCount = countPosts(newItems);
      const newIds = extractExcludeIds(newItems);

      if (isFirstLoad) {
        setFeedItems(newItems);
        excludeIdsRef.current = newIds;
        postSkipRef.current = postCount;
        setHasMore(postCount > 0);
      } else if (newItems.length > 0) {
        setFeedItems((prev) => [...newItems, ...prev]);
        excludeIdsRef.current = trimExcludeIds([
          ...excludeIdsRef.current,
          ...newIds,
        ]);
        postSkipRef.current += postCount;
      }
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
        skip: postSkipRef.current,
      });

      setFeedItems((prev) => [...prev, ...resp.items]);

      const postCount = countPosts(resp.items);
      const newIds = extractExcludeIds(resp.items);
      excludeIdsRef.current = trimExcludeIds([
        ...excludeIdsRef.current,
        ...newIds,
      ]);
      postSkipRef.current += postCount;

      // End-of-feed detection:
      //   • An empty page always means "nothing left" (both stage 2 and stage 3
      //     fallbacks on the server already ran), so flip hasMore off.
      //   • Otherwise, below STAGE2_END a short page is expected (first page is
      //     ~26 items) — let Stage 3 kick in on the next loadMore.
      //   • In Stage 3 territory, a short page means the 90-day long-tail
      //     window is exhausted.
      if (postCount === 0) {
        setHasMore(false);
      } else if (postSkipRef.current < STAGE2_END) {
        setHasMore(true);
      } else {
        setHasMore(postCount >= PAGE_SIZE);
      }
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
    setFeedItems,
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
