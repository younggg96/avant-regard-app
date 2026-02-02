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

type TabType = "published" | "pending" | "draft" | "saved" | "liked" | "forum";

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
    });
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

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!user?.userId) return;
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
    fetchTabData(activeTab);
  }, [activeTab, user?.userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowingUsersCount();
      loadFollowersCount();
      loadUnreadNotificationCount();
      fetchTabData(activeTab, true);
    }, [activeTab, user?.userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserInfo(),
      loadUserProfile(),
      fetchTabData(activeTab, true),
      loadFollowingUsersCount(),
      loadFollowersCount(),
    ]);
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

  // 渲染帖子内容
  const renderPostsContent = () => {
    const currentTabData = tabsData[activeTab];
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
  // 帖子
  postsContainer: {
    paddingBottom: theme.spacing.xl,
  },
});

export default ProfileScreen;
