import React, { useState, useEffect, useCallback } from "react";
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
import { getUnreadCount } from "../services/notificationService";
import { userInfoService, UserInfo } from "../services/userInfoService";
import {
  getFollowingCount,
  getFollowingDesignersCount,
} from "../services/followService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

type TabType = "published" | "pending" | "draft" | "saved" | "liked";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 用户信息状态
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 关注的用户数量
  const [followingUsersCount, setFollowingUsersCount] = useState(0);

  // 关注的设计师数量
  const [followingDesignersCount, setFollowingDesignersCount] = useState(0);

  // 各标签的帖子数量
  const [postCounts, setPostCounts] = useState({
    published: 0,
    pending: 0,
    draft: 0,
    saved: 0,
    liked: 0,
  });

  // 缓存各 tab 的数据，避免重复请求
  const [tabDataCache, setTabDataCache] = useState<{
    [key in TabType]?: { posts: DisplayPost[]; count: number };
  }>({});

  const tabs = [
    {
      id: "published" as TabType,
      label: "已发布",
      count: postCounts.published,
    },
    { id: "pending" as TabType, label: "待审核", count: postCounts.pending },
    { id: "liked" as TabType, label: "我喜欢的", count: postCounts.liked },
    { id: "saved" as TabType, label: "我收藏的", count: postCounts.saved },
    { id: "draft" as TabType, label: "草稿", count: postCounts.draft },
  ];

  const menuItems = [
    // {
    //   id: "notifications",
    //   label: "通知",
    //   count: unreadNotifications,
    //   icon: "notifications-outline",
    // },
    {
      id: "followedUsers",
      label: "关注的用户",
      count: followingUsersCount,
      icon: "people-outline",
    },
    {
      id: "followedDesigners",
      label: "关注的设计师",
      count: followingDesignersCount,
      icon: "heart-outline",
    },
    { id: "settings", label: "设置", count: null, icon: "settings-outline" },
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
      },
      likes: apiPost.likeCount || 0,
      // 保留原始状态用于判断
      status: apiPost.status,
    } as DisplayPost & { status?: string };
  };

  // 初始化数据 - 只加载用户信息和关注数量，不加载所有帖子
  useEffect(() => {
    loadUnreadNotifications();
    loadUserInfo();
    loadFollowingUsersCount();
    loadFollowingDesignersCount();
    // 清空缓存，因为用户可能变了
    setTabDataCache({});
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

  // 加载未读通知数量
  const loadUnreadNotifications = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error("Error loading unread notifications:", error);
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

  // 加载关注的设计师数量
  const loadFollowingDesignersCount = async () => {
    if (!user?.userId) return;

    try {
      const count = await getFollowingDesignersCount(user.userId);
      setFollowingDesignersCount(count);
    } catch (error) {
      console.error("Error loading following designers count:", error);
    }
  };

  // 更新单个 tab 的数量
  const updateTabCount = (tab: TabType, count: number) => {
    setPostCounts((prev) => ({
      ...prev,
      [tab]: count,
    }));
  };

  // 加载 posts - 使用缓存避免重复请求
  const loadPosts = async (forceRefresh = false) => {
    if (!user?.userId) return;

    // 如果有缓存且不是强制刷新，直接使用缓存
    if (!forceRefresh && tabDataCache[activeTab]) {
      setPosts(tabDataCache[activeTab]!.posts);
      return;
    }

    setLoading(true);
    try {
      let loadedPosts: DisplayPost[] = [];

      // 获取用户头像信息
      const authorName = userInfo?.username || user?.username || "用户";
      const authorAvatar =
        userInfo?.avatarUrl ||
        user?.avatar ||
        `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;

      if (activeTab === "saved") {
        // 加载用户收藏的帖子
        const apiPosts = await postService.getFavoritePostsByUserId(
          user.userId
        );
        // 转换为展示格式
        loadedPosts = apiPosts.map((post) =>
          convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
        );
      } else if (activeTab === "liked") {
        // 加载用户点赞的帖子
        const apiPosts = await postService.getLikedPostsByUserId(user.userId);
        // 转换为展示格式
        loadedPosts = apiPosts.map((post) =>
          convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
        );
      } else if (activeTab === "pending" || activeTab === "published") {
        // pending 和 published 共享同一个 API 请求
        const apiPosts = await postService.getPostsByUserId(
          user.userId,
          "PUBLISHED"
        );
        
        // 筛选出待审核和已审核通过的帖子
        const pendingPosts = apiPosts.filter(
          (post: ApiPost) => post.auditStatus === "PENDING"
        );
        const approvedPosts = apiPosts.filter(
          (post: ApiPost) => post.auditStatus === "APPROVED"
        );

        // 转换为展示格式
        const pendingDisplayPosts = pendingPosts.map((post) => ({
          ...convertToDisplayPost(post, {
            name: authorName,
            avatar: authorAvatar,
          }),
          auditStatus: post.auditStatus,
        }));
        const approvedDisplayPosts = approvedPosts.map((post) =>
          convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
        );

        // 缓存两个 tab 的数据
        setTabDataCache((prev) => ({
          ...prev,
          pending: { posts: pendingDisplayPosts, count: pendingDisplayPosts.length },
          published: { posts: approvedDisplayPosts, count: approvedDisplayPosts.length },
        }));

        // 更新两个 tab 的数量
        updateTabCount("pending", pendingDisplayPosts.length);
        updateTabCount("published", approvedDisplayPosts.length);

        // 设置当前 tab 的帖子
        loadedPosts = activeTab === "pending" ? pendingDisplayPosts : approvedDisplayPosts;
        
        setPosts(loadedPosts);
        setLoading(false);
        return;
      } else if (activeTab === "draft") {
        // 加载草稿帖子
        const apiPosts = await postService.getPostsByUserId(
          user.userId,
          "DRAFT"
        );
        // 转换为展示格式
        loadedPosts = apiPosts.map((post) =>
          convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
        );
      }

      // 缓存当前 tab 的数据
      setTabDataCache((prev) => ({
        ...prev,
        [activeTab]: { posts: loadedPosts, count: loadedPosts.length },
      }));

      // 更新当前 tab 的数量
      updateTabCount(activeTab, loadedPosts.length);

      setPosts(loadedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 当标签切换时加载对应 tab 的数据（使用缓存）
  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  // 当页面获得焦点时刷新当前 tab 的数据
  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadFollowingUsersCount();
      loadFollowingDesignersCount();
      // 只刷新当前 tab 的数据
      loadPosts(true);
    }, [activeTab, user?.userId])
  );

  // 下拉刷新 - 只刷新当前 tab 和必要的信息
  const onRefresh = async () => {
    setRefreshing(true);
    // 清除当前 tab 的缓存
    setTabDataCache((prev) => {
      const newCache = { ...prev };
      delete newCache[activeTab];
      // 如果是 pending 或 published，两个都清除因为共享数据源
      if (activeTab === "pending" || activeTab === "published") {
        delete newCache["pending"];
        delete newCache["published"];
      }
      return newCache;
    });
    
    await Promise.all([
      loadUserInfo(),
      loadPosts(true),
      loadFollowingUsersCount(),
      loadFollowingDesignersCount(),
    ]);
    setRefreshing(false);
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

      // 清除相关缓存并重新加载数据
      try {
        // 清除当前 tab 的缓存
        setTabDataCache((prev) => {
          const newCache = { ...prev };
          delete newCache[activeTab];
          // 如果是 pending 或 published，两个都清除
          if (activeTab === "pending" || activeTab === "published") {
            delete newCache["pending"];
            delete newCache["published"];
          }
          return newCache;
        });
        await loadPosts(true);
      } catch (refreshError) {
        console.warn("删除成功但刷新数据失败:", refreshError);
        // 即使刷新失败，也手动从列表中移除已删除的帖子
        setPosts((prevPosts) =>
          prevPosts.filter((p) => p.id !== postToDelete.id)
        );
        // 更新数量
        updateTabCount(activeTab, posts.length - 1);
      }
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
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          {/* 头像 */}
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

          {/* 用户信息 */}
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => (navigation as any).navigate("EditProfile")}
          >
            <Text style={styles.username}>
              {userInfo?.username || user?.username || "用户"}
            </Text>
            {userInfo?.bio ? (
              <Text style={styles.userBio} numberOfLines={1}>
                {userInfo.bio}
              </Text>
            ) : (
              <Text style={styles.joinDate}>
                {user?.phone
                  ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
                  : "点击编辑个人资料"}
              </Text>
            )}
          </TouchableOpacity>

          {/* 退出按钮 */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                switch (item.id) {
                  case "notifications":
                    (navigation as any).navigate("Notifications");
                    break;
                  case "followedUsers":
                    (navigation as any).navigate("FollowingUsers", {
                      userId: user?.userId,
                    });
                    break;
                  case "followedDesigners":
                    (navigation as any).navigate("FollowingDesigners", {
                      userId: user?.userId,
                    });
                    break;
                  case "settings":
                    (navigation as any).navigate("Settings");
                    break;
                  case "favorites":
                    (navigation as any).navigate("Favorites");
                    break;
                  case "history":
                    (navigation as any).navigate("History");
                    break;
                  default:
                    Alert.show(`${item.label}功能即将推出`);
                }
              }}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={theme.colors.gray400}
                  style={styles.menuIcon}
                />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <View style={styles.menuRight}>
                {item.count !== null && (
                  <Text style={styles.menuCount}>{item.count}</Text>
                )}
                <Text style={styles.menuArrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 我的发布区域 */}
        <View style={styles.postsSection}>
          {/* 标签栏 */}
          <ScrollView
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
                onPress={() => setActiveTab(tab.id)}
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

          {/* Posts 网格 */}
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.gray400} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : posts.length > 0 ? (
            <View style={styles.postsGrid}>
              {posts.map((post) => (
                <View key={post.id} style={styles.postItem}>
                  <TouchableOpacity
                    onPress={() => handlePostPress(post)}
                    onLongPress={() => {
                      // 只有自己的帖子才能删除（published、draft、pending）
                      if (
                        activeTab === "published" ||
                        activeTab === "draft" ||
                        activeTab === "pending"
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

                  {/* 显示删除按钮（只对自己的帖子） */}
                  {(activeTab === "published" ||
                    activeTab === "draft" ||
                    activeTab === "pending") && (
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
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name={
                  activeTab === "saved"
                    ? "bookmark-outline"
                    : activeTab === "liked"
                    ? "heart-outline"
                    : activeTab === "pending"
                    ? "time-outline"
                    : "document-text-outline"
                }
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>
                {activeTab === "published" && "还没有发布内容"}
                {activeTab === "pending" && "没有待审核的帖子"}
                {activeTab === "draft" && "还没有草稿"}
                {activeTab === "saved" && "还没有收藏帖子"}
                {activeTab === "liked" && "还没有点赞帖子"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...theme.typography.h3,
    color: theme.colors.white,
  },
  userInfo: {
    flex: 1,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  username: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: 2,
  },
  userBio: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  joinDate: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  content: {
    flex: 1,
  },
  menuSection: {
    paddingVertical: theme.spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: theme.spacing.sm,
  },
  menuLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginRight: theme.spacing.sm,
  },
  menuArrow: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  postsSection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  tabBarContent: {
    paddingHorizontal: theme.spacing.md,
  },
  tabItem: {
    paddingVertical: theme.spacing.md,
    marginRight: theme.spacing.lg,
    position: "relative",
  },
  tabItemActive: {},
  tabLabel: {
    ...theme.typography.body,
    color: theme.colors.gray400,
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
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
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
