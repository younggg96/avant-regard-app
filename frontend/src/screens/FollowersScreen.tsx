import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  getFollowers,
  FollowingUser,
  followUser,
  unfollowUser,
  isFollowingUser,
  getMutualFollows,
} from "../services/followService";
import { userInfoService } from "../services/userInfoService";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

type RouteParams = {
  Followers: {
    userId: number;
  };
};

const FollowersScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "Followers">>();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);
  const [followers, setFollowers] = useState<FollowingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState<Record<number, boolean>>({});
  const [mutualFollowIds, setMutualFollowIds] = useState<Set<number>>(new Set());
  const [isPrivate, setIsPrivate] = useState(false);

  // 从路由参数获取 userId，如果没有则使用当前用户的 userId
  const userId = route.params?.userId || user?.userId;
  const isOwnProfile = userId === user?.userId;

  // 检查隐私设置
  const checkPrivacySettings = async () => {
    if (!userId || isOwnProfile) {
      setIsPrivate(false);
      return;
    }

    try {
      const settings = await userInfoService.getPrivacySettings(userId);
      setIsPrivate(settings.hideFollowers);
    } catch (error) {
      console.error("Error checking privacy settings:", error);
      setIsPrivate(false);
    }
  };

  // 加载粉丝列表
  const loadFollowers = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // 先检查隐私设置
      if (!isOwnProfile) {
        const settings = await userInfoService.getPrivacySettings(userId);
        if (settings.hideFollowers) {
          setIsPrivate(true);
          setFollowers([]);
          return;
        }
        setIsPrivate(false);
      }

      const users = await getFollowers(userId);
      setFollowers(users);

      if (user?.userId) {
        const [statusResults, mutualUsers] = await Promise.all([
          Promise.all(
            users.map(async (follower) => {
              try {
                const isFollowing = await isFollowingUser(user.userId, follower.userId);
                return { userId: follower.userId, isFollowing };
              } catch {
                return { userId: follower.userId, isFollowing: false };
              }
            })
          ),
          getMutualFollows(user.userId),
        ]);

        const statusMap: Record<number, boolean> = {};
        statusResults.forEach((r) => { statusMap[r.userId] = r.isFollowing; });
        setFollowingStatus(statusMap);
        setMutualFollowIds(new Set(mutualUsers.map((u) => u.userId)));
      }
    } catch (error) {
      console.error("Error loading followers:", error);
      Alert.show(t("common.loadFailed"));
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
        Alert.show(t("engagement.unfollowed"));
      } else {
        await followUser({
          followerId: user.userId,
          targetUserId: targetUserId,
        });
        Alert.show(t("engagement.followSuccess"));
      }
      // 更新关注状态
      setFollowingStatus((prev) => ({
        ...prev,
        [targetUserId]: !isCurrentlyFollowing,
      }));
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.show(t("engagement.operationFailed"));
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
        <Text style={styles.headerTitle}>{t("followersScreen.title")}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 内容 */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator  color={theme.colors.gray400} />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : isPrivate ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="lock-closed-outline"
              size={24}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>{t("followersScreen.privateList")}</Text>
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
                    <OptimizedImage
                      uri={follower.avatar}
                      size={ImageSize.THUMBNAIL}
                      style={styles.avatar}
                      contentFit="cover"
                      lazy={true}
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
                      {followingStatus[follower.userId]
                        ? (mutualFollowIds.has(follower.userId) ? t("profile.mutual") : t("profile.unfollow"))
                        : t("followersScreen.followBack")}
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
              size={24}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>{t("followersScreen.noFollowers")}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    backButton: {
      padding: t.spacing.xs,
    },
    headerTitle: {
      ...t.typography.h3,
      color: t.colors.text,
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
      paddingVertical: t.spacing.xl * 2,
    },
    loadingText: {
      ...t.typography.caption,
      color: t.colors.gray400,
      marginTop: t.spacing.sm,
    },
    userList: {
      paddingVertical: t.spacing.sm,
    },
    userItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
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
      marginRight: t.spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: t.colors.gray500,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      ...t.typography.body,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    userDetails: {
      flex: 1,
    },
    username: {
      ...t.typography.body,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 4,
    },
    bio: {
      ...t.typography.caption,
      color: t.colors.gray600,
      marginBottom: 4,
    },
    locationContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    location: {
      ...t.typography.caption,
      color: t.colors.gray400,
      marginLeft: 2,
    },
    followButton: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
    },
    followingButton: {
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.gray300,
    },
    followButtonText: {
      ...t.typography.caption,
      color: t.colors.textInverted,
      fontWeight: "500",
    },
    followingButtonText: {
      color: t.colors.gray600,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: t.spacing.xl * 2,
    },
    emptyText: {
      ...t.typography.body,
      color: t.colors.gray400,
      marginTop: t.spacing.md,
    },
  });

export default FollowersScreen;
