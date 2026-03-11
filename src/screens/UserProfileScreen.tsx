import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ScrollView as RNScrollView,
  StyleSheet,
  View,
  Modal,
  StatusBar,
  Text as RNText,
  Image as RNImage,
} from "react-native";
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
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
} from "../components/ui";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import { postService, Post as ApiPost } from "../services/postService";
import {
  followService,
  isFollowingUser,
  getFollowersCount,
  getFollowingCount,
} from "../services/followService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
  UserPrivacySettings,
} from "../services/userInfoService";
import SimplePostCard from "../components/SimplePostCard";
import ForumPostCard from "../components/ForumPostCard";
import { Post as DisplayPost } from "../components/PostCard";
import { ImageCropper } from "../components/ImageCropper";
import { showService, Show } from "../services/showService";
import { brandService, BrandSubmission } from "../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
} from "../services/buyerStoreService";

type TabType = "posts" | "forum" | "saved" | "liked" | "archive";

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
const CONTRIB_CARD_GAP = 12;
const CONTRIB_CARD_PADDING = 16;
const CONTRIB_CARD_WIDTH = (SCREEN_WIDTH - CONTRIB_CARD_PADDING * 2 - CONTRIB_CARD_GAP) / 2;

type ContribSubTab = "show" | "brand" | "store";

