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
import {
  BuyerStore,
  getStoresPaginated,
} from "../../../../../services/buyerStoreService";
import {
  getStoreEntryCards,
  getStoreProducts,
  getStoreProfileConfig,
  StoreEntryCard,
  StoreProduct,
  StoreProfileConfig,
} from "../../../../../services/storeProductService";
import {
  getStoreBanners,
  StoreBanner,
} from "../../../../../services/storeMerchantService";
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
    };
  });
};

const formatCountLabel = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
};

/**
 * 根据店铺原始数据 + （可选）商家配置合成 UI 视图。
 *
 * 合并策略：
 *   - 有配置的字段覆盖原始；
 *   - 配置里 tags 数组非空才覆盖原始店铺 tags（`config.tags` → `store.style`），
 *     防止商家只清空没重填导致一片空；
 *   - 粉丝数只用后端 `favoriteCount`；"关注 / 帖子"两列暂时走 0
 *     （真实接口出来后替换），不再用 hash 合成伪数字；
 *   - 没有描述 / 封面时返回空串 / undefined，UI 侧（StoreProfileCard）
 *     已支持空态：coverImage 缺失 → 灰块，tags / description 空 → 不渲染；
 *   - `isRemote = config != null`，方便后续埋点 / 调试。
 */
const buildProfileView = (
  store: BuyerStore,
  config?: StoreProfileConfig | null
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
    followerLabel: formatCountLabel(store.favoriteCount ?? 0),
    // 关注数 / 发帖数当前没有公开接口；暂时走 0，待后端补齐后再替换。
    // 与其合成伪数字误导用户"这家店很火"，不如直接显示真实的零。
    followingLabel: "0",
    postCountLabel: "0",
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
  isFollowed: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  setSelectedStoreId: (storeId: string) => void;
  toggleFollow: () => void;
  toggleProductFavorite: (productId: string) => void;
  favoritedProductIds: Set<string>;
  refresh: () => Promise<void>;
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
  // 用一个 Set 存所有已"关注"的店铺 id，这样多次切换店铺不会互相覆盖状态。
  const [followedStoreIds, setFollowedStoreIds] = useState<Set<string>>(
    () => new Set()
  );
  const [favoritedProductIds, setFavoritedProductIds] = useState<Set<string>>(
    () => new Set()
  );

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
      // 初次加载自动选中第一家，保持页面不是空态。
      setSelectedStoreIdState((prev) => prev ?? result.stores[0]?.id ?? null);
    } catch (err) {
      console.error("加载买手店列表失败:", err);
      setError(err instanceof Error ? err.message : "加载买手店失败");
    } finally {
      if (mode === "initial") setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

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
      if (!needProfile && !needCards && !needProducts && !needBanners) return;

      configInFlightRef.current.add(storeId);
      try {
        const [profileResult, cardsResult, productsResult, bannersResult] =
          await Promise.allSettled([
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
            setProductsMap((prev) => ({
              ...prev,
              [storeId]: productsResult.value?.products ?? [],
            }));
          } else {
            console.warn(
              "[useBuyerTabData] load products failed:",
              productsResult.reason
            );
            setProductsMap((prev) => ({ ...prev, [storeId]: [] }));
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
      } finally {
        configInFlightRef.current.delete(storeId);
      }
    },
    [profileConfigMap, entryCardsMap, productsMap, bannersMap]
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
    return buildProfileView(selectedStore, config ?? null);
  }, [selectedStore, profileConfigMap]);

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

  const banner = useMemo<BuyerStoreFeatureBanner | null>(() => {
    if (!selectedStoreId) return null;
    return buildFeatureBanner(bannersMap[selectedStoreId]);
  }, [selectedStoreId, bannersMap]);

  const setSelectedStoreId = useCallback((storeId: string) => {
    setSelectedStoreIdState(storeId);
  }, []);

  const toggleFollow = useCallback(() => {
    if (!selectedStoreId) return;
    setFollowedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedStoreId)) next.delete(selectedStoreId);
      else next.add(selectedStoreId);
      return next;
    });
  }, [selectedStoreId]);

  const toggleProductFavorite = useCallback((productId: string) => {
    setFavoritedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const isFollowed = selectedStoreId ? followedStoreIds.has(selectedStoreId) : false;

  return {
    stores: shortcuts,
    storeMap,
    selectedStoreId,
    selectedStore,
    selectedProfile,
    entryCards,
    banner,
    products,
    isFollowed,
    isLoading,
    isRefreshing,
    error,
    setSelectedStoreId,
    toggleFollow,
    toggleProductFavorite,
    favoritedProductIds,
    refresh,
  };
};
