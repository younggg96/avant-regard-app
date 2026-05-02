import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ScrollView as RNScrollView,
  View,
  StatusBar,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
import { postService, likePost, unlikePost } from "../../services/postService";
import { Show } from "../../services/showService";
import { BrandSubmission } from "../../services/brandService";
import { UserSubmittedStore } from "../../services/buyerStoreService";
import { TabType } from "./types";
import {
  COVER_HEIGHT,
  HEADER_CONTENT_HEIGHT,
  TAB_BAR_HEIGHT,
  SCREEN_HEIGHT,
} from "./constants";
import { styles } from "./styles";
import { useProfileData } from "./hooks/useProfileData";
import { CoverSection } from "./components/CoverSection";
import { CollapsedHeader } from "./components/CollapsedHeader";
import { ProfileInfo } from "./components/ProfileInfo";
import { FollowedBrands } from "./components/FollowedBrands";
import { UserTitlesSection } from "./components/UserTitlesSection";
import { ProfileTabBar, StickyTabBar } from "./components/ProfileTabBar";
import { PostsContent } from "./components/PostsContent";
import { DeletePostDialog } from "./components/DeletePostDialog";
import { AvatarPreviewModal } from "../../components/AvatarPreviewModal";
import { MonthlyLotteryEntry } from "../../components/level";
import { useLevelStore } from "../../store/levelStore";

const AnimatedScrollView = Animated.createAnimatedComponent(RNScrollView);

const ProfileScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const ownLevel = useLevelStore((s) => s.status?.currentLevel ?? 0);

  const headerTotalHeight = insets.top + HEADER_CONTENT_HEIGHT;
  const headerFadeThreshold = COVER_HEIGHT - headerTotalHeight;

  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);

  const tabBarAnchorY = useSharedValue(9999);
  const tabScrollViewRef = useRef<RNScrollView>(null);
  const scrollY = useSharedValue(0);

  const {
    userInfo,
    userProfile,
    followingUsersCount,
    followersCount,
    coverImage,
    followedBrands,
    userTitles,
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
    resetTabsData,
    loadUserInfo,
    loadUserProfile,
    loadFollowingUsersCount,
    loadFollowersCount,
    loadFollowedBrands,
    loadUserTitles,
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
    loadAllProfileData();
    resetTabsData();
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

  useFocusEffect(
    useCallback(() => {
      loadAllProfileData();
      if (activeTab === "archive") {
        loadContributions();
      } else if (activeTab === "storeActivity") {
        loadStoreActivity();
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
      loadFollowedBrands(),
      loadUserTitles(),
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
    <View style={[styles.container, { backgroundColor: '#FFF' }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <CollapsedHeader
        avatarUri={avatarUri}
        username={displayUsername}
        isCollapsed={isCollapsed}
        insetTop={insets.top}
        headerTotalHeight={headerTotalHeight}
        animatedStyle={collapsedHeaderAnimatedStyle}
        onSettingsPress={navigateToSettings}
        onAvatarPress={() => setAvatarPreviewVisible(true)}
      />

      <StickyTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={setActiveTab}
        headerTotalHeight={headerTotalHeight}
        animatedStyle={stickyTabBarAnimatedStyle}
      />

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
        />

        <ProfileInfo
          avatarUri={avatarUri}
          userInfo={userInfo}
          userProfile={userProfile}
          username={displayUsername}
          followingUsersCount={followingUsersCount}
          followersCount={followersCount}
          publishedCount={tabsData.published.count}
          userId={user?.userId}
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

        <UserTitlesSection titles={userTitles} />

        <Animated.View
          style={[styles.tabBarContainer, inlineTabBarAnimatedStyle, { backgroundColor: '#FFF' }]}
          onLayout={(event) => {
            const layoutY = event.nativeEvent.layout.y;
            if (Math.abs(tabBarAnchorY.value - layoutY) > 1) {
              tabBarAnchorY.value = layoutY;
            }
          }}
        >
          <ProfileTabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabPress={setActiveTab}
            scrollViewRef={tabScrollViewRef}
          />
        </Animated.View>

        <View style={[styles.postsContainer, { minHeight: contentMinHeight, backgroundColor: '#FFF' }]}>
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
        </View>
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
