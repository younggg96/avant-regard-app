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
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  postService,
  Post as ApiPost,
  PostStatus as ApiPostStatus,
} from "../services/postService";
// import { getUnreadCount } from "../services/notificationService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
} from "../services/userInfoService";
import {
  getFollowingCount,
  getFollowersCount,
} from "../services/followService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

type TabType = "published" | "pending" | "draft" | "saved" | "liked";

// 定义每个 Tab 的数据结构
type TabData = {
  posts: DisplayPost[];
  isLoading: boolean;
  hasLoaded: boolean; // 标记是否初始化过，避免重复 loading 动画
  count: number;
};

const initialTabState: TabData = {
  posts: [],
  isLoading: false,
  hasLoaded: false,
  count: 0,
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 用户信息状态
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 关注的用户数量
  const [followingUsersCount, setFollowingUsersCount] = useState(0);

  // 粉丝数量
  const [followersCount, setFollowersCount] = useState(0);

  // 用户完整资料（包含性别、年龄等）
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);

  // Tab 滑动相关
  const tabScrollViewRef = useRef<ScrollView>(null);
  const contentScrollViewRef = useRef<ScrollView>(null);

  // 核心状态：由一个 Map 管理所有 Tab 的数据，实现状态分离
  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    published: { ...initialTabState },
    pending: { ...initialTabState },
    draft: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
  });

  // 通用更新函数：只更新某个 Tab 的特定字段
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
    { id: "liked" as TabType, label: "我喜欢的", count: tabsData.liked.count },
    { id: "saved" as TabType, label: "我收藏的", count: tabsData.saved.count },
    { id: "draft" as TabType, label: "草稿", count: tabsData.draft.count },
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
      // 保留原始状态用于判断
      status: apiPost.status,
    } as DisplayPost & { status?: string };
  };

  // 初始化数据 - 只加载用户信息和关注数量
  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowingUsersCount();
    loadFollowersCount();
    // 重置所有 Tab 的状态，因为用户可能变了
    setTabsData({
      published: { ...initialTabState },
      pending: { ...initialTabState },
      draft: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
    });
  }, [user?.userId]);

  // 加载用户信息
  const loadUserInfo = async () => {
    if (!user?.userId) return;

    try {
      const info = await userInfoService.getUserInfo(user.userId);
      setUserInfo(info);

      // 同步更新本地状态
      if (info) {
        updateProfile({
          username: info.username,
          bio: info.bio,
          location: info.location,
          avatar: info.avatarUrl,
        });
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  // 加载关注的用户数量
  const loadFollowingUsersCount = async () => {
    if (!user?.userId) return;

    try {
      const count = await getFollowingCount(user.userId);
      setFollowingUsersCount(count);
    } catch (error) {
      console.error("Error loading following users count:", error);
    }
  };

  // 加载粉丝数量
  const loadFollowersCount = async () => {
    if (!user?.userId) return;

    try {
      const count = await getFollowersCount(user.userId);
      setFollowersCount(count);
    } catch (error) {
      console.error("Error loading followers count:", error);
    }
  };

  // 加载用户完整资料
  const loadUserProfile = async () => {
    if (!user?.userId) return;

    try {
      const profile = await userInfoService.getUserProfile(user.userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  // 重构后的加载函数：可以指定加载某个 Tab，不再依赖 activeTab
  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!user?.userId) return;

      // 如果不是强制刷新，且数据已经加载过，就直接返回（实现缓存，不再转圈）
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }

      // 设置当前 Tab 正在加载
      updateTabState(targetTab, { isLoading: true });

      try {
        const authorName = userInfo?.username || user?.username || "用户";
        const authorAvatar =
          userInfo?.avatarUrl ||
          user?.avatar ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;

        let newPosts: DisplayPost[] = [];

        // 特殊处理：Published 和 Pending 共享一个接口
        if (targetTab === "published" || targetTab === "pending") {
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "PUBLISHED"
          );

          const pendingPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "PENDING")
            .map((p) => ({
              ...convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              }),
              auditStatus: p.auditStatus,
            }));

          const approvedPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "APPROVED")
            .map((p) =>
              convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              })
            );

          // 同时更新两个 Tab 的数据
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
          return; // 结束，因为已经手动更新了状态
        }

        // 处理其他单一接口的 Tab
        if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(
            user.userId
          );
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
            })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(user.userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
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
        }

        // 更新当前 Tab 状态
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

  // 切换 tab 时，如果该 tab 还没加载过数据，才去请求
  // 如果已经 hasLoaded 为 true，fetchTabData 内部会直接 return，实现"瞬开"
  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, user?.userId]);

  // 当页面获得焦点时刷新当前 tab 的数据
  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowingUsersCount();
      loadFollowersCount();
      // 强制刷新当前 tab 的数据
      fetchTabData(activeTab, true);
    }, [activeTab, user?.userId])
  );

  // 下拉刷新 - 只刷新当前 tab 和必要的信息
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserInfo(),
      loadUserProfile(),
      fetchTabData(activeTab, true), // 强制刷新当前 Tab
      loadFollowingUsersCount(),
      loadFollowersCount(),
    ]);
    setRefreshing(false);
  };

  // 处理 tab 滑动切换
  const handleTabSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    const tabIds: TabType[] = [
      "published",
      "pending",
      "liked",
      "saved",
      "draft",
    ];
    if (
      pageIndex >= 0 &&
      pageIndex < tabIds.length &&
      tabIds[pageIndex] !== activeTab
    ) {
      setActiveTab(tabIds[pageIndex]);
    }
  };

  // 处理 tab 点击
  const handleTabPress = (tabId: TabType) => {
    const tabIds: TabType[] = [
      "published",
      "pending",
      "liked",
      "saved",
      "draft",
    ];
    const index = tabIds.indexOf(tabId);
    if (index >= 0 && contentScrollViewRef.current) {
      contentScrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTab(tabId);
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

  const handleLogout = () => {
    // Simple confirmation - just show message and logout after delay
    Alert.show("正在退出...");
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handlePostPress = (post: DisplayPost) => {
    // 判断帖子状态
    let postStatus: "draft" | "pending" | "published" = "published";

    // 根据当前标签页或帖子属性判断状态
    if (activeTab === "pending") {
      postStatus = "pending";
    } else if (activeTab === "draft") {
      postStatus = "draft";
    } else if ("status" in post) {
      const status = (post as any).status;
      if (status === "DRAFT") {
        postStatus = "draft";
      }
    } else if ("auditStatus" in post) {
      const auditStatus = (post as any).auditStatus;
      if (auditStatus === "PENDING") {
        postStatus = "pending";
      }
    }

    (navigation as any).navigate("PostDetail", {
      post: post,
      postStatus: postStatus,
    });
  };

  // 处理长按删除帖子
  const handleDeletePost = (post: DisplayPost) => {
    setPostToDelete(post);
    setShowDeleteDialog(true);
  };

  // 确认删除帖子
  const handleConfirmDelete = async () => {
    if (!postToDelete || !user?.userId) {
      Alert.show("错误", "缺少必要的参数");
      setShowDeleteDialog(false);
      setPostToDelete(null);
      return;
    }

    // 开始删除
    setIsDeleting(true);

    try {
      // 验证帖子 ID
      const postId =
        typeof postToDelete.id === "string"
          ? parseInt(postToDelete.id, 10)
          : Number(postToDelete.id);

      if (isNaN(postId) || postId <= 0) {
        throw new Error("无效的帖子 ID");
      }

      // 验证用户 ID
      if (!user.userId || user.userId <= 0) {
        throw new Error("无效的用户 ID");
      }

      console.log(`正在删除帖子 ID: ${postId}, 用户 ID: ${user.userId}`);

      // 调用删除 API
      await postService.deletePost(postId, user.userId);

      // 关闭对话框
      setShowDeleteDialog(false);

      // 显示成功提示
      Alert.show("成功", "帖子已删除");

      // 直接更新本地数据，不需要重新请求 API，体验更好
      setTabsData((prev) => {
        const currentTabData = prev[activeTab];
        const newPosts = currentTabData.posts.filter(
          (p) => p.id !== postToDelete.id
        );

        // 如果是 pending 或 published，可能需要同时更新两个 tab
        if (activeTab === "pending" || activeTab === "published") {
          return {
            ...prev,
            [activeTab]: {
              ...currentTabData,
              posts: newPosts,
              count: newPosts.length,
            },
          };
        }

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

      // 根据错误类型显示不同的错误信息
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
      // 清理状态
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 顶部操作栏 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => (navigation as any).navigate("Settings")}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={theme.colors.black}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBarButton} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={24}
            color={theme.colors.black}
          />
        </TouchableOpacity>
      </View>

      {/* 小红书风格头部 */}
      <View style={styles.header}>
        {/* 第一行：头像和用户名 */}
        <View style={styles.profileRow}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => (navigation as any).navigate("EditProfile")}
          >
            {userInfo?.avatarUrl || user?.avatar ? (
              <Image
                source={{ uri: userInfo?.avatarUrl || user?.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {(userInfo?.username || user?.username)
                    ?.slice(0, 2)
                    .toUpperCase() || "AG"}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.userInfoSection}>
            <Text style={styles.username}>
              {userInfo?.username || user?.username || "用户"}
            </Text>
            <Text style={styles.userId}>
              用户号：{user?.userId || "未知"}
              {userInfo?.location ? `  IP属地：${userInfo.location}` : ""}
            </Text>
          </View>
        </View>

        {/* Bio */}
        <TouchableOpacity
          style={styles.bioContainer}
          onPress={() => (navigation as any).navigate("EditProfile")}
        >
          <Text style={styles.bioText} numberOfLines={2}>
            {userInfo?.bio || "点击编辑个人简介..."}
          </Text>
        </TouchableOpacity>

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
              (navigation as any).navigate("FollowingUsers", {
                userId: user?.userId,
              })
            }
          >
            <Text style={styles.statNumber}>{followingUsersCount}</Text>
            <Text style={styles.statLabel}>关注</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>粉丝</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>
              {tabsData.published.count > 0
                ? tabsData.published.count
                : userInfo?.userId
                ? "0"
                : "-"}
            </Text>
            <Text style={styles.statLabel}>获赞与收藏</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 我的发布区域 */}
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
            // 直接从总状态池取数据，不再依赖单一的 posts 变量
            const currentTabData = tabsData[tab.id];
            const isCurrentTab = activeTab === tab.id;

            // 只有在从未加载过数据 且 正在加载时 才显示 loading
            // 这样如果已经有旧数据，刷新时不会白屏
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
                          onLongPress={() => {
                            if (
                              tab.id === "published" ||
                              tab.id === "draft" ||
                              tab.id === "pending"
                            ) {
                              handleDeletePost(post);
                            }
                          }}
                          activeOpacity={0.95}
                        >
                          <SimplePostCard
                            post={post}
                            onPress={() => handlePostPress(post)}
                          />
                        </TouchableOpacity>

                        {(tab.id === "published" ||
                          tab.id === "draft" ||
                          tab.id === "pending") && (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeletePost(post)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={theme.colors.white}
                            />
                          </TouchableOpacity>
                        )}
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
                          : tab.id === "pending"
                          ? "time-outline"
                          : "document-text-outline"
                      }
                      size={48}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.emptyText}>
                      {tab.id === "published" && "还没有发布内容"}
                      {tab.id === "pending" && "没有待审核的帖子"}
                      {tab.id === "draft" && "还没有草稿"}
                      {tab.id === "saved" && "还没有收藏帖子"}
                      {tab.id === "liked" && "还没有点赞帖子"}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            );
          })}
        </ScrollView>
      </View>

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
              <View
                style={{
                  backgroundColor: theme.colors.white,
                  borderRadius: 16,
                  marginHorizontal: 40,
                  width: SCREEN_WIDTH - 80,
                  overflow: "hidden",
                }}
              >
                {/* 标题 */}
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingTop: 24,
                    paddingBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: theme.colors.black,
                      textAlign: "center",
                    }}
                  >
                    确认删除
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.colors.gray600,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    删除后将无法恢复，确定要删除这篇帖子吗？
                  </Text>
                </View>

                {/* 分割线 */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.gray100,
                  }}
                />

                {/* 按钮区域 */}
                <View style={{ flexDirection: "row" }}>
                  {/* 取消按钮 */}
                  <TouchableOpacity
                    onPress={() => {
                      if (isDeleting) return; // 删除中不允许取消
                      setShowDeleteDialog(false);
                      setPostToDelete(null);
                    }}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      alignItems: "center",
                      borderRightWidth: 1,
                      borderRightColor: theme.colors.gray100,
                      opacity: isDeleting ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: theme.colors.gray600,
                      }}
                    >
                      取消
                    </Text>
                  </TouchableOpacity>

                  {/* 删除按钮 */}
                  <TouchableOpacity
                    onPress={handleConfirmDelete}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color="#FF3040"
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: "#FF3040",
                          }}
                        >
                          删除中...
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#FF3040",
                        }}
                      >
                        删除
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  // 顶部操作栏
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  topBarButton: {
    padding: theme.spacing.xs,
  },
  // 小红书风格头部
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
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.lg,
    position: "relative",
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
    position: "relative",
  },
  deleteButton: {
    position: "absolute",
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: "rgba(255, 48, 64, 0.9)",
    borderRadius: theme.borderRadius.full,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.sm,
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
});

export default ProfileScreen;
