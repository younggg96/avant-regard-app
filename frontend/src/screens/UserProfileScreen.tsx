import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView as RNScrollView,
  FlatList,
  StyleSheet,
  View,
  Modal,
  StatusBar,
  Text as RNText,
  Image as RNImage,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useDerivedValue,
  interpolate,
  Extrapolation,
  runOnJS,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  OptimizedImage,
} from "../components/ui";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import { postService, Post as ApiPost, likePost, unlikePost } from "../services/postService";
import {
  followService,
  isFollowingUser,
  isMutualFollow,
  getFollowersCount,
  getFollowingCount,
  getFollowingBrands,
  FollowingBrand,
} from "../services/followService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
  UserPrivacySettings,
  UserTitle,
  getUserTitles,
} from "../services/userInfoService";
import ForumPostCard from "../components/ForumPostCard";
import PostCard, { Post as DisplayPost } from "../components/PostCard";
import { splitIntoMasonryColumns } from "../utils/masonryLayout";
import { ImageCropper } from "../components/ImageCropper";
import { AvatarPreviewModal } from "../components/AvatarPreviewModal";
import { showService, Show } from "../services/showService";
import { brandService, BrandSubmission } from "../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
  CONTRIBUTION_PAGE_SIZE,
} from "../services/buyerStoreService";
import { ShareToChatModal } from "../components/ShareToChatModal";
import { LevelBadge } from "../components/level";
import { levelService } from "../services/levelService";

type TabType = "posts" | "forum" | "saved" | "liked" | "archive" | "wishlist";

type TabData = {
  posts: DisplayPost[];
  isLoading: boolean;
  hasLoaded: boolean;
  count: number;
};

