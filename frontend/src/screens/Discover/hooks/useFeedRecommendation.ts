import { useState, useCallback, useRef, Dispatch, SetStateAction } from "react";
import { getFeed, FeedItem, Post } from "../../../services/postService";
import { feedCacheService } from "../../../services/feedCacheService";

const EXCLUDE_IDS_MAX_SIZE = 200;
const PAGE_SIZE = 30;
// Mirrors backend STAGE2_END (STAGE1_SIZE + STAGE2_SIZE = 6 + 20). Below this
// cursor the server is still in the Stage 1+2 path and can return short pages
// by design (first page is ~26 items, not PAGE_SIZE). Once Stage 3 is exhausted
// the client loops previously seen items instead of ending the feed.
const STAGE2_END = 26;

const getFeedItemKey = (item: FeedItem): string =>
  `${item.type}:${String(item.data.id)}`;

interface RefreshOptions {
  /** When true, skip `setRefreshing` so no RefreshControl spinner shows.
   *  Used for background revalidation after a cache-hit cold start. */
  silent?: boolean;
}

interface UseFeedRecommendationReturn {
  feedItems: FeedItem[];
  setFeedItems: Dispatch<SetStateAction<FeedItem[]>>;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  refresh: (options?: RefreshOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  setBoostBrand: (brandId: number | null) => void;
  boostBrandId: number | null;
  /** Attempt to hydrate feedItems from the on-device cache.
   *  Returns `true` if cached data was loaded (caller can skip the
   *  loading screen and show stale content immediately). */
  hydrateFromCache: () => Promise<boolean>;
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
 *
 * Endless-scroll guarantee (both directions):
 *   loadMore (swipe up / onEndReached):
 *     recommendations → 90-day chronological → full archive (server-side
 *     window widening in FeedService._fetch_longtail_posts) → local replay
 *     pool via `appendReplayItems` (loops de-duplicated feedItems by its own
 *     cursor). Server-side layers are exhausted only when the caller's
 *     exclude_ids covers every qualifying post in the DB.
 *
 *   refresh (pull-to-refresh):
 *     fresh + scored (skip=0, force_fresh) → Stage 2 empty fallback also
 *     benefits from the same archive widening → if the response is still
 *     empty, prepend a page from the same local pool via
 *     `getNextRefreshRecycleItems` so pull-to-refresh is never a no-op.
 *
 *   Both tiers share the de-duplicated source pool but maintain independent
 *   cursors (`replayCursorRef` vs `refreshRecycleCursorRef`) so one path's
 *   pagination never skips rows in the other.
 */
export const useFeedRecommendation = (): UseFeedRecommendationReturn => {
  const [feedItems, setFeedItemsState] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [boostBrandId, setBoostBrandId] = useState<number | null>(null);

  const feedItemsRef = useRef<FeedItem[]>([]);
  const excludeIdsRef = useRef<number[]>([]);
  const postSkipRef = useRef<number>(0);
  const requestInFlight = useRef(false);
  const replayCursorRef = useRef(0);
  const isReplayingRef = useRef(false);
  // Separate cursor for the refresh-side recycle tier. refresh and loadMore
  // both fall back to the same de-duplicated pool (feedItemsRef keyed by
  // `${type}:${id}`), but they advance independently so one path's
  // pagination never causes a visible jump in the other.
  const refreshRecycleCursorRef = useRef(0);

  const setFeedItems = useCallback<Dispatch<SetStateAction<FeedItem[]>>>(
    (value) => {
      setFeedItemsState((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prevState: FeedItem[]) => FeedItem[])(prev)
            : value;
        feedItemsRef.current = next;
        return next;
      });
    },
    []
  );

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

  const getReplaySourceItems = useCallback((): FeedItem[] => {
    const seen = new Set<string>();
    const sourceItems: FeedItem[] = [];

    for (const item of feedItemsRef.current) {
      const key = getFeedItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      sourceItems.push(item);
    }
    return sourceItems;
  }, []);

  const getNextReplayItems = useCallback((): FeedItem[] => {
    const source = getReplaySourceItems();
    if (source.length === 0) return [];

    const replayItems: FeedItem[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      replayItems.push(source[(replayCursorRef.current + i) % source.length]);
    }
    replayCursorRef.current =
      (replayCursorRef.current + PAGE_SIZE) % source.length;
    return replayItems;
  }, [getReplaySourceItems]);

  const appendReplayItems = useCallback(() => {
    const replayItems = getNextReplayItems();
    if (replayItems.length === 0) {
      setHasMore(false);
      return;
    }
    setFeedItems((prev) => [...prev, ...replayItems]);
    setHasMore(true);
  }, [getNextReplayItems, setFeedItems]);

  /**
   * Refresh-side recycle: symmetric counterpart to `getNextReplayItems`.
   *
   * When the server has no fresh items left (backend already widened to the
   * full archive — see FeedService `_fetch_longtail_posts` — but every
   * qualifying post is still in `exclude_ids`), pull-to-refresh would
   * otherwise resolve with an empty list and the user would see no feedback.
   * Loop a page from the already-rendered pool so refresh always has
   * something to prepend — visually mirrors the "之前出现过的帖子" tier we
   * already provide for loadMore.
   *
   * Uses its own cursor so `replayCursorRef` (loadMore) keeps its position.
   */
  const getNextRefreshRecycleItems = useCallback((): FeedItem[] => {
    const source = getReplaySourceItems();
    if (source.length === 0) return [];

    const items: FeedItem[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      items.push(source[(refreshRecycleCursorRef.current + i) % source.length]);
    }
    refreshRecycleCursorRef.current =
      (refreshRecycleCursorRef.current + PAGE_SIZE) % source.length;
    return items;
  }, [getReplaySourceItems]);

  const hydrateFromCache = useCallback(async (): Promise<boolean> => {
    try {
      const cached = await feedCacheService.get();
      if (cached && cached.length > 0) {
        setFeedItems(cached);
        // Prevent premature loadMore while the background revalidation
        // hasn't populated excludeIds / postSkip yet.
        setHasMore(false);
        return true;
      }
    } catch {
      // Fall through to network.
    }
    return false;
  }, [setFeedItems]);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (!options?.silent) setRefreshing(true);

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
        replayCursorRef.current = 0;
        refreshRecycleCursorRef.current = 0;
        isReplayingRef.current = false;
        excludeIdsRef.current = newIds;
        postSkipRef.current = postCount;
        setHasMore(postCount > 0);
        // Persist the first page for instant next cold start.
        void feedCacheService.set(newItems);
      } else if (newItems.length > 0) {
        setFeedItems((prev) => [...newItems, ...prev]);
        isReplayingRef.current = false;
        replayCursorRef.current = 0;
        excludeIdsRef.current = trimExcludeIds([
          ...excludeIdsRef.current,
          ...newIds,
        ]);
        postSkipRef.current += postCount;
        setHasMore(true);
      } else {
        // Server genuinely has nothing new: backend already widened Stage 3
        // to the full archive and still returned empty, i.e. every qualifying
        // post is already in the caller's exclude_ids window. Instead of
        // leaving pull-to-refresh as a no-op, cycle a page from the local
        // pool so the user always sees new rows at the top. This is the
        // refresh-side mirror of loadMore's replay tier — loadMore keeps
        // its own cursor + state untouched.
        const recycled = getNextRefreshRecycleItems();
        if (recycled.length > 0) {
          setFeedItems((prev) => [...recycled, ...prev]);
        }
      }
    } catch (err) {
      console.error("[FeedV2] refresh failed:", err);
    } finally {
      if (!options?.silent) setRefreshing(false);
      requestInFlight.current = false;
    }
  }, [boostBrandId, getNextRefreshRecycleItems, setFeedItems]);

  const loadMore = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);

    // Replay mode re-uses FeedItem refs already sitting in memory, so no
    // network round-trip and no mount spike — commit synchronously; there's
    // nothing for the rAF deferral below to smooth out.
    if (isReplayingRef.current) {
      try {
        appendReplayItems();
      } finally {
        setLoading(false);
        requestInFlight.current = false;
      }
      return;
    }

    let resp: Awaited<ReturnType<typeof getFeed>>;
    try {
      resp = await getFeed({
        limit: PAGE_SIZE,
        excludeIds: excludeIdsRef.current,
        boostBrandId,
        skip: postSkipRef.current,
      });
    } catch (err) {
      console.error("[FeedV2] loadMore failed:", err);
      setLoading(false);
      requestInFlight.current = false;
      return;
    }

    const postCount = countPosts(resp.items);
    const newIds = extractExcludeIds(resp.items);

    // ---------------------------------------------------------------------
    // Defer the mount-heavy commit to the next frame.
    //
    // Why:
    //   MasonryFlashList triggers `onEndReached` *inside* the JS scroll frame
    //   while the finger is still carrying momentum. If `setFeedItems` lands
    //   inside that same frame, React reconciliation for up to PAGE_SIZE (30)
    //   new cards + FlashList re-layout runs on the same JS thread that's
    //   currently driving scroll translations — reading as a visible 1-2
    //   frame freeze at the bottom of the list ("just stops for a moment").
    //
    //   rAF-ing the commit lets FlashList's current momentum frame paint
    //   cleanly first; the append then lands in the *next* frame when scroll
    //   has naturally decelerated.
    //
    // Batching:
    //   `setFeedItems` + `setLoading(false)` + `requestInFlight` reset all
    //   live inside the SAME rAF callback so React batches them into one
    //   commit — the "加载中" footer stays visible right up to the moment
    //   the new cards appear. Releasing `setLoading(false)` earlier would
    //   produce a "footer gone + empty gap" flicker between frames.
    //
    // Paging guards:
    //   `excludeIdsRef` / `postSkipRef` are refs, not state — updating them
    //   inside the rAF is fine because the outer `requestInFlight.current`
    //   flag (also cleared inside the rAF) prevents any second `onEndReached`
    //   from launching a duplicate request before the commit lands.
    // ---------------------------------------------------------------------
    requestAnimationFrame(() => {
      if (resp.items.length > 0) {
        setFeedItems((prev) => [...prev, ...resp.items]);
        excludeIdsRef.current = trimExcludeIds([
          ...excludeIdsRef.current,
          ...newIds,
        ]);
        postSkipRef.current += postCount;
      }

      // End-of-feed handling:
      //   • Empty page: the backend has nothing new left, so immediately
      //     append a replay page to keep the scroll continuous.
      //   • Stage 1+2 short pages are expected, so continue asking the server.
      //   • Stage 3 short pages mean the long-tail window is exhausted;
      //     switch subsequent loads to replay mode.
      if (postCount === 0) {
        isReplayingRef.current = true;
        appendReplayItems();
      } else if (postSkipRef.current < STAGE2_END) {
        setHasMore(true);
      } else if (postCount < PAGE_SIZE) {
        isReplayingRef.current = true;
        replayCursorRef.current = 0;
        setHasMore(true);
      } else {
        setHasMore(true);
      }

      setLoading(false);
      requestInFlight.current = false;
    });
  }, [appendReplayItems, boostBrandId, setFeedItems]);

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
    hydrateFromCache,
  };
};

export default useFeedRecommendation;
