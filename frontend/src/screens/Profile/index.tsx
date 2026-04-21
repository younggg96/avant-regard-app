import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ScrollView as RNScrollView,
  View,
  StatusBar,
} from "react-native";
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
import { postService } from "../../services/postService";
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

const AnimatedScrollView = Animated.createAnimatedComponent(RNScrollView);

const ProfileScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

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
    tabsData,
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
    { id: "published" as TabType, label: "已发布", count: tabsData.published.count },
    { id: "pending" as TabType, label: "待审核", count: tabsData.pending.count },
    { id: "forum" as TabType, label: "论坛", count: tabsData.forum.count },
    { id: "liked" as TabType, label: "我喜欢的", count: tabsData.liked.count },
    { id: "saved" as TabType, label: "我收藏的", count: tabsData.saved.count },
    { id: "wishlist" as TabType, label: "愿望单", count: tabsData.wishlist.count },
    { id: "storeActivity" as TabType, label: "买手店" },
    { id: "draft" as TabType, label: "草稿", count: tabsData.draft.count },
    { id: "archive" as TabType, label: "贡献" },
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

  const handleConfirmDelete = async () => {
    if (!postToDelete || !user?.userId) {
      Alert.show("错误", "缺少必要的参数");
      setShowDeleteDialog(false);
      setPostToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const postId = typeof postToDelete.id === "string"
        ? parseInt(postToDelete.id, 10) : Number(postToDelete.id);
      if (isNaN(postId) || postId <= 0) throw new Error("无效的帖子 ID");
      if (!user.userId || user.userId <= 0) throw new Error("无效的用户 ID");

      await postService.deletePost(postId, user.userId);
      setShowDeleteDialog(false);
      Alert.show("成功", "帖子已删除");

      // Handled via fetchTabData refresh
      fetchTabData(activeTab, true);
    } catch (error) {
      console.error("删除帖子时出错:", error);
      let errorMessage = "请稍后重试";
      if (error instanceof Error) {
        if (error.message.includes("网络") || error.message.includes("Network")) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (error.message.includes("权限") || error.message.includes("Permission")) {
          errorMessage = "没有删除权限";
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
            user={user}
            onPostPress={handlePostPress}
            onDeletePost={handleDeletePost}
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
