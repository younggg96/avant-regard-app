import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { InteractionManager } from "react-native";
import {
  getForumPosts,
  getFollowingPosts,
  likePost,
  unlikePost,
  Post,
  FeedItem,
} from "../../../services/postService";
import { userInfoService, UserInfo } from "../../../services/userInfoService";
import { useAuthStore } from "../../../store/authStore";
import { getActiveBanners, Banner } from "../../../services/bannerService";
import { getCommunities, CommunityListResponse } from "../../../services/communityService";
import {
  forumPostsCacheService,
  followingPostsCacheService,
  bannersCacheService,
  communitiesCacheService,
} from "../../../services/feedCacheService";
import { DisplayPost, TabType, UserInfoCache } from "../types";
import { mapApiPostToDisplayPost } from "../utils";
import { Alert } from "../../../utils/Alert";
import i18n from "../../../i18n";
import { useFeedRecommendation } from "./useFeedRecommendation";

// 推荐 Tab 冷启动「品牌 splash」最短时长。即使本地缓存命中能瞬间提供
// 数据，我们仍要让 `home-loading.gif` 至少播一个完整循环，再切到内容 ——
// 否则缓存提速反而把品牌动画吃掉了，用户的反馈是「loading 图片不见了」。
//
// 数值取舍：太短（< 500 ms）GIF 还没播完一遍就闪过去了观感更糟；太长
// （> 1 s）会被有缓存的用户当成"打开变慢了"。700 ms 大致等于一个
// home-loading.gif 循环，是观感最自然的最小值。
const COLD_START_SPLASH_MS = 700;

// 每个 Tab 的加载状态
// 买手店 Tab 的实际数据获取由 BuyerTabContent 内部 `useBuyerTabData` 自行负责；
// 这里仅保留字段以便 `loadTabData` / `handleRefresh` 的开关仍然类型完备。
interface TabLoadingState {
  forum: boolean;
  recommend: boolean;
  buyer: boolean;
  following: boolean;
}

// 每个 Tab 是否已加载过
interface TabLoadedState {
  forum: boolean;
  recommend: boolean;
  buyer: boolean;
  following: boolean;
}

interface UseDiscoverDataReturn {
  // 每个 Tab 独立的帖子数据
  recommendPosts: DisplayPost[];
  forumPosts: DisplayPost[];
  followingPosts: DisplayPost[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  isInitialized: boolean;
  refreshing: boolean;
  loading: boolean;
  error: string | null;
  userInfoCache: React.MutableRefObject<UserInfoCache>;
  // Tab 独立加载状态
  tabLoading: TabLoadingState;
  tabLoaded: TabLoadedState;
  /**
   * 论坛 Tab 头部内容（Banner / 热门社区）的加载占位标记。
   *
   * - `bannersLoading`：true 表示当前正在拉取激活 banner，UI 应显示
   *   `BannerCarouselSkeleton` 而不是空白；首次拉取完成后翻 false。
   * - `communitiesLoading`：同义，对 `getCommunities` 拉取过程占位。
   *
   * 单独于 `tabLoading.forum` —— 即使 forum Tab 走 cache hit 路径
   * 已经把 `tabLoaded.forum` 翻 true、跳过 GIF，banner / 社区仍然是
   * 后台异步拉取，没有这两个 flag 的话 header 就会闪一下空白。
   */
  bannersLoading: boolean;
  communitiesLoading: boolean;
  // 操作方法
  handleRefresh: (activeTab: TabType) => Promise<void>;
  handleLike: (postId: string) => Promise<void>;
  loadTabData: (tab: TabType) => Promise<void>;
  setForumPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  setFollowingPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  // 推荐 Tab 分页（Feed v2.1 三段式）
  recommendHasMore: boolean;
  recommendLoadingMore: boolean;
  loadMoreRecommend: () => Promise<void>;
}

/**
 * 发现页数据获取 Hook
 * 管理所有数据的获取、缓存和刷新逻辑
 * 支持懒加载：滑动到对应 tab 时才加载数据
 */
export const useDiscoverData = (): UseDiscoverDataReturn => {
  const { user } = useAuthStore();
  const [forumPosts, setForumPosts] = useState<DisplayPost[]>([]);
  const [followingPosts, setFollowingPosts] = useState<DisplayPost[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [communities, setCommunities] = useState<CommunityListResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Forum-tab 头部独立 loading flags（详见 UseDiscoverDataReturn 注释）。
  // 默认 true：在 forum Tab 第一次发起请求之前，UI 渲染骨架而不是空白；
  // 一旦请求 settle（成功 / 失败均）就翻 false。
  const [bannersLoading, setBannersLoading] = useState(true);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);

  // 推荐 Tab：接入 Feed v2.1 三段式分页 hook（首屏保鲜 + 黄金推荐 + 长尾兜底）
  const {
    feedItems,
    setFeedItems,
    refreshing: feedRefreshing,
    loading: feedLoadingMore,
    hasMore: feedHasMore,
    refresh: refreshFeed,
    loadMore: loadMoreFeed,
    hydrateFromCache,
  } = useFeedRecommendation();

  // 每个 Tab 独立的加载状态
  const [tabLoading, setTabLoading] = useState<TabLoadingState>({
    forum: false,
    recommend: false,
    buyer: false,
    following: false,
  });

  // 每个 Tab 是否已加载过
  const [tabLoaded, setTabLoaded] = useState<TabLoadedState>({
    forum: false,
    recommend: false,
    buyer: false,
    following: false,
  });

  // 缓存用户信息
  const userInfoCache = useRef<UserInfoCache>(new Map());

  // 缓存 DisplayPost 引用：key = postId，value = { source: apiPost, display: DisplayPost }。
  // Feed v2.1 的 refresh / loadMore / 乐观点赞每次都会生成新的 feedItems 数组，
  // 若直接 map(mapApiPostToDisplayPost) 会让未变化的老帖也得到全新 DisplayPost 引用，
  // 进而让下游 `TabContent` → `PostCard.memo` 全部命中 shallow-diff 失效，
  // 在瀑布流里表现为「追加一页 / 点一次赞 → 30 张卡片全部重渲染」。
  // 以 apiPost 对象引用（以及 userInfoCache 的版本号）做失效检测，保留未变帖子的
  // DisplayPost 引用，使 React.memo 真正生效。
  const displayPostCacheRef = useRef<
    Map<number, { source: Post; userInfoVersion: number; display: DisplayPost }>
  >(new Map());
  const userInfoVersionRef = useRef(0);

  /**
   * 获取用户信息（带缓存）
   */
  const fetchUserInfos = useCallback(
    async (userIds: number[], existingMap: Map<number, UserInfo>) => {
      const uncachedUserIds = userIds.filter((id) => !existingMap.has(id));
      if (uncachedUserIds.length === 0) return existingMap;

      const userInfoPromises = uncachedUserIds.map(async (userId) => {
        try {
          const info = await userInfoService.getUserInfo(userId);
          return { userId, info };
        } catch (err) {
          console.warn(`获取用户 ${userId} 信息失败:`, err);
          return null;
        }
      });

      const results = await Promise.all(userInfoPromises);
      let changed = false;
      results.forEach((result) => {
        if (result && result.info) {
          existingMap.set(result.userId, result.info);
          userInfoCache.current.set(result.userId, result.info);
          changed = true;
        }
      });
      // Bump the cache version so stale DisplayPost entries (which were
      // rendered with the old dicebear fallback) get rebuilt on the next
      // mapping pass. This preserves reference stability for *unchanged*
      // posts while invalidating just-backfilled authors.
      if (changed) userInfoVersionRef.current += 1;

      return existingMap;
    },
    []
  );

  /**
   * 将 Feed v2.1 返回的 post 型条目转换为 Discover 使用的 DisplayPost。
   * show 卡片暂不在此 Tab 渲染，直接过滤；后端已在 feed 接口内批量补全
   * username/avatarUrl，因此大部分情况下无需再次请求 user_info。
   *
   * Reference-stability contract:
   *   For unchanged apiPost objects (same object ref as last render, and the
   *   user-info cache has not been bumped since), the same DisplayPost
   *   instance is returned. This is what makes `PostCard` React.memo
   *   actually prune re-renders on loadMore / like / refresh. When the
   *   backing apiPost reference changes — e.g. `applyLikeToFeed` swaps in a
   *   new `{...post, likedByMe, likeCount}` — the entry is rebuilt so the
   *   single touched card re-renders, and every other card stays memoized.
   */
  const mapFeedItemsToDisplayPosts = useCallback(
    (items: FeedItem[]): DisplayPost[] => {
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      const cache = displayPostCacheRef.current;
      const version = userInfoVersionRef.current;
      const liveIds = new Set<number>();
      const result: DisplayPost[] = [];
      for (const item of items) {
        if (item.type !== "post") continue;
        const post = item.data as Post;
        liveIds.add(post.id);
        const cached = cache.get(post.id);
        if (
          cached &&
          cached.source === post &&
          cached.userInfoVersion === version
        ) {
          result.push(cached.display);
          continue;
        }
        const display = mapApiPostToDisplayPost(post, userInfoMap);
        cache.set(post.id, {
          source: post,
          userInfoVersion: version,
          display,
        });
        result.push(display);
      }
      // Evict entries for posts no longer in the feed so the cache cannot
      // grow unbounded across long sessions (replay mode in particular can
      // keep looping the same ids, but refresh + restart must clear them).
      for (const id of cache.keys()) {
        if (!liveIds.has(id)) cache.delete(id);
      }
      return result;
    },
    []
  );

  const recommendPosts = useMemo<DisplayPost[]>(
    () => mapFeedItemsToDisplayPosts(feedItems),
    [feedItems, mapFeedItemsToDisplayPosts]
  );

  /**
   * 后台补全未缓存作者的 user_info（不阻塞首屏）。
   * 拉到新数据后异步触发一次，下一次 mapFeedItemsToDisplayPosts 会读到最新头像/昵称。
   */
  const backfillUserInfosForFeed = useCallback(
    async (items: FeedItem[]) => {
      const ids = new Set<number>();
      for (const item of items) {
        if (item.type === "post") {
          ids.add((item.data as Post).userId);
        }
      }
      if (ids.size === 0) return;
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      await fetchUserInfos(Array.from(ids), userInfoMap);
    },
    [fetchUserInfos]
  );

  // -------------------------------------------------------------------------
  // Backfill scheduling — the recommend-tab-specific scroll-jank root cause.
  //
  // `refreshFeed` / `loadMore` write straight into `feedItems` so the feed
  // paints with whatever `avatarUrl` / `username` the backend already
  // batched into the feed response (2026-04-20 change). The `backfill`
  // pass is just to top up extras we don't strictly need on first paint
  // (mainly `user_info.primaryTitle` for the author badge, and the rare
  // post whose `avatarUrl` was null in the batch response).
  //
  // Running it synchronously inside a `useEffect([feedItems])` fires
  // multiple concurrent HTTP requests at the exact moment the
  // MasonryFlashList is mounting 26 cells — their JSON parse + state
  // writes pile onto the JS thread during the most sensitive paint
  // window. Followers tab does a single awaited `fetchUserInfos` *before*
  // render and then sits idle, which is why it feels smooth.
  //
  // Fix: run the backfill through `InteractionManager.runAfterInteractions`
  // so RN guarantees it fires only after the current interaction / layout
  // batch completes, plus a small safety timeout so we still run on
  // devices where InteractionManager's completion signal is delayed.
  // A pending handle is stashed so rapid `feedItems` changes cancel the
  // previous scheduled backfill instead of stacking them.
  // -------------------------------------------------------------------------
  const pendingBackfillTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingInteractionHandleRef = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);

  useEffect(() => {
    if (feedItems.length === 0) return;

    // Clear any previously scheduled backfill — only the latest feedItems
    // snapshot needs a pass. Without this, every append would schedule
    // another overlapping fetch batch.
    if (pendingBackfillTimerRef.current) {
      clearTimeout(pendingBackfillTimerRef.current);
      pendingBackfillTimerRef.current = null;
    }
    if (pendingInteractionHandleRef.current) {
      pendingInteractionHandleRef.current.cancel();
      pendingInteractionHandleRef.current = null;
    }

    let cancelled = false;
    const runBackfill = () => {
      if (cancelled) return;
      // Mark done first so whichever scheduler fires second
      // (InteractionManager vs the setTimeout safety net) is a no-op.
      cancelled = true;
      pendingBackfillTimerRef.current = null;
      pendingInteractionHandleRef.current = null;
      backfillUserInfosForFeed(feedItems).catch(() => {
        // non-blocking; next load will retry
      });
    };

    pendingInteractionHandleRef.current =
      InteractionManager.runAfterInteractions(runBackfill);
    // Safety net: if no interaction completion fires (e.g. user pauses
    // mid-gesture, or InteractionManager's signal is delayed as it often
    // is during cold start when the JS thread never goes idle), still run
    // the backfill so author titles fill in.
    //
    // 3.5s is chosen specifically to outlast the cold-start storm —
    // SplashVideo unmount, first-screen image decode, 7-8 concurrent boot
    // HTTP requests, and the feed's own initial fetch all land inside the
    // first ~3s. Firing the backfill (which issues 1-N `user_info` fetches
    // whose responses trigger a userInfoVersion bump → the next feedItems
    // mutation rebuilds affected DisplayPost entries) at 1.2s used to drop
    // it right into the masonry's first-paint window. Pushing it out means
    // the user sees author titles fill in a beat later, but the recommend
    // tab is smooth from the first frame. On warm scrolls (subsequent
    // loadMore / refresh) this codepath is gated behind
    // `InteractionManager.runAfterInteractions` anyway, which fires
    // near-immediately once the JS thread idles — the 3.5s is purely a
    // safety net, not the primary scheduling mechanism.
    pendingBackfillTimerRef.current = setTimeout(runBackfill, 3500);

    return () => {
      cancelled = true;
      if (pendingBackfillTimerRef.current) {
        clearTimeout(pendingBackfillTimerRef.current);
        pendingBackfillTimerRef.current = null;
      }
      if (pendingInteractionHandleRef.current) {
        pendingInteractionHandleRef.current.cancel();
        pendingInteractionHandleRef.current = null;
      }
    };
  }, [feedItems, backfillUserInfosForFeed]);

