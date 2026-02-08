import { useState, useCallback, useEffect, useRef } from "react";
import { getPosts, getForumPosts, likePost, unlikePost } from "../../../services/postService";
import { userInfoService, UserInfo } from "../../../services/userInfoService";
import { useAuthStore } from "../../../store/authStore";
import { getFollowingUsers, FollowingUser } from "../../../services/followService";
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
  // 状态
  posts: DisplayPost[];
  forumPosts: DisplayPost[];
  banners: Banner[];
  followingUserIds: number[];
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
  setPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  setForumPosts: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
}

/**
 * 发现页数据获取 Hook
 * 管理所有数据的获取、缓存和刷新逻辑
 * 支持懒加载：滑动到对应 tab 时才加载数据
 */
export const useDiscoverData = (): UseDiscoverDataReturn => {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [forumPosts, setForumPosts] = useState<DisplayPost[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [followingUserIds, setFollowingUserIds] = useState<number[]>([]);
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
   * 从后端获取帖子数据
   */
  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      const apiPosts = await getPosts();

      // 只显示已发布的帖子
      const publishedPosts = apiPosts.filter(
        (post) => post.status === "PUBLISHED"
      );

      // 收集所有不同的 userId
      const userIds = [...new Set(publishedPosts.map((post) => post.userId))];

      // 获取所有用户信息
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      await fetchUserInfos(userIds, userInfoMap);

      // 转换为前端展示格式
      const displayPosts = publishedPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setPosts(displayPosts);
    } catch (err) {
      console.error("获取帖子失败:", err);
      setError(err instanceof Error ? err.message : "获取帖子失败");
      setPosts([]);
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
   * 获取关注的用户列表
   */
  const fetchFollowingUsers = useCallback(async () => {
    if (!user?.userId) return;

    try {
      const followingList = await getFollowingUsers(user.userId);
      const userIds = followingList.map((item: FollowingUser) => item.userId);
      setFollowingUserIds(userIds);
      console.log("关注的用户数量:", userIds.length);
    } catch (err) {
      console.error("获取关注列表失败:", err);
      setFollowingUserIds([]);
    }
  }, [user?.userId]);

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
      // 如果已经加载过或正在加载，则跳过
      if (tabLoaded[tab] || tabLoading[tab]) {
        return;
      }

      setTabLoading((prev) => ({ ...prev, [tab]: true }));

      try {
        if (tab === "forum") {
          await Promise.all([fetchForumPosts(), fetchBanners(), fetchCommunities()]);
        } else if (tab === "recommend") {
          await Promise.all([fetchPosts(), fetchBanners()]);
        } else if (tab === "following") {
          await Promise.all([fetchPosts(), fetchFollowingUsers()]);
        }
        setTabLoaded((prev) => ({ ...prev, [tab]: true }));
      } catch (err) {
        console.error(`加载 ${tab} tab 数据失败:`, err);
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [tabLoaded, tabLoading, fetchPosts, fetchForumPosts, fetchBanners, fetchCommunities, fetchFollowingUsers]
  );

  /**
   * 初始化加载数据 - 只加载推荐 tab 的数据（默认显示的 tab）
   */
  useEffect(() => {
    const initData = async () => {
      setTabLoading((prev) => ({ ...prev, recommend: true }));
      try {
        await Promise.all([fetchPosts(), fetchBanners()]);
        setTabLoaded((prev) => ({ ...prev, recommend: true }));
      } catch (err) {
        console.error("初始化加载推荐数据失败:", err);
      } finally {
        setTabLoading((prev) => ({ ...prev, recommend: false }));
      }
      setIsInitialized(true);
    };
    initData();
  }, [fetchPosts, fetchBanners]);

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
          await Promise.all([fetchPosts(), fetchBanners()]);
        } else {
          await Promise.all([fetchPosts(), fetchFollowingUsers()]);
        }
        // 刷新成功后确保标记为已加载
        setTabLoaded((prev) => ({ ...prev, [activeTab]: true }));
      } catch (err) {
        console.error(`刷新 ${activeTab} 数据失败:`, err);
      } finally {
        setRefreshing(false);
      }
    },
    [fetchPosts, fetchFollowingUsers, fetchBanners, fetchForumPosts, fetchCommunities]
  );

  /**
   * 点赞/取消点赞
   */
  const handleLike = useCallback(
    async (postId: string) => {
      // 同时在 posts 和 forumPosts 中查找目标帖子
      const targetPost = posts.find((p) => p.id === postId);
      const targetForumPost = forumPosts.find((p) => p.id === postId);
      const target = targetPost || targetForumPost;
      
      if (!target) return;

      const isCurrentlyLiked = target.engagement.isLiked;

      // 乐观更新 UI
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

      // 根据帖子来源更新对应的状态
      if (targetPost) {
        setPosts((prevPosts) => prevPosts.map(updatePost));
      }
      if (targetForumPost) {
        setForumPosts((prevPosts) => prevPosts.map(updatePost));
      }

      // 调用 API
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
        // 回滚 UI 状态
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

        if (targetPost) {
          setPosts((prevPosts) => prevPosts.map(rollbackPost));
        }
        if (targetForumPost) {
          setForumPosts((prevPosts) => prevPosts.map(rollbackPost));
        }
      }
    },
    [posts, forumPosts, user]
  );

  return {
    posts,
    forumPosts,
    banners,
    followingUserIds,
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
    setPosts,
    setForumPosts,
  };
};

export default useDiscoverData;
