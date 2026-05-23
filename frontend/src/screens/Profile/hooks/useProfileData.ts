import { useState, useCallback } from "react";
import i18n from "@/i18n";
import { useAuthStore } from "../../../store/authStore";
import {
  postService,
  Post as ApiPost,
  UserPostStats,
} from "../../../services/postService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
  UserTitle,
} from "../../../services/userInfoService";
import {
  getFollowingCount,
  getFollowersCount,
  getFollowingBrands,
  FollowingBrand,
} from "../../../services/followService";
import { Post as DisplayPost } from "../../../components/PostCard";
import { showService, Show } from "../../../services/showService";
import { brandService, BrandSubmission } from "../../../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
  UserStoreActivity,
  CONTRIBUTION_PAGE_SIZE,
} from "../../../services/buyerStoreService";
import {
  listMyFavoritedStoreProducts,
  listMyLikedStoreProducts,
  listMyWantedStoreProducts,
} from "../../../services/storeProductService";
import {
  TabType,
  TabData,
  initialTabState,
  ContribSubTab,
  StoreActivitySubTab,
  ProductActivitySubTab,
  ProductListState,
  initialProductListState,
} from "../types";
import { Alert } from "../../../utils/Alert";
import { resolveAvatarUrlOrEmpty } from "../../../utils/avatarUtils";

function convertToDisplayPost(
  apiPost: ApiPost,
  authorInfo: { name: string; avatar: string }
): DisplayPost {
  return {
    id: String(apiPost.id),
    type: apiPost.postType,
    auditStatus: apiPost.auditStatus,
    title: apiPost.title || i18n.t("community.noTitle"),
    image: apiPost.imageUrls?.[0] || "",
    author: {
      id: String(apiPost.userId),
      name: authorInfo.name,
      avatar: resolveAvatarUrlOrEmpty(authorInfo.avatar),
    },
    content: {
      title: apiPost.title || i18n.t("community.noTitle"),
      description: apiPost.contentText || "",
      images: apiPost.imageUrls || [],
      coverAspectRatio:
        apiPost.coverWidth && apiPost.coverHeight && apiPost.coverHeight > 0
          ? apiPost.coverWidth / apiPost.coverHeight
          : undefined,
    },
    engagement: {
      likes: apiPost.likeCount || 0,
      saves: apiPost.favoriteCount || 0,
      comments: apiPost.commentCount || 0,
      isLiked: apiPost.likedByMe || false,
      isSaved: apiPost.favoritedByMe || false,
    },
    likes: apiPost.likeCount || 0,
    productName: apiPost.productName,
    brandName: apiPost.brandName,
    rating: apiPost.rating,
  } as DisplayPost & { status?: string };
}

export function useProfileData() {
  const { user, updateProfile } = useAuthStore();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [followingUsersCount, setFollowingUsersCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [followedBrands, setFollowedBrands] = useState<FollowingBrand[]>([]);
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [postStats, setPostStats] = useState<UserPostStats | null>(null);

  const [contribSubTab, setContribSubTab] = useState<ContribSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribLoaded, setContribLoaded] = useState(false);

  const [storeActivitySubTab, setStoreActivitySubTab] = useState<StoreActivitySubTab>("favorites");
  const [storeActivity, setStoreActivity] = useState<UserStoreActivity | null>(null);
  const [storeActivityLoading, setStoreActivityLoading] = useState(false);
  const [storeActivityLoaded, setStoreActivityLoaded] = useState(false);

  // 商品级活动 —— 嵌套在 storeActivity tab 下的"商品"二级 tab。三个独立列表，
  // 每个有自己的加载/已加载/total，避免切换时复用脏数据。
  const [productActivitySubTab, setProductActivitySubTab] =
    useState<ProductActivitySubTab>("likes");
  const [productLikes, setProductLikes] = useState<ProductListState>({ ...initialProductListState });
  const [productSaved, setProductSaved] = useState<ProductListState>({ ...initialProductListState });
  const [productWanted, setProductWanted] = useState<ProductListState>({ ...initialProductListState });

  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    published: { ...initialTabState },
    pending: { ...initialTabState },
    draft: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
    forum: { ...initialTabState },
    archive: { ...initialTabState },
    wishlist: { ...initialTabState },
    storeActivity: { ...initialTabState },
  });

  const updateTabState = useCallback(
    (tab: TabType, updates: Partial<TabData>) => {
      setTabsData((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], ...updates },
      }));
    },
    []
  );

  const resetTabsData = useCallback(() => {
    setTabsData({
      published: { ...initialTabState },
      pending: { ...initialTabState },
      draft: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
      forum: { ...initialTabState },
      archive: { ...initialTabState },
      wishlist: { ...initialTabState },
      storeActivity: { ...initialTabState },
    });
    setContribLoaded(false);
    setStoreActivityLoaded(false);
    setProductLikes({ ...initialProductListState });
    setProductSaved({ ...initialProductListState });
    setProductWanted({ ...initialProductListState });
  }, []);

  const loadUserInfo = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const info = await userInfoService.getUserInfo(user.userId);
      setUserInfo(info);
      if (info) {
        updateProfile({
          username: info.username,
          bio: info.bio,
          location: info.location,
          avatar: info.avatarUrl,
        });
        if (info.coverUrl) {
          setCoverImage(info.coverUrl);
        }
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  }, [user?.userId, updateProfile]);

  const loadFollowingUsersCount = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowingCount(user.userId);
      setFollowingUsersCount(count);
    } catch (error) {
      console.error("Error loading following users count:", error);
    }
  }, [user?.userId]);

  const loadFollowersCount = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowersCount(user.userId);
      setFollowersCount(count);
    } catch (error) {
      console.error("Error loading followers count:", error);
    }
  }, [user?.userId]);

  const loadUserProfile = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const profile = await userInfoService.getUserProfile(user.userId);
      setUserProfile(profile);
      if (profile?.coverUrl) {
        setCoverImage(profile.coverUrl);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }, [user?.userId]);

  const loadFollowedBrands = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const brands = await getFollowingBrands(user.userId);
      setFollowedBrands(brands);
    } catch (error) {
      console.error("Error loading followed brands:", error);
    }
  }, [user?.userId]);

  const loadUserTitles = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const titles = await userInfoService.getUserTitles(user.userId);
      setUserTitles(titles);
    } catch (error) {
      console.error("Error loading user titles:", error);
    }
  }, [user?.userId]);

  const loadPostStats = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const stats = await postService.getUserPostStats(user.userId);
      setPostStats(stats);
    } catch (error) {
      console.error("Error loading post stats:", error);
    }
  }, [user?.userId]);

  const loadContributions = useCallback(async () => {
    if (!user?.userId) return;
    setContribLoading(true);
    try {
      const [showsRes, brandsRes, storesRes] = await Promise.all([
        showService.getMyShows(),
        brandService.getMySubmissions(),
        buyerStoreService.getMySubmissions(1, CONTRIBUTION_PAGE_SIZE),
      ]);
      setMyShows(showsRes);
      setMyBrands(brandsRes);
      setMyStores(storesRes.stores);
    } catch (err) {
      console.error("Error loading contributions:", err);
    } finally {
      setContribLoading(false);
      setContribLoaded(true);
    }
  }, [user?.userId]);

  const loadStoreActivity = useCallback(async () => {
    if (!user?.userId) return;
    setStoreActivityLoading(true);
    try {
      const activity = await buyerStoreService.getUserStoreActivity();
      setStoreActivity(activity);
      const totalCount = activity.favoritesTotal + activity.commentsTotal + activity.ratingsTotal;
      updateTabState("storeActivity", { count: totalCount, hasLoaded: true, isLoading: false });
    } catch (err) {
      console.error("Error loading store activity:", err);
    } finally {
      setStoreActivityLoading(false);
      setStoreActivityLoaded(true);
    }
  }, [user?.userId, updateTabState]);

  /**
   * 按需加载商品级活动列表（lazy）。三种 sub-sub-tab 走同一个分发器：
   *   - likes    -> /user/liked-products
   *   - saved    -> /user/favorited-products
   *   - wishlist -> /user/wanted-products
   *
   * `force=true` 时重拉，用于下拉刷新；否则若 hasLoaded 直接跳过。
   */
  const loadProductActivity = useCallback(
    async (sub: ProductActivitySubTab, force = false) => {
      if (!user?.userId) return;

      const get = (s: ProductActivitySubTab) =>
        s === "likes" ? productLikes : s === "saved" ? productSaved : productWanted;
      const set = (s: ProductActivitySubTab, value: ProductListState) => {
        if (s === "likes") setProductLikes(value);
        else if (s === "saved") setProductSaved(value);
        else setProductWanted(value);
      };

      const prev = get(sub);
      if (!force && prev.hasLoaded) return;

      set(sub, { ...prev, isLoading: true });
      try {
        const res =
          sub === "likes"
            ? await listMyLikedStoreProducts(1, 50)
            : sub === "saved"
              ? await listMyFavoritedStoreProducts(1, 50)
              : await listMyWantedStoreProducts(1, 50);
        set(sub, {
          products: res.products || [],
          total: res.total || 0,
          isLoading: false,
          hasLoaded: true,
        });
      } catch (err) {
        console.error(`Error loading product ${sub}:`, err);
        set(sub, { ...prev, isLoading: false, hasLoaded: true });
      }
    },
    // 故意不把 productLikes/Saved/Wanted 放进 deps：闭包抓最新值就够了；
    // 写进去会让每次 setState 都重建函数，触发 useEffect 链路重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.userId]
  );

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!user?.userId) return;
      if (targetTab === "archive" || targetTab === "storeActivity") return;
      if (!isRefresh && tabsData[targetTab].hasLoaded) return;

      updateTabState(targetTab, { isLoading: true });

      try {
        const authorName = userInfo?.username || user?.username || i18n.t("profile.user");
        const authorAvatar = resolveAvatarUrlOrEmpty(
          userInfo?.avatarUrl,
          user?.avatar,
        );

        let newPosts: DisplayPost[] = [];

        if (targetTab === "published" || targetTab === "pending") {
          const apiPosts = await postService.getPostsByUserId(user.userId, "PUBLISHED");

          // "pending" tab 收纳所有「未对外可见」的笔记：审核中 + 已驳回。
          // 不再按 communityId 过滤，让论坛被驳回帖子也能被作者找到、修改。
          // REJECTED 在前面：用户看到时更紧迫，需要先处理。
          const pendingPosts = apiPosts
            .filter(
              (p: ApiPost) =>
                p.auditStatus === "PENDING" || p.auditStatus === "REJECTED"
            )
            .sort((a, b) => {
              const rank = (p: ApiPost) => (p.auditStatus === "REJECTED" ? 0 : 1);
              return rank(a) - rank(b);
            })
            .map((p) => convertToDisplayPost(p, { name: authorName, avatar: authorAvatar }));

          const approvedPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "APPROVED" && p.communityId == null)
            .map((p) => convertToDisplayPost(p, { name: authorName, avatar: authorAvatar }));

          setTabsData((prev) => ({
            ...prev,
            published: { posts: approvedPosts, count: approvedPosts.length, isLoading: false, hasLoaded: true },
            pending: { posts: pendingPosts, count: pendingPosts.length, isLoading: false, hasLoaded: true },
          }));
          return;
        }

        if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(user.userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || i18n.t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
            })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(user.userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || i18n.t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
            })
          );
        } else if (targetTab === "draft") {
          const apiPosts = await postService.getPostsByUserId(user.userId, "DRAFT");
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "forum") {
          const apiPosts = await postService.getPostsByUserId(user.userId, "PUBLISHED");
          newPosts = apiPosts
            .filter((p: ApiPost) => p.communityId != null && p.auditStatus === "APPROVED")
            .map((p) => convertToDisplayPost(p, { name: authorName, avatar: authorAvatar }));
        } else if (targetTab === "wishlist") {
          const apiPosts = await postService.getWantedPostsByUserId(user.userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || i18n.t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
            })
          );
        }

        updateTabState(targetTab, { posts: newPosts, count: newPosts.length, isLoading: false, hasLoaded: true });
      } catch (error) {
        console.error(`Error loading ${targetTab}:`, error);
        updateTabState(targetTab, { isLoading: false });
        Alert.show(i18n.t("common.loadFailed"));
      }
    },
    [user?.userId, userInfo, tabsData, updateTabState]
  );

  const loadAllProfileData = useCallback(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowingUsersCount();
    loadFollowersCount();
    loadFollowedBrands();
    loadUserTitles();
    loadPostStats();
  }, [loadUserInfo, loadUserProfile, loadFollowingUsersCount, loadFollowersCount, loadFollowedBrands, loadUserTitles, loadPostStats]);

  return {
    userInfo,
    userProfile,
    followingUsersCount,
    followersCount,
    coverImage,
    followedBrands,
    userTitles,
    postStats,
    contribSubTab,
    setContribSubTab,
    myShows,
    myBrands,
    myStores,
    contribLoading,
    contribLoaded,
    storeActivitySubTab,
    setStoreActivitySubTab,
    storeActivity,
    storeActivityLoading,
    storeActivityLoaded,
    productActivitySubTab,
    setProductActivitySubTab,
    productLikes,
    productSaved,
    productWanted,
    loadProductActivity,
    tabsData,
    setTabsData,
    updateTabState,
    resetTabsData,
    loadUserInfo,
    loadUserProfile,
    loadFollowingUsersCount,
    loadFollowersCount,
    loadFollowedBrands,
    loadUserTitles,
    loadPostStats,
    loadContributions,
    loadStoreActivity,
    fetchTabData,
    loadAllProfileData,
  };
}