const CONTRIB_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#E8F5E9", color: "#2E7D32", label: "已通过" },
  REJECTED: { bg: "#FFEBEE", color: "#C62828", label: "已拒绝" },
  PENDING: { bg: "#FFF3E0", color: "#E65100", label: "审核中" },
};

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
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings | null>(null);

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
    { id: "posts", label: "笔记" },
    { id: "forum", label: "论坛" },
    { id: "saved", label: "收藏" },
    { id: "liked", label: "赞过" },
    { id: "archive", label: "贡献" },
  ];

  const tabs = isCurrentUser
    ? allTabs
    : allTabs.filter((tab) => {
        if (tab.id === "saved") return true;
        if (tab.id === "liked") return !(privacySettings?.hideLikes ?? true);
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

  const checkFollowStatus = async () => {
    if (!currentUser?.userId || isCurrentUser) return;
    try {
      const isFollowingResult = await isFollowingUser(
        currentUser.userId,
        userId
      );
      setIsFollowing(isFollowingResult);
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
          buyerStoreService.getMySubmissions(1, 100),
        ]);
        setMyShows(showsRes);
        setMyBrands(brandsRes);
        setMyStores(storesRes.stores);
      } else {
        const [showsRes, brandsRes, storesRes] = await Promise.all([
          showService.getShowsByUser(userId),
          brandService.getSubmissionsByUser(userId),
          buyerStoreService.getSubmissionsByUser(userId, 1, 100),
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
    setTabsData({
      posts: { ...initialTabState },
      forum: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
      archive: { ...initialTabState },
    });
    setContribLoaded(false);
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
        setFollowersCount((prev) => Math.max(0, prev - 1));
        Alert.show("已取消关注");
      } else {
        await followService.followUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(true);
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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      // 使用动态计算的阈值
      const collapsed = event.contentOffset.y > headerFadeThreshold;
      runOnJS(updateCollapsedState)(collapsed);
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

  // 2. 吸顶 Header 背景透明度
  // 修正：使用计算好的准确阈值。在滚动到阈值前20px开始变白，平滑过渡。
  const collapsedHeaderAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [headerFadeThreshold - 20, headerFadeThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // 3. 顶部透明按钮区 (TopActions) 渐隐
  // 当 Header 变白时，原本的透明按钮应该消失，避免重叠
  const topActionsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [headerFadeThreshold - 20, headerFadeThreshold],
      [1, 0], // 与 Header 相反
      Extrapolation.CLAMP
    );
    return { opacity };
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

  const formatContribDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

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

    const renderCard = (item: any, type: ContribSubTab) => {
      const status = item.status || "APPROVED";
      const ss = CONTRIB_STATUS[status] || CONTRIB_STATUS.PENDING;
      const key = `${type}-${item.id}`;
      const image = type === "store"
        ? (item.images && item.images.length > 0 ? item.images[0] : null)
        : item.coverImage;
      const title = type === "show" ? `${item.brand} ${item.season}` : item.name;
      const subtitle = type === "show"
        ? (item.category || item.year?.toString() || "")
        : type === "brand"
          ? (item.category || "")
          : `${item.city}, ${item.country}`;
      const icon = type === "show" ? "film-outline" : type === "brand" ? "pricetag-outline" : "storefront-outline";
      const onPress = type === "show"
        ? () => handleShowPress(item)
        : type === "brand"
          ? () => handleBrandSubmissionPress(item)
          : () => handleStoreCardPress(item);

      return (
        <Pressable key={key} style={contribStyles.card} onPress={onPress}>
          <View style={contribStyles.cardImageContainer}>
            {image ? (
              <RNImage source={{ uri: image }} style={contribStyles.cardImage} resizeMode="cover" />
            ) : (
              <View style={contribStyles.cardImagePlaceholder}>
                <Ionicons name={icon as any} size={32} color={theme.colors.gray300} />
              </View>
            )}
          </View>
          <View style={contribStyles.cardInfo}>
            <RNText style={contribStyles.cardTitle} numberOfLines={2}>{title}</RNText>
            {subtitle ? <RNText style={contribStyles.cardSubtitle} numberOfLines={1}>{subtitle}</RNText> : null}
            <View style={contribStyles.cardBottom}>
              <View style={[contribStyles.statusBadge, { backgroundColor: ss.bg }]}>
                <RNText style={[contribStyles.statusText, { color: ss.color }]}>{ss.label}</RNText>
              </View>
              <RNText style={contribStyles.dateText}>{formatContribDate(item.createdAt)}</RNText>
            </View>
          </View>
        </Pressable>
      );
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
          <View style={contribStyles.cardGrid}>
            {data.map((item) => renderCard(item, contribSubTab))}
          </View>
        )}
      </VStack>
    );
  };

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

      // 其他 tab 使用两列网格布局
      return (
        <HStack flexWrap="wrap" px="$md" pt="$sm" justifyContent="space-between">
          {currentTabData.posts.map((post) => (
            <Box key={post.id} width="48%" mb="$md">
              <Pressable onPress={() => handlePostPress(post)}>
                <SimplePostCard post={post} onPress={() => handlePostPress(post)} />
              </Pressable>
            </Box>
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
                  activeTab === "forum" ? "chatbubbles-outline" : "camera-outline"
            }
            size={24}
            color={theme.colors.gray300}
          />
          <Text color="$gray400" mt="$md">
            {activeTab === "posts" && "还没有发布内容"}
            {activeTab === "forum" && "还没有论坛帖子"}
            {activeTab === "saved" && "还没有收藏帖子"}
            {activeTab === "liked" && "还没有点赞帖子"}
          </Text>
        </VStack>
      );
    }
    return null;
  };

  const avatarUri = userInfo?.avatarUrl || avatar;
  const statusBarStyle = isCollapsed ? "dark-content" : "light-content";

  return (
    <View style={[styles.container, { backgroundColor: '#FFF' }]}>
      <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

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
              <RNImage source={{ uri: avatarUri }} style={styles.collapsedAvatar} />
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
              <Pressable
                style={[styles.followButtonSmall, isFollowing && styles.followingButtonSmall]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <RNText style={styles.followButtonTextSmall}>
                    {isFollowing ? "已关注" : "关注"}
                  </RNText>
                )}
              </Pressable>
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
            <RNImage source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
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
          </Animated.View>
        </Animated.View>

        {/* 用户信息 (移除 fade out 动画，让它自然滚动) */}
        <View style={[styles.profileInfo, { backgroundColor: '#FFF' }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <RNImage source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <RNText style={styles.avatarText}>
                    {(userInfo?.username || username)?.slice(0, 2).toUpperCase() || "AG"}
                  </RNText>
                </View>
              )}
            </View>

            <View style={styles.actionButtonsRow}>
              {!isCurrentUser ? (
                <Pressable
                  style={[styles.followButton, isFollowing && styles.followingButton]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator color={isFollowing ? theme.colors.gray600 : "white"} size="small" />
                  ) : (
                    <RNText style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                      {isFollowing ? "已关注" : "关注"}
                    </RNText>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.editProfileButton}
                  onPress={() => (navigation as any).navigate("EditProfile")}
                >
                  <RNText style={styles.editProfileText}>编辑资料</RNText>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.userNameSection}>
            <RNText style={styles.userName}>{userInfo?.username || username || "用户"}</RNText>
            <RNText style={styles.bio} numberOfLines={2}>{userInfo?.bio || "暂无简介"}</RNText>
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
                  Alert.show("该用户已隐藏关注列表");
                  return;
                }
                (navigation as any).navigate("FollowingUsers", { userId });
              }}
            >
              <RNText style={styles.statNumber}>{followingCount}</RNText>
              <RNText style={styles.statLabel}>关注</RNText>
            </Pressable>
            <Pressable 
              style={styles.statItem} 
              onPress={() => {
                if (!isCurrentUser && privacySettings?.hideFollowers) {
                  Alert.show("该用户已隐藏粉丝列表");
                  return;
                }
                (navigation as any).navigate("Followers", { userId });
              }}
            >
              <RNText style={styles.statNumber}>{followersCount}</RNText>
              <RNText style={styles.statLabel}>粉丝</RNText>
            </Pressable>
            <View style={styles.statItem}>
              <RNText style={styles.statNumber}>{tabsData.posts.hasLoaded ? getTotalLikes() : "-"}</RNText>
              <RNText style={styles.statLabel}>获赞与收藏</RNText>
            </View>
          </View>
        </View>

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
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: CONTRIB_CARD_PADDING,
    paddingTop: 4,
    justifyContent: "space-between",
  },
  card: {
    width: CONTRIB_CARD_WIDTH,
    marginBottom: CONTRIB_CARD_GAP,
    borderRadius: 12,
    backgroundColor: "#FFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardImageContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 18,
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 10,
    color: theme.colors.gray300,
  },
});

export default UserProfileScreen;