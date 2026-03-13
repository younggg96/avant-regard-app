import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView as RNScrollView,
  View,
  Text as RNText,
  StyleSheet,
  Image as RNImage,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  Image,
} from "../components/ui";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  postService,
  Post as ApiPost,
} from "../services/postService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
} from "../services/userInfoService";
import {
  getFollowingCount,
  getFollowersCount,
} from "../services/followService";
import { getUnreadCount } from "../services/notificationService";
import SimplePostCard from "../components/SimplePostCard";
import ForumPostCard from "../components/ForumPostCard";
import { Post as DisplayPost } from "../components/PostCard";
import { showService, Show } from "../services/showService";
import { brandService, BrandSubmission } from "../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
} from "../services/buyerStoreService";

type TabType = "published" | "pending" | "draft" | "saved" | "liked" | "forum" | "archive";

type ContribSubTab = "show" | "brand" | "store";

const CONTRIB_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#E8F5E9", color: "#2E7D32", label: "已通过" },
  REJECTED: { bg: "#FFEBEE", color: "#C62828", label: "已拒绝" },
  PENDING: { bg: "#FFF3E0", color: "#E65100", label: "审核中" },
};

const CONTRIB_CARD_GAP = 12;
const CONTRIB_CARD_PADDING = 16;
const CONTRIB_CARD_WIDTH = (Dimensions.get("window").width - CONTRIB_CARD_PADDING * 2 - CONTRIB_CARD_GAP) / 2;

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

// --- 布局常量 ---
const COVER_HEIGHT = 240;
const AVATAR_SIZE = 80;
const AVATAR_SIZE_SMALL = 32;
const AVATAR_BORDER = 4;
const HEADER_CONTENT_HEIGHT = 44;
const TAB_BAR_HEIGHT = 44;

const AnimatedScrollView = Animated.createAnimatedComponent(RNScrollView);

const ProfileScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile } = useAuthStore();

  // 动态计算 Header 总高度 (刘海 + 44px)
  const headerTotalHeight = insets.top + HEADER_CONTENT_HEIGHT;
  // 计算准确的吸顶/变色阈值
  const headerFadeThreshold = COVER_HEIGHT - headerTotalHeight;

  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [followingUsersCount, setFollowingUsersCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [contribSubTab, setContribSubTab] = useState<ContribSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribLoaded, setContribLoaded] = useState(false);

  const tabBarAnchorY = useSharedValue(9999);
  const tabScrollViewRef = useRef<RNScrollView>(null);
  const scrollY = useSharedValue(0);

  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    published: { ...initialTabState },
    pending: { ...initialTabState },
    draft: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
    forum: { ...initialTabState },
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

  const tabs = [
    {
      id: "published" as TabType,
      label: "已发布",
      count: tabsData.published.count,
    },
    {
      id: "pending" as TabType,
      label: "待审核",
      count: tabsData.pending.count,
    },
    { id: "forum" as TabType, label: "论坛", count: tabsData.forum.count },
    { id: "liked" as TabType, label: "我喜欢的", count: tabsData.liked.count },
    { id: "saved" as TabType, label: "我收藏的", count: tabsData.saved.count },
    { id: "draft" as TabType, label: "草稿", count: tabsData.draft.count },
    { id: "archive" as TabType, label: "贡献" },
  ];

  const convertToDisplayPost = (
    apiPost: ApiPost,
    authorInfo: { name: string; avatar: string }
  ): DisplayPost => {
    return {
      id: String(apiPost.id),
      type: apiPost.postType,
      auditStatus: apiPost.auditStatus,
      title: apiPost.title || "无标题",
      image: apiPost.imageUrls?.[0] || "https://picsum.photos/id/1/600/800",
      author: {
        id: String(apiPost.userId),
        name: authorInfo.name,
        avatar: authorInfo.avatar,
      },
      content: {
        title: apiPost.title || "无标题",
        description: apiPost.contentText || "",
        images: apiPost.imageUrls || [],
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
  };

  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowingUsersCount();
    loadFollowersCount();
    loadUnreadNotificationCount();
    setTabsData({
      published: { ...initialTabState },
      pending: { ...initialTabState },
      draft: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
      forum: { ...initialTabState },
      archive: { ...initialTabState },
    });
    setContribLoaded(false);
  }, [user?.userId]);

  const loadUserInfo = async () => {
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
  };

  const loadFollowingUsersCount = async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowingCount(user.userId);
      setFollowingUsersCount(count);
    } catch (error) {
      console.error("Error loading following users count:", error);
    }
  };

  const loadFollowersCount = async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowersCount(user.userId);
      setFollowersCount(count);
    } catch (error) {
      console.error("Error loading followers count:", error);
    }
  };

  const loadUnreadNotificationCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotificationCount(count);
    } catch (error) {
      console.error("Error loading unread notification count:", error);
    }
  };

  const loadUserProfile = async () => {
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
  };

  const loadContributions = useCallback(async () => {
    if (!user?.userId) return;
    setContribLoading(true);
    try {
      const [showsRes, brandsRes, storesRes] = await Promise.all([
        showService.getMyShows(),
        brandService.getMySubmissions(),
        buyerStoreService.getMySubmissions(1, 100),
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
  }, [user]);

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!user?.userId) return;
      if (targetTab === "archive") return;
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }

      updateTabState(targetTab, { isLoading: true });

      try {
        const authorName = userInfo?.username || user?.username || "用户";
        const authorAvatar =
          userInfo?.avatarUrl ||
          user?.avatar ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;

        let newPosts: DisplayPost[] = [];

        if (targetTab === "published" || targetTab === "pending") {
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "PUBLISHED"
          );

          // 过滤掉论坛帖子（有 communityId 的帖子），只显示普通帖子
          const pendingPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "PENDING" && p.communityId == null)
            .map((p) =>
              convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              })
            );

          const approvedPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "APPROVED" && p.communityId == null)
            .map((p) =>
              convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              })
            );

          setTabsData((prev) => ({
            ...prev,
            published: {
              posts: approvedPosts,
              count: approvedPosts.length,
              isLoading: false,
              hasLoaded: true,
            },
            pending: {
              posts: pendingPosts,
              count: pendingPosts.length,
              isLoading: false,
              hasLoaded: true,
            },
          }));
          return;
        }

        if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(
            user.userId
          );
          // 对于收藏的帖子，使用帖子返回的原作者信息
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || "用户",
              avatar: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${p.userId}`,
            })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(user.userId);
          // 对于点赞的帖子，使用帖子返回的原作者信息
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: p.username || "用户",
              avatar: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${p.userId}`,
            })
          );
        } else if (targetTab === "draft") {
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "DRAFT"
          );
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
            })
          );
        } else if (targetTab === "forum") {
          // 获取用户的所有已发布帖子，然后筛选出论坛帖子（有 communityId 的帖子）
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "PUBLISHED"
          );
          const forumPosts = apiPosts
            .filter((p: ApiPost) => p.communityId != null && p.auditStatus === "APPROVED")
            .map((p) =>
              convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              })
            );
          newPosts = forumPosts;
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
        Alert.show("加载失败，请重试");
      }
    },
    [user?.userId, userInfo, tabsData, updateTabState]
  );

  useEffect(() => {
    if (activeTab === "archive") {
      if (!contribLoaded) loadContributions();
    } else {
      fetchTabData(activeTab);
    }
  }, [activeTab, user?.userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowingUsersCount();
      loadFollowersCount();
      loadUnreadNotificationCount();
      if (activeTab === "archive") {
        loadContributions();
      } else {
        fetchTabData(activeTab, true);
      }
    }, [activeTab, user?.userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const tasks: Promise<any>[] = [
      loadUserInfo(),
      loadUserProfile(),
      loadFollowingUsersCount(),
      loadFollowersCount(),
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

  // 更新折叠状态
  const updateCollapsedState = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // 滚动事件处理
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const collapsed = event.contentOffset.y > headerFadeThreshold;
      runOnJS(updateCollapsedState)(collapsed);
    },
  });

  // 1. 封面视差动画
  const coverAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, headerFadeThreshold],
      [0, headerFadeThreshold / 2],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateY }] };
  });

  // 2. 吸顶 Header 背景透明度
  const collapsedHeaderAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [headerFadeThreshold - 20, headerFadeThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // 3. 顶部透明按钮区 渐隐
  const topActionsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [headerFadeThreshold - 20, headerFadeThreshold],
      [1, 0],
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

  const getGenderText = (gender?: string): string => {
    switch (gender) {
      case "MALE":
        return "♂";
      case "FEMALE":
        return "♀";
      default:
        return "";
    }
  };

  const handleLogout = () => {
    Alert.show("正在退出...");
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  const handleDeletePost = (post: DisplayPost) => {
    setPostToDelete(post);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete || !user?.userId) {
      Alert.show("错误", "缺少必要的参数");
      setShowDeleteDialog(false);
      setPostToDelete(null);
      return;
    }

    setIsDeleting(true);

    try {
      const postId =
        typeof postToDelete.id === "string"
          ? parseInt(postToDelete.id, 10)
          : Number(postToDelete.id);

      if (isNaN(postId) || postId <= 0) {
        throw new Error("无效的帖子 ID");
      }

      if (!user.userId || user.userId <= 0) {
        throw new Error("无效的用户 ID");
      }

      console.log(`正在删除帖子 ID: ${postId}, 用户 ID: ${user.userId}`);

      await postService.deletePost(postId, user.userId);

      setShowDeleteDialog(false);
      Alert.show("成功", "帖子已删除");

      setTabsData((prev) => {
        const currentTabData = prev[activeTab];
        const newPosts = currentTabData.posts.filter(
          (p) => p.id !== postToDelete.id
        );

        return {
          ...prev,
          [activeTab]: {
            ...currentTabData,
            posts: newPosts,
            count: newPosts.length,
          },
        };
      });
    } catch (error) {
      console.error("删除帖子时出错:", error);

      let errorMessage = "请稍后重试";
      if (error instanceof Error) {
        if (
          error.message.includes("网络") ||
          error.message.includes("Network")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (
          error.message.includes("权限") ||
          error.message.includes("Permission")
        ) {
          errorMessage = "没有删除权限";
        } else if (error.message.includes("无效")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      Alert.show("删除失败", errorMessage);
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  const avatarUri = userInfo?.avatarUrl || user?.avatar;
  const statusBarStyle = isCollapsed ? "dark-content" : "light-content";

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

    const emptyIcons: Record<ContribSubTab, string> = {
      show: "film-outline",
      brand: "pricetag-outline",
      store: "storefront-outline",
    };
    const emptyTexts: Record<ContribSubTab, string> = {
      show: "暂无秀场贡献",
      brand: "暂无品牌贡献",
      store: "暂无买手店贡献",
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
          <Image
            source={require("../../assets/gif/profile-loading.gif")}
            style={styles.profileLoadingGif}
            resizeMode="contain"
          />
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
                onLongPress={() => handleDeletePost(post)}
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
              <Pressable
                onPress={() => handlePostPress(post)}
                onLongPress={() => {
                  if (activeTab === "published" || activeTab === "draft" || activeTab === "pending") {
                    handleDeletePost(post);
                  }
                }}
              >
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
                  activeTab === "pending" ? "time-outline" :
                    activeTab === "forum" ? "chatbubbles-outline" : "document-text-outline"
            }
            size={24}
            color={theme.colors.gray300}
          />
          <Text color="$gray400" mt="$md">
            {activeTab === "published" && "还没有发布内容"}
            {activeTab === "pending" && "没有待审核的帖子"}
            {activeTab === "draft" && "还没有草稿"}
            {activeTab === "saved" && "还没有收藏帖子"}
            {activeTab === "liked" && "还没有点赞帖子"}
            {activeTab === "forum" && "还没有论坛帖子"}
          </Text>
        </VStack>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#FFF' }]}>
      <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

      {/* --- 吸顶头部 (Sticky Header - 白色背景) --- */}
      <Animated.View
        style={[
          styles.collapsedHeader,
          { paddingTop: insets.top, height: headerTotalHeight },
          collapsedHeaderAnimatedStyle,
        ]}
        pointerEvents={isCollapsed ? "auto" : "none"}
      >
        <View style={[styles.collapsedHeaderBg, { backgroundColor: '#FFF' }]} />
        <View style={[styles.collapsedHeaderContent, { height: HEADER_CONTENT_HEIGHT }]}>
          <Pressable
            style={styles.headerButton}
            onPress={() => (navigation as any).navigate("Notifications")}
          >
            <View style={{ position: "relative" }}>
              <Ionicons name="notifications-outline" size={20} color="#1A1A1A" />
              {unreadNotificationCount > 0 && (
                <View style={styles.badge}>
                  <RNText style={styles.badgeText}>
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </RNText>
                </View>
              )}
            </View>
          </Pressable>
          <View style={styles.collapsedAvatarContainer}>
            {avatarUri ? (
              <RNImage source={{ uri: avatarUri }} style={styles.collapsedAvatar} />
            ) : (
              <View style={[styles.collapsedAvatar, styles.avatarPlaceholder]}>
                <RNText style={styles.avatarTextSmall}>
                  {(userInfo?.username || user?.username)?.slice(0, 1).toUpperCase() || "U"}
                </RNText>
              </View>
            )}
          </View>
          <View style={styles.headerRightButtons}>
            <Pressable
              style={styles.headerButton}
              onPress={() => (navigation as any).navigate("Settings")}
            >
              <Ionicons name="settings-outline" size={20} color="#1A1A1A" />
            </Pressable>
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
              <Pressable key={tab.id} style={styles.tabItem} onPress={() => handleTabPress(tab.id)}>
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
          {/* 透明 Header 时的顶部按钮 */}
          <Animated.View style={[styles.topActions, { top: insets.top + 8 }, topActionsAnimatedStyle]}>
            <Pressable>
            </Pressable>
            <HStack gap="$sm">
              <Pressable
                style={styles.actionButton}
                onPress={() => (navigation as any).navigate("Notifications")}
              >
                <View style={{ position: "relative" }}>
                  <Ionicons name="notifications-outline" size={22} color="white" />
                  {unreadNotificationCount > 0 && (
                    <View style={styles.badge}>
                      <RNText style={styles.badgeText}>
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </RNText>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => (navigation as any).navigate("Settings")}
              >
                <Ionicons name="settings-outline" size={22} color="white" />
              </Pressable>
            </HStack>
          </Animated.View>
        </Animated.View>

        {/* 用户信息 */}
        <View style={[styles.profileInfo, { backgroundColor: '#FFF' }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <RNImage source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <RNText style={styles.avatarText}>
                    {(userInfo?.username || user?.username)?.slice(0, 2).toUpperCase() || "AG"}
                  </RNText>
                </View>
              )}
              <Pressable
                style={styles.avatarAddButton}
                onPress={() => (navigation as any).navigate("EditProfile")}
              >
                <Ionicons name="add" size={14} color="white" />
              </Pressable>
            </View>
          </View>

          <View style={styles.userNameSection}>
            <RNText style={styles.userName}>{userInfo?.username || user?.username || "用户"}</RNText>
            <RNText style={styles.bio} numberOfLines={2}>
              {userInfo?.bio || "点击编辑个人简介..."}
            </RNText>
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
            {userProfile?.preference && (
              <View style={styles.tag}>
                <RNText style={styles.tagText}>{userProfile.preference}</RNText>
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <Pressable style={styles.statItem} onPress={() => (navigation as any).navigate("FollowingUsers", { userId: user?.userId })}>
              <RNText style={styles.statNumber}>{followingUsersCount}</RNText>
              <RNText style={styles.statLabel}>关注</RNText>
            </Pressable>
            <Pressable style={styles.statItem} onPress={() => (navigation as any).navigate("Followers", { userId: userInfo?.userId })}>
              <RNText style={styles.statNumber}>{followersCount}</RNText>
              <RNText style={styles.statLabel}>粉丝</RNText>
            </Pressable>
            <View style={styles.statItem}>
              <RNText style={styles.statNumber}>
                {tabsData.published.count > 0 ? tabsData.published.count : userInfo?.userId ? "0" : "-"}
              </RNText>
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

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent={true}
        onRequestClose={() => setShowDeleteDialog(false)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowDeleteDialog(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableWithoutFeedback>
              <VStack
                bg="$white"
                borderRadius={16}
                width={SCREEN_WIDTH - 80}
                overflow="hidden"
              >
                <VStack px="$lg" pt="$lg" pb="$md">
                  <Text
                    fontSize="$lg"
                    fontWeight="$semibold"
                    color="$black"
                    textAlign="center"
                  >
                    确认删除
                  </Text>
                  <Text
                    fontSize="$sm"
                    color="$gray600"
                    textAlign="center"
                    mt="$sm"
                  >
                    删除后将无法恢复，确定要删除这篇帖子吗？
                  </Text>
                </VStack>

                <Box height={1} bg="$gray100" />

                <HStack>
                  <Pressable
                    flex={1}
                    py="$md"
                    alignItems="center"
                    borderRightWidth={1}
                    borderRightColor="$gray100"
                    onPress={() => {
                      if (isDeleting) return;
                      setShowDeleteDialog(false);
                      setPostToDelete(null);
                    }}
                    disabled={isDeleting}
                    opacity={isDeleting ? 0.5 : 1}
                  >
                    <Text fontSize="$md" fontWeight="$medium" color="$gray600">
                      取消
                    </Text>
                  </Pressable>

                  <Pressable
                    flex={1}
                    py="$md"
                    alignItems="center"
                    onPress={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    <HStack alignItems="center" justifyContent="center">
                      {isDeleting ? (
                        <>
                          <ActivityIndicator
                            color="#FF3040"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            fontSize="$md"
                            fontWeight="$semibold"
                            color="#FF3040"
                          >
                            删除中...
                          </Text>
                        </>
                      ) : (
                        <Text
                          fontSize="$md"
                          fontWeight="$semibold"
                          color="#FF3040"
                        >
                          删除
                        </Text>
                      )}
                    </HStack>
                  </Pressable>
                </HStack>
              </VStack>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  // 封面图片
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
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  // 折叠头部
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
  },
  collapsedAvatar: {
    width: AVATAR_SIZE_SMALL,
    height: AVATAR_SIZE_SMALL,
    borderRadius: AVATAR_SIZE_SMALL / 2,
    backgroundColor: theme.colors.gray200,
  },
  avatarTextSmall: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  // 吸顶 Tab 栏
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
  // 用户信息
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
    position: "relative",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
  avatarAddButton: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: '#FFF',
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
  userIdText: {
    fontSize: 12,
    color: theme.colors.gray400,
    marginTop: 2,
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
  // Tab 栏
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
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
  // 帖子
  postsContainer: {
    paddingBottom: theme.spacing.xl,
  },
  profileLoadingGif: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT / 2,
  },
});

const contribStyles = StyleSheet.create({
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 32,
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

export default ProfileScreen;
