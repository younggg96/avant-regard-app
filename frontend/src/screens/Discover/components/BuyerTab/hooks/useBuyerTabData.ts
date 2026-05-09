/**
 * 买手店 Tab 数据 Hook —— 纯真实数据版（2026-04-29 去 mock 重构）。
 *
 * 职责：
 *   1. 拉取真实的买手店列表（经 `/api/buyer-stores`）给顶部横向选择条用；
 *   2. 管理当前被选中店铺的 id / 关注态 / 已收藏单品；
 *   3. 懒加载所选店铺的 4 组真实资源并缓存：
 *        - `getStoreProfileConfig`（店铺主页配置）
 *        - `getStoreEntryCards`（入口卡片，0~N 张）
 *        - `getStoreProducts`（商品预览前 8 条）
 *        - `getStoreBanners`（商家发布的 Banner，由 StoreBanner 适配成
 *          `BuyerStoreFeatureBanner` 给 NewArrivalBanner 消费）
 *   4. 把上述真实数据组装为页面可直接消费的 View 模型；任何资源缺失都
 *      让 UI 走空态（卡片隐藏 / 商品空提示 / Banner 不渲染）
 *
 * 为何不把数据揉进 `useDiscoverData`：
 *   - 买手店 Tab 的数据模型（stores / products / 选中 id）与 posts 型
 *     Tab 完全不同；混在一起会让 `useDiscoverData` 突然多出仅对一个
 *     Tab 有意义的字段，违反 SRP 且让其它 Tab 的 hook 重渲染时连带
 *     触发买手店相关 memo 失效。
 *   - BuyerTabContent 作为独立渲染单元（在 Discover/index.tsx 里与
 *     TabContent 并排挂载）本就只需要 DiscoverScreen 透传少量回调，
 *     自己管理自己的状态最简单。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import i18n from "../../../../../i18n";
import {
  BuyerStore,
  getStoresPaginated,
} from "../../../../../services/buyerStoreService";
import {
  getStoreEntryCards,
  getStoreProducts,
  getStoreProfileConfig,
  likeStoreProduct,
  StoreEntryCard,
  StoreProduct,
  StoreProfileConfig,
  unlikeStoreProduct,
} from "../../../../../services/storeProductService";
import {
  getStoreBanners,
  StoreBanner,
} from "../../../../../services/storeMerchantService";
// 买手店帖子（migration 055）— Discover/Stores tab 在 Banner 下面新增
// "Products / Posts" tab 切换, posts 数据走 postService.getPostsByStoreId
// 的公开列表 (PUBLISHED + APPROVED).
import {
  postService,
  Post as ApiPost,
} from "../../../../../services/postService";
import { useAuthStore } from "../../../../../store/authStore";
import { useStoreFavoritesStore } from "../../../../../store/storeFavoritesStore";
import {
  BuyerStoreFeatureBanner,
  BuyerStoreProduct,
  BuyerStoreProfileView,
  BuyerStoreShortcut,
  ProductBadge,
  StoreEntryCardView,
} from "../types";

// ---------------------------------------------------------------------------
// 纯函数工具（拆出来便于单测 & 保持 hook 内部瘦身）
// ---------------------------------------------------------------------------

/**
 * 把后端返回的 `StoreProduct[]` 映射到买手店 Tab 单品卡片的 View 模型。
 *
 * - 首图取 `images[0]`；商家没上图时留空串，UI 侧 OptimizedImage 自带
 *   灰块占位，不再由前端偷偷塞 Unsplash 兜底图；
 * - `badge` 按业务优先级自动派生：`hasDiscount → SALE`、`isNew → NEW`、
 *   其他 → 无角标。这层派生让 ProductCard 不用再感知业务语义；
 * - `brand` 为空时回退到 `categoryName`，都空才给 "—" —— 商家可能先上商品
 *   再补品牌信息，不让卡片看起来残缺。
 */
const buildProductsFromRemote = (
  remote: StoreProduct[]
): BuyerStoreProduct[] => {
  return remote.map((p) => {
    const badge: ProductBadge | undefined = p.hasDiscount
      ? "SALE"
      : p.isNew
        ? "NEW"
        : undefined;
    return {
      id: `remote-${p.id}`,
      realProductId: p.id,
      title: p.title,
      brand: p.brand?.trim() || p.categoryName?.trim() || "—",
      image: p.images?.[0] ?? "",
      priceCents: p.priceCents,
      discountPriceCents: p.discountPriceCents ?? undefined,
      badge,
      // 把后端真值带到 view —— 卡片心形 = "我点过赞"，与 StoreProductDetail
      // 顶部 like 按钮的同步逻辑见 useBuyerTabData.toggleProductFavorite。
      isFavorited: !!p.likedByMe,
    };
  });
};

/**
 * 根据店铺原始数据 + （可选）商家配置合成 UI 视图。
 *
 * 合并策略：
 *   - 有配置的字段覆盖原始；
 *   - 配置里 tags 数组非空才覆盖原始店铺 tags（`config.tags` → `store.style`），
 *     防止商家只清空没重填导致一片空；
 *   - 粉丝数（followerCount）走 useStoreFavoritesStore 的乐观计数：
 *     用户点 follow 后立即 +1，回滚时 -1；初始值由 `syncCountsFromStores`
 *     从列表接口的 `favoriteCount` 写入；
 *   - 商品数（productCount）从 `getStoreProducts(...).total` 取，
 *     商家没上架时显示 0；
 *   - 没有描述 / 封面时返回空串 / undefined，UI 侧（StoreProfileCard）
 *     已支持空态：coverImage 缺失 → 灰块，tags / description 空 → 不渲染；
 *   - `isRemote = config != null`，方便后续埋点 / 调试。
 *
 * 数字格式化（10k / 1.2w 等）放到 UI 侧，避免把 number 提前 stringify
 * 后乐观更新时 label 不再变化。
 */
const buildProfileView = (
  store: BuyerStore,
  config: StoreProfileConfig | null | undefined,
  followerCount: number,
  productCount: number
): BuyerStoreProfileView => {
  const location = [store.city, store.country].filter(Boolean).join(" · ");

  // tags 优先级：商家自助配置的 profile_config.tags > 店铺本体的 style 列表 > 空。
  const remoteTags = (config?.tags ?? []).filter(Boolean);
  const storeStyleTags = (store.style ?? []).filter(Boolean);
  const tags = remoteTags.length > 0 ? remoteTags : storeStyleTags;

  const shortDescription =
    config?.shortDescription?.trim() || store.description?.trim() || "";
  const longDescription =
    config?.longDescription?.trim() || store.description?.trim() || "";

  const coverImage =
    config?.coverImage?.trim() || store.images?.[0] || undefined;

  return {
    storeId: store.id,
    name: store.name,
    description: shortDescription,
    location: location || "—",
    coverImage,
    logoImage: config?.logoImage?.trim() || undefined,
    logoLetter: (store.name?.trim()?.charAt(0) || "S").toUpperCase(),
    followerCount,
    followingCount: 0,
    productCount,
    isVerified: true,
    tags,
    longDescription,
    isRemote: !!config,
  };
};

/**
 * 把后端返回的 `StoreEntryCard[]` 映射到统一 View 模型。
 * 商家未配置时返回空数组，由 CategoryCards 侧 `if (!hasCards) return null`
 * 直接隐藏整段，不再伪装成"4 张固定兜底卡片"。
 */
const buildEntryCardsView = (
  remote: StoreEntryCard[] | undefined
): StoreEntryCardView[] => {
  if (!remote || remote.length === 0) return [];
  // 后端已经按 sort_order 排好；这里做一次 defensive sort，避免顺序错乱。
  return [...remote]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((card) => ({
      id: `remote-${card.id}`,
      cardType: card.cardType,
      label: card.label,
      labelEn: card.labelEn || undefined,
      image: card.imageUrl,
      targetCategoryId: card.targetCategoryId ?? null,
      sortOrder: card.sortOrder,
      isRemote: true,
    }));
};

/**
 * 把商家发布的 `StoreBanner[]` 里可展示的第一条适配成 `BuyerStoreFeatureBanner`。
 *
 * 规则：
 *   - 只看 PUBLISHED 状态 + 图片 URL 合法的 banner；
 *   - 按 `sortOrder` 升序取第一条；
 *   - subtitle / cta 来自商家时保持 undefined（NewArrivalBanner 会条件渲染）
 *
 * 返回 null 表示这家店没有任何可展示的 banner，UI 侧会跳过 NewArrivalBanner。
 */
const buildFeatureBanner = (
  banners: StoreBanner[] | undefined
): BuyerStoreFeatureBanner | null => {
  if (!banners || banners.length === 0) return null;
  const candidates = banners
    .filter((b) => b.status === "PUBLISHED")
    .filter((b) => {
      const url = (b.imageUrl ?? "").toLowerCase();
      return url.startsWith("http://") || url.startsWith("https://");
    });
  if (candidates.length === 0) return null;
  const [first] = [...candidates].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
  );
  return {
    bannerId: first.id,
    image: first.imageUrl,
    title: first.title || undefined,
    linkUrl: first.linkUrl || undefined,
  };
};

const toShortcut = (store: BuyerStore): BuyerStoreShortcut => ({
  storeId: store.id,
  name: store.name,
  coverImage: store.images?.[0],
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseBuyerTabDataArgs {
  /**
   * true 时允许 hook 真正发起买手店列表请求；false 时保持 idle。
   *
   * 为什么需要这个开关：BuyerTabContent 与 recommend / forum / following
   * 并列挂载在 Discover 页的横向 ScrollView 里，三方都会在冷启动瞬间
   * 竞争同一批 HTTP 下载槽。如果这里照搬 `useEffect(() => load())` 的
   * 写法，用户大概率还没看到买手店 Tab 就先吃了它 15s 的 timeout，
   * 推荐 Feed 的首屏也会被拖慢。改成只有 `enabled === true` 才 kickoff
   * 首次拉取（并通过 `hasLoadedRef` 去重），对齐 forum / following 走
   * `loadTabData` 的懒加载语义。
   */
  enabled: boolean;
}

export interface UseBuyerTabDataReturn {
  stores: BuyerStoreShortcut[];
  storeMap: Record<string, BuyerStore>;
  selectedStoreId: string | null;
  selectedStore: BuyerStore | null;
  selectedProfile: BuyerStoreProfileView | null;
  /**
   * 所选店铺的入口卡片。纯真实数据：来自 `/store/{id}/entry-cards`
   * （按 sort_order 升序）。商家尚未配置 / 接口失败时返回空数组，
   * 由 CategoryCards 侧直接隐藏整段。
   */
  entryCards: StoreEntryCardView[];
  banner: BuyerStoreFeatureBanner | null;
  products: BuyerStoreProduct[];
  /** 当前选中店铺的店铺帖子（migration 055）。商家未发帖 / 未入驻时为空数组。 */
  storePosts: ApiPost[];
  /** 当前选中店铺的店铺帖子是否还在加载（与 isProductsLoading 同语义）。 */
  isStorePostsLoading: boolean;
  isFollowed: boolean;
  isLoading: boolean;
  /**
   * 当前选中店铺的商品是否正在加载。
   * 真值条件：选中了 storeId 且 `productsMap[storeId] === undefined`
   * （即从未拉过 / 切换到新店铺还没回结果）。一旦后端返回（无论 `[]` 还是
   * 有值）都会落到 productsMap 里，本标志立即翻 false —— 与 productsMap
   * 的"undefined = 未拉过 / [] = 已拉过但商家没上"三态语义对齐。
   */
  isProductsLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  setSelectedStoreId: (storeId: string) => void;
  /**
   * 切换当前选中店铺的关注态。返回 boolean 标记调用是否被消费：
   * - `true`  ：用户已登录、请求已发起（成功或回滚由全局 store 内部处理）；
   * - `false` ：未登录 / 没选中店铺；调用方应当弹登录提示。
   */
  toggleFollow: () => Promise<boolean>;
  toggleProductFavorite: (productId: string) => Promise<void>;
  favoritedProductIds: Set<string>;
  refresh: () => Promise<void>;
  /**
   * 仅刷新当前店铺的商品列表（不动 profile / cards / banners）。
   * 给页面 focus 时用 —— 用户从 StoreProductDetail 改了 like 后回到 Tab，
   * 通过这个轻量 RPC 让卡片心形即时同步。
   */
  refreshSelectedStoreProducts: () => Promise<void>;
}

/** 顶部店铺选择条所需的条数。单屏横向滑动大约展示 6-7 张，多拉一些
 *  留出滑动余量即可；不需要整张买手店全目录。 */
const STORE_SHORTCUT_PAGE_SIZE = 20;

export const useBuyerTabData = (
  { enabled }: UseBuyerTabDataArgs = { enabled: true }
): UseBuyerTabDataReturn => {
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(null);
  // 初始 loading=false：在 `enabled === false` 期间视为 idle，不显示骨架
  // （组件层此时会渲染"暂无买手店数据"占位，但冷启动根本看不到）。
  // 直到首次 kickoff 才翻成 true。
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- 关注 (favorite) 全局态：复用 useStoreFavoritesStore -----------------
  // 之前这里维护过一份 `followedStoreIds: Set<string>`，但它纯前端、不与后端
  // 通信，导致点 follow 看似"已关注"刷新后又变回未关注。改成共享全局 store
  // 之后，BuyerTab / StoreDetail 任意一处的 toggle 都会同时刷新另一处。
  //
  // 一律按 selector 抽取，保证每个返回值都是稳定引用 —— 否则 zustand 会
  // 每次都返回新的快照对象，把外面的 useCallback 全打成新引用。
  const currentUser = useAuthStore((s) => s.user);
  const favoritesLoaded = useStoreFavoritesStore((s) => s.loaded);
  const favoriteIds = useStoreFavoritesStore((s) => s.favoriteIds);
  const favoriteCounts = useStoreFavoritesStore((s) => s.favoriteCounts);
  const loadFavoritesFromServer = useStoreFavoritesStore((s) => s.loadFavorites);
  const syncCountsFromStores = useStoreFavoritesStore((s) => s.syncCountsFromStores);
  const toggleFavoriteApi = useStoreFavoritesStore((s) => s.toggleFavorite);
  // favoritedProductIds 不再单独 setState，改为 useMemo 从 productsMap 派生
  // —— 单一真值在 productsMap 上，避免"卡片心形 vs likedByMe"两个状态会
  // 漂移（这正是用户报告的 bug：详情页 like 之后回来卡片仍是空心）。

  // 店铺 4 组可配置资源按 storeId 缓存 —— 同一次会话里用户来回切店
  // 不会反复打接口。`undefined` 表示"还没拉过"，`null`（仅 profileConfig）
  // 表示"拉过了但后端说未配置"，这两种语义要分开，否则 UI 会分不清
  // "还在 loading"和"明确空态"。
  const [profileConfigMap, setProfileConfigMap] = useState<
    Record<string, StoreProfileConfig | null>
  >({});
  const [entryCardsMap, setEntryCardsMap] = useState<
    Record<string, StoreEntryCard[]>
  >({});
  // 商品列表缓存。`undefined` = 未拉过；`[]` = 拉过但商家确实没上商品（UI 走空态）；
  // 有值 = 用真实商品。和 profileConfigMap 保持一致的三态语义。
  const [productsMap, setProductsMap] = useState<
    Record<string, StoreProduct[]>
  >({});
  // Banner 列表缓存。语义同 productsMap：`undefined` = 未拉过；`[]` = 拉过
  // 但商家还没发 banner；有值 = 用真实 banner。NewArrivalBanner 根据映射
  // 结果决定是否挂载。
  const [bannersMap, setBannersMap] = useState<
    Record<string, StoreBanner[]>
  >({});
  // 店铺帖子（migration 055）缓存. 三态语义和 productsMap 对齐:
  //   undefined = 未拉过 (此时 isStorePostsLoading=true)
  //   []        = 拉过但商家没发帖 (UI 走"暂无店铺帖子"空态)
  //   有值      = 真实店铺帖子, Posts tab 渲染网格
  const [storePostsMap, setStorePostsMap] = useState<
    Record<string, ApiPost[]>
  >({});
  // 商品总数缓存（key = storeId, value = total）。来自 `getStoreProducts.total`，
  // StoreProfileCard 顶部的 "Products" 列直接读这里；undefined = 还没拉过，UI
  // 显示 0 即可（商家没上架也是 0，体感等价）。
  const [productCountMap, setProductCountMap] = useState<
    Record<string, number>
  >({});

  // 首次 enabled 翻 true 才真正发请求；后续 enabled toggle 不再重拉，
  // 让用户手动下拉刷新或点击"重试"按钮。
  const hasLoadedRef = useRef(false);
  // 正在拉取配置的 storeId 集合，避免 Promise in-flight 时再次触发。
  const configInFlightRef = useRef<Set<string>>(new Set());

  const loadStores = useCallback(async (mode: "initial" | "refresh") => {
    try {
      if (mode === "initial") setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      // 顶部选择条只吃一页——不要用 `getAllStores`，那个函数内部硬编码
      // `pageSize: 200` 并循环拉取直到拉完整张买手店目录，在网络抖动时
      // 会把 `/api/buyer-stores?page=1&pageSize=200` + `page=2&pageSize=200`
      // 同时卡 15s，把冷启动其它请求也拖垮。
      //
      // `withMerchantFirst: true` 保证已有商家入驻的店铺排在选择条前部，
      // 对应后端 `get_stores_with_merchant_priority`，渲染层不需要额外排序。
      const result = await getStoresPaginated({
        pageSize: STORE_SHORTCUT_PAGE_SIZE,
        withMerchantFirst: true,
      });
      setStores(result.stores);
      // 把后端列表里的 favoriteCount 灌进全局 favorites store 的 counts 缓存，
      // 这样 follow 按钮乐观 +1/-1 的起点就是真实的关注人数（而不是 0）。
      // syncCountsFromStores 内部按 id 合并，不会覆盖已有的更高值（StoreDetail
      // 那条路径写入的精确值依然保留）。
      syncCountsFromStores(result.stores);
      // 初次加载自动选中第一家，保持页面不是空态。
      setSelectedStoreIdState((prev) => prev ?? result.stores[0]?.id ?? null);
    } catch (err) {
      console.error("加载买手店列表失败:", err);
      setError(err instanceof Error ? err.message : i18n.t("discover.buyerLoadFailed"));
    } finally {
      if (mode === "initial") setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, [syncCountsFromStores]);

  // 用户登录后把"我关注的店铺"列表灌进全局 favorites store —— 这样
  // BuyerTab 切到任意店铺时 follow 按钮的初始状态都是正确的；不登录
  // 直接跳过（按钮 idle，点的时候提示登录）。
  useEffect(() => {
    if (!enabled) return;
    if (!currentUser?.userId) return;
    if (favoritesLoaded) return;
    loadFavoritesFromServer(currentUser.userId);
  }, [enabled, currentUser?.userId, favoritesLoaded, loadFavoritesFromServer]);

  // 懒启动：仅当外部把 `enabled` 翻成 true 时才 kickoff，且只 kickoff 一次。
  useEffect(() => {
    if (!enabled) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadStores("initial");
  }, [enabled, loadStores]);

  // 店铺级别的可配置数据懒加载：选中 storeId 变化 → 并发拉
  // profile + entry-cards + products + banners。四个接口任一失败都静默
  // 吞掉（每组都不是阻塞性数据，空态由 UI 侧展示），只打 log 便于排查；
  // 避免因为商家还没配置某一项就把整个买手店 Tab 打成 error。
  //
  // Products 一次拉顶部 8 条做首屏预览；商家实际上了更多商品时，点击入口
  // 卡片会跳 StoreProductList 走完整分页接口。
  const PREVIEW_PRODUCT_COUNT = 8;

  // Discover/Stores tab 的 Posts tab 用的预览条数。8 条对齐 PREVIEW_PRODUCT_COUNT,
  // 给一行 4 张缩略图 + 第二行 4 张; 用户想看完整列表点 "View All" 跳 StoreDetail.
  const PREVIEW_POST_COUNT = 8;

  const loadStoreConfig = useCallback(
    async (storeId: string, opts?: { force?: boolean }) => {
      if (!storeId) return;
      if (configInFlightRef.current.has(storeId)) return;
      const needProfile =
        opts?.force || profileConfigMap[storeId] === undefined;
      const needCards = opts?.force || entryCardsMap[storeId] === undefined;
      const needProducts =
        opts?.force || productsMap[storeId] === undefined;
      const needBanners =
        opts?.force || bannersMap[storeId] === undefined;
      const needPosts =
        opts?.force || storePostsMap[storeId] === undefined;
      if (
        !needProfile &&
        !needCards &&
        !needProducts &&
        !needBanners &&
        !needPosts
      ) {
        return;
      }

      configInFlightRef.current.add(storeId);
      try {
        const [
          profileResult,
          cardsResult,
          productsResult,
          bannersResult,
          postsResult,
        ] = await Promise.allSettled([
            needProfile
              ? getStoreProfileConfig(storeId)
              : Promise.resolve(null),
            needCards ? getStoreEntryCards(storeId) : Promise.resolve([]),
            needProducts
              ? getStoreProducts({
                  storeId,
                  page: 1,
                  pageSize: PREVIEW_PRODUCT_COUNT,
                })
              : Promise.resolve({ products: [], total: 0, page: 1, pageSize: 0 }),
            needBanners
              ? getStoreBanners(storeId)
              : Promise.resolve({ banners: [], total: 0 }),
            // 店铺帖子（migration 055）。public 入口 → includeUnpublished=false,
            // 后端只返回 PUBLISHED + APPROVED. 失败仅打 warn, 走空数组空态.
            needPosts
              ? postService.getPostsByStoreId(storeId, { limit: PREVIEW_POST_COUNT })
              : Promise.resolve([] as ApiPost[]),
          ]);

        if (needProfile) {
          if (profileResult.status === "fulfilled") {
            setProfileConfigMap((prev) => ({
              ...prev,
              [storeId]: profileResult.value ?? null,
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load profile-config failed:",
              profileResult.reason
            );
            // 失败也写 null，避免无限重试；让空态立刻生效。
            setProfileConfigMap((prev) => ({ ...prev, [storeId]: null }));
          }
        }

        if (needCards) {
          if (cardsResult.status === "fulfilled") {
            setEntryCardsMap((prev) => ({
              ...prev,
              [storeId]: cardsResult.value ?? [],
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load entry-cards failed:",
              cardsResult.reason
            );
            setEntryCardsMap((prev) => ({ ...prev, [storeId]: [] }));
          }
        }

        if (needProducts) {
          if (productsResult.status === "fulfilled") {
            const value = productsResult.value;
            setProductsMap((prev) => ({
              ...prev,
              [storeId]: value?.products ?? [],
            }));
            // total 是后端已经按 PUBLISHED 过滤后的真实商品数 —— 即便我们
            // 这里只取了 PREVIEW_PRODUCT_COUNT 条做预览，total 仍然反映全量。
            setProductCountMap((prev) => ({
              ...prev,
              [storeId]: value?.total ?? 0,
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load products failed:",
              productsResult.reason
            );
            setProductsMap((prev) => ({ ...prev, [storeId]: [] }));
            setProductCountMap((prev) => ({ ...prev, [storeId]: 0 }));
          }
        }

        if (needBanners) {
          if (bannersResult.status === "fulfilled") {
            setBannersMap((prev) => ({
              ...prev,
              [storeId]: bannersResult.value?.banners ?? [],
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load banners failed:",
              bannersResult.reason
            );
            setBannersMap((prev) => ({ ...prev, [storeId]: [] }));
          }
        }

        if (needPosts) {
          if (postsResult.status === "fulfilled") {
            setStorePostsMap((prev) => ({
              ...prev,
              [storeId]: postsResult.value ?? [],
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load store posts failed:",
              postsResult.reason
            );
            // 失败也写 [], 让 isStorePostsLoading 立刻翻 false, 避免空 tab 一直转圈.
            setStorePostsMap((prev) => ({ ...prev, [storeId]: [] }));
          }
        }
      } finally {
        configInFlightRef.current.delete(storeId);
      }
    },
    [profileConfigMap, entryCardsMap, productsMap, bannersMap, storePostsMap]
  );

  // 选中店铺变化时 kickoff 一次配置拉取；已有缓存则立即跳过。
  useEffect(() => {
    if (!selectedStoreId) return;
    loadStoreConfig(selectedStoreId);
  }, [selectedStoreId, loadStoreConfig]);

  const refresh = useCallback(async () => {
    // 用户手动触发（下拉刷新 / 重试按钮）也算作一次"已加载"，避免
    // 紧接着的 enabled effect 再追发一次重复请求。
    hasLoadedRef.current = true;
    await loadStores("refresh");
    // 同步强刷当前店的配置，反映 Web SaaS 新提交的改动。
    if (selectedStoreId) {
      await loadStoreConfig(selectedStoreId, { force: true });
    }
  }, [loadStores, loadStoreConfig, selectedStoreId]);

  const storeMap = useMemo(() => {
    const acc: Record<string, BuyerStore> = {};
    for (const store of stores) acc[store.id] = store;
    return acc;
  }, [stores]);

  const selectedStore = selectedStoreId ? storeMap[selectedStoreId] ?? null : null;

  const shortcuts = useMemo<BuyerStoreShortcut[]>(
    () => stores.map(toShortcut),
    [stores]
  );

  const selectedProfile = useMemo<BuyerStoreProfileView | null>(() => {
    if (!selectedStore) return null;
    const config = selectedStore.id ? profileConfigMap[selectedStore.id] : null;
    // followerCount 优先取全局 favorites store 里的乐观值（点 follow 后立刻
    // +1），缺失时回退到 buyer-stores 列表接口写入的初值。
    const favCount = favoriteCounts.get(selectedStore.id);
    const followerCount = favCount ?? selectedStore.favoriteCount ?? 0;
    const productCount = productCountMap[selectedStore.id] ?? 0;
    return buildProfileView(selectedStore, config ?? null, followerCount, productCount);
  }, [selectedStore, profileConfigMap, favoriteCounts, productCountMap]);

  const entryCards = useMemo<StoreEntryCardView[]>(() => {
    if (!selectedStoreId) return [];
    return buildEntryCardsView(entryCardsMap[selectedStoreId]);
  }, [selectedStoreId, entryCardsMap]);

  const products = useMemo<BuyerStoreProduct[]>(() => {
    if (!selectedStore) return [];
    // 纯真实数据：商家还没上商品时返回空数组，UI 走 ProductGrid 的"暂无匹配
    // 的单品"空态。
    const remote = productsMap[selectedStore.id];
    if (!remote || remote.length === 0) return [];
    return buildProductsFromRemote(remote);
  }, [selectedStore, productsMap]);

  // 当前店铺的商品是否还在加载 —— 仅在缓存还没写过任何值时为 true。
  // 注意 `productsMap[id] === []` 不算 loading（商家就是没上商品）。
  const isProductsLoading = useMemo<boolean>(() => {
    if (!selectedStoreId) return false;
    return productsMap[selectedStoreId] === undefined;
  }, [selectedStoreId, productsMap]);

  const banner = useMemo<BuyerStoreFeatureBanner | null>(() => {
    if (!selectedStoreId) return null;
    return buildFeatureBanner(bannersMap[selectedStoreId]);
  }, [selectedStoreId, bannersMap]);

  // 当前店铺的店铺帖子（migration 055）。空数组与 productsMap 一致,
  // 表示"商家没发店铺帖子"——UI 走空态。
  const storePosts = useMemo<ApiPost[]>(() => {
    if (!selectedStoreId) return [];
    return storePostsMap[selectedStoreId] ?? [];
  }, [selectedStoreId, storePostsMap]);

  const isStorePostsLoading = useMemo<boolean>(() => {
    if (!selectedStoreId) return false;
    return storePostsMap[selectedStoreId] === undefined;
  }, [selectedStoreId, storePostsMap]);

  const setSelectedStoreId = useCallback((storeId: string) => {
    setSelectedStoreIdState(storeId);
  }, []);

  /**
   * 关注 / 取消关注当前选中的店铺。直接走全局 favorites store —— 它内部
   * 已经处理了乐观更新 + 失败回滚 + 与 StoreDetailScreen 共享 IDs / counts。
   *
   * 未登录用户：直接 no-op，调用方（BuyerTab/index.tsx）会用 Alert 提示登录。
   * 这里返回 boolean 让上层知道是否真的进入了请求流程，便于决定要不要 toast。
   */
  const toggleFollow = useCallback(async (): Promise<boolean> => {
    if (!selectedStoreId) return false;
    if (!currentUser?.userId) return false;
    await toggleFavoriteApi(selectedStoreId, currentUser.userId);
    return true;
  }, [selectedStoreId, currentUser?.userId, toggleFavoriteApi]);

  /**
   * 从 productsMap 直接派生当前选中店铺的"已点赞"商品 id 集合。
   * 不再用独立 state —— productsMap 是唯一真值，toggle / focus refresh 都
   * 写它。derive 法保证：详情页改动只要拉新数据回来，卡片心形即时更新。
   */
  const favoritedProductIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedStoreId) return ids;
    const list = productsMap[selectedStoreId];
    if (!list) return ids;
    for (const p of list) {
      if (p.likedByMe) ids.add(`remote-${p.id}`);
    }
    return ids;
  }, [selectedStoreId, productsMap]);

  /**
   * 卡片上心形的点击 —— 与 StoreProductDetailScreen.handleToggleLike 走同一
   * 后端接口（store_product_likes）。乐观写入 productsMap，失败回滚。
   *
   * 用 productsMap 做乐观源是为了让其它消费方（同店铺的其它商品 view、
   * favoritedProductIds memo）一次性同步。
   */
  const toggleProductFavorite = useCallback(
    async (productId: string) => {
      const realId = parseInt(productId.replace(/^remote-/, ""), 10);
      if (!Number.isFinite(realId) || realId <= 0) return;

      let nextLiked = false;
      let didFlip = false;
      setProductsMap((prev) => {
        const next: Record<string, StoreProduct[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          next[key] = list.map((p) => {
            if (p.id !== realId) return p;
            didFlip = true;
            nextLiked = !p.likedByMe;
            const likeDelta = nextLiked ? 1 : -1;
            return {
              ...p,
              likedByMe: nextLiked,
              likeCount: Math.max(0, (p.likeCount ?? 0) + likeDelta),
            };
          });
        }
        return next;
      });
      if (!didFlip) return; // productId 不在当前任何店铺缓存里，跳过 RPC

      try {
        if (nextLiked) await likeStoreProduct(realId);
        else await unlikeStoreProduct(realId);
      } catch (err) {
        console.warn("[useBuyerTabData] toggle product like failed:", err);
        // 回滚：再 flip 一次
        setProductsMap((prev) => {
          const next: Record<string, StoreProduct[]> = {};
          for (const [key, list] of Object.entries(prev)) {
            next[key] = list.map((p) => {
              if (p.id !== realId) return p;
              const rollbackLiked = !nextLiked;
              const likeDelta = rollbackLiked ? 1 : -1;
              return {
                ...p,
                likedByMe: rollbackLiked,
                likeCount: Math.max(0, (p.likeCount ?? 0) + likeDelta),
              };
            });
          }
          return next;
        });
      }
    },
    []
  );

  /**
   * 当前选中店铺的商品列表强制重拉。
   * 给页面 focus 时用 —— 用户可能在 StoreProductDetail 改了 likedByMe，
   * 回到 Discover/Stores 卡片需要看到最新心形。
   *
   * 不走 loadStoreConfig({force: true}) 是为了避免顺带把 profile-config /
   * entry-cards / banners 也重拉一次（那 3 项基本不会随 like 改变）。
   */
  const refreshSelectedStoreProducts = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const result = await getStoreProducts({
        storeId: selectedStoreId,
        page: 1,
        pageSize: PREVIEW_PRODUCT_COUNT,
      });
      setProductsMap((prev) => ({
        ...prev,
        [selectedStoreId]: result.products ?? [],
      }));
      // total 同步刷新 —— 商家可能在 Web 后台新增 / 下架商品，focus 回来时
      // StoreProfileCard 上的 "Products" 计数也要跟着变。
      setProductCountMap((prev) => ({
        ...prev,
        [selectedStoreId]: result.total ?? 0,
      }));
    } catch (err) {
      console.warn(
        "[useBuyerTabData] refreshSelectedStoreProducts failed:",
        err
      );
    }
  }, [selectedStoreId]);

  const isFollowed = selectedStoreId ? favoriteIds.has(selectedStoreId) : false;

  return {
    stores: shortcuts,
    storeMap,
    selectedStoreId,
    selectedStore,
    selectedProfile,
    entryCards,
    banner,
    products,
    storePosts,
    isStorePostsLoading,
    isFollowed,
    isLoading,
    isProductsLoading,
    isRefreshing,
    error,
    setSelectedStoreId,
    toggleFollow,
    toggleProductFavorite,
    favoritedProductIds,
    refresh,
    refreshSelectedStoreProducts,
  };
};
