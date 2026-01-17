import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Linking,
  Dimensions,
  ActivityIndicator,
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
import { Post as DisplayPost } from "../components/PostCard";
import {
  followService,
  isFollowingUser,
  getFollowersCount,
  getFollowingCount,
} from "../services/followService";
import { userInfoService, UserInfo } from "../services/userInfoService";
import SimplePostCard from "../components/SimplePostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 用户资料类型（扩展自 API 返回的 UserInfo）
interface UserProfile extends Partial<UserInfo> {
  id: number;
  username: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  // 社交媒体
  instagram?: string;
  twitter?: string;
  weibo?: string;
  xiaohongshu?: string;
}

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

  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: userId,
    username: username || "用户",
    avatar: avatar,
  });
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // 判断是否是当前用户自己
  const isCurrentUser = currentUser?.userId === userId;

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
    };
  };

  // 加载用户数据
  const loadUserData = async () => {
    try {
      setLoading(true);

      // 并行加载数据
      const [userInfoData, postsData, followers, following] = await Promise.all(
        [
          userInfoService.getUserInfo(userId).catch(() => null),
          postService.getPostsByUserId(userId, "PUBLISHED").catch(() => []),
          getFollowersCount(userId).catch(() => 0),
          getFollowingCount(userId).catch(() => 0),
        ]
      );

      // 获取用户信息
      const authorName = userInfoData?.username || username || "用户";
      const authorAvatar =
        userInfoData?.avatarUrl ||
        avatar ||
        `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`;

      // 更新用户资料（从 API 获取）
      if (userInfoData) {
        setUserProfile((prev) => ({
          ...prev,
          id: userInfoData.userId,
          username: userInfoData.username || prev.username,
          bio: userInfoData.bio,
          location: userInfoData.location,
          avatar: userInfoData.avatarUrl || prev.avatar,
        }));
      }

      // 转换帖子数据为展示格式
      const displayPosts = (postsData || []).map((post) =>
        convertToDisplayPost(post, { name: authorName, avatar: authorAvatar })
      );
      setPosts(displayPosts);
      setFollowersCount(followers);
      setFollowingCount(following);

      // 检查是否关注
      if (currentUser?.userId && !isCurrentUser) {
        const isFollowingResult = await isFollowingUser(
          currentUser.userId,
          userId
        ).catch(() => false);
        setIsFollowing(isFollowingResult);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [userId])
  );

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
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

  // 打开社交媒体链接
  const openSocialLink = (platform: string, handle?: string) => {
    if (!handle) return;

    let url = "";
    switch (platform) {
      case "instagram":
        url = `https://instagram.com/${handle}`;
        break;
      case "twitter":
        url = `https://twitter.com/${handle}`;
        break;
      case "weibo":
        url = `https://weibo.com/${handle}`;
        break;
      case "xiaohongshu":
        url = `https://xiaohongshu.com/user/profile/${handle}`;
        break;
      case "website":
        url = handle.startsWith("http") ? handle : `https://${handle}`;
        break;
    }

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.show("无法打开链接");
      });
    }
  };

  // 帖子点击
  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  // 渲染社交媒体链接
  const renderSocialLinks = () => {
    const socialLinks = [
      {
        platform: "instagram",
        icon: "logo-instagram",
        handle: userProfile.instagram,
      },
      {
        platform: "twitter",
        icon: "logo-twitter",
        handle: userProfile.twitter,
      },
      { platform: "weibo", icon: "globe-outline", handle: userProfile.weibo },
      {
        platform: "xiaohongshu",
        icon: "leaf-outline",
        handle: userProfile.xiaohongshu,
      },
      {
        platform: "website",
        icon: "link-outline",
        handle: userProfile.website,
      },
    ].filter((item) => item.handle);

    if (socialLinks.length === 0) return null;

    return (
      <View style={styles.socialContainer}>
        {socialLinks.map((item) => (
          <TouchableOpacity
            key={item.platform}
            style={styles.socialButton}
            onPress={() => openSocialLink(item.platform, item.handle)}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={theme.colors.gray600}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 顶部导航栏 - 小红书风格 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={theme.colors.black}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息区域 - 小红书风格 */}
        <View style={styles.profileSection}>
          {/* 头像和关注按钮行 */}
          <View style={styles.profileTopRow}>
            {/* 头像 */}
            {userProfile.avatar ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userProfile.username?.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

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
                      color={theme.colors.white}
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

          {/* 用户名 */}
          <Text style={styles.username}>{userProfile.username}</Text>

          {/* 小红书号/ID */}
          <Text style={styles.userId}>ID: {userId}</Text>

          {/* 个人简介 */}
          {userProfile.bio ? (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          ) : (
            <Text style={styles.bioPlaceholder}>暂无简介</Text>
          )}

          {/* 位置信息 */}
          {userProfile.location && (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.gray400}
              />
              <Text style={styles.locationText}>{userProfile.location}</Text>
            </View>
          )}

          {/* 社交媒体链接 */}
          {renderSocialLinks()}

          {/* 统计数据 - 小红书风格（关注/粉丝/获赞） */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                (navigation as any).navigate("FollowingUsers", {
                  userId: userId,
                })
              }
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>关注</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                (navigation as any).navigate("Followers", {
                  userId: userId,
                })
              }
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>粉丝</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {posts.reduce((sum, p) => sum + (p.likes || 0), 0)}
              </Text>
              <Text style={styles.statLabel}>获赞</Text>
            </View>
          </View>
        </View>

        {/* 帖子标签切换 */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, styles.tabItemActive]}>
            <Ionicons
              name="grid-outline"
              size={20}
              color={theme.colors.black}
            />
            <Text style={[styles.tabText, styles.tabTextActive]}>笔记</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons
              name="bookmark-outline"
              size={20}
              color={theme.colors.gray400}
            />
            <Text style={styles.tabText}>收藏</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons
              name="heart-outline"
              size={20}
              color={theme.colors.gray400}
            />
            <Text style={styles.tabText}>赞过</Text>
          </TouchableOpacity>
        </View>

        {/* 帖子网格 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.gray400} />
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
              name="camera-outline"
              size={56}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyTitle}>暂无笔记</Text>
            <Text style={styles.emptySubtitle}>
              {isCurrentUser
                ? "快去发布你的第一篇笔记吧"
                : "TA 还没有发布任何笔记"}
            </Text>
          </View>
        )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.white,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  followButton: {
    backgroundColor: "#FF2442",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.black,
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 4,
  },
  userId: {
    fontSize: 12,
    color: theme.colors.gray400,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: theme.colors.gray700,
    lineHeight: 20,
    marginBottom: 8,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: theme.colors.gray300,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.gray400,
    marginLeft: 4,
  },
  socialContainer: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 12,
    gap: 12,
  },
  socialButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray50,
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.black,
    marginRight: 4,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.gray400,
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "500",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 4,
  },
  postItem: {
    width: (SCREEN_WIDTH - 12) / 2,
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.gray400,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.gray300,
    marginTop: 8,
  },
});

export default UserProfileScreen;