  /**
   * 触发推荐 Tab 首次加载（供初始化 / tab 懒加载复用）。
   * `silent` suppresses error-state and refresh-spinner writes — used for
   * background revalidation after a cache-hit cold start so the user sees
   * the cached feed undisturbed while fresh data loads behind the scenes.
   */
  const fetchRecommendPosts = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setError(null);
      await refreshFeed(options);
    } catch (err) {
      console.error("获取推荐帖子失败:", err);
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : i18n.t("discover.fetchRecommendFailed"));
      }
    }
  }, [refreshFeed]);

  /**
   * 论坛 / 关注 Tab 的「水合 + 静默重新校验」运行时（Discover 推荐 Tab 那条
   * stale-while-revalidate 路径的对照实现）。
   *
   * 本地 AsyncStorage 命中时：
   *   1. 立即把缓存的 Post[] 映射成 DisplayPost[] 推到上层 setState ——
   *      用户进 Tab 的瞬间就能看到上次的内容，不再过 GifLoading。
   *   2. 异步触发一次"silent revalidate"：拉一页新数据，按 id 去重后
   *      把「真正新出现的帖子」prepend 到现有列表的最上面（保留用户
   *      正在看的那些卡片的 ref 与位置；推荐 Tab 同款 UX）。
   *   3. 重新写 cache，用合并后的列表（最新的若干条 Post），下次冷启动
   *      命中后已经是包含新帖的状态。
   *
   * 缓存未命中时：
   *   退化到原始 fetch 路径，调用方继续走 `setTabLoading(true)` + GIF。
   *
   * Returns `true` if cache was hydrated (caller should mark tabLoaded
   * synchronously and skip the loading indicator).
   */
  const hydrateAndRevalidatePosts = useCallback(
    async (params: {
      cache: typeof forumPostsCacheService | typeof followingPostsCacheService;
      fetcher: () => Promise<Post[]>;
      setPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
    }): Promise<boolean> => {
      const { cache, fetcher, setPosts } = params;
      const cached = await cache.get();
      if (!cached || cached.length === 0) {
        return false;
      }

      const hydratedUserInfoMap = new Map<number, UserInfo>(
        userInfoCache.current
      );
      const hydratedDisplay = cached.map((post) =>
        mapApiPostToDisplayPost(post, hydratedUserInfoMap)
      );
      setPosts(hydratedDisplay);

      // Silent background revalidate. Errors are swallowed because the
      // user already has the cached cards visible — they'll still see
      // content; we just won't have the latest until the next cycle.
      void (async () => {
        try {
          const fresh = await fetcher();
          if (fresh.length === 0) return;

          const cachedIds = new Set(cached.map((p) => p.id));
          const trulyNew = fresh.filter((p) => !cachedIds.has(p.id));
          if (trulyNew.length === 0) {
            // Server has nothing newer — refresh the cached entry's
            // mtime so the cache stays "warm" but don't disturb the UI.
            void cache.set(cached);
            return;
          }

          // Backfill author info for the newly arrived posts (existing
          // ones already used the cached map). Done before the setPosts
          // so freshly inserted cards render with their real avatars
          // instead of the dicebear fallback.
          const userIdsForNew = [...new Set(trulyNew.map((p) => p.userId))];
          const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
          await fetchUserInfos(userIdsForNew, userInfoMap);

          const trulyNewDisplay = trulyNew.map((post) =>
            mapApiPostToDisplayPost(post, userInfoMap)
          );
          // Functional updater (NOT setPosts(mergedDisplay)) so any
          // optimistic mutations the user made between hydrate and
          // revalidate completion — e.g. tapping ❤ on a cached card —
          // survive the merge. Replacing the whole list with a re-mapped
          // copy of the cached source would silently roll back those
          // local edits, which the like-rollback code can't recover from
          // because the network request already succeeded.
          setPosts((prev) => [...trulyNewDisplay, ...prev]);
          // Cache the merged set (capped inside `cache.set`) so next
          // cold start hydrates with the freshest known top + recent
          // context. We persist the API-shaped Posts (not DisplayPosts)
          // because that's what the cache schema is.
          void cache.set([...trulyNew, ...cached]);
        } catch (err) {
          console.warn("[Discover] silent revalidate failed:", err);
        }
      })();

      return true;
    },
    [fetchUserInfos]
  );

  /**
   * 获取论坛帖子
   *
   * Persists the API response to `forumPostsCacheService` after success
   * so the next cold start can hydrate via `hydrateAndRevalidatePosts`.
   */
  const fetchForumPosts = useCallback(async () => {
    try {
      const apiPosts = await getForumPosts();

      const userIds = [...new Set(apiPosts.map((post) => post.userId))];
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      await fetchUserInfos(userIds, userInfoMap);

      const displayPosts = apiPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setForumPosts(displayPosts);
      void forumPostsCacheService.set(apiPosts);
    } catch (err) {
      console.error("获取论坛帖子失败:", err);
      setForumPosts([]);
    }
  }, [fetchUserInfos]);

  /**
   * 获取 Banner 数据
   *
   * 翻 `bannersLoading` 标记的目的：让 forum Tab 的 header 在请求未
   * 完成前显示骨架（`BannerCarouselSkeleton`）。无论成功 / 失败，
   * finally 段都会把 flag 翻回 false —— 失败时 banners 保持空数组、
   * `BannerCarousel` 自身的 `banners.length === 0 → return null` 会
   * 接管，避免长期挂着骨架。
   *
   * Cache 写入：成功后顺带把 `Banner[]` 持久化进
   * `bannersCacheService`，下次冷启动可由 `hydrateBannersFromCache`
   * 即时填充，节省一次网络往返的等待。
   */
  const fetchBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const activeBanners = await getActiveBanners();
      setBanners(activeBanners);
      void bannersCacheService.set(activeBanners);
    } catch (err) {
      console.error("获取 Banner 失败:", err);
      setBanners([]);
    } finally {
      setBannersLoading(false);
    }
  }, []);

  /**
   * 获取关注用户的帖子
   *
   * Persists to `followingPostsCacheService` after success — see
   * `fetchForumPosts` for why.
   */
  const fetchFollowingPosts = useCallback(async () => {
    try {
      const apiPosts = await getFollowingPosts();

      const userIds = [...new Set(apiPosts.map((post) => post.userId))];
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      await fetchUserInfos(userIds, userInfoMap);

      const displayPosts = apiPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setFollowingPosts(displayPosts);
      void followingPostsCacheService.set(apiPosts);
    } catch (err) {
      console.error("获取关注帖子失败:", err);
      setFollowingPosts([]);
    }
  }, [fetchUserInfos]);

  /**
   * 获取社区列表（带重试机制）
   *
   * `communitiesLoading` 与 `bannersLoading` 同步处理。重试期间 flag
   * 维持 true，第二次以上的失败会进入兜底分支重置成空 popular 列表，
   * 此时 `PopularCommunities` 自身的 `length === 0 → return null` 兜底
   * 把整个 section 隐藏，不会再显示骨架。
   *
   * Cache 写入：拿到合法 `CommunityListResponse` 后整块持久化。注意
   * 重试期间不写缓存——仅在「真正成功 / 兜底空对象」分支落盘，避免
   * 中间态把空 `popular` 写进缓存导致下次冷启动看到永远的空 section。
   */
  const fetchCommunities = useCallback(async (retryCount = 0) => {
    if (retryCount === 0) setCommunitiesLoading(true);
    try {
      const communityData = await getCommunities();
      if (communityData && communityData.popular) {
        setCommunities(communityData);
        void communitiesCacheService.set(communityData);
      } else {
        console.warn("社区数据格式异常:", communityData);
        setCommunities({ popular: [], following: [], all: [] });
      }
      setCommunitiesLoading(false);
    } catch (err) {
      console.error("获取社区列表失败:", err);
      if (retryCount < 2) {
        console.log(`重试获取社区列表... (${retryCount + 1}/2)`);
        setTimeout(() => fetchCommunities(retryCount + 1), 1000);
      } else {
        setCommunities({ popular: [], following: [], all: [] });
        setCommunitiesLoading(false);
      }
    }
  }, []);

  /**
   * 论坛 Tab 头部（banner / 热门社区）的本地缓存 hydrate。
   *
   * 与 forum/following 帖子的 stale-while-revalidate 策略一致：拿到有效
   * 缓存就立即把数据写进 state、把 loading flag 翻 false，让骨架立刻
   * 让位给真实组件。后续 `fetchBanners` / `fetchCommunities` 的网络结果
   * 仍会覆盖这些 state；轻量级的 silent revalidate。
   *
   * 任一缓存读失败都按 miss 处理（ AsyncStorage 偶发 corruption / 缺
   * 字段不应阻塞 forum Tab 加载）。
   */
  const hydrateForumHeaderFromCache = useCallback(async () => {
    const [cachedBanners, cachedCommunities] = await Promise.all([
      bannersCacheService.get().catch(() => null),
      communitiesCacheService.get().catch(() => null),
    ]);
    if (cachedBanners && cachedBanners.length > 0) {
      setBanners(cachedBanners);
      setBannersLoading(false);
    }
    if (
      cachedCommunities &&
      Array.isArray(cachedCommunities.popular) &&
      cachedCommunities.popular.length > 0
    ) {
      setCommunities(cachedCommunities);
      setCommunitiesLoading(false);
    }
  }, []);

  /**
   * 加载指定 Tab 的数据（懒加载）
   *
   * Forum / Following Tab 走 stale-while-revalidate：
   *   - 缓存命中 → 立即翻 tabLoaded 标记跳过 GifLoading，先显示老数据，
   *     `hydrateAndRevalidatePosts` 在后台静默拉新数据 + 智能 prepend。
   *   - 缓存未命中 → 走原始路径，await fetch，全程 GifLoading。
   *
   * Forum Tab 还会在两条路径之前先 hydrate banner / 热门社区缓存，让
   * header 也享受 stale-while-revalidate 的视觉收益（避免 cache miss
   * 路径的骨架屏被显示完毕后还要等一拍才拿到 banner 数据的体感）。
   *
   * 推荐 Tab 在初始化 `useEffect` 里已经独立完成 hydrate（由
   * `useFeedRecommendation.hydrateFromCache` 负责），这里走"切回 Tab 后
   * 触发的强制刷新"路径，依赖上层 hook 的去重逻辑。
   */
  const loadTabData = useCallback(
    async (tab: TabType) => {
      if (tabLoaded[tab] || tabLoading[tab]) {
        return;
      }

      // Forum: try cache first.
      if (tab === "forum") {
        // 头部缓存 hydrate 与帖子缓存 hydrate 并行；两者读 AsyncStorage
        // 互不阻塞，缩短首屏可见所有 section 的等待时间。
        const [hydrated] = await Promise.all([
          hydrateAndRevalidatePosts({
            cache: forumPostsCacheService,
            fetcher: getForumPosts,
            setPosts: setForumPosts,
          }),
          hydrateForumHeaderFromCache(),
        ]);
        if (hydrated) {
          setTabLoaded((prev) => ({ ...prev, forum: true }));
          // Banners / communities are tiny, fetch in background — they
          // don't block the visible feed. 即使前面 cache hit 了仍然
          // 重新 fetch 一次以做静默 revalidate（cache stale 检测）。
          void Promise.all([fetchBanners(), fetchCommunities()]);
          return;
        }
        // Cache miss → standard load with GifLoading.
        setTabLoading((prev) => ({ ...prev, forum: true }));
        try {
          await Promise.all([fetchForumPosts(), fetchBanners(), fetchCommunities()]);
          setTabLoaded((prev) => ({ ...prev, forum: true }));
        } catch (err) {
          console.error("加载 forum tab 数据失败:", err);
        } finally {
          setTabLoading((prev) => ({ ...prev, forum: false }));
        }
        return;
      }

      // Following: try cache first.
      if (tab === "following") {
        const hydrated = await hydrateAndRevalidatePosts({
          cache: followingPostsCacheService,
          fetcher: getFollowingPosts,
          setPosts: setFollowingPosts,
        });
        if (hydrated) {
          setTabLoaded((prev) => ({ ...prev, following: true }));
          return;
        }
        setTabLoading((prev) => ({ ...prev, following: true }));
        try {
          await fetchFollowingPosts();
          setTabLoaded((prev) => ({ ...prev, following: true }));
        } catch (err) {
          console.error("加载 following tab 数据失败:", err);
        } finally {
          setTabLoading((prev) => ({ ...prev, following: false }));
        }
        return;
      }

      // Recommend / buyer keep the original path.
      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      try {
        if (tab === "recommend") {
          await fetchRecommendPosts();
        }
        // "buyer" tab 的数据由 BuyerTabContent 内部自行获取，这里只翻转加载标记，
        // 避免 CenteredTabBar 切到买手店时触发父层骨架屏 / 空态分支。
        setTabLoaded((prev) => ({ ...prev, [tab]: true }));
      } catch (err) {
        console.error(`加载 ${tab} tab 数据失败:`, err);
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [
      tabLoaded,
      tabLoading,
      fetchRecommendPosts,
      fetchForumPosts,
      fetchFollowingPosts,
      fetchBanners,
      fetchCommunities,
      hydrateAndRevalidatePosts,
      hydrateForumHeaderFromCache,
    ]
  );

  /**
   * 初始化加载数据 — stale-while-revalidate for the recommend tab.
   *
   * 1. Try the on-device feed cache. If it contains data, kick off a silent
   *    background refresh and hold the loading-GIF on screen for a minimum
   *    splash window. The cached feed is already in state at that point;
   *    flipping `tabLoaded` is purely the timing of when the GIF dissolves
   *    into content. This re-instates the brand-loading animation on every
   *    cold start without losing the cache's first-paint speed (the data is
   *    ready well before the splash ends, so the post-splash transition is
   *    a single frame instead of a network round-trip).
   * 2. On cache miss (first install, cleared storage, hydrate failure), fall
   *    back to the original synchronous fetch path — the GIF stays up for
   *    however long the network actually takes, no artificial floor.
   */
  useEffect(() => {
    let splashTimer: ReturnType<typeof setTimeout> | null = null;

    const initData = async () => {
      const cacheHit = await hydrateFromCache();

      if (cacheHit) {
        setIsInitialized(true);
        // Background revalidation — silent so no spinner / error overlay.
        fetchRecommendPosts({ silent: true }).catch((err) => {
          console.warn("后台刷新推荐数据失败:", err);
        });
        // Cold-start brand splash floor: keep `tabLoaded` false for the
        // duration so `TabContent` keeps `home-loading.gif` on screen.
        // 700 ms ≈ one full loop of the GIF — long enough to feel
        // intentional, short enough that users perceive the app as fast.
        splashTimer = setTimeout(() => {
          setTabLoaded((prev) => ({ ...prev, recommend: true }));
          splashTimer = null;
        }, COLD_START_SPLASH_MS);
        return;
      }

      // Cache miss — show loading indicator and await network.
      setTabLoading((prev) => ({ ...prev, recommend: true }));
      try {
        await fetchRecommendPosts();
        setTabLoaded((prev) => ({ ...prev, recommend: true }));
      } catch (err) {
        console.error("初始化加载推荐数据失败:", err);
      } finally {
        setTabLoading((prev) => ({ ...prev, recommend: false }));
      }
      setIsInitialized(true);
    };
    initData();

    return () => {
      // Component unmount before the splash floor elapses — drop the
      // pending setState so React doesn't warn about updates on unmounted
      // components and we don't accidentally flip `tabLoaded` from a
      // stale closure on the next mount.
      if (splashTimer) {
        clearTimeout(splashTimer);
        splashTimer = null;
      }
    };
  }, [fetchRecommendPosts, hydrateFromCache]);

  /**
   * 刷新数据 - 刷新时也更新 tabLoaded 状态
   */
  const handleRefresh = useCallback(
    async (activeTab: TabType) => {
      // 买手店 Tab 自己的下拉刷新走子组件里的 `useBuyerTabData.refresh`，
      // 这里直接短路：不真正发请求、也不清空父级 refreshing 状态。
      if (activeTab === "buyer") {
        return;
      }
      setRefreshing(true);
      try {
        if (activeTab === "forum") {
          await Promise.all([fetchForumPosts(), fetchBanners(), fetchCommunities()]);
        } else if (activeTab === "recommend") {
          await fetchRecommendPosts();
        } else if (activeTab === "following") {
          await fetchFollowingPosts();
        }
        setTabLoaded((prev) => ({ ...prev, [activeTab]: true }));
      } catch (err) {
        console.error(`刷新 ${activeTab} 数据失败:`, err);
      } finally {
        setRefreshing(false);
      }
    },
    [fetchRecommendPosts, fetchFollowingPosts, fetchBanners, fetchForumPosts, fetchCommunities]
  );

  /**
   * 点赞/取消点赞（乐观更新 + 失败回滚）。
   * 推荐 Tab 的数据存放在 feedItems 里，需要通过 setFeedItems 同步；
   * 论坛 / 关注 Tab 仍使用各自的 DisplayPost 列表。
   */
  const applyLikeToFeed = useCallback(
    (postId: number, liked: boolean) => {
      setFeedItems((prev) =>
        prev.map((item) => {
          if (item.type !== "post") return item;
          const post = item.data as Post;
          if (post.id !== postId) return item;
          const nextLikeCount = Math.max(
            0,
            (post.likeCount || 0) + (liked ? 1 : -1)
          );
          return {
            ...item,
            data: {
              ...post,
              likedByMe: liked,
              likeCount: nextLikeCount,
            },
          };
        })
      );
    },
    [setFeedItems]
  );

  // ---------------------------------------------------------------------------
  // Stable callback refs for handleLike.
  //
  // Why: handleLike originally depended on [recommendPosts, forumPosts,
  // followingPosts, user, applyLikeToFeed]. Three of those arrays re-reference
  // on every feedItems append / refresh / optimistic like, so the callback
  // itself churned. That churn propagated downstream:
  //   DiscoverScreen.handleLike ref change
  //     → TabContent.renderMasonryItem (useCallback with [onLike] dep) rebuilt
  //     → MasonryFlashList treats renderItem as new
  //     → every mounted PostCard re-renders even though React.memo would
  //       otherwise have pruned them.
  // Moving the arrays into refs makes handleLike depend only on primitives,
  // so the callback ref stays stable across the common feed mutations and
  // the memoized card path actually pays off.
  // ---------------------------------------------------------------------------
  const recommendPostsRef = useRef(recommendPosts);
  recommendPostsRef.current = recommendPosts;
  const forumPostsRef = useRef(forumPosts);
  forumPostsRef.current = forumPosts;
  const followingPostsRef = useRef(followingPosts);
  followingPostsRef.current = followingPosts;
  const userRef = useRef(user);
  userRef.current = user;

  const handleLike = useCallback(
    async (postId: string) => {
      const targetRecommend = recommendPostsRef.current.find(
        (p) => p.id === postId
      );
      const targetForum = forumPostsRef.current.find((p) => p.id === postId);
      const targetFollowing = followingPostsRef.current.find(
        (p) => p.id === postId
      );
      const target = targetRecommend || targetForum || targetFollowing;

      if (!target) return;

      const isCurrentlyLiked = !!target.engagement.isLiked;
      const nextLiked = !isCurrentlyLiked;

      const updatePost = (post: DisplayPost) =>
        post.id === postId
          ? {
              ...post,
              engagement: {
                ...post.engagement,
                isLiked: nextLiked,
                likes: nextLiked
                  ? post.engagement.likes + 1
                  : Math.max(0, post.engagement.likes - 1),
              },
            }
          : post;

      if (targetRecommend) {
        const numericId = parseInt(postId, 10);
        if (!Number.isNaN(numericId)) applyLikeToFeed(numericId, nextLiked);
      }
      if (targetForum) {
        setForumPosts((prev) => prev.map(updatePost));
      }
      if (targetFollowing) {
        setFollowingPosts((prev) => prev.map(updatePost));
      }

      try {
        const numericPostId = parseInt(postId, 10);
        const currentUser = userRef.current;
        const userId = currentUser?.id ? parseInt(currentUser.id, 10) : 0;

        if (isCurrentlyLiked) {
          await unlikePost(numericPostId, userId);
          Alert.show(i18n.t("engagement.unlikeSuccess"));
        } else {
          await likePost(numericPostId, userId);
          Alert.show(i18n.t("engagement.likeSuccess"));
        }
      } catch (err) {
        console.error("点赞操作失败:", err);
        const rollbackPost = (post: DisplayPost) =>
          post.id === postId
            ? {
                ...post,
                engagement: {
                  ...post.engagement,
                  isLiked: isCurrentlyLiked,
                  likes: isCurrentlyLiked
                    ? post.engagement.likes + 1
                    : Math.max(0, post.engagement.likes - 1),
                },
              }
            : post;

        if (targetRecommend) {
          const numericId = parseInt(postId, 10);
          if (!Number.isNaN(numericId)) {
            applyLikeToFeed(numericId, isCurrentlyLiked);
          }
        }
        if (targetForum) {
          setForumPosts((prev) => prev.map(rollbackPost));
        }
        if (targetFollowing) {
          setFollowingPosts((prev) => prev.map(rollbackPost));
        }
      }
    },
    [applyLikeToFeed]
  );

  // 推荐 Tab 的 refreshing 以 feed hook 为准（下拉刷新时 feed hook 接管），
  // 其余 Tab 仍沿用原先的 refreshing。对外只暴露合并值，让 UI 层无需关心来源。
  const mergedRefreshing = refreshing || feedRefreshing;

  return {
    recommendPosts,
    forumPosts,
    followingPosts,
    banners,
    communities,
    isInitialized,
    refreshing: mergedRefreshing,
    loading,
    error,
    userInfoCache,
    tabLoading,
    tabLoaded,
    bannersLoading,
    communitiesLoading,
    handleRefresh,
    handleLike,
    loadTabData,
    setForumPosts,
    setFollowingPosts,
    recommendHasMore: feedHasMore,
    recommendLoadingMore: feedLoadingMore,
    loadMoreRecommend: loadMoreFeed,
  };
};

export default useDiscoverData;
