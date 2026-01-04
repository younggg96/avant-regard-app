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
  getFollowingUsers,
  FollowingUser,
  unfollowUser,
} from "../services/followService";

type RouteParams = {
  FollowingUsers: {
    userId: number;
  };
};

const FollowingUsersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "FollowingUsers">>();
  const { user } = useAuthStore();
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 从路由参数获取 userId，如果没有则使用当前用户的 userId
  const userId = route.params?.userId || user?.userId;

  // 加载关注的用户列表
  const loadFollowingUsers = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const users = await getFollowingUsers(userId);
      setFollowingUsers(users);
    } catch (error) {
      console.error("Error loading following users:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowingUsers();
  }, [userId]);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowingUsers();
    setRefreshing(false);
  };

  // 取消关注
  const handleUnfollow = async (targetUserId: number) => {
    if (!user?.userId) return;

    try {
      await unfollowUser({
        followerId: user.userId,
        targetUserId: targetUserId,
      });
      Alert.show("已取消关注");
      // 重新加载列表
      await loadFollowingUsers();
    } catch (error) {
      console.error("Error unfollowing user:", error);
      Alert.show("取消关注失败，请重试");
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
        <Text style={styles.headerTitle}>关注的用户</Text>
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
        ) : followingUsers.length > 0 ? (
          <View style={styles.userList}>
            {followingUsers.map((followingUser) => (
              <View key={followingUser.userId} style={styles.userItem}>
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => handleUserPress(followingUser.userId)}
                >
                  {/* 头像 */}
                  {followingUser.avatar ? (
                    <Image
                      source={{ uri: followingUser.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {followingUser.username?.slice(0, 2).toUpperCase() ||
                          "??"}
                      </Text>
                    </View>
                  )}

                  {/* 用户信息 */}
                  <View style={styles.userDetails}>
                    <Text style={styles.username} numberOfLines={1}>
                      {followingUser.username}
                    </Text>
                    {followingUser.bio ? (
                      <Text style={styles.bio} numberOfLines={2}>
                        {followingUser.bio}
                      </Text>
                    ) : null}
                    {followingUser.location ? (
                      <View style={styles.locationContainer}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={theme.colors.gray400}
                        />
                        <Text style={styles.location}>
                          {followingUser.location}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* 取消关注按钮 - 只有当查看的是自己的关注列表时才显示 */}
                {user?.userId === userId && (
                  <TouchableOpacity
                    style={styles.unfollowButton}
                    onPress={() => handleUnfollow(followingUser.userId)}
                  >
                    <Text style={styles.unfollowButtonText}>取消关注</Text>
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
            <Text style={styles.emptyText}>还没有关注任何用户</Text>
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
  unfollowButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
  },
  unfollowButtonText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontWeight: "500",
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

export default FollowingUsersScreen;

