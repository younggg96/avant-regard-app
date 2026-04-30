"use client";

/**
 * `/discover` feed: `推荐 / 关注` tabs + stable-order masonry + infinite scroll.
 *
 * Layout
 *  - **`index % columnCount` partitioning (NOT CSS `columns`)**. CSS columns
 *    rebalance on every content change, so every `loadMore` batch would
 *    visibly re-shuffle posts the viewer has already seen — exactly what
 *    the user hit in manual testing.
 *
 *    Splitting by `index % N` is the simplest layout that preserves the
 *    one property that matters for infinite scroll: **appending to the
 *    post array never changes the column of any existing post**. The
 *    post at index `i` is always in column `i % N`, regardless of how
 *    many posts get added after it. Columns remain slightly uneven in
 *    height (because card aspect-ratio varies), which is the expected
 *    waterfall aesthetic and NOT a reshuffle.
 *
 *    This is a deliberate simplification over mobile's runtime
 *    `MasonryFlashList` greedy-shortest-column algorithm — that algorithm
 *    needs runtime DOM measurements which are unavailable during SSR and
 *    would reintroduce a layout shift on first paint. For the web's
 *    post-1 batch (paginated on scroll), users read chronologically
 *    row-by-row, so the `index % N` row-major order is actually more
 *    intuitive than mobile's bin-packing.
 *  - **Dynamic cover aspect-ratio** — `PostCard` (`masonry` mode) follows
 *    each image/video's natural ratio clamped to [3/4, 16/9], giving the
 *    waterfall look without any JS reflow logic.
 *
 * Pagination
 *  - `推荐` uses Feed v2.1 three-stage dispatch (see backend
 *    `GET /api/posts/feed`). We mirror the mobile contract from
 *    `frontend/src/screens/Discover/hooks/useFeedRecommendation.ts`:
 *      • `skip` = number of post items already consumed (NOT total items);
 *      • `excludeIds` = sliding dedup window bounded at 200, with negative
 *        IDs encoding already-seen show cards so Stage 2's show-interleave
 *        doesn't resurface them;
 *      • "no more data" only flips off after we cross into Stage 3
 *        (`skip >= STAGE2_END = 26`) AND the latest page is short.
 *    An IntersectionObserver on a sentinel node triggers `loadMore` well
 *    before the user reaches the true bottom, so the feed feels seamless.
 *  - `关注` uses `GET /api/posts/following` which the backend caps at
 *    `limit ≤ 200` with no skip/offset — so it's a single authenticated
 *    fetch on first activation. Unauthenticated viewers see a login CTA.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AnimateIn } from "@/components/AnimateIn";
import { PostCard } from "@/components/PostCard";
import { useAuthStore } from "@/lib/auth/store";
import { postService } from "@/lib/services/post";
import type { FeedItem, Post } from "@/lib/types";

type TabId = "recommend" | "following";

interface DiscoverFeedProps {
  initialItems: FeedItem[];
  /** SSR error from the first-page fetch; surfaced only on the 推荐 pane. */
  initialError: string | null;
}

const PAGE_SIZE = 30;
const EXCLUDE_IDS_MAX = 200;
// Mirror backend `STAGE2_END = STAGE1_SIZE + STAGE2_SIZE` (6 + 20). Under this
// cursor the server is still in the Stage 1+2 path and short pages are
// expected-by-design, so we must not flip `hasMore` off prematurely.
const STAGE2_END = 26;
const FOLLOWING_LIMIT = 100;

// Breakpoints mirror the previous CSS columns: `sm:2 lg:3 xl:4`.
const BREAKPOINTS: Array<{ minWidth: number; columns: number }> = [
  { minWidth: 1280, columns: 4 },
  { minWidth: 1024, columns: 3 },
  { minWidth: 640, columns: 2 },
  { minWidth: 0, columns: 1 },
];

/** Extract the exclude-ID list for a page of `FeedItem`s (+post / −show). */
function extractExcludeIds(items: FeedItem[]): number[] {
  const ids: number[] = [];
  for (const item of items) {
    if (item.type === "post") {
      ids.push((item.data as Post).id);
    } else {
      const showId = Number(item.data.id);
      if (!Number.isNaN(showId)) ids.push(-showId);
    }
  }
  return ids;
}

function countPosts(items: FeedItem[]): number {
  let n = 0;
  for (const it of items) if (it.type === "post") n++;
  return n;
}

function trimExcludeIds(ids: number[]): number[] {
  return ids.length > EXCLUDE_IDS_MAX ? ids.slice(ids.length - EXCLUDE_IDS_MAX) : ids;
}

/**
 * Responsive column count. Starts at 4 (SSR default — matches the widest
 * tailwind breakpoint) and corrects on mount + resize. The one-time
 * correction on narrow viewports is unavoidable without a blocking JS gate,
 * but it never causes a masonry reshuffle since assignments are reset (and
 * re-computed) whenever `columnCount` changes.
 */
function useColumnCount(): number {
  const [n, setN] = useState<number>(4);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      for (const bp of BREAKPOINTS) {
        if (w >= bp.minWidth) return bp.columns;
      }
      return 1;
    };
    const apply = () => setN(compute());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return n;
}

export function DiscoverFeed({ initialItems, initialError }: DiscoverFeedProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("recommend");

  const TABS: Array<{ id: TabId; label: string; subtitle: string }> = [
    { id: "recommend", label: t("discover.recommend"), subtitle: t("discover.recommendSubtitle") },
    { id: "following", label: t("discover.following"), subtitle: t("discover.followingSubtitle") },
  ];

  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ---- 推荐 tab state (driven by Feed v2.1 three-stage dispatch) ---------
  const [recommendItems, setRecommendItems] = useState<FeedItem[]>(initialItems);
  const [recommendLoadingMore, setRecommendLoadingMore] = useState(false);
  const [recommendHasMore, setRecommendHasMore] = useState(initialItems.length > 0);
  const [recommendError, setRecommendError] = useState<string | null>(initialError);
  const recommendSkipRef = useRef<number>(countPosts(initialItems));
  const recommendExcludeIdsRef = useRef<number[]>(extractExcludeIds(initialItems));
  const recommendInFlightRef = useRef(false);

  const retryRecommend = useCallback(async () => {
    if (recommendInFlightRef.current) return;
    recommendInFlightRef.current = true;
    setRecommendError(null);
    setRecommendLoadingMore(true);
    try {
      const resp = await postService.getFeedPage({ limit: PAGE_SIZE, skip: 0 });
      setRecommendItems(resp.items);
      recommendSkipRef.current = countPosts(resp.items);
      recommendExcludeIdsRef.current = extractExcludeIds(resp.items);
      setRecommendHasMore(resp.items.length > 0);
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : t("discover.cannotLoadDiscover"));
    } finally {
      setRecommendLoadingMore(false);
      recommendInFlightRef.current = false;
    }
  }, [t]);

  const loadMoreRecommend = useCallback(async () => {
    if (recommendInFlightRef.current) return;
    if (!recommendHasMore) return;
    recommendInFlightRef.current = true;
    setRecommendLoadingMore(true);
    try {
      const resp = await postService.getFeedPage({
        limit: PAGE_SIZE,
        skip: recommendSkipRef.current,
        excludeIds: recommendExcludeIdsRef.current,
      });

      const newPostCount = countPosts(resp.items);
      setRecommendItems((prev) => [...prev, ...resp.items]);
      recommendSkipRef.current += newPostCount;
      recommendExcludeIdsRef.current = trimExcludeIds([
        ...recommendExcludeIdsRef.current,
        ...extractExcludeIds(resp.items),
      ]);

      // End-of-feed detection (mirror mobile):
      //   • Empty page → definitely no more (both Stage 2 and Stage 3 ran).
      //   • Below STAGE2_END → expected short pages, stay hopeful.
      //   • Stage 3 territory → a short page means the 90-day long-tail window
      //     is exhausted.
      if (newPostCount === 0) {
        setRecommendHasMore(false);
      } else if (recommendSkipRef.current < STAGE2_END) {
        setRecommendHasMore(true);
      } else {
        setRecommendHasMore(newPostCount >= PAGE_SIZE);
      }
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : t("discover.loadMoreFailed"));
      setRecommendHasMore(false);
    } finally {
      setRecommendLoadingMore(false);
      recommendInFlightRef.current = false;
    }
  }, [recommendHasMore, t]);

  // ---- 关注 tab state (single authenticated fetch; backend has no skip) --
  const [followingPosts, setFollowingPosts] = useState<Post[] | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [followingLoading, setFollowingLoading] = useState(false);

  useEffect(() => {
    if (tab !== "following") return;
    if (!hydrated || !isAuthenticated) return;
    if (followingPosts !== null || followingLoading) return;

    let cancelled = false;
    setFollowingLoading(true);
    setFollowingError(null);

    postService
      .getFollowingPosts(FOLLOWING_LIMIT)
      .then((posts) => {
        if (!cancelled) setFollowingPosts(posts ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFollowingError(err instanceof Error ? err.message : t("discover.cannotLoadFollowing"));
        }
      })
      .finally(() => {
        if (!cancelled) setFollowingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, hydrated, isAuthenticated, followingPosts, followingLoading]);

  useEffect(() => {
    if (!isAuthenticated) setFollowingPosts(null);
  }, [isAuthenticated]);

  // ---- Infinite scroll sentinel for 推荐 tab ----------------------------
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (tab !== "recommend") return;
    if (!recommendHasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMoreRecommend();
            break;
          }
        }
      },
      {
        // Trigger ~400px before the sentinel enters the viewport so the next
        // page is in flight by the time the user actually reaches the bottom.
        rootMargin: "0px 0px 400px 0px",
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, recommendHasMore, recommendItems.length, loadMoreRecommend]);

  // ---- Derived lists (posts-only for rendering) -------------------------
  const recommendPosts = useMemo<Post[]>(
    () =>
      recommendItems
        .filter((it) => it.type === "post")
        .map((it) => it.data as Post),
    [recommendItems],
  );

  const activePosts = tab === "recommend" ? recommendPosts : followingPosts ?? [];
  const activeError = tab === "recommend" ? recommendError : followingError;

  const pane = useMemo<
    "list" | "empty" | "error" | "loading" | "login"
  >(() => {
    if (tab === "recommend") {
      if (recommendItems.length === 0) {
        if (recommendError) return "error";
        if (recommendLoadingMore) return "loading";
        return "empty";
      }
      return "list";
    }

    if (!hydrated) return "loading";
    if (!isAuthenticated) return "login";
    if (followingLoading && followingPosts === null) return "loading";
    if (followingError && (followingPosts === null || followingPosts.length === 0))
      return "error";
    if ((followingPosts ?? []).length === 0) return "empty";
    return "list";
  }, [
    tab,
    hydrated,
    isAuthenticated,
    recommendItems.length,
    recommendError,
    recommendLoadingMore,
    followingLoading,
    followingPosts,
    followingError,
  ]);

  return (
    <>
      <nav
        aria-label="Discover tabs"
        className="mb-10 flex items-end gap-8 border-b border-black/[0.08] dark:border-white/[0.08]"
      >
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              aria-pressed={active}
              className={`group relative -mb-px pb-3 pt-1 text-left transition-colors duration-200 ${
                active
                  ? "text-black dark:text-white"
                  : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              }`}
            >
              <span className="block font-serif text-lg leading-tight md:text-xl">
                {tabItem.label}
              </span>
              <span className="mt-0.5 block font-label text-[10px] uppercase tracking-[0.2em] text-current opacity-60">
                {tabItem.subtitle}
              </span>
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 h-px origin-left transition-transform duration-300 ease-out ${
                  active
                    ? "scale-x-100 bg-black dark:bg-white"
                    : "scale-x-0 bg-black/30 dark:bg-white/30"
                }`}
              />
            </button>
          );
        })}
      </nav>

      {pane === "error" && (
        <AnimateIn>
          <div
            className="flex flex-col items-start gap-3 rounded border p-8 font-serif text-sm
                       border-black/[0.08] bg-[#f9f9f9] text-black/50
                       dark:border-white/[0.08] dark:bg-[#111] dark:text-white/40"
          >
            <p>{t("discover.loadError")}（{activeError}）{t("discover.pleaseRetry")}</p>
            {tab === "recommend" && (
              <button
                type="button"
                onClick={retryRecommend}
                className="rounded-full bg-black px-4 py-1.5 font-label text-[11px] uppercase tracking-[0.2em] text-white hover:opacity-85 dark:bg-white dark:text-black"
              >
                {t("common.retry")}
              </button>
            )}
          </div>
        </AnimateIn>
      )}

      {pane === "login" && (
        <AnimateIn>
          <div
            className="flex flex-col items-start gap-4 rounded border p-8 font-serif text-sm
                       border-black/[0.08] bg-[#f9f9f9] text-black/60
                       dark:border-white/[0.08] dark:bg-[#111] dark:text-white/50"
          >
            <p>{t("discover.loginCta")}</p>
            <Link
              href="/auth/login?next=/discover"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 font-label text-[11px] uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black"
            >
              {t("auth.login")}
            </Link>
          </div>
        </AnimateIn>
      )}

      {pane === "loading" && (
        <div className="font-label text-[12px] uppercase tracking-widest text-black/40 dark:text-white/40">
          {t("common.loading")}
        </div>
      )}

      {pane === "empty" && (
        <AnimateIn>
          <div
            className="rounded border p-8 font-serif text-sm
                       border-black/[0.08] bg-[#f9f9f9] text-black/50
                       dark:border-white/[0.08] dark:bg-[#111] dark:text-white/40"
          >
            {tab === "recommend" ? t("discover.emptyRecommend") : t("discover.emptyFollowing")}
          </div>
        </AnimateIn>
      )}

      {pane === "list" && (
        <>
          <MasonryGrid posts={activePosts} />

          {tab === "recommend" && (
            <InfiniteScrollFooter
              hasMore={recommendHasMore}
              loading={recommendLoadingMore}
              error={recommendError}
              sentinelRef={sentinelRef}
              onRetry={loadMoreRecommend}
            />
          )}

          {tab === "following" && activePosts.length > 0 && (
            <FollowingEndFooter />
          )}
        </>
      )}
    </>
  );
}

/**
 * Stable-order masonry.
 *
 * Contract: the post at array index `i` is always rendered in column
 * `i % columnCount`. This makes the layout **append-only by construction**
 * — adding posts to the end of the array cannot change any existing
 * post's column. No refs, no effects, no DOM measurements, fully
 * deterministic on both server and client.
 *
 * The only time the layout reshuffles is when the viewport crosses a
 * responsive breakpoint and `columnCount` changes, which is expected UX
 * for a resize.
 */
function MasonryGrid({ posts }: { posts: Post[] }) {
  const columnCount = useColumnCount();

  const partitioned = useMemo<Post[][]>(() => {
    const cols: Post[][] = Array.from({ length: columnCount }, () => []);
    for (let i = 0; i < posts.length; i++) {
      cols[i % columnCount].push(posts[i]);
    }
    return cols;
  }, [posts, columnCount]);

  return (
    <div className="flex items-start gap-3">
      {partitioned.map((colPosts, colIdx) => (
        <div
          key={colIdx}
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          {colPosts.map((post, i) => (
            <AnimateIn
              key={post.id}
              delay={Math.min(i * 30, 300)}
            >
              {/* priority hint for the visible top row across all columns */}
              <PostCard post={post} priority={i === 0} masonry />
            </AnimateIn>
          ))}
        </div>
      ))}
    </div>
  );
}

function InfiniteScrollFooter({
  hasMore,
  loading,
  error,
  sentinelRef,
  onRetry,
}: {
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  sentinelRef: React.RefObject<HTMLDivElement>;
  onRetry: () => void;
}): ReactNode {
  const { t } = useTranslation();

  if (hasMore) {
    return (
      <div className="pt-10">
        <div
          ref={sentinelRef}
          aria-hidden
          className="h-px w-full"
        />
        {loading && (
          <div className="flex items-center justify-center gap-3 py-4 font-label text-[11px] uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
            <LoadingDot />
            {t("discover.loadMore")}
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-4 font-serif text-xs text-black/50 dark:text-white/40">
            <span>{t("discover.loadMoreFailed")}（{error}）</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-black/20 px-4 py-1 font-label text-[10px] uppercase tracking-[0.2em] hover:bg-black hover:text-white dark:border-white/20 dark:hover:bg-white dark:hover:text-black"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-14 flex items-center gap-4 pb-2">
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
        {t("discover.noMorePosts")}
      </span>
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
    </div>
  );
}

function FollowingEndFooter(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="mt-14 flex items-center gap-4 pb-2">
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
        {t("discover.allFollowingUpdates")}
      </span>
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
    </div>
  );
}

function LoadingDot(): ReactNode {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black/40 dark:bg-white/40"
    />
  );
}
