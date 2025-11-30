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
import { postService, Post } from "../services/postService";
import {
  followService,
  isFollowingUser,
  getFollowersCount,
  getFollowingCount,
} from "../services/followService";
import SimplePostCard from "../components/SimplePostCard";
import ScreenHeader from "../components/ScreenHeader";

// 用户资料类型
interface UserProfile {
  id: number;
  username: string;
  nickname?: string;
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // 判断是否是当前用户自己
  const isCurrentUser = currentUser?.userId === userId;

  // 加载用户数据
  const loadUserData = async () => {
    try {
      setLoading(true);

      // 并行加载数据
      const [postsData, followers, following] = await Promise.all([
        postService.getPostsByUserId(userId, "PUBLISHED"),
        getFollowersCount(userId).catch(() => 0),
        getFollowingCount(userId).catch(() => 0),
      ]);

      setPosts(postsData || []);
      setFollowersCount(followers);
      setFollowingCount(following);

      // 检查是否关注
      if (currentUser?.userId && !isCurrentUser) {
        const following = await isFollowingUser(
          currentUser.userId,
          userId
        ).catch(() => false);
        setIsFollowing(following);
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
          followingId: userId,
        });
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        Alert.show("已取消关注");
      } else {
        await followService.followUser({
          followerId: currentUser.userId,
          followingId: userId,
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
  const handlePostPress = (post: Post) => {
    (navigation as any).navigate("PostDetail", {
      post: post,
      postStatus: "published",
    });
  };

  // 渲染统计数据
  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{posts.length}</Text>
        <Text style={styles.statLabel}>帖子</Text>
      </View>
      <View style={styles.statDivider} />
      <TouchableOpacity style={styles.statItem}>
        <Text style={styles.statNumber}>{followersCount}</Text>
        <Text style={styles.statLabel}>粉丝</Text>
      </TouchableOpacity>
      <View style={styles.statDivider} />
      <TouchableOpacity style={styles.statItem}>
        <Text style={styles.statNumber}>{followingCount}</Text>
        <Text style={styles.statLabel}>关注</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染社交媒体链接
  const renderSocialLinks = () => {
    const socialLinks = [
      { platform: "instagram", icon: "logo-instagram", handle: userProfile.instagram },
      { platform: "twitter", icon: "logo-twitter", handle: userProfile.twitter },
      { platform: "weibo", icon: "globe-outline", handle: userProfile.weibo },
      { platform: "xiaohongshu", icon: "leaf-outline", handle: userProfile.xiaohongshu },
      { platform: "website", icon: "link-outline", handle: userProfile.website },
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
      <ScreenHeader
        title={userProfile.nickname || userProfile.username}
        showBack
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息头部 */}
        <View style={styles.profileHeader}>
          {/* 头像 */}
          <View style={styles.avatarContainer}>
            {userProfile.avatar ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(userProfile.nickname || userProfile.username)
                    ?.slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* 用户名和简介 */}
          <Text style={styles.username}>
            {userProfile.nickname || userProfile.username}
          </Text>
          <Text style={styles.handle}>@{userProfile.username}</Text>

          {userProfile.bio && (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          )}

          {userProfile.location && (
            <View style={styles.locationContainer}>
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.gray400}
              />
              <Text style={styles.locationText}>{userProfile.location}</Text>
            </View>
          )}

          {/* 统计数据 */}
          {renderStats()}

          {/* 社交媒体链接 */}
          {renderSocialLinks()}

          {/* 关注按钮 */}
          {!isCurrentUser && (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText,
                  ]}
                >
                  处理中...
                </Text>
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark" : "add"}
                    size={18}
                    color={isFollowing ? theme.colors.gray600 : theme.colors.white}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followingButtonText,
                    ]}
                  >
                    {isFollowing ? "已关注" : "关注"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isCurrentUser && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => (navigation as any).navigate("EditProfile")}
            >
              <Ionicons
                name="pencil-outline"
                size={16}
                color={theme.colors.black}
              />
              <Text style={styles.editButtonText}>编辑资料</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 帖子区域 */}
        <View style={styles.postsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>全部帖子</Text>
            <Text style={styles.postCount}>{posts.length} 篇</Text>
          </View>

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
                name="document-text-outline"
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>暂无帖子</Text>
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
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.white,
  },
  username: {
    ...theme.typography.h2,
    color: theme.colors.black,
    marginBottom: 4,
  },
  handle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
  },
  bio: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 20,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  locationText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.gray200,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: 24,
    marginTop: theme.spacing.lg,
    minWidth: 120,
  },
  followingButton: {
    backgroundColor: theme.colors.gray100,
  },
  followButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
    marginLeft: 4,
  },
  followingButtonText: {
    color: theme.colors.gray600,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 24,
    marginTop: theme.spacing.lg,
  },
  editButtonText: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "500",
    marginLeft: 6,
  },
  postsSection: {
    paddingTop: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  postCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.spacing.md,
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

export default UserProfileScreen;