const initialTabState: TabData = {
  posts: [],
  isLoading: false,
  hasLoaded: false,
  count: 0,
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ContribSubTab = "show" | "brand" | "store";

// --- 布局常量 ---
const COVER_HEIGHT = 200;
const AVATAR_SIZE = 80;
const AVATAR_SIZE_SMALL = 32;
const AVATAR_BORDER = 4;
const HEADER_CONTENT_HEIGHT = 44; // 导航栏内容高度
const TAB_BAR_HEIGHT = 44; // Tab栏高度

// 注意：HEADER_FADE_THRESHOLD 移到组件内部计算，以便获取准确的 insets

const AnimatedScrollView = Animated.createAnimatedComponent(RNScrollView);

const UserProfileScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuthStore();

  // 1. 动态计算 Header 总高度 (刘海 + 44px)
  const headerTotalHeight = insets.top + HEADER_CONTENT_HEIGHT;

  // 2. 关键修复：计算准确的吸顶/变色阈值 
  // 当封面底部 刚好碰到 Header 底部时，Header 应该完全变白
  const headerFadeThreshold = COVER_HEIGHT - headerTotalHeight;

  const { userId, username, avatar } = route.params as {
    userId: number;
    username?: string;
    avatar?: string;
  };

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [refreshing, setRefreshing] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempCropImage, setTempCropImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings | null>(null);
  const [followedBrands, setFollowedBrands] = useState<FollowingBrand[]>([]);
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [showShareToChat, setShowShareToChat] = useState(false);
  const [otherLevel, setOtherLevel] = useState<number>(0);

  // Contribution states
  const [contribSubTab, setContribSubTab] = useState<ContribSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribLoaded, setContribLoaded] = useState(false);

  const tabBarAnchorY = useSharedValue(9999);
  const tabScrollViewRef = useRef<RNScrollView>(null);
  const isCurrentUser = currentUser?.userId === userId;
  const scrollY = useSharedValue(0);

  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    posts: { ...initialTabState },
    forum: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
    archive: { ...initialTabState },
    wishlist: { ...initialTabState },
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

  const allTabs: { id: TabType; label: string }[] = [
    { id: "posts", label: t("profile.published") },
    { id: "forum", label: t("profile.forum") },
    { id: "saved", label: t("profile.saved") },
    { id: "liked", label: t("profile.liked") },
    { id: "wishlist", label: t("profile.wishlist") },
    { id: "archive", label: t("profile.contributions") },
  ];

  const tabs = isCurrentUser
    ? allTabs
    : allTabs.filter((tab) => {
      if (tab.id === "saved") return true;
      if (tab.id === "liked") return !(privacySettings?.hideLikes ?? false);
      if (tab.id === "wishlist") return !(privacySettings?.hideWishlist ?? false);
      return true;
    });

  const convertToDisplayPost = (
    apiPost: ApiPost,
    authorInfo: { name: string; avatar: string }
  ): DisplayPost => {
    const validImages = (apiPost.imageUrls || []).filter((url) => url && url.trim() !== "");
    const firstImage = validImages[0] || "https://picsum.photos/id/1/600/800";

    return {
      id: String(apiPost.id),
      type: apiPost.postType,
      auditStatus: apiPost.auditStatus,
      title: apiPost.title || "无标题",
      image: firstImage,
      author: {
        id: String(apiPost.userId),
        name: authorInfo.name,
        avatar: authorInfo.avatar,
      },
      content: {
        title: apiPost.title || "无标题",
        description: apiPost.contentText || "",
        images: validImages.length > 0 ? validImages : [firstImage],
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
    };
  };

  const loadUserInfo = async () => {
    try {
      const info = await userInfoService.getUserInfo(userId);
      setUserInfo(info);
      if (info.coverUrl) {
        setCoverImage(info.coverUrl);
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await userInfoService.getUserProfile(userId);
      setUserProfile(profile);
      if (profile.coverUrl) {
        setCoverImage(profile.coverUrl);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadPrivacySettings = async () => {
    try {
      const settings = await userInfoService.getPrivacySettings(userId);
      setPrivacySettings(settings);
    } catch (error) {
      console.error("Error loading privacy settings:", error);
    }
  };

  const loadFollowCounts = async () => {
    try {
      const [followers, following] = await Promise.all([
        getFollowersCount(userId),
        getFollowingCount(userId),
      ]);
      setFollowersCount(followers);
      setFollowingCount(following);
    } catch (error) {
      console.error("Error loading follow counts:", error);
    }
  };

  const loadFollowedBrands = async () => {
    try {
      const brands = await getFollowingBrands(userId);
      setFollowedBrands(brands);
    } catch (error) {
      console.error("Error loading followed brands:", error);
    }
  };

  const loadUserTitles = async () => {
    try {
      const titles = await getUserTitles(userId);
      setUserTitles(titles);
    } catch (error) {
      console.error("Error loading user titles:", error);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUser?.userId || isCurrentUser) return;
    try {
      const [isFollowingResult, isMutualResult] = await Promise.all([
        isFollowingUser(currentUser.userId, userId),
        isMutualFollow(currentUser.userId, userId),
      ]);
      setIsFollowing(isFollowingResult);
      setIsMutual(isMutualResult);
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (targetTab === "archive") return;
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }
      updateTabState(targetTab, { isLoading: true });
      try {
        const authorName = userInfo?.username || username || "用户";
        const authorAvatar =
          userInfo?.avatarUrl ||
          avatar ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`;

        let newPosts: DisplayPost[] = [];

        if (targetTab === "posts") {
          const apiPosts = await postService.getPostsByUserId(
            userId,
            "PUBLISHED"
          );
          const approvedPosts = apiPosts.filter(
            (p: ApiPost) => p.auditStatus === "APPROVED" && p.communityId == null
          );
          newPosts = approvedPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "forum") {
          const apiPosts = await postService.getPostsByUserId(
            userId,
            "PUBLISHED"
          );
          const forumPosts = apiPosts.filter(
            (p: ApiPost) => p.auditStatus === "APPROVED" && p.communityId != null
          );
          newPosts = forumPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || "用户",
              avatar: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${p.userId}`,
            })
          );
        } else if (targetTab === "liked") {
          if (!isCurrentUser && privacySettings?.hideLikes) {
            updateTabState(targetTab, {
              posts: [],
              count: 0,
              isLoading: false,
              hasLoaded: true,
            });
            return;
          }
          const apiPosts = await postService.getLikedPostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || "用户",
              avatar: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${p.userId}`,
            })
          );
        } else if (targetTab === "wishlist") {
          if (!isCurrentUser && privacySettings?.hideWishlist) {
            updateTabState(targetTab, {
              posts: [],
              count: 0,
              isLoading: false,
              hasLoaded: true,
            });
            return;
          }
          const apiPosts = await postService.getWantedPostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || "用户",
              avatar: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${p.userId}`,
            })
          );
        }
        updateTabState(targetTab, {
          posts: newPosts,
          count: newPosts.length,
          isLoading: false,
          hasLoaded: true,
        });
      } catch (error) {
        console.error(`Error loading ${targetTab}:`, error);
        updateTabState(targetTab, { isLoading: false });
      }
    },
    [userId, userInfo, username, avatar, tabsData, updateTabState, isCurrentUser, privacySettings]
  );

  const loadContributions = useCallback(async () => {
    setContribLoading(true);
    try {
      if (isCurrentUser && currentUser?.userId) {
        const [showsRes, brandsRes, storesRes] = await Promise.all([
          showService.getMyShows(),
          brandService.getMySubmissions(),
          buyerStoreService.getMySubmissions(1, CONTRIBUTION_PAGE_SIZE),
        ]);
        setMyShows(showsRes);
        setMyBrands(brandsRes);
        setMyStores(storesRes.stores);
      } else {
        const [showsRes, brandsRes, storesRes] = await Promise.all([
          showService.getShowsByUser(userId),
          brandService.getSubmissionsByUser(userId),
          buyerStoreService.getSubmissionsByUser(userId, 1, CONTRIBUTION_PAGE_SIZE),
        ]);
        setMyShows(showsRes);
        setMyBrands(brandsRes);
        setMyStores(storesRes.stores);
      }
    } catch (err) {
      console.error("Error loading contributions:", err);
    } finally {
      setContribLoading(false);
      setContribLoaded(true);
    }
  }, [currentUser, isCurrentUser, userId]);

  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowCounts();
    checkFollowStatus();
    loadPrivacySettings();
    loadFollowedBrands();
    loadUserTitles();
    setTabsData({
      posts: { ...initialTabState },
      forum: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
      archive: { ...initialTabState },
      wishlist: { ...initialTabState },
    });
    setContribLoaded(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    levelService
      .getUserLevel(userId)
      .then((res) => {
        if (!cancelled) setOtherLevel(res.currentLevel ?? 0);
      })
      .catch(() => {
        if (!cancelled) setOtherLevel(0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (activeTab === "archive") {
      if (!contribLoaded) loadContributions();
    } else {
      fetchTabData(activeTab);
    }
  }, [activeTab, userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowCounts();
      checkFollowStatus();
      loadPrivacySettings();
      loadFollowedBrands();
      loadUserTitles();
      if (activeTab === "archive") {
        loadContributions();
      } else {
        fetchTabData(activeTab, true);
      }
    }, [activeTab, userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const tasks: Promise<any>[] = [
      loadUserInfo(),
      loadUserProfile(),
      loadFollowCounts(),
      checkFollowStatus(),
      loadFollowedBrands(),
      loadUserTitles(),
    ];
    if (activeTab === "archive") {
      tasks.push(loadContributions());
    } else {
      tasks.push(fetchTabData(activeTab, true));
    }
    await Promise.all(tasks);
    setRefreshing(false);
  };

  const handleTabPress = (tabId: TabType) => {
    setActiveTab(tabId);
  };

  const handleFollowToggle = async () => {
    if (!currentUser?.userId) {
      Alert.show("请先登录");
      return;
    }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollowUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(false);
        setIsMutual(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        Alert.show("已取消关注");
      } else {
        await followService.followUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(true);
        const mutual = await isMutualFollow(currentUser.userId, userId);
        setIsMutual(mutual);
        setFollowersCount((prev) => prev + 1);
        Alert.show("关注成功");
      }
    } catch (error) {
      console.error("Follow toggle error:", error);
      const message = error instanceof Error ? error.message : "操作失败";
      Alert.show(message);
    } finally {
      setFollowLoading(false);
    }
  };

  const getGenderText = (gender?: string): string => {
    switch (gender) {
      case "MALE": return "♂";
      case "FEMALE": return "♀";
      default: return "";
    }
  };

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  const getTotalLikes = () => {
    return tabsData.posts.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  };

  const handleCropDone = async (croppedUri: string) => {
    setShowCropper(false);
    setTempCropImage(null);
    if (!currentUser?.userId) return;
    const previousCover = coverImage;
    setCoverImage(croppedUri);
    setUploadingCover(true);
    try {
      const updatedInfo = await userInfoService.uploadCover(
        currentUser.userId,
        croppedUri
      );
      if (updatedInfo.coverUrl) {
        setCoverImage(updatedInfo.coverUrl);
        Alert.show("背景图更新成功");
      }
    } catch (error) {
      console.error("Cover upload error:", error);
      setCoverImage(previousCover);
      Alert.show("背景图上传失败");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempCropImage(null);
  };

  const updateCollapsedState = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // 记录 UI 线程上一次的 collapsed 状态，只在布尔值真正翻转时才触发 JS setState，
  // 避免每帧都 runOnJS 造成抖动/滞后。
  const lastCollapsedShared = useSharedValue(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const collapsed = event.contentOffset.y > headerFadeThreshold;
      if (collapsed !== lastCollapsedShared.value) {
        lastCollapsedShared.value = collapsed;
        runOnJS(updateCollapsedState)(collapsed);
      }
    },
  });

  // --- 动画样式优化 ---

  // 1. 封面视差
  const coverAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, headerFadeThreshold],
      [0, headerFadeThreshold / 2],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.5, 1],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateY }, { scale }] };
  });

  // 2. 吸顶 Header 显隐进度（0 = 隐藏, 1 = 显示）。
  // 使用时间动画代替滚动位置插值，避免快速滑动 / 回弹时
  // opacity 卡在 0.3 ~ 0.7 之间，留下半透明白色覆盖层在封面上的视觉 bug。
  const headerProgress = useDerivedValue(() => {
    const shouldShow = scrollY.value > headerFadeThreshold ? 1 : 0;
    return withTiming(shouldShow, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  });

  const collapsedHeaderAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: headerProgress.value };
  });

  // 3. 顶部透明按钮区 (TopActions) 与吸顶 Header 完全反向，共用同一进度。
  const topActionsAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: 1 - headerProgress.value };
  });

  // 4. 吸顶 Tab 栏动画
  const stickyTabBarAnimatedStyle = useAnimatedStyle(() => {
    if (tabBarAnchorY.value === 9999) return { opacity: 0, zIndex: -1 };

    const stickyTriggerOffset = tabBarAnchorY.value - headerTotalHeight;

    const opacity = interpolate(
      scrollY.value,
      [stickyTriggerOffset, stickyTriggerOffset + 1],
      [0, 1],
      Extrapolation.CLAMP
    );

    const zIndex = scrollY.value > stickyTriggerOffset ? 99 : -1;

    return { opacity, zIndex };
  });

  // 5. 内联 Tab 栏动画
  const inlineTabBarAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: 1 };
  });

  const contentMinHeight = SCREEN_HEIGHT - headerTotalHeight - TAB_BAR_HEIGHT;

  const handleShowPress = (show: Show) => {
    (navigation as any).navigate("CollectionDetail", {
      collection: {
        id: String(show.id),
        title: `${show.brand} ${show.season}`,
        season: show.season,
        year: String(show.year || ""),
        coverImage: show.coverImage || "",
        imageCount: 0,
        designer: show.designer,
        description: show.description,
        category: show.category,
        showUrl: show.showUrl,
        contributorName: show.contributorName,
      },
      brandName: show.brand,
    });
  };

  const handleBrandSubmissionPress = (sub: BrandSubmission) => {
    if (sub.status === "APPROVED") {
      (navigation as any).navigate("BrandDetail", { name: sub.name });
    }
  };

  const handleStoreCardPress = (store: UserSubmittedStore) => {
    if (store.status === "APPROVED" && store.approvedStoreId) {
      (navigation as any).navigate("StoreDetail", { storeId: store.approvedStoreId });
    }
  };

  const renderContributionContent = () => {
    const subTabs: { id: ContribSubTab; label: string; count: number }[] = [
      { id: "show", label: "秀场", count: myShows.length },
      { id: "brand", label: "品牌", count: myBrands.length },
      { id: "store", label: "买手店", count: myStores.length },
    ];

    const getData = () => {
      switch (contribSubTab) {
        case "show": return myShows;
        case "brand": return myBrands;
        case "store": return myStores;
      }
    };
    const data = getData();

    const displayName = userInfo?.username || username || "该用户";
    const emptyIcons: Record<ContribSubTab, string> = {
      show: "film-outline",
      brand: "pricetag-outline",
      store: "storefront-outline",
    };
    const emptyTexts: Record<ContribSubTab, string> = {
      show: isCurrentUser ? "暂无秀场贡献" : `${displayName} 暂无秀场贡献`,
      brand: isCurrentUser ? "暂无品牌贡献" : `${displayName} 暂无品牌贡献`,
      store: isCurrentUser ? "暂无买手店贡献" : `${displayName} 暂无买手店贡献`,
    };

    // Build a displayable post + its press handler for a contribution item.
    // Returning a flat shape (post + onPress) lets the outer masonry splitter
    // know each item's media URI so it can balance columns by natural height.
    const buildContribCard = (
      item: any,
      type: ContribSubTab
    ): { post: DisplayPost; onPress: () => void } => {
      const key = `${type}-${item.id}`;
      const image = type === "store"
        ? (item.images && item.images.length > 0 ? item.images[0] : null)
        : item.coverImage;
      const title = type === "show" ? `${item.brand} ${item.season}` : item.name;
      const onPress = type === "show"
        ? () => handleShowPress(item)
        : type === "brand"
          ? () => handleBrandSubmissionPress(item)
          : () => handleStoreCardPress(item);

      const post: DisplayPost = {
        id: key,
        title,
        image: image || "",
        author: {
          id: String(userId),
          name: userInfo?.username || username || "",
          avatar: userInfo?.avatarUrl || avatar || "",
        },
        content: {
          title,
          images: image ? [image] : [],
        },
        engagement: { likes: 0 },
      };

      return { post, onPress };
    };

    return (
      <VStack>
        {/* Sub filter buttons */}
        <HStack px="$md" py="$sm" style={{ gap: 8 }}>
          {subTabs.map((st) => {
            const isActive = contribSubTab === st.id;
            return (
              <Pressable
                key={st.id}
                style={[contribStyles.filterChip, isActive && contribStyles.filterChipActive]}
                onPress={() => setContribSubTab(st.id)}
              >
                <RNText style={[contribStyles.filterChipText, isActive && contribStyles.filterChipTextActive]}>
                  {st.label}
                </RNText>
                <RNText style={[contribStyles.filterChipCount, isActive && contribStyles.filterChipCountActive]}>
                  {st.count}
                </RNText>
              </Pressable>
            );
          })}
        </HStack>

        {/* Content */}
        {contribLoading ? (
          <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
            <ActivityIndicator color={theme.colors.gray400} />
            <Text fontSize="$sm" color="$gray400" mt="$sm">加载中...</Text>
          </VStack>
        ) : data.length === 0 ? (
          <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
            <Ionicons name={emptyIcons[contribSubTab] as any} size={24} color={theme.colors.gray300} />
            <Text color="$gray400" mt="$md">{emptyTexts[contribSubTab]}</Text>
          </VStack>
        ) : (
          (() => {
            const cards = data.map((item) => buildContribCard(item, contribSubTab));
            const columns = splitIntoMasonryColumns(
              cards,
              ({ post }) => post.content?.images?.[0] || post.image
            );
            return (
              <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
                {columns.map((column, colIndex) => (
                  <VStack key={colIndex} flex={1} space="sm">
                    {column.map(({ post, onPress }) => (
                      <PostCard key={post.id} post={post} onPress={onPress} />
                    ))}
                  </VStack>
                ))}
              </HStack>
            );
          })()
        )}
      </VStack>
    );
  };

  const handleLike = useCallback(
    async (postId: string) => {
      const allPosts = Object.values(tabsData).flatMap((td) => td.posts);
      const target = allPosts.find((p) => p.id === postId);
      if (!target) return;

      const isCurrentlyLiked = !!target.engagement?.isLiked;
      const nextLiked = !isCurrentlyLiked;

      const updatePost = (post: DisplayPost) =>
        post.id === postId
          ? {
              ...post,
              engagement: {
                ...post.engagement,
                isLiked: nextLiked,
                likes: nextLiked
                  ? (post.engagement?.likes || 0) + 1
                  : Math.max(0, (post.engagement?.likes || 0) - 1),
              },
            }
          : post;

      setTabsData((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next) as TabType[]) {
          next[key] = { ...next[key], posts: next[key].posts.map(updatePost) };
        }
        return next;
      });

      try {
        const numericPostId = parseInt(postId, 10);
        const uid = currentUser?.userId || 0;
        if (isCurrentlyLiked) {
          await unlikePost(numericPostId, uid);
        } else {
          await likePost(numericPostId, uid);
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
                    ? (post.engagement?.likes || 0) + 1
                    : Math.max(0, (post.engagement?.likes || 0) - 1),
                },
              }
            : post;

        setTabsData((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next) as TabType[]) {
            next[key] = { ...next[key], posts: next[key].posts.map(rollbackPost) };
          }
          return next;
        });
      }
    },
    [tabsData, currentUser]
  );

  const renderPostsContent = () => {
    if (activeTab === "archive") return renderContributionContent();

    const currentTabData = tabsData[activeTab as Exclude<TabType, "archive">];
    const shouldShowLoading = currentTabData.isLoading && !currentTabData.hasLoaded;

    if (shouldShowLoading) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
          <Text fontSize="$sm" color="$gray400" mt="$sm">加载中...</Text>
        </VStack>
      );
    }

    if (currentTabData.posts.length > 0) {
      // 论坛帖子使用单列竖排列表布局
      if (activeTab === "forum") {
        return (
          <View style={{ width: '100%' }}>
            {currentTabData.posts.map((post) => (
              <Pressable
                key={post.id}
                onPress={() => handlePostPress(post)}
                style={{ width: '100%' }}
              >
                <ForumPostCard post={post} onPress={() => handlePostPress(post)} />
              </Pressable>
            ))}
          </View>
        );
      }

      // 其他 tab 使用双列瀑布流：每列独立纵向流动，告别 flex-wrap
      // 把相邻卡片强制对齐到同一行顶部造成的空白间隙。卡片本身按媒体自
      // 然比例渲染（见 PostCard 的 useMediaAspectRatio），所以布局随内容
      // 真实高度起伏，视觉上接近小红书 / 瀑布流。
      const postColumns = splitIntoMasonryColumns(
        currentTabData.posts,
        (post) => post.content?.images?.[0] || post.image
      );
      return (
        <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
          {postColumns.map((column, colIndex) => (
            <VStack key={colIndex} flex={1} space="sm">
              {column.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={handlePostPress}
                  onLike={handleLike}
                />
              ))}
            </VStack>
          ))}
        </HStack>
      );
    }

    if (currentTabData.hasLoaded) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons
            name={
              activeTab === "saved" ? "bookmark-outline" :
                activeTab === "liked" ? "heart-outline" :
                  activeTab === "wishlist" ? "bag-handle-outline" :
                    activeTab === "forum" ? "chatbubbles-outline" : "camera-outline"
            }
            size={24}
            color={theme.colors.gray300}
          />
          <Text color="$gray400" mt="$md">
            {activeTab === "posts" && t("profile.noPublishedPosts")}
            {activeTab === "forum" && t("profile.noForumPosts")}
            {activeTab === "saved" && t("profile.noSavedPosts")}
            {activeTab === "liked" && t("profile.noLikedPosts")}
            {activeTab === "wishlist" && t("profile.noWishlist")}
          </Text>
        </VStack>
      );
    }
    return null;
  };

  const avatarUri = userInfo?.avatarUrl || avatar;

  return (
    <View style={[styles.container, { backgroundColor: '#FFF' }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* --- 吸顶头部 (Sticky Header - 白色背景) --- */}
      <Animated.View
        style={[
          styles.collapsedHeader,
          {
            paddingTop: insets.top,
            height: headerTotalHeight,
          },
          collapsedHeaderAnimatedStyle,
        ]}
        pointerEvents={isCollapsed ? "auto" : "none"}
      >
        <View style={[styles.collapsedHeaderBg, { backgroundColor: '#FFF' }]} />

        <View style={[styles.collapsedHeaderContent, { height: HEADER_CONTENT_HEIGHT }]}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>
          <View style={styles.collapsedAvatarContainer}>
            {avatarUri ? (
              <Pressable
                onPress={() => setAvatarPreviewVisible(true)}
                hitSlop={8}
              >
                <OptimizedImage
                  uri={avatarUri}
                  size={ImageSize.THUMBNAIL}
                  style={styles.collapsedAvatar}
                  contentFit="cover"
                  lazy={false}
                />
              </Pressable>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <RNText style={styles.collapsedUsername} numberOfLines={1}>
                  {userInfo?.username || username || "用户"}
                </RNText>
              </View>
            )}
          </View>
          <View style={styles.headerRightButtons}>
            {!isCurrentUser && (
              <>
                <Pressable
                  style={[styles.followButtonSmall, isFollowing && styles.followingButtonSmall]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <RNText style={styles.followButtonTextSmall}>
                      {isFollowing ? t("profile.unfollow") : t("profile.followUser")}
                    </RNText>
                  )}
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={() => setShowShareToChat(true)}
                >
                  <Ionicons name="share-outline" size={20} color={theme.colors.black} />
                </Pressable>
              </>
            )}
            {/* 在白色 Header 显示深色编辑按钮 */}
            {isCurrentUser && (
              <Pressable
                style={styles.headerButton}
                onPress={() => (navigation as any).navigate("EditProfile")}
              >
                <Ionicons name="create-outline" size={20} color={theme.colors.black} />
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>

      {/* --- 吸顶 Tab 栏 (Sticky Tab Bar) --- */}
      <Animated.View
        style={[
          styles.stickyTabBar,
          { top: headerTotalHeight },
          stickyTabBarAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }}>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContent}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                style={styles.tabItem}
                onPress={() => handleTabPress(tab.id)}
              >
                <RNText style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </RNText>
                {activeTab === tab.id && <View style={styles.tabIndicator} />}
              </Pressable>
            ))}
          </RNScrollView>
        </View>
      </Animated.View>

      {/* --- 滚动内容 --- */}
      <AnimatedScrollView
        style={styles.scrollView}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={headerTotalHeight}
          />
        }
      >
        {/* 封面 */}
        <Animated.View style={[styles.coverContainer, coverAnimatedStyle]}>
          {coverImage ? (
            <OptimizedImage
              uri={coverImage}
              size={ImageSize.LARGE}
              style={styles.coverImage}
              contentFit="cover"
              lazy={false}
            />
          ) : (
            <View style={styles.defaultCover} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.5)"]}
            locations={[0, 0.4, 1]}
            style={styles.coverGradient}
          />
          {/* 透明 Header 时的顶部按钮 (只在这里使用渐隐动画) */}
          <Animated.View style={[styles.topActions, { top: insets.top + 8 }, topActionsAnimatedStyle]}>
            <Pressable style={styles.actionButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="white" />
            </Pressable>
            {!isCurrentUser && (
              <Pressable style={styles.actionButton} onPress={() => setShowShareToChat(true)}>
                <Ionicons name="share-outline" size={20} color="white" />
              </Pressable>
            )}
          </Animated.View>
        </Animated.View>

        {/* 用户信息 (移除 fade out 动画，让它自然滚动) */}
        <View style={[styles.profileInfo, { backgroundColor: '#FFF' }]}>
          <View style={styles.avatarRow}>
            <Pressable
              style={styles.avatarWrapper}
              onPress={() => {
                if (avatarUri) setAvatarPreviewVisible(true);
              }}
              disabled={!avatarUri}
            >
              {avatarUri ? (
                <OptimizedImage
                  uri={avatarUri}
                  size={ImageSize.MEDIUM}
                  style={styles.avatar}
                  contentFit="cover"
                  lazy={false}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <RNText style={styles.avatarText}>
                    {(userInfo?.username || username)?.slice(0, 2).toUpperCase() || "AG"}
                  </RNText>
                </View>
              )}
            </Pressable>

            <View style={styles.actionButtonsRow}>
              {!isCurrentUser ? (
                <>
                  <Pressable
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator color={isFollowing ? theme.colors.gray600 : "white"} size="small" />
                    ) : (
                      <RNText style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                        {isFollowing ? (isMutual ? t("profile.mutual") : t("profile.unfollow")) : t("profile.followUser")}
                      </RNText>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.chatButton}
                    onPress={() => {
                      const { createConversation } = require("../services/chatService");
                      createConversation(userId).then((res: { conversationId: number }) => {
                        (navigation as any).navigate("Chat", {
                          conversationId: res.conversationId,
                          otherUserName: userInfo?.username || username || "用户",
                          otherUserAvatar: userInfo?.avatarUrl,
                          otherUserId: userId,
                        });
                      }).catch((e: Error) => Alert.show("发起聊天失败"));
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={theme.colors.black} />
                    <RNText style={styles.chatButtonText}>{t("profile.sendMessage")}</RNText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.editProfileButton}
                  onPress={() => (navigation as any).navigate("EditProfile")}
                >
                  <RNText style={styles.editProfileText}>{t("profile.editProfile")}</RNText>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.userNameSection}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <RNText style={styles.userName}>{userInfo?.username || username || "用户"}</RNText>
              {otherLevel > 0 ? <LevelBadge level={otherLevel} size="sm" /> : null}
              {userInfo?.primaryTitle ? (
                <View style={styles.primaryTitleBadge}>
                  <RNText style={styles.primaryTitleText}>{userInfo.primaryTitle}</RNText>
                </View>
              ) : null}
            </View>
            <RNText style={styles.bio} numberOfLines={2}>{userInfo?.bio || t("profile.editBioPlaceholder")}</RNText>
          </View>

          <View style={styles.tagsContainer}>
            {userProfile?.age != null && userProfile.age > 0 && (
              <View style={styles.tag}>
                <RNText style={styles.tagText}>{getGenderText(userProfile?.gender)} {userProfile.age}岁</RNText>
              </View>
            )}
            {userInfo?.location && (
              <View style={styles.tag}>
                <RNText style={styles.tagText}>{userInfo.location}</RNText>
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <Pressable
              style={styles.statItem}
              onPress={() => {
                if (!isCurrentUser && privacySettings?.hideFollowing) {
                  Alert.show(t("followingUsers.privateList"));
                  return;
                }
                (navigation as any).navigate("FollowingUsers", { userId });
              }}
            >
              <RNText style={styles.statNumber}>{followingCount}</RNText>
              <RNText style={styles.statLabel}>{t("profile.following")}</RNText>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() => {
                if (!isCurrentUser && privacySettings?.hideFollowers) {
                  Alert.show(t("followersScreen.privateList"));
                  return;
                }
                (navigation as any).navigate("Followers", { userId });
              }}
            >
              <RNText style={styles.statNumber}>{followersCount}</RNText>
              <RNText style={styles.statLabel}>{t("profile.followers")}</RNText>
            </Pressable>
            <View style={styles.statItem}>
              <RNText style={styles.statNumber}>{tabsData.posts.hasLoaded ? getTotalLikes() : "-"}</RNText>
              <RNText style={styles.statLabel}>{t("profile.likesAndSaves")}</RNText>
            </View>
          </View>
        </View>

        {/* 关注的品牌 */}
        {followedBrands.length > 0 && (
          <View style={styles.followedBrandsSection}>
            <View style={styles.followedBrandsHeader}>
              <RNText style={styles.followedBrandsTitle}>{t("profile.followedBrands")}</RNText>
              <RNText style={styles.followedBrandsCount}>{followedBrands.length}</RNText>
            </View>
            <FlatList
              data={followedBrands}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              keyExtractor={(item) => String(item.brandId)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.brandChip}
                  onPress={() => (navigation as any).navigate("BrandDetail", { name: item.name })}
                >
                  {item.coverImage ? (
                    <OptimizedImage
                      uri={item.coverImage}
                      size={ImageSize.THUMBNAIL}
                      style={styles.brandChipImage}
                      contentFit="cover"
                      lazy={true}
                    />
                  ) : (
                    <View style={styles.brandChipImagePlaceholder}>
                      <RNText style={styles.brandChipInitial}>
                        {item.name?.charAt(0)?.toUpperCase() || "B"}
                      </RNText>
                    </View>
                  )}
                  <RNText style={styles.brandChipName} numberOfLines={1}>
                    {item.name}
                  </RNText>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* 用户头衔 */}
        {userTitles.length > 0 && (
          <View style={styles.followedBrandsSection}>
            <View style={styles.followedBrandsHeader}>
              <RNText style={styles.followedBrandsTitle}>{t("myTitles.title")}</RNText>
              <RNText style={styles.followedBrandsCount}>{userTitles.length}</RNText>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 }}>
              {userTitles.map((t) => (
                <View
                  key={t.id}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: t.isPrimary ? "#FEF3C7" : "#F9FAFB",
                    borderWidth: 1,
                    borderColor: t.isPrimary ? "#FDE68A" : "#F3F4F6",
                  }}
                >
                  <RNText
                    style={{
                      fontSize: 13,
                      fontWeight: t.isPrimary ? "600" : "500",
                      color: t.isPrimary ? "#92400E" : "#000",
                    }}
                  >
                    {t.title}
                  </RNText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- Inline Tab 栏 (随页面滚动) --- */}
        <Animated.View
          style={[styles.tabBarContainer, inlineTabBarAnimatedStyle, { backgroundColor: '#FFF' }]}
          onLayout={(event) => {
            const layoutY = event.nativeEvent.layout.y;
            if (Math.abs(tabBarAnchorY.value - layoutY) > 1) {
              tabBarAnchorY.value = layoutY;
            }
          }}
        >
          <RNScrollView
            ref={tabScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollContent}
          >
            {tabs.map((tab) => (
              <Pressable key={tab.id} style={styles.tabItem} onPress={() => handleTabPress(tab.id)}>
                <RNText style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </RNText>
                {activeTab === tab.id && <View style={styles.tabIndicator} />}
              </Pressable>
            ))}
          </RNScrollView>
        </Animated.View>

        {/* 帖子列表 */}
        <View style={[styles.postsContainer, { minHeight: contentMinHeight, backgroundColor: '#FFF' }]}>
          {renderPostsContent()}
        </View>
      </AnimatedScrollView>

      {/* Modal */}
      <Modal visible={showCropper} animationType="fade" onRequestClose={handleCropCancel}>
        {tempCropImage && (
          <ImageCropper sourceUri={tempCropImage} aspect="16:9" onCancel={handleCropCancel} onDone={handleCropDone} />
        )}
      </Modal>

      <AvatarPreviewModal
        visible={avatarPreviewVisible}
        uri={avatarUri}
        onClose={() => setAvatarPreviewVisible(false)}
      />

      {!isCurrentUser && (
        <ShareToChatModal
          visible={showShareToChat}
          user={{
            userId,
            username: userInfo?.username || username || "用户",
            avatarUrl: userInfo?.avatarUrl || avatar,
            bio: userInfo?.bio,
            location: userInfo?.location,
            primaryTitle: userInfo?.primaryTitle,
          }}
          onClose={() => setShowShareToChat(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  coverContainer: {
    height: COVER_HEIGHT,
    overflow: "hidden",
  },
  coverImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  defaultCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.black,
  },
  coverGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topActions: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  topRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  editCoverButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  collapsedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  collapsedHeaderBg: {
    ...StyleSheet.absoluteFillObject,
  },
  collapsedHeaderContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  collapsedAvatarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  collapsedUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  followButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.black,
  },
  followingButtonSmall: {
    backgroundColor: theme.colors.gray200,
  },
  followButtonTextSmall: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  stickyTabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99,
    height: TAB_BAR_HEIGHT,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileInfo: {
    paddingBottom: 16,
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: -(AVATAR_SIZE / 2),
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    borderRadius: (AVATAR_SIZE + AVATAR_BORDER * 2) / 2,
    borderWidth: AVATAR_BORDER,
    borderColor: '#FFF',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: theme.colors.gray200,
  },
  collapsedAvatar: {
    width: AVATAR_SIZE_SMALL,
    height: AVATAR_SIZE_SMALL,
    borderRadius: AVATAR_SIZE_SMALL / 2,
    backgroundColor: theme.colors.gray200,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: 22,
    fontWeight: "bold",
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  followButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.black,
    minWidth: 80,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: theme.colors.gray200,
  },
  followButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  followingButtonText: {
    color: theme.colors.white,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: 4,
  },
  chatButtonText: {
    color: theme.colors.black,
    fontSize: 14,
    fontWeight: "500",
  },
  editProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.gray100,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.black,
  },
  userNameSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.black,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.gray600,
    marginTop: 4,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.gray100,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.gray600,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 24,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.black,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray600,
  },
  followedBrandsSection: {
    paddingBottom: 14,
    backgroundColor: "#FFF",
  },
  followedBrandsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  followedBrandsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  followedBrandsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray300,
  },
  brandChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    gap: 8,
  },
  brandChipImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  brandChipImagePlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  brandChipInitial: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  brandChipName: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.black,
    maxWidth: 100,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    flex: 1,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    position: "relative",
  },
  tabText: {
    fontSize: 15,
    color: theme.colors.gray600,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.black,
    borderRadius: 1,
  },
  postsContainer: {
    paddingBottom: theme.spacing.xl,
  },
  primaryTitleBadge: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryTitleText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
});

const contribStyles = StyleSheet.create({
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
  filterChipTextActive: {
    color: "#FFF",
  },
  filterChipCount: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  filterChipCountActive: {
    color: "rgba(255,255,255,0.7)",
  },
});

export default UserProfileScreen;