import { useState, useCallback, useEffect, useRef } from "react";
import { getRecommendPosts, getForumPosts, getFollowingPosts, likePost, unlikePost } from "../../../services/postService";
import { userInfoService, UserInfo } from "../../../services/userInfoService";
import { useAuthStore } from "../../../store/authStore";
import { getActiveBanners, Banner } from "../../../services/bannerService";
import { getCommunities, CommunityListResponse } from "../../../services/communityService";
import { DisplayPost, TabType, UserInfoCache } from "../types";
import { mapApiPostToDisplayPost } from "../utils";
import { Alert } from "../../../utils/Alert";

// 每个 Tab 的加载状态
interface TabLoadingState {
  forum: boolean;
  recommend: boolean;
  following: boolean;
}

// 每个 Tab 是否已加载过
interface TabLoadedState {
  forum: boolean;
  recommend: boolean;
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
  // 操作方法
  handleRefresh: (activeTab: TabType) => Promise<void>;
  handleLike: (postId: string) => Promise<void>;
  loadTabData: (tab: TabType) => Promise<void>;
  setRecommendPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  setForumPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  setFollowingPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
}

/**
 * 发现页数据获取 Hook
 * 管理所有数据的获取、缓存和刷新逻辑
 * 支持懒加载：滑动到对应 tab 时才加载数据
 */
export const useDiscoverData = (): UseDiscoverDataReturn => {
  const { user } = useAuthStore();
  const [recommendPosts, setRecommendPosts] = useState<DisplayPost[]>([]);
  const [forumPosts, setForumPosts] = useState<DisplayPost[]>([]);
  const [followingPosts, setFollowingPosts] = useState<DisplayPost[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [communities, setCommunities] = useState<CommunityListResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每个 Tab 独立的加载状态
  const [tabLoading, setTabLoading] = useState<TabLoadingState>({
    forum: false,
    recommend: false,
    following: false,
  });

  // 每个 Tab 是否已加载过
  const [tabLoaded, setTabLoaded] = useState<TabLoadedState>({
    forum: false,
    recommend: false,
    following: false,
  });

  // 缓存用户信息
  const userInfoCache = useRef<UserInfoCache>(new Map());

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
      results.forEach((result) => {
        if (result && result.info) {
          existingMap.set(result.userId, result.info);
          userInfoCache.current.set(result.userId, result.info);
        }
      });

      return existingMap;
    },
    []
  );

  /**
   * 获取推荐帖子（非论坛帖子）
   */
  const fetchRecommendPosts = useCallback(async () => {
    try {
      setError(null);
      const apiPosts = await getRecommendPosts();

      const userIds = [...new Set(apiPosts.map((post) => post.userId))];
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      await fetchUserInfos(userIds, userInfoMap);

      const displayPosts = apiPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setRecommendPosts(displayPosts);
    } catch (err) {
      console.error("获取推荐帖子失败:", err);
      setError(err instanceof Error ? err.message : "获取推荐帖子失败");
      setRecommendPosts([]);
    }
  }, [fetchUserInfos]);

  /**
   * 获取论坛帖子
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
    } catch (err) {
      console.error("获取论坛帖子失败:", err);
      setForumPosts([]);
    }
  }, [fetchUserInfos]);

  /**
   * 获取 Banner 数据
   */
  const fetchBanners = useCallback(async () => {
    try {
      const activeBanners = await getActiveBanners();
      setBanners(activeBanners);
    } catch (err) {
      console.error("获取 Banner 失败:", err);
      setBanners([]);
    }
  }, []);

  /**
   * 获取关注用户的帖子
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
    } catch (err) {
      console.error("获取关注帖子失败:", err);
      setFollowingPosts([]);
    }
  }, [fetchUserInfos]);

  /**
   * 获取社区列表（带重试机制）
   */
  const fetchCommunities = useCallback(async (retryCount = 0) => {
    try {
      const communityData = await getCommunities();
      if (communityData && communityData.popular) {
        setCommunities(communityData);
      } else {
        console.warn("社区数据格式异常:", communityData);
        setCommunities({ popular: [], following: [], all: [] });
      }
    } catch (err) {
      console.error("获取社区列表失败:", err);
      if (retryCount < 2) {
        console.log(`重试获取社区列表... (${retryCount + 1}/2)`);
        setTimeout(() => fetchCommunities(retryCount + 1), 1000);
      } else {
        setCommunities({ popular: [], following: [], all: [] });
      }
    }
  }, []);

  /**
   * 加载指定 Tab 的数据（懒加载）
   */
  const loadTabData = useCallback(
    async (tab: TabType) => {
      if (tabLoaded[tab] || tabLoading[tab]) {
        return;
      }

      setTabLoading((prev) => ({ ...prev, [tab]: true }));

      try {
        if (tab === "forum") {
          await Promise.all([fetchForumPosts(), fetchBanners(), fetchCommunities()]);
        } else if (tab === "recommend") {
          await Promise.all([fetchRecommendPosts(), fetchBanners()]);
        } else if (tab === "following") {
          await fetchFollowingPosts();
        }
        setTabLoaded((prev) => ({ ...prev, [tab]: true }));
      } catch (err) {
        console.error(`加载 ${tab} tab 数据失败:`, err);
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [tabLoaded, tabLoading, fetchRecommendPosts, fetchForumPosts, fetchFollowingPosts, fetchBanners, fetchCommunities]
  );

  /**
   * 初始化加载数据 - 只加载推荐 tab 的数据（默认显示的 tab）
   */
  useEffect(() => {
    const initData = async () => {
      setTabLoading((prev) => ({ ...prev, recommend: true }));
      try {
        await Promise.all([fetchRecommendPosts(), fetchBanners()]);
        setTabLoaded((prev) => ({ ...prev, recommend: true }));
      } catch (err) {
        console.error("初始化加载推荐数据失败:", err);
      } finally {
        setTabLoading((prev) => ({ ...prev, recommend: false }));
      }
      setIsInitialized(true);
    };
    initData();
  }, [fetchRecommendPosts, fetchBanners]);

  /**
   * 刷新数据 - 刷新时也更新 tabLoaded 状态
   */
  const handleRefresh = useCallback(
    async (activeTab: TabType) => {
      setRefreshing(true);
      try {
        if (activeTab === "forum") {
          await Promise.all([fetchForumPosts(), fetchBanners(), fetchCommunities()]);
        } else if (activeTab === "recommend") {
          await Promise.all([fetchRecommendPosts(), fetchBanners()]);
        } else {
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
   * 点赞/取消点赞
   */
  const handleLike = useCallback(
    async (postId: string) => {
      const targetRecommend = recommendPosts.find((p) => p.id === postId);
      const targetForum = forumPosts.find((p) => p.id === postId);
      const targetFollowing = followingPosts.find((p) => p.id === postId);
      const target = targetRecommend || targetForum || targetFollowing;

      if (!target) return;

      const isCurrentlyLiked = target.engagement.isLiked;

      const updatePost = (post: DisplayPost) =>
        post.id === postId
          ? {
              ...post,
              engagement: {
                ...post.engagement,
                isLiked: !isCurrentlyLiked,
                likes: isCurrentlyLiked
                  ? post.engagement.likes - 1
                  : post.engagement.likes + 1,
              },
            }
          : post;

      if (targetRecommend) {
        setRecommendPosts((prev) => prev.map(updatePost));
      }
      if (targetForum) {
        setForumPosts((prev) => prev.map(updatePost));
      }
      if (targetFollowing) {
        setFollowingPosts((prev) => prev.map(updatePost));
      }

      try {
        const numericPostId = parseInt(postId, 10);
        const userId = user?.id ? parseInt(user.id, 10) : 0;

        if (isCurrentlyLiked) {
          await unlikePost(numericPostId, userId);
          Alert.show("已取消点赞");
        } else {
          await likePost(numericPostId, userId);
          Alert.show("点赞成功");
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
                    : post.engagement.likes - 1,
                },
              }
            : post;

        if (targetRecommend) {
          setRecommendPosts((prev) => prev.map(rollbackPost));
        }
        if (targetForum) {
          setForumPosts((prev) => prev.map(rollbackPost));
        }
        if (targetFollowing) {
          setFollowingPosts((prev) => prev.map(rollbackPost));
        }
      }
    },
    [recommendPosts, forumPosts, followingPosts, user]
  );

  return {
    recommendPosts,
    forumPosts,
    followingPosts,
    banners,
    communities,
    isInitialized,
    refreshing,
    loading,
    error,
    userInfoCache,
    tabLoading,
    tabLoaded,
    handleRefresh,
    handleLike,
    loadTabData,
    setRecommendPosts,
    setForumPosts,
    setFollowingPosts,
  };
};

export default useDiscoverData;
