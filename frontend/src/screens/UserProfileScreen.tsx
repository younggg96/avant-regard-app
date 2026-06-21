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
  TopTabBar,
  AnimatedChip,
  chipRowStyle,
} from "../components/ui";
import { ImageSize } from "../utils/imageUtils";
import {
  theme,
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../theme";
import { useProfileLoadingGif } from "../utils/loadingGifs";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import { postService, Post as ApiPost, likePost, unlikePost, UserPostStats } from "../services/postService";
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
import { resolveAvatarUrlOrEmpty } from "../utils/avatarUtils";
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
import { titlesShownOnProfile } from "./Profile/components/UserTitlesSection";
import {
  listUserPublicListings,
  type StoreProduct,
} from "../services/storeProductService";
import { useFormatPrice } from "../utils/currency";
import { listUserReviews, type TradeReview } from "../services/aftersalesService";

/** 他人主页一级 tab */
type UserProfileTopTab = "notes" | "selling" | "wishlist" | "archive";
/** 「笔记」下的 sub-tab (chip) */
type NotesSubTab = "posts" | "forum" | "saved" | "liked";
type PostsTabType = NotesSubTab | "wishlist";

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
  const appTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const profileLoadingGif = useProfileLoadingGif();
  const formatPrice = useFormatPrice();

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
  const [topTab, setTopTab] = useState<UserProfileTopTab>("notes");
  const [notesSubTab, setNotesSubTab] = useState<NotesSubTab>("posts");
  const [sellingSubTab, setSellingSubTab] = useState<"active" | "sold">("active");
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
  const [postStats, setPostStats] = useState<UserPostStats | null>(null);
  const [tradeReviews, setTradeReviews] = useState<TradeReview[]>([]);
  const [tradeReviewsTotal, setTradeReviewsTotal] = useState(0);

  // Contribution states
  const [contribSubTab, setContribSubTab] = useState<ContribSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribLoaded, setContribLoaded] = useState(false);
  type SellingBucket = {
    products: StoreProduct[];
    total: number;
    loaded: boolean;
  };
  const [sellingData, setSellingData] = useState<Record<"active" | "sold", SellingBucket>>({
    active: { products: [], total: 0, loaded: false },
    sold: { products: [], total: 0, loaded: false },
  });
  const [sellingLoading, setSellingLoading] = useState(false);
  const sellingProducts = sellingData[sellingSubTab].products;
  const sellingLoaded = sellingData[sellingSubTab].loaded;

  const tabBarAnchorY = useSharedValue(9999);
  const topPanelProgress = useSharedValue(1);
  const notesPanelProgress = useSharedValue(1);
  const isCurrentUser = currentUser?.userId === userId;
  const scrollY = useSharedValue(0);

  const [tabsData, setTabsData] = useState<Record<PostsTabType, TabData>>({
    posts: { ...initialTabState },
    forum: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
    wishlist: { ...initialTabState },
  });

  const updateTabState = useCallback(
    (tab: PostsTabType, updates: Partial<TabData>) => {
      setTabsData((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], ...updates },
      }));
    },
    []
  );

  const topTabs = React.useMemo(() => {
    const items: { id: UserProfileTopTab; label: string }[] = [
      { id: "notes", label: t("profile.tabNotes") },
    ];
    if (isCurrentUser || !privacySettings?.hideSales) {
      items.push({ id: "selling", label: t("profile.tabSelling") });
    }
    if (isCurrentUser || !privacySettings?.hideWishlist) {
      items.push({ id: "wishlist", label: t("profile.wishlist") });
    }
    items.push({ id: "archive", label: t("profile.contributions") });
    return items;
  }, [isCurrentUser, privacySettings, t]);

  const notesSubTabs = React.useMemo(() => {
    const chips: { id: NotesSubTab; label: string; count?: number }[] = [
      { id: "posts", label: t("profile.published"), count: tabsData.posts.count },
      { id: "forum", label: t("profile.forum"), count: tabsData.forum.count },
      { id: "saved", label: t("profile.saved"), count: tabsData.saved.count },
    ];
    if (isCurrentUser || !privacySettings?.hideLikes) {
      chips.push({ id: "liked", label: t("profile.liked"), count: tabsData.liked.count });
    }
    return chips;
  }, [isCurrentUser, privacySettings, tabsData, t]);

  const sellingSubTabs = React.useMemo(
    () => [
      {
        id: "active" as const,
        label: t("trading.myListings.tabActive"),
        count: sellingData.active.total,
      },
      {
        id: "sold" as const,
        label: t("trading.myListings.tabSold"),
        count: sellingData.sold.total,
      },
    ],
    [t, sellingData.active.total, sellingData.sold.total],
  );

  const contribSubTabs = React.useMemo(
    () => [
      { id: "show" as ContribSubTab, label: t("profileContrib.show"), count: myShows.length },
      { id: "brand" as ContribSubTab, label: t("profileContrib.brand"), count: myBrands.length },
      { id: "store" as ContribSubTab, label: t("profileContrib.store"), count: myStores.length },
    ],
    [myShows.length, myBrands.length, myStores.length, t],
  );

  const privacyReady = isCurrentUser || privacySettings !== null;

  useEffect(() => {
    if (!topTabs.some((tab) => tab.id === topTab)) {
      setTopTab("notes");
    }
  }, [topTabs, topTab]);

  useEffect(() => {
    topPanelProgress.value = 0;
    topPanelProgress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [topTab, topPanelProgress]);

  useEffect(() => {
    if (topTab !== "notes") return;
    notesPanelProgress.value = 0;
    notesPanelProgress.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [notesSubTab, topTab, notesPanelProgress]);

  const convertToDisplayPost = (
    apiPost: ApiPost,
    authorInfo: { name: string; avatar: string }
  ): DisplayPost => {
    const validImages = (apiPost.imageUrls || []).filter((url) => url && url.trim() !== "");
    const firstImage = validImages[0] || "";

    return {
      id: String(apiPost.id),
      type: apiPost.postType,
      auditStatus: apiPost.auditStatus,
      title: apiPost.title || t("chat.noTitle"),
      image: firstImage,
      author: {
        id: String(apiPost.userId),
        name: authorInfo.name,
        avatar: authorInfo.avatar,
      },
      content: {
        title: apiPost.title || t("chat.noTitle"),
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

  const loadPostStats = async () => {
    try {
      const stats = await postService.getUserPostStats(userId);
      setPostStats(stats);
    } catch (error) {
      console.error("Error loading post stats:", error);
    }
  };

  const loadTradeReviews = async () => {
    try {
      const res = await listUserReviews(userId);
      setTradeReviews(res.items ?? []);
      setTradeReviewsTotal(res.total ?? 0);
    } catch (error) {
      console.error("Error loading trade reviews:", error);
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
    async (targetTab: PostsTabType, isRefresh = false) => {
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }
      updateTabState(targetTab, { isLoading: true });
      try {
        const authorName = userInfo?.username || username || t("profile.user");
        const authorAvatar = resolveAvatarUrlOrEmpty(
          userInfo?.avatarUrl,
          avatar,
        );

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
              name: p.username || t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
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
              name: p.username || t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
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
              name: p.username || t("profile.user"),
              avatar: resolveAvatarUrlOrEmpty(p.avatarUrl, authorAvatar),
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

  // 帖子列表和用户资料是并发拉取的：若帖子先返回，作者会被烘焙成
  // 「用户」占位 + 空头像且 hasLoaded 不再重拉。这里在 userInfo 到达后
  // 把属于主人的卡片作者信息回填成真实昵称 / 头像。
  useEffect(() => {
    if (!userInfo) return;
    const name = userInfo.username || "";
    const avatarUrl = resolveAvatarUrlOrEmpty(userInfo.avatarUrl, avatar);
    if (!name && !avatarUrl) return;
    const ownerId = String(userId);
    setTabsData((prev) => {
      let changed = false;
      const next = { ...prev };
      (Object.keys(prev) as PostsTabType[]).forEach((tab) => {
        let tabChanged = false;
        const updatedPosts = prev[tab].posts.map((p) => {
          if (p.author.id !== ownerId) return p;
          const newName = name || p.author.name;
          const newAvatar = avatarUrl || p.author.avatar;
          if (p.author.name === newName && p.author.avatar === newAvatar) {
            return p;
          }
          tabChanged = true;
          return { ...p, author: { ...p.author, name: newName, avatar: newAvatar } };
        });
        if (tabChanged) {
          changed = true;
          next[tab] = { ...prev[tab], posts: updatedPosts };
        }
      });
      return changed ? next : prev;
    });
  }, [userInfo, userId, avatar]);

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

  // 同时拉取 active / sold 两个 bucket。每个 status 独立 setState, 永不交叉。
  // 简单直白 —— chip 切换只触发一次（在 topTab=selling 进入时）, 后续切换 chip
  // 直接用缓存 (`sellingData[chip].products`)。
  const loadSellingListings = useCallback(
    async () => {
      setSellingLoading(true);
      const fetchOne = async (status: "active" | "sold") => {
        try {
          const res = await listUserPublicListings(userId, {
            status,
            page: 1,
            pageSize: 40,
          });
          setSellingData((prev) => ({
            ...prev,
            [status]: {
              products: res.products || [],
              total: res.total ?? (res.products?.length ?? 0),
              loaded: true,
            },
          }));
        } catch (err) {
          console.error(`Error loading user ${status} listings:`, err);
          setSellingData((prev) => ({
            ...prev,
            [status]: { products: [], total: 0, loaded: true },
          }));
        }
      };
      try {
        await Promise.all([fetchOne("active"), fetchOne("sold")]);
      } finally {
        setSellingLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowCounts();
    checkFollowStatus();
    loadPrivacySettings();
    loadFollowedBrands();
    loadUserTitles();
    loadPostStats();
    loadTradeReviews();
    setTabsData({
      posts: { ...initialTabState },
      forum: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
      wishlist: { ...initialTabState },
    });
    setContribLoaded(false);
    setSellingData({
      active: { products: [], total: 0, loaded: false },
      sold: { products: [], total: 0, loaded: false },
    });
    setTopTab("notes");
    setNotesSubTab("posts");
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

  // 切换 sub-chip 不再触发请求 —— 进入 selling tab 时一次性 prefetch 两个 bucket。
  useEffect(() => {
    if (topTab === "archive") {
      if (!contribLoaded) loadContributions();
    } else if (topTab === "selling") {
      if (!sellingData.active.loaded || !sellingData.sold.loaded) {
        loadSellingListings();
      }
    } else if (topTab === "wishlist") {
      fetchTabData("wishlist");
    } else if (topTab === "notes") {
      fetchTabData(notesSubTab);
    }
  }, [topTab, notesSubTab, userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowCounts();
      checkFollowStatus();
      loadPrivacySettings();
      loadFollowedBrands();
      loadUserTitles();
      loadPostStats();
      loadTradeReviews();
      if (topTab === "archive") {
        loadContributions();
      } else if (topTab === "selling") {
        loadSellingListings();
      } else if (topTab === "wishlist") {
        fetchTabData("wishlist", true);
      } else if (topTab === "notes") {
        fetchTabData(notesSubTab, true);
      }
    }, [topTab, notesSubTab, userId])
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
      loadPostStats(),
      loadTradeReviews(),
    ];
    if (topTab === "archive") {
      tasks.push(loadContributions());
    } else if (topTab === "selling") {
      tasks.push(loadSellingListings());
    } else if (topTab === "wishlist") {
      tasks.push(fetchTabData("wishlist", true));
    } else if (topTab === "notes") {
      tasks.push(fetchTabData(notesSubTab, true));
    }
    await Promise.all(tasks);
    setRefreshing(false);
  };

  const handleFollowToggle = async () => {
    if (!currentUser?.userId) {
      Alert.show(t("engagement.pleaseLogin"));
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
        Alert.show(t("engagement.unfollowed"));
      } else {
        await followService.followUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(true);
        const mutual = await isMutualFollow(currentUser.userId, userId);
        setIsMutual(mutual);
        setFollowersCount((prev) => prev + 1);
        Alert.show(t("engagement.followSuccess"));
      }
    } catch (error) {
      console.error("Follow toggle error:", error);
      const message = error instanceof Error ? error.message : t("engagement.operationFailed");
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

  // 注意：原先此处用 `tabsData.posts.posts.reduce((s,p)=>s+p.likes)` 计算"获赞与
  // 收藏"，存在两个偏差：(1) 仅累加 likes，未包含 favorites；(2) 仅统计已加载到
  // posts tab 的非论坛帖子，遗漏 forum / 未拉取分页。改用后端聚合接口
  // /api/posts/user/{id}/stats，按 PUBLISHED + APPROVED 全量聚合，与单篇帖子
  // 真实计数保持同步。

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
        Alert.show(t("editProfile.coverUploadSuccess"));
      }
    } catch (error) {
      console.error("Cover upload error:", error);
      setCoverImage(previousCover);
      Alert.show(t("common.uploadFailed"));
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

  const topPanelAnimStyle = useAnimatedStyle(() => ({
    opacity: topPanelProgress.value,
    transform: [
      {
        translateY: interpolate(
          topPanelProgress.value,
          [0, 1],
          [8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const notesPanelAnimStyle = useAnimatedStyle(() => ({
    opacity: notesPanelProgress.value,
    transform: [
      {
        translateY: interpolate(
          notesPanelProgress.value,
          [0, 1],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

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
      show: t("profileContrib.noShowContrib"),
      brand: t("profileContrib.noBrandContrib"),
      store: t("profileContrib.noStoreContrib"),
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
      <VStack alignItems="stretch" style={{ width: "100%" }}>
        {/* Content */}
        {contribLoading ? (
          <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
            <RNImage
              source={profileLoadingGif}
              style={styles.loadingGif}
              resizeMode="contain"
            />
          </VStack>
        ) : data.length === 0 ? (
          <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
            <Ionicons name={emptyIcons[contribSubTab] as any} size={24} color={theme.colors.gray300} />
            <Text style={[{ fontFamily: playfairFonts.regular, textAlign: "center" }, { color: theme.colors.gray400 }]} mt="$md">
              {emptyTexts[contribSubTab]}
            </Text>
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
        for (const key of Object.keys(next) as PostsTabType[]) {
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
          for (const key of Object.keys(next) as PostsTabType[]) {
            next[key] = { ...next[key], posts: next[key].posts.map(rollbackPost) };
          }
          return next;
        });
      }
    },
    [tabsData, currentUser]
  );

  const renderSellingContent = () => {
    if (sellingLoading && !sellingLoaded) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <RNImage source={profileLoadingGif} style={styles.loadingGif} resizeMode="contain" />
        </VStack>
      );
    }

    if (sellingProducts.length === 0) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name="pricetag-outline" size={24} color={theme.colors.gray300} />
          <Text style={[{ fontFamily: playfairFonts.regular, textAlign: "center" }, { color: theme.colors.gray400 }]} mt="$md">
            {t("profile.noSellingListings")}
          </Text>
        </VStack>
      );
    }

    return (
      <View style={styles.sellingGrid}>
        {sellingProducts.map((product) => {
          const cover = product.images?.[0];
          const isSold =
            sellingSubTab === "sold" ||
            product.status === "sold" ||
            product.status === "SOLD_OUT";
          return (
            <Pressable
              key={product.id}
              style={styles.sellingCard}
              onPress={() =>
                (navigation as any).navigate("StoreProductDetail", { productId: product.id })
              }
            >
              <View style={styles.sellingCover}>
                {cover ? (
                  <OptimizedImage uri={cover} size={ImageSize.MEDIUM} style={styles.sellingImage} contentFit="cover" lazy />
                ) : (
                  <View style={[styles.sellingImage, styles.sellingImagePlaceholder]}>
                    <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
                  </View>
                )}
                {isSold ? (
                  <View style={styles.soldBadge}>
                    <Text style={styles.soldBadgeText}>
                      {t("trading.myListings.tabSold")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <VStack px="$sm" py="$sm" gap={3}>
                <Text fontSize={13} fontWeight="$semibold" numberOfLines={2} style={{ color: appTheme.colors.text }}>
                  {product.title}
                </Text>
                {!!product.brand && (
                  <Text fontSize={10} numberOfLines={1} style={{ color: appTheme.colors.gray400 }}>
                    {product.brand}
                  </Text>
                )}
                <Text fontSize={13} fontWeight="$bold" style={{ color: appTheme.colors.text }}>
                  {formatPrice(product.priceCents, product.currency)}
                </Text>
              </VStack>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderPostsForTab = (tabKey: PostsTabType) => {
    const currentTabData = tabsData[tabKey];
    const shouldShowLoading = currentTabData.isLoading && !currentTabData.hasLoaded;

    if (shouldShowLoading) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <RNImage source={profileLoadingGif} style={styles.loadingGif} resizeMode="contain" />
        </VStack>
      );
    }

    if (currentTabData.posts.length > 0) {
      if (tabKey === "forum") {
        return (
          <View style={{ width: "100%" }}>
            {currentTabData.posts.map((post) => (
              <Pressable key={post.id} onPress={() => handlePostPress(post)} style={{ width: "100%" }}>
                <ForumPostCard post={post} onPress={() => handlePostPress(post)} />
              </Pressable>
            ))}
          </View>
        );
      }

      const postColumns = splitIntoMasonryColumns(
        currentTabData.posts,
        (post) => post.content?.images?.[0] || post.image,
      );
      return (
        <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
          {postColumns.map((column, colIndex) => (
            <VStack key={colIndex} flex={1} space="sm">
              {column.map((post) => (
                <Pressable key={post.id} onPress={() => handlePostPress(post)}>
                  <PostCard post={post} onPress={() => handlePostPress(post)} onLike={handleLike} />
                </Pressable>
              ))}
            </VStack>
          ))}
        </HStack>
      );
    }

    if (currentTabData.hasLoaded) {
      const emptyIcon =
        tabKey === "saved"
          ? "bookmark-outline"
          : tabKey === "liked"
            ? "heart-outline"
            : tabKey === "wishlist"
              ? "bag-handle-outline"
              : tabKey === "forum"
                ? "chatbubbles-outline"
                : "camera-outline";
      const emptyText =
        tabKey === "posts"
          ? t("profile.noPublishedPosts")
          : tabKey === "forum"
            ? t("profile.noForumPosts")
            : tabKey === "saved"
              ? t("profile.noSavedPosts")
              : tabKey === "liked"
                ? t("profile.noLikedPosts")
                : t("profile.noWishlist");

      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name={emptyIcon as any} size={24} color={theme.colors.gray300} />
          <Text style={[{ fontFamily: playfairFonts.regular, textAlign: "center" }, { color: theme.colors.gray400 }]} mt="$md">
            {emptyText}
          </Text>
        </VStack>
      );
    }

    return null;
  };

  const chipStripWrap = {
    backgroundColor: appTheme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appTheme.colors.border,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: 10,
  } as const;

  const renderNotesChips = () => (
    <View style={chipStripWrap}>
      <View style={chipRowStyle}>
        {notesSubTabs.map((chip) => (
          <AnimatedChip
            key={chip.id}
            label={chip.label}
            count={chip.count}
            isActive={notesSubTab === chip.id}
            onPress={() => setNotesSubTab(chip.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderSellingChips = () => (
    <View style={chipStripWrap}>
      <View style={chipRowStyle}>
        {sellingSubTabs.map((chip) => (
          <AnimatedChip
            key={chip.id}
            label={chip.label}
            count={chip.count}
            isActive={sellingSubTab === chip.id}
            onPress={() => setSellingSubTab(chip.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderContribChips = () => (
    <View style={chipStripWrap}>
      <View style={chipRowStyle}>
        {contribSubTabs.map((chip) => (
          <AnimatedChip
            key={chip.id}
            label={chip.label}
            count={chip.count}
            isActive={contribSubTab === chip.id}
            onPress={() => setContribSubTab(chip.id)}
          />
        ))}
      </View>
    </View>
  );

  const renderMainContent = () => {
    if (topTab === "archive") return renderContributionContent();
    if (topTab === "selling") return renderSellingContent();
    if (topTab === "wishlist") return renderPostsForTab("wishlist");
    return renderPostsForTab(notesSubTab);
  };

  const renderPostsContent = () => renderMainContent();

  const avatarUri = userInfo?.avatarUrl || avatar;
  const profileTitlesShown = titlesShownOnProfile(userTitles);

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <StatusBar
        barStyle={appTheme.mode === "dark" ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

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
        <View style={[styles.collapsedHeaderBg, { backgroundColor: appTheme.colors.card }]} />

        <View style={[styles.collapsedHeaderContent, { height: HEADER_CONTENT_HEIGHT }]}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={appTheme.colors.text} />
          </Pressable>

          {/* 头像绝对居中 —— 左右按钮数量/宽度不对称时仍保持视觉居中。 */}
          <View style={styles.collapsedAvatarContainer} pointerEvents="box-none">
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
                  {userInfo?.username || username || t("profile.user")}
                </RNText>
              </View>
            )}
          </View>

          <View style={styles.headerRightButtons}>
            {!isCurrentUser && (
              <Pressable
                style={styles.headerButton}
                onPress={() => setShowShareToChat(true)}
              >
                <Ionicons name="share-outline" size={20} color={appTheme.colors.text} />
              </Pressable>
            )}
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
      {privacyReady && (
        <Animated.View
          style={[
            styles.stickyTabBar,
            { top: headerTotalHeight },
            stickyTabBarAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={{ flex: 1, backgroundColor: appTheme.colors.card }}>
            <TopTabBar
              tabs={topTabs}
              activeTab={topTab}
              onTabPress={setTopTab}
            />
          </View>
        </Animated.View>
      )}

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
              <Ionicons name="chevron-back" size={24} color={appTheme.colors.text} />
            </Pressable>
            {!isCurrentUser && (
              <Pressable style={styles.actionButton} onPress={() => setShowShareToChat(true)}>
                <Ionicons name="share-outline" size={20} color={appTheme.colors.text} />
              </Pressable>
            )}
          </Animated.View>
        </Animated.View>

        {/* 用户信息 (移除 fade out 动画，让它自然滚动) */}
        <View style={[styles.profileInfo, { backgroundColor: appTheme.colors.card }]}>
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
                      <ActivityIndicator color={isFollowing ? appTheme.colors.gray600 : appTheme.colors.textInverted} size="small" />
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
                          otherUserName: userInfo?.username || username || t("profile.user"),
                          otherUserAvatar: userInfo?.avatarUrl,
                          otherUserId: userId,
                        });
                      }).catch((e: Error) => Alert.show(t("engagement.operationFailed")));
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
              <RNText style={styles.userName}>{userInfo?.username || username || t("profile.user")}</RNText>
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
                <RNText style={styles.tagText}>{getGenderText(userProfile?.gender)} {userProfile.age}{t("profile.ageUnit")}</RNText>
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
              <RNText style={styles.statNumber}>{postStats ? postStats.totalLikesAndSaves : "-"}</RNText>
              <RNText style={styles.statLabel}>{t("profile.likesAndSaves")}</RNText>
            </View>
          </View>
        </View>

        {/* 历史评价入口 —— 与主页默认展示内容（笔记 / 在售 等）明确区分，
            单独成卡片入口，点击进入卖家历史评价独立页。 */}
        {tradeReviewsTotal > 0 && (
          <Pressable
            style={styles.ratingSection}
            onPress={() =>
              (navigation as any).navigate("UserReviews", {
                userId,
                username: userInfo?.username || username,
              })
            }
          >
            <HStack alignItems="center" justifyContent="space-between">
              <HStack alignItems="center" space="sm">
                <Ionicons name="star" size={16} color={theme.colors.starRated} />
                <RNText style={styles.ratingEntryTitle}>
                  {t("profile.reviewsEntryTitle")}
                </RNText>
                <RNText style={styles.ratingScore}>
                  {(tradeReviews.reduce((sum, r) => sum + r.rating, 0) / tradeReviews.length).toFixed(1)}
                </RNText>
                <RNText style={styles.ratingCount}>
                  ({tradeReviewsTotal} {t("profile.ratingsCount")})
                </RNText>
              </HStack>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={appTheme.colors.gray400}
              />
            </HStack>
          </Pressable>
        )}

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
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
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

        {/* 用户头衔：仅展示主头衔（或唯一头衔） */}
        {profileTitlesShown.length > 0 && (
          <View style={styles.followedBrandsSection}>
            <View style={styles.followedBrandsHeader}>
              <RNText style={styles.followedBrandsTitle}>{t("myTitles.title")}</RNText>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 }}>
              {profileTitlesShown.map((titleRow) => (
                <View
                  key={titleRow.id}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: appTheme.colors.text,
                    borderWidth: 1,
                    borderColor: appTheme.colors.card,
                  }}
                >
                  <RNText
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: appTheme.colors.textInverted,
                      fontFamily: playfairFonts.medium,
                    }}
                  >
                    {titleRow.title}
                  </RNText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- Inline Tab 栏 (随页面滚动) --- */}
        {privacyReady && (
          <Animated.View
            style={[styles.tabBarContainer, inlineTabBarAnimatedStyle, { backgroundColor: appTheme.colors.card }]}
            onLayout={(event) => {
              const layoutY = event.nativeEvent.layout.y;
              if (Math.abs(tabBarAnchorY.value - layoutY) > 1) {
                tabBarAnchorY.value = layoutY;
              }
            }}
          >
            <TopTabBar
              tabs={topTabs}
              activeTab={topTab}
              onTabPress={setTopTab}
            />
          </Animated.View>
        )}

        <Animated.View style={topPanelAnimStyle}>
          {topTab === "notes" && renderNotesChips()}
          {topTab === "selling" && renderSellingChips()}
          {topTab === "archive" && renderContribChips()}

          <Animated.View
            style={[
              styles.postsContainer,
              { minHeight: contentMinHeight, backgroundColor: appTheme.colors.background },
              topTab === "notes" && notesPanelAnimStyle,
            ]}
          >
            {renderPostsContent()}
          </Animated.View>
        </Animated.View>
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
            username: userInfo?.username || username || t("profile.user"),
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
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
    backgroundColor: t.colors.text,
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
    borderRadius: t.borderRadius.sm,
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
    borderBottomColor: t.colors.border,
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
    position: "relative",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  collapsedAvatarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: t.colors.text,
    fontFamily: playfairFonts.medium,
  },
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  followButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.text,
  },
  followingButtonSmall: {
    backgroundColor: t.colors.gray100,
  },
  followButtonTextSmall: {
    color: t.colors.textInverted,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: playfairFonts.medium,
  },
  followingButtonTextSmall: {
    color: t.colors.gray400,
  },
  stickyTabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99,
    height: TAB_BAR_HEIGHT,
    backgroundColor: t.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
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
    borderColor: t.colors.card,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: t.colors.skeleton,
  },
  collapsedAvatar: {
    width: AVATAR_SIZE_SMALL,
    height: AVATAR_SIZE_SMALL,
    borderRadius: AVATAR_SIZE_SMALL / 2,
    backgroundColor: t.colors.skeleton,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: t.colors.textInverted,
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: playfairFonts.bold,
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
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.text,
    minWidth: 80,
    alignItems: "center",
  },
  followingButton: {
    // gray200 在 dark mode 是 #3A3A3A,叠 textInverted (#0A0A0A 接近黑) 文字几乎看不见。
    // 用 gray100 做"已关注"的 muted 底,文字走 gray400 保证两端都有对比。
    backgroundColor: t.colors.gray100,
  },
  followButtonText: {
    color: t.colors.textInverted,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: playfairFonts.medium,
  },
  followingButtonText: {
    color: t.colors.gray400,
    fontFamily: playfairFonts.medium,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    gap: 4,
  },
  chatButtonText: {
    color: t.colors.text,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: playfairFonts.medium,
  },
  editProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: t.spacing.sm,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    backgroundColor: t.colors.gray100,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "500",
    color: t.colors.text,
    fontFamily: playfairFonts.medium,
  },
  userNameSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: t.colors.text,
    fontFamily: playfairFonts.bold,
  },
  bio: {
    fontSize: 14,
    color: t.colors.gray600,
    marginTop: 4,
    lineHeight: 20,
    fontFamily: playfairFonts.regular,
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
    backgroundColor: t.colors.gray100,
  },
  tagText: {
    fontSize: 12,
    color: t.colors.gray600,
    fontFamily: playfairFonts.regular,
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
    color: t.colors.text,
    fontFamily: playfairFonts.bold,
  },
  statLabel: {
    fontSize: 12,
    color: t.colors.gray600,
    fontFamily: playfairFonts.regular,
  },
  ratingSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: t.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  ratingEntryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.text,
    fontFamily: playfairFonts.medium,
  },
  ratingScore: {
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
    fontFamily: playfairFonts.medium,
  },
  ratingCount: {
    fontSize: 12,
    color: t.colors.gray400,
    fontFamily: playfairFonts.regular,
  },
  followedBrandsSection: {
    paddingBottom: 14,
    backgroundColor: t.colors.card,
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
    color: t.colors.gray400,
    fontFamily: playfairFonts.medium,
  },
  followedBrandsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.gray300,
    fontFamily: playfairFonts.medium,
  },
  brandChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    paddingRight: 8,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.gray100,
    gap: 6,
  },
  brandChipImage: {
    width: 22,
    height: 22,
    borderRadius: t.borderRadius.sm,
  },
  brandChipImagePlaceholder: {
    width: 22,
    height: 22,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  brandChipInitial: {
    fontSize: 10,
    fontWeight: "700",
    color: t.colors.textInverted,
    fontFamily: playfairFonts.bold,
  },
  brandChipName: {
    fontSize: 12,
    fontWeight: "500",
    color: t.colors.text,
    maxWidth: 80,
    fontFamily: playfairFonts.medium,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  tabScrollContent: {
    paddingLeft: 16,
    paddingRight: 32,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    position: "relative",
  },
  tabText: {
    fontSize: 15,
    color: t.colors.gray600,
    fontWeight: "500",
    fontFamily: playfairFonts.medium,
  },
  tabTextActive: {
    color: t.colors.text,
    fontWeight: "600",
    fontFamily: playfairFonts.medium,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: t.colors.text,
    borderRadius: 1,
  },
  postsContainer: {
    paddingBottom: t.spacing.xl,
  },
  primaryTitleBadge: {
    backgroundColor: t.colors.text,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  primaryTitleText: {
    fontSize: 11,
    fontWeight: "500",
    color: t.colors.textInverted,
    fontFamily: playfairFonts.medium,
  },
  loadingGif: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  sellingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  sellingCard: {
    width: (SCREEN_WIDTH - t.spacing.md * 2 - t.spacing.sm) / 2,
    borderRadius: t.borderRadius.md,
    overflow: "hidden",
    backgroundColor: t.colors.card,
  },
  sellingCover: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: t.colors.skeleton,
  },
  sellingImage: {
    width: "100%",
    height: "100%",
  },
  sellingImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  soldBadge: {
    position: "absolute",
    top: t.spacing.xs,
    right: t.spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: t.borderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  soldBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#FFFFFF",
    fontFamily: playfairFonts.bold,
  },
});

export default UserProfileScreen;