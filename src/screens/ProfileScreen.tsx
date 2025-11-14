import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  getUserPostsByStatus,
  initializeMockUserPosts,
  UserPost,
  PostStatus,
} from "../services/userPostService";
import {
  getSavedPosts,
  getLikedPosts,
  initializeMockInteractions,
} from "../services/userInteractionService";
import { getUnreadCount } from "../services/notificationService";
import SimplePostCard from "../components/SimplePostCard";
import { Post } from "../components/PostCard";

type TabType = "published" | "pending" | "draft" | "saved" | "liked";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const tabs = [
    { id: "published" as TabType, label: "已发布", count: 0 },
    { id: "liked" as TabType, label: "我喜欢的", count: 0 },
    { id: "saved" as TabType, label: "我收藏的", count: 0 },
    { id: "pending" as TabType, label: "审核中", count: 0 },
    { id: "draft" as TabType, label: "草稿", count: 0 },
  ];

  const menuItems = [
    {
      id: "notifications",
      label: "通知",
      count: unreadNotifications,
      icon: "notifications-outline",
    },
    { id: "followed", label: "关注的设计师", count: 12, icon: "heart-outline" },
    { id: "saved", label: "收藏的搭配", count: 48, icon: "bookmark-outline" },
    { id: "settings", label: "设置", count: null, icon: "settings-outline" },
  ];

  // 初始化数据
  useEffect(() => {
    initializeMockUserPosts();
    initializeMockInteractions();
    loadUnreadNotifications();
  }, []);

  // 加载未读通知数量
  const loadUnreadNotifications = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error("Error loading unread notifications:", error);
    }
  };

  // 加载 posts
  const loadPosts = async () => {
    try {
      let loadedPosts: Post[] = [];

      if (activeTab === "saved") {
        // 加载收藏的帖子
        loadedPosts = await getSavedPosts();
      } else if (activeTab === "liked") {
        // 加载喜欢的帖子
        loadedPosts = await getLikedPosts();
      } else {
        // 加载用户发布的帖子
        const statusMap: Record<"published" | "pending" | "draft", PostStatus> =
          {
            published: "published",
            pending: "pending",
            draft: "draft",
          };
        const userPosts = await getUserPostsByStatus(
          statusMap[activeTab as "published" | "pending" | "draft"]
        );
        // 将 UserPost 转换为 Post，并保留 status 信息
        loadedPosts = userPosts.map((userPost) => ({
          ...userPost,
          author: {
            id: user?.id || "current-user",
            name: user?.nickname || "用户",
            avatar: "https://picsum.photos/id/64/60/60",
          },
        }));
      }

      setPosts(loadedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
      Alert.show("加载失败，请重试");
    }
  };

  // 当标签切换时重新加载
  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  // 当页面获得焦点时重新加载
  useFocusEffect(
    useCallback(() => {
      loadPosts();
      loadUnreadNotifications();
    }, [activeTab])
  );

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleLogout = () => {
    // Simple confirmation - just show message and logout after delay
    Alert.show("正在退出...");
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handlePostPress = (post: Post) => {
    // 判断是否需要传递 postStatus
    let postStatus: "draft" | "pending" | "published" = "published";

    if ("status" in post) {
      // 如果是 UserPost（有 status 字段），传递状态
      postStatus = (post as any).status;
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nickname?.slice(0, 2).toUpperCase() || "AG"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.nickname || "用户"}</Text>
            <Text style={styles.joinDate}>
              {user?.phone
                ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
                : "未绑定手机"}
            </Text>
          </View>
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
                    (navigation as any).navigate("设置");
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
          {posts.length > 0 ? (
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
                {activeTab === "pending" && "没有审核中的内容"}
                {activeTab === "draft" && "还没有草稿"}
                {activeTab === "saved" && "还没有收藏的内容"}
                {activeTab === "liked" && "还没有喜欢的内容"}
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
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.md,
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
