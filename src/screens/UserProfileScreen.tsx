import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
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
} from "../services/userInfoService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";
import { HStack } from "@/components/ui";

type TabType = "posts" | "saved" | "liked";

// 定义每个 Tab 的数据结构
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuthStore();

  // 从路由参数获取用户信息
  const { userId, username, avatar } = route.params as {
    userId: number;
    username?: string;
    avatar?: string;
  };

  // 用户信息状态
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);

  // 关注状态
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Tab 相关
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [refreshing, setRefreshing] = useState(false);

  // Tab 滑动相关
  const tabScrollViewRef = useRef<ScrollView>(null);
  const contentScrollViewRef = useRef<ScrollView>(null);

  // 判断是否是当前用户自己
  const isCurrentUser = currentUser?.userId === userId;

  // Tab 数据状态
  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    posts: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
  });

  // 通用更新函数
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
    { id: "posts" as TabType, label: "笔记", icon: "grid-outline" },
    { id: "saved" as TabType, label: "收藏", icon: "bookmark-outline" },
    { id: "liked" as TabType, label: "赞过", icon: "heart-outline" },
  ];

  // 将 API 帖子转换为展示格式
  const convertToDisplayPost = (
    apiPost: ApiPost,
    authorInfo: { name: string; avatar: string }
  ): DisplayPost => {
    return {
      id: String(apiPost.id),
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
    };
  };

  // 加载用户信息
  const loadUserInfo = async () => {
    try {
      const info = await userInfoService.getUserInfo(userId);
      setUserInfo(info);
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  // 加载用户完整资料
  const loadUserProfile = async () => {
    try {
      const profile = await userInfoService.getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  // 加载关注数量
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

  // 检查是否已关注
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

  // 加载 Tab 数据
  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      // 如果不是强制刷新，且数据已经加载过，就直接返回
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
          // 只获取已发布且审核通过的帖子
          const apiPosts = await postService.getPostsByUserId(
            userId,
            "PUBLISHED"
          );
          const approvedPosts = apiPosts.filter(
            (p: ApiPost) => p.auditStatus === "APPROVED"
          );
          newPosts = approvedPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
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
    [userId, userInfo, username, avatar, tabsData, updateTabState]
  );

  // 初始化加载
  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowCounts();
    checkFollowStatus();
    // 重置所有 Tab 状态
    setTabsData({
      posts: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
    });
  }, [userId]);

  // 切换 tab 时加载数据
  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, userId]);

  // 页面获得焦点时刷新
  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowCounts();
      checkFollowStatus();
      fetchTabData(activeTab, true);
    }, [activeTab, userId])
  );

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserInfo(),
      loadUserProfile(),
      loadFollowCounts(),
      checkFollowStatus(),
      fetchTabData(activeTab, true),
    ]);
    setRefreshing(false);
  };

  // 处理 Tab 滑动切换
  const handleTabSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    const tabIds: TabType[] = ["posts", "saved", "liked"];
    if (
      pageIndex >= 0 &&
      pageIndex < tabIds.length &&
      tabIds[pageIndex] !== activeTab
    ) {
      setActiveTab(tabIds[pageIndex]);
    }
  };

  // 处理 Tab 点击
  const handleTabPress = (tabId: TabType) => {
    const tabIds: TabType[] = ["posts", "saved", "liked"];
    const index = tabIds.indexOf(tabId);
    if (index >= 0 && contentScrollViewRef.current) {
      contentScrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTab(tabId);
  };

  // 关注/取消关注
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
      const message = error instanceof Error ? error.message : "操作失败";
      Alert.show(message);
    } finally {
      setFollowLoading(false);
    }
  };

  // 获取性别显示文字
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

  // 帖子点击
  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  // 计算总获赞数
  const getTotalLikes = () => {
    return tabsData.posts.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <HStack
        px="$md"
        py="$sm"
        alignItems="center"
        justifyContent="between"
        bg="$white"
      >
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.black}
          />
        </TouchableOpacity>
      </HStack>

      {/* 头部信息区域 */}
      <View style={styles.header}>
        {/* 第一行：头像和操作按钮 */}
        <View style={styles.profileRow}>
          <View style={styles.avatarContainer}>
            {userInfo?.avatarUrl || avatar ? (
              <Image
                source={{ uri: userInfo?.avatarUrl || avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {(userInfo?.username || username)
                    ?.slice(0, 2)
                    .toUpperCase() || "AG"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.userInfoSection}>
            <Text style={styles.username}>
              {userInfo?.username || username || "用户"}
            </Text>
            <Text style={styles.userId}>
              {userInfo?.location ? `  · ${userInfo.location}` : ""}
            </Text>
          </View>

          {/* 关注/编辑按钮 */}
          <View style={styles.actionButtons}>
            {!isCurrentUser ? (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? theme.colors.gray600 : theme.colors.white}
                  />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followingButtonText,
                    ]}
                  >
                    {isFollowing ? "已关注" : "关注"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => (navigation as any).navigate("EditProfile")}
              >
                <Text style={styles.editButtonText}>编辑资料</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bio */}
        <View style={styles.bioContainer}>
          <Text style={styles.bioText} numberOfLines={2}>
            {userInfo?.bio || "暂无简介"}
          </Text>
        </View>

        {/* 标签（年龄、位置等） */}
        <View style={styles.tagsRow}>
          {userProfile?.age != null && userProfile.age > 0 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {getGenderText(userProfile?.gender)} {userProfile.age}岁
              </Text>
            </View>
          ) : null}
          {userInfo?.location ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{userInfo.location}</Text>
            </View>
          ) : null}
          {userProfile?.preference ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{userProfile.preference}</Text>
            </View>
          ) : null}
        </View>

        {/* 统计数据 */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              (navigation as any).navigate("FollowingUsers", { userId })
            }
          >
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>关注</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() =>
              (navigation as any).navigate("Followers", { userId })
            }
          >
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>粉丝</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {tabsData.posts.hasLoaded ? getTotalLikes() : "-"}
            </Text>
            <Text style={styles.statLabel}>获赞与收藏</Text>
          </View>
        </View>
      </View>

      {/* 帖子区域 */}
      <View style={styles.postsSection}>
        {/* 标签栏 */}
        <ScrollView
          ref={tabScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                activeTab === tab.id && styles.tabItemActive,
              ]}
              onPress={() => handleTabPress(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={
                  activeTab === tab.id
                    ? theme.colors.black
                    : theme.colors.gray300
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.id && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 可滑动的内容区域 */}
        <ScrollView
          ref={contentScrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleTabSwipe}
          scrollEventThrottle={16}
          style={styles.swipeContainer}
          nestedScrollEnabled={true}
        >
          {tabs.map((tab) => {
            const currentTabData = tabsData[tab.id];
            const isCurrentTab = activeTab === tab.id;
            const shouldShowLoading =
              currentTabData.isLoading && !currentTabData.hasLoaded;

            return (
              <ScrollView
                key={tab.id}
                style={styles.tabPage}
                contentContainerStyle={styles.tabPageContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing && isCurrentTab}
                    onRefresh={onRefresh}
                  />
                }
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {shouldShowLoading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator
                      size="large"
                      color={theme.colors.gray400}
                    />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : currentTabData.posts.length > 0 ? (
                  <View style={styles.postsGrid}>
                    {currentTabData.posts.map((post) => (
                      <View key={post.id} style={styles.postItem}>
                        <TouchableOpacity
                          onPress={() => handlePostPress(post)}
                          activeOpacity={0.95}
                        >
                          <SimplePostCard
                            post={post}
                            onPress={() => handlePostPress(post)}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : currentTabData.hasLoaded ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name={
                        tab.id === "saved"
                          ? "bookmark-outline"
                          : tab.id === "liked"
                            ? "heart-outline"
                            : "camera-outline"
                      }
                      size={48}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.emptyText}>
                      {tab.id === "posts" && "还没有发布内容"}
                      {tab.id === "saved" && "还没有收藏帖子"}
                      {tab.id === "liked" && "还没有点赞帖子"}
                    </Text>
                    <Text style={styles.emptySubText}>
                      {tab.id === "posts" &&
                        (isCurrentUser
                          ? "快去发布你的第一篇笔记吧"
                          : "TA 还没有发布任何笔记")}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  // 顶部导航栏
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xs,
    height: 44,
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarRight: {
    flexDirection: "row",
  },
  // 头部样式（与 ProfileScreen 一致）
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  avatarContainer: {
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...theme.typography.h2,
    color: theme.colors.white,
  },
  userInfoSection: {
    flex: 1,
  },
  username: {
    ...theme.typography.h2,
    color: theme.colors.black,
    fontWeight: "700",
    marginBottom: 4,
  },
  userId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  actionButtons: {
    marginLeft: theme.spacing.sm,
  },
  followButton: {
    backgroundColor: "#FF2442",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 72,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.white,
  },
  followingButtonText: {
    color: theme.colors.gray600,
  },
  editButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.black,
  },
  bioContainer: {
    marginBottom: theme.spacing.sm,
  },
  bioText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  tagText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  statNumber: {
    ...theme.typography.h3,
    color: theme.colors.black,
    fontWeight: "700",
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  // 帖子区域
  postsSection: {
    flex: 1,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    maxHeight: 44,
  },
  tabBarContent: {
    paddingHorizontal: theme.spacing.md,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.lg,
    position: "relative",
    gap: 6,
  },
  tabItemActive: {},
  tabLabel: {
    ...theme.typography.body,
    color: theme.colors.gray300,
    fontWeight: "500",
  },
  tabLabelActive: {
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
  },
  // 滑动容器
  swipeContainer: {
    flex: 1,
  },
  tabPage: {
    width: SCREEN_WIDTH,
  },
  tabPageContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    justifyContent: "space-between",
  },
  postItem: {
    width: "48%",
    marginBottom: theme.spacing.md,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl * 2,
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.md,
  },
  emptySubText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: theme.spacing.xs,
  },
});

export default UserProfileScreen;
