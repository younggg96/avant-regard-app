import React, { useState, useEffect } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  getFollowers,
  FollowingUser,
  followUser,
  unfollowUser,
  isFollowingUser,
} from "../services/followService";

type RouteParams = {
  Followers: {
    userId: number;
  };
};

const FollowersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "Followers">>();
  const { user } = useAuthStore();
  const [followers, setFollowers] = useState<FollowingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState<Record<number, boolean>>({});

  // 从路由参数获取 userId，如果没有则使用当前用户的 userId
  const userId = route.params?.userId || user?.userId;

  // 加载粉丝列表
  const loadFollowers = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const users = await getFollowers(userId);
      setFollowers(users);

      // 检查当前用户是否关注了这些粉丝
      if (user?.userId) {
        const statusMap: Record<number, boolean> = {};
        await Promise.all(
          users.map(async (follower) => {
            try {
              const isFollowing = await isFollowingUser(user.userId, follower.userId);
              statusMap[follower.userId] = isFollowing;
            } catch {
              statusMap[follower.userId] = false;
            }
          })
        );
        setFollowingStatus(statusMap);
      }
    } catch (error) {
      console.error("Error loading followers:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowers();
  }, [userId]);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowers();
    setRefreshing(false);
  };

  // 关注/取消关注粉丝
  const handleToggleFollow = async (targetUserId: number) => {
    if (!user?.userId) return;

    const isCurrentlyFollowing = followingStatus[targetUserId];

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser({
          followerId: user.userId,
          targetUserId: targetUserId,
        });
        Alert.show("已取消关注");
      } else {
        await followUser({
          followerId: user.userId,
          targetUserId: targetUserId,
        });
        Alert.show("关注成功");
      }
      // 更新关注状态
      setFollowingStatus((prev) => ({
        ...prev,
        [targetUserId]: !isCurrentlyFollowing,
      }));
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.show(isCurrentlyFollowing ? "取消关注失败" : "关注失败");
    }
  };

  // 导航到用户主页
  const handleUserPress = (userId: number) => {
    (navigation as any).navigate("UserProfile", { userId });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>粉丝</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 内容 */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.colors.gray400} />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : followers.length > 0 ? (
          <View style={styles.userList}>
            {followers.map((follower) => (
              <View key={follower.userId} style={styles.userItem}>
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => handleUserPress(follower.userId)}
                >
                  {/* 头像 */}
                  {follower.avatar ? (
                    <Image
                      source={{ uri: follower.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {follower.username?.slice(0, 2).toUpperCase() || "??"}
                      </Text>
                    </View>
                  )}

                  {/* 用户信息 */}
                  <View style={styles.userDetails}>
                    <Text style={styles.username} numberOfLines={1}>
                      {follower.username}
                    </Text>
                    {follower.bio ? (
                      <Text style={styles.bio} numberOfLines={2}>
                        {follower.bio}
                      </Text>
                    ) : null}
                    {follower.location ? (
                      <View style={styles.locationContainer}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={theme.colors.gray400}
                        />
                        <Text style={styles.location}>{follower.location}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* 关注按钮 - 不显示自己 */}
                {user?.userId !== follower.userId && (
                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      followingStatus[follower.userId] && styles.followingButton,
                    ]}
                    onPress={() => handleToggleFollow(follower.userId)}
                  >
                    <Text
                      style={[
                        styles.followButtonText,
                        followingStatus[follower.userId] &&
                          styles.followingButtonText,
                      ]}
                    >
                      {followingStatus[follower.userId] ? "已关注" : "回关"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={48}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>还没有粉丝</Text>
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
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
  userList: {
    paddingVertical: theme.spacing.sm,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
  },
  userDetails: {
    flex: 1,
  },
  username: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 4,
  },
  bio: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  location: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: 2,
  },
  followButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 4,
    backgroundColor: theme.colors.black,
  },
  followingButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  followButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "500",
  },
  followingButtonText: {
    color: theme.colors.gray600,
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

export default FollowersScreen;
