import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ScrollView as RNScrollView,
  View,
  StatusBar,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute, RouteProp } from "@react-navigation/native";
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
import { Post as DisplayPost } from "../../components/PostCard";
import { useAuthStore } from "../../store/authStore";
import { Alert } from "../../utils/Alert";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";
import { postService, likePost, unlikePost } from "../../services/postService";
import { Show } from "../../services/showService";
import { BrandSubmission } from "../../services/brandService";
import { UserSubmittedStore } from "../../services/buyerStoreService";
import {
  TabType,
  TopTabType,
  BuyingFilterType,
  SellingFilterType,
} from "./types";
import {
  COVER_HEIGHT,
  HEADER_CONTENT_HEIGHT,
  TAB_BAR_HEIGHT,
  SCREEN_HEIGHT,
} from "./constants";
import { useProfileStyles } from "./styles";
import { useAppTheme } from "../../theme";
import { useProfileData } from "./hooks/useProfileData";
import { CoverSection } from "./components/CoverSection";
import { CollapsedHeader } from "./components/CollapsedHeader";
import { ProfileInfo } from "./components/ProfileInfo";
import { FollowedBrands } from "./components/FollowedBrands";
import { LevelProgressCard } from "./components/LevelProgressCard";
import { ArchiveEntryCard } from "./components/ArchiveEntryCard";
import { ProfileTabBar } from "./components/ProfileTabBar";
import { TopTabBar } from "../../components/ui";
import { TradingContent } from "./components/TradingContent";
import { PostsContent } from "./components/PostsContent";
import { CollectionsContent } from "./components/CollectionsContent";
import { DeletePostDialog } from "./components/DeletePostDialog";
import { AvatarPreviewModal } from "../../components/AvatarPreviewModal";
import { MonthlyLotteryEntry } from "../../components/level";
import { useLevelStore } from "../../store/levelStore";
import { useChatStore } from "../../store/chatStore";
import { useNotificationStore } from "../../store/notificationStore";

const AnimatedScrollView = Animated.createAnimatedComponent(RNScrollView);

type ProfileRouteParams = {
  Profile: { initialTopTab?: TopTabType } | undefined;
};

const ProfileScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProfileRouteParams, "Profile">>();
  const insets = useSafeAreaInsets();
  const styles = useProfileStyles();
  const appTheme = useAppTheme();
  const { user, logout } = useAuthStore();
  const ownLevel = useLevelStore((s) => s.status?.currentLevel ?? 0);
  const refreshLevel = useLevelStore((s) => s.refresh);
  const totalChatUnread = useChatStore((s) => s.totalUnread);
  const totalNotificationUnread = useNotificationStore((s) => s.unreadCount);
  const refreshChatUnread = useChatStore((s) => s.refreshUnreadCount);
  const refreshNotificationUnread = useNotificationStore((s) => s.refreshUnreadCount);
  const totalInteractionUnread = totalChatUnread + totalNotificationUnread;

  const headerTotalHeight = insets.top + HEADER_CONTENT_HEIGHT;
  const headerFadeThreshold = COVER_HEIGHT - headerTotalHeight;

  const [activeTab, setActiveTab] = useState<TabType>("published");
  // 一级 tab —— 默认进入「笔记」侧, 与历史行为保持一致;切到「购买」/
  // 「在售」时由 TradingContent 自己懒加载对应订单列表, 不影响首屏。
  // 设置页等外部入口可通过 route.params.initialTopTab 跳过来时预选「购买」
  // 或「在售」一级 tab, 避免用户再手动点一下。
  const [topTab, setTopTab] = useState<TopTabType>(
    route.params?.initialTopTab ?? "notes",
  );

  useEffect(() => {
    const next = route.params?.initialTopTab;
    if (next) {
      setTopTab(next);
      navigation.setParams({ initialTopTab: undefined } as never);
    }
  }, [route.params?.initialTopTab, navigation]);
  const [buyingFilter, setBuyingFilter] = useState<BuyingFilterType>("all");
  const [sellingFilter, setSellingFilter] = useState<SellingFilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);

  const tabBarAnchorY = useSharedValue(9999);
  const tabScrollViewRef = useRef<RNScrollView>(null);
  const scrollY = useSharedValue(0);
  // 一级 tab / 笔记 sub-tab 切换时内容区淡入 + 轻微上移。
  const topPanelProgress = useSharedValue(1);
  const notesPanelProgress = useSharedValue(1);

  const {
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
    collectionsSubTab,
    setCollectionsSubTab,
    collectionFolders,
    defaultCollectionTotal,
    defaultCollectionCover,
    collectionsLoading,
    loadCollectionFolders,
    tabsData,
    setTabsData,
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
  } = useProfileData();

  const tabs = [
    { id: "published" as TabType, label: t("profile.published"), count: tabsData.published.count },
    { id: "pending" as TabType, label: t("profile.pending"), count: tabsData.pending.count },
    { id: "forum" as TabType, label: t("profile.forum"), count: tabsData.forum.count },
    { id: "liked" as TabType, label: t("profile.liked"), count: tabsData.liked.count },
    { id: "saved" as TabType, label: t("profile.saved"), count: tabsData.saved.count },
    { id: "wishlist" as TabType, label: t("profile.wishlist"), count: tabsData.wishlist.count },
    { id: "storeActivity" as TabType, label: t("profile.storeActivity") },
    { id: "draft" as TabType, label: t("profile.draft"), count: tabsData.draft.count },
    { id: "archive" as TabType, label: t("profile.contributions") },
  ];

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
  }, [activeTab, topTab, notesPanelProgress]);

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

  useEffect(() => {
    loadAllProfileData();
    resetTabsData();
    // 等级 store 与本页 LevelProgressCard / MonthlyLotteryEntry 共享状态，
    // 切换账号时强制再拉一次，避免保留上一个账号的任务进度。
    refreshLevel();
  }, [user?.userId]);

  useEffect(() => {
    if (activeTab === "archive") {
      if (!contribLoaded) loadContributions();
    } else if (activeTab === "storeActivity") {
      if (!storeActivityLoaded) loadStoreActivity();
    } else {
      fetchTabData(activeTab);
    }
  }, [activeTab, user?.userId]);

  // 「收藏」一级 tab —— 按需懒加载三类数据 (帖子收藏 / 店铺收藏 / 产品收藏夹)。
  // 帖子收藏复用 saved 列表，店铺收藏复用 storeActivity，产品收藏夹独立 loader。
  useEffect(() => {
    if (topTab !== "collections") return;
    if (collectionsSubTab === "posts") {
      fetchTabData("saved");
    } else if (collectionsSubTab === "stores") {
      if (!storeActivityLoaded) loadStoreActivity();
    } else if (collectionsSubTab === "products") {
      loadCollectionFolders();
    }
  }, [topTab, collectionsSubTab, user?.userId, storeActivityLoaded]);

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Profile");
      loadAllProfileData();
      // 与「我的等级」页对齐：每次回到本页都同步最新等级 + 任务进度，
      // 避免发帖/点赞/收藏后回到主页看到滞后的进度条。
      refreshLevel();
      // 同步互动页铃铛角标 (聊天 + 系统通知未读).
      refreshNotificationUnread();
      refreshChatUnread();
      if (activeTab === "archive") {
        loadContributions();
      } else if (activeTab === "storeActivity") {
        loadStoreActivity();
      } else {
        fetchTabData(activeTab, true);
      }
    }, [
      activeTab,
      user?.userId,
      refreshLevel,
      refreshNotificationUnread,
      refreshChatUnread,
    ])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const tasks: Promise<any>[] = [
      loadUserInfo(),
      loadUserProfile(),
      loadFollowingUsersCount(),
      loadFollowersCount(),
      loadFollowedBrands(),
      loadUserTitles(),
      loadPostStats(),
      // 下拉刷新越过 levelStore 节流窗口, 让用户拿到真正最新的等级 / 任务进度.
      refreshLevel({ force: true }),
      refreshNotificationUnread(),
      refreshChatUnread(),
    ];
    if (activeTab === "archive") {
      tasks.push(loadContributions());
    } else if (activeTab === "storeActivity") {
      tasks.push(loadStoreActivity());
    } else {
      tasks.push(fetchTabData(activeTab, true));
    }
    await Promise.all(tasks);
    setRefreshing(false);
  };

  const updateCollapsedState = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  // Track last collapsed boolean on the UI thread so we only touch JS state on
  // an actual toggle (avoids per-frame setState traffic via runOnJS).
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

  const coverAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, headerFadeThreshold],
      [0, headerFadeThreshold / 2],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateY }] };
  });

  // Time-based header visibility (0 = hidden, 1 = visible). Replaces the
  // 20px scroll-driven interpolation that could freeze at a half-opaque value
  // when scroll momentum/rubber-banding stopped inside the transition zone,
  // leaving a translucent white band stuck over the cover image.
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

  const topActionsAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: 1 - headerProgress.value };
  });

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

  const inlineTabBarAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: 1 };
  });

  const contentMinHeight = SCREEN_HEIGHT - headerTotalHeight - TAB_BAR_HEIGHT;

  const navigateToSettings = useCallback(() => {
    (navigation as any).navigate("Settings");
  }, [navigation]);

  const navigateToMessages = useCallback(() => {
    (navigation.navigate as any)("Main", {
      screen: "Interaction",
      params: { subTab: "messages" },
    });
  }, [navigation]);

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  const handleDeletePost = (post: DisplayPost) => {
    setPostToDelete(post);
    setShowDeleteDialog(true);
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
        const uid = user?.userId || 0;
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
    [tabsData, user]
  );

  const handleConfirmDelete = async () => {
    if (!postToDelete || !user?.userId) {
      Alert.show(t("common.failed"), t("common.unknownError"));
      setShowDeleteDialog(false);
      setPostToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const postId = typeof postToDelete.id === "string"
        ? parseInt(postToDelete.id, 10) : Number(postToDelete.id);
      if (isNaN(postId) || postId <= 0) throw new Error(t("profile.invalidPostId"));
      if (!user.userId || user.userId <= 0) throw new Error(t("profile.invalidUserId"));

      await postService.deletePost(postId, user.userId);
      setShowDeleteDialog(false);
      Alert.show(t("common.success"), t("profile.deleteSuccess"));

      // Handled via fetchTabData refresh
      fetchTabData(activeTab, true);
    } catch (error) {
      console.error("删除帖子时出错:", error);
      let errorMessage = t("profile.deleteFailed");
      if (error instanceof Error) {
        if (error.message.includes("网络") || error.message.includes("Network")) {
          errorMessage = t("common.networkError");
        } else if (error.message.includes("权限") || error.message.includes("Permission")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      Alert.show(t("profile.deleteFailed"), errorMessage);
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
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

  const handleStoreActivityPress = (storeId: string) => {
    (navigation as any).navigate("StoreDetail", { storeId });
  };

  const handleProductPress = (productId: number) => {
    (navigation as any).navigate("StoreProductDetail", { productId });
  };

  const avatarUri = userInfo?.avatarUrl || user?.avatar;
  const displayUsername = userInfo?.username || user?.username || "";

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <StatusBar
        barStyle={appTheme.mode === "dark" ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      <CollapsedHeader
        avatarUri={avatarUri}
        username={displayUsername}
        isCollapsed={isCollapsed}
        insetTop={insets.top}
        headerTotalHeight={headerTotalHeight}
        animatedStyle={collapsedHeaderAnimatedStyle}
        onSettingsPress={navigateToSettings}
        onMessagesPress={navigateToMessages}
        unreadCount={totalInteractionUnread}
        onAvatarPress={() => setAvatarPreviewVisible(true)}
      />

      {/* 一级 tab (笔记 / 购买 / 在售) 的 sticky 版。当用户向下滚动
          越过下方 inline TopTabBar 时由 stickyTabBarAnimatedStyle 渐显。
          一级 tab 设为 sticky, chip 条跟随内容滚动 —— 这样用户即使
          在订单列表深处也能一键切回「笔记」。 */}
      <Animated.View
        style={[styles.stickyTabBar, { top: headerTotalHeight }, stickyTabBarAnimatedStyle]}
        pointerEvents="box-none"
      >
        <View style={{ flex: 1, backgroundColor: appTheme.colors.card }}>
          <TopTabBar
            tabs={[
              { id: "notes", label: t("profile.tabNotes") },
              { id: "buying", label: t("profile.tabBuying") },
              { id: "selling", label: t("profile.tabSelling") },
              { id: "collections", label: t("profile.tabCollections") },
            ]}
            activeTab={topTab}
            onTabPress={setTopTab}
          />
        </View>
      </Animated.View>

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
        <CoverSection
          coverImage={coverImage}
          insetTop={insets.top}
          coverAnimatedStyle={coverAnimatedStyle}
          topActionsAnimatedStyle={topActionsAnimatedStyle}
          onSettingsPress={navigateToSettings}
          onMessagesPress={navigateToMessages}
          unreadCount={totalInteractionUnread}
        />

        <ProfileInfo
          avatarUri={avatarUri}
          userInfo={userInfo}
          userProfile={userProfile}
          username={displayUsername}
          followingUsersCount={followingUsersCount}
          followersCount={followersCount}
          likesAndSavesCount={postStats?.totalLikesAndSaves}
          userId={user?.userId}
          userTitles={userTitles}
          onEditProfile={() => (navigation as any).navigate("EditProfile")}
          onFollowingPress={() => (navigation as any).navigate("FollowingUsers", { userId: user?.userId })}
          onFollowersPress={() => (navigation as any).navigate("Followers", { userId: userInfo?.userId })}
          onAvatarPress={() => setAvatarPreviewVisible(true)}
        />

        <MonthlyLotteryEntry isOwnProfile currentLevel={ownLevel} />

        <FollowedBrands
          brands={followedBrands}
          onBrandPress={(name) => (navigation as any).navigate("BrandDetail", { name })}
        />

        {/* PDF p.11 + p.19 · MY ARCHIVE 入口卡片（仅增加不减少） */}
        <ArchiveEntryCard isOwnProfile />

        <LevelProgressCard />

        {/* Inline 一级 tab bar (笔记 / 购买 / 在售)。
            sticky 版用此处的 onLayout 作为锚点 —— 滚到这里之上时,
            上面的 sticky 版本透明度切换到 1, 接管屏幕顶部。 */}
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
            tabs={[
              { id: "notes", label: t("profile.tabNotes") },
              { id: "buying", label: t("profile.tabBuying") },
              { id: "selling", label: t("profile.tabSelling") },
              { id: "collections", label: t("profile.tabCollections") },
            ]}
            activeTab={topTab}
            onTabPress={setTopTab}
          />
        </Animated.View>

        <Animated.View style={topPanelAnimStyle}>
        {topTab === "notes" ? (
          <>
            {/* 笔记下原 9 个 sub-tab —— chip 样式 + 切换动效 */}
            <View
              style={{
                backgroundColor: appTheme.colors.card,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: appTheme.colors.border,
              }}
            >
              <ProfileTabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabPress={setActiveTab}
                scrollViewRef={tabScrollViewRef}
              />
            </View>

            <Animated.View style={[styles.postsContainer, notesPanelAnimStyle, { minHeight: contentMinHeight, backgroundColor: appTheme.colors.background }]}>
              <PostsContent
                activeTab={activeTab}
                tabsData={tabsData}
                contribSubTab={contribSubTab}
                setContribSubTab={setContribSubTab}
                contribLoading={contribLoading}
                myShows={myShows}
                myBrands={myBrands}
                myStores={myStores}
                storeActivitySubTab={storeActivitySubTab}
                setStoreActivitySubTab={setStoreActivitySubTab}
                storeActivity={storeActivity}
                storeActivityLoading={storeActivityLoading}
                productActivitySubTab={productActivitySubTab}
                setProductActivitySubTab={setProductActivitySubTab}
                productLikes={productLikes}
                productSaved={productSaved}
                productWanted={productWanted}
                loadProductActivity={loadProductActivity}
                onProductPress={handleProductPress}
                user={user}
                onPostPress={handlePostPress}
                onDeletePost={handleDeletePost}
                onLike={handleLike}
                onShowPress={handleShowPress}
                onBrandSubmissionPress={handleBrandSubmissionPress}
                onStoreCardPress={handleStoreCardPress}
                onStoreActivityPress={handleStoreActivityPress}
              />
            </Animated.View>
          </>
        ) : topTab === "collections" ? (
          <View
            style={[
              styles.postsContainer,
              { minHeight: contentMinHeight, backgroundColor: appTheme.colors.background },
            ]}
          >
            <CollectionsContent
              collectionsSubTab={collectionsSubTab}
              setCollectionsSubTab={setCollectionsSubTab}
              postsFavData={tabsData.saved}
              onPostPress={handlePostPress}
              onLike={handleLike}
              storeActivity={storeActivity}
              storeActivityLoading={storeActivityLoading}
              onStorePress={handleStoreActivityPress}
              collectionFolders={collectionFolders}
              defaultCollectionTotal={defaultCollectionTotal}
              defaultCollectionCover={defaultCollectionCover}
              collectionsLoading={collectionsLoading}
              onProductFolderPress={(collectionId, title) =>
                (navigation as any).navigate("UserCollectionDetail", {
                  collectionId,
                  title,
                })
              }
              onFoldersChanged={() => loadCollectionFolders(true)}
            />
          </View>
        ) : (
          <View style={[styles.postsContainer, { minHeight: contentMinHeight, backgroundColor: appTheme.colors.background }]}>
            <TradingContent
              mode={topTab === "buying" ? "buying" : "selling"}
              buyingFilter={buyingFilter}
              setBuyingFilter={setBuyingFilter}
              sellingFilter={sellingFilter}
              setSellingFilter={setSellingFilter}
            />
          </View>
        )}
        </Animated.View>
      </AnimatedScrollView>

      <DeletePostDialog
        visible={showDeleteDialog}
        isDeleting={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteDialog(false);
            setPostToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />

      <AvatarPreviewModal
        visible={avatarPreviewVisible}
        uri={avatarUri}
        onClose={() => setAvatarPreviewVisible(false)}
      />
    </View>
  );
};

export default ProfileScreen;
