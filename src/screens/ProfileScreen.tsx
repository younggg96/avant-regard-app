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
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

type TabType = "published" | "draft" | "saved" | "liked";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // 用户信息状态
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 各标签的帖子数量
  const [postCounts, setPostCounts] = useState({
    published: 0,
    draft: 0,
    saved: 0,
    liked: 0,
  });

  const tabs = [
    {
      id: "published" as TabType,
      label: "已发布",
      count: postCounts.published,
    },
    { id: "liked" as TabType, label: "我喜欢的", count: postCounts.liked },
    { id: "saved" as TabType, label: "我收藏的", count: postCounts.saved },
    { id: "draft" as TabType, label: "草稿", count: postCounts.draft },
  ];

  const menuItems = [
    {
      id: "notifications",
      label: "通知",
      count: unreadNotifications,
      icon: "notifications-outline",
    },
    { id: "followed", label: "关注的设计师", count: 12, icon: "heart-outline" },
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

  // 初始化数据
  useEffect(() => {
    loadUnreadNotifications();
    loadUserInfo();
    loadAllPostCounts();
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

  // 加载所有标签的帖子数量
  const loadAllPostCounts = async () => {
    if (!user?.userId) return;

    try {
      const [publishedPosts, draftPosts] = await Promise.all([
        postService.getPostsByUserId(user.userId, "PUBLISHED").catch(() => []),
        postService.getPostsByUserId(user.userId, "DRAFT").catch(() => []),
      ]);

      setPostCounts({
        published: publishedPosts.length,
        draft: draftPosts.length,
        saved: 0, // TODO: 后端暂无获取收藏列表的 API
        liked: 0, // TODO: 后端暂无获取点赞列表的 API
      });
    } catch (error) {
      console.error("Error loading post counts:", error);
    }
  };

  // 加载 posts
  const loadPosts = async () => {
    if (!user?.userId) return;

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
        // TODO: 后端暂无获取收藏列表的 API
        // 暂时返回空数组
        loadedPosts = [];
      } else if (activeTab === "liked") {
        // TODO: 后端暂无获取点赞列表的 API
        // 暂时返回空数组
        loadedPosts = [];
      } else {
        // 加载用户发布/草稿的帖子
        const statusMap: Record<"published" | "draft", ApiPostStatus> = {
          published: "PUBLISHED",
          draft: "DRAFT",
        };

        const apiPosts = await postService.getPostsByUserId(
          user.userId,
          statusMap[activeTab as "published" | "draft"]
        );

        // 转换为展示格式
        loadedPosts = apiPosts.map((post) =>
          convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
        );
      }

      setPosts(loadedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 当标签切换时重新加载
  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  // 当页面获得焦点时重新加载
  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadPosts();
      loadUnreadNotifications();
    }, [activeTab, user?.userId])
  );

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserInfo(), loadPosts(), loadUnreadNotifications()]);
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
    let postStatus: "draft" | "published" = "published";

    if ("status" in post) {
      const status = (post as any).status;
      if (status === "DRAFT") {
        postStatus = "draft";
      }
    } else if (activeTab === "draft") {
      postStatus = "draft";
    }

    (navigation as any).navigate("PostDetail", {
      post: post,
      postStatus: postStatus,
    });
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
                  <SimplePostCard
                    post={post}
                    onPress={() => handlePostPress(post)}
                  />
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
                    : "document-text-outline"
                }
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>
                {activeTab === "published" && "还没有发布内容"}
                {activeTab === "draft" && "还没有草稿"}
                {activeTab === "saved" && "还没有收藏帖子"}
                {activeTab === "liked" && "还没有点赞帖子"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
