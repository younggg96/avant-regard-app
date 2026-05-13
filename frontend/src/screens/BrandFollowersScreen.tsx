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
  getBrandFollowers,
  FollowingUser,
  followUser,
  unfollowUser,
  isFollowingUser,
} from "../services/followService";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

type RouteParams = {
  BrandFollowers: {
    brandId: number;
    brandName?: string;
  };
};

const BrandFollowersScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "BrandFollowers">>();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);
  const [followers, setFollowers] = useState<FollowingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState<Record<number, boolean>>({});

  const brandId = route.params?.brandId;
  const brandName = route.params?.brandName;

  const loadFollowers = async () => {
    if (!brandId) return;

    try {
      setLoading(true);
      const users = await getBrandFollowers(brandId);
      setFollowers(users);

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
      console.error("Error loading brand followers:", error);
      Alert.show(t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowers();
  }, [brandId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowers();
    setRefreshing(false);
  };

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
      setFollowingStatus((prev) => ({
        ...prev,
        [targetUserId]: !isCurrentlyFollowing,
      }));
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.show(t("engagement.operationFailed"));
    }
  };

  const handleUserPress = (userId: number) => {
    (navigation as any).navigate("UserProfile", { userId });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {brandName ? `${brandName} - ${t("brand.followers")}` : t("brand.followers")}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.colors.gray400} />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : followers.length > 0 ? (
          <View style={styles.userList}>
            {followers.map((follower) => (
              <View key={follower.userId} style={styles.userItem}>
                <TouchableOpacity
                  style={styles.userInfo}
                  onPress={() => handleUserPress(follower.userId)}
                >
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
                      {followingStatus[follower.userId] ? t("profile.unfollow") : t("profile.followUser")}
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
      borderBottomColor: t.colors.border,
    },
    backButton: {
      padding: t.spacing.xs,
    },
    headerTitle: {
      ...t.typography.h3,
      color: t.colors.text,
      flex: 1,
      textAlign: "center",
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
      borderBottomColor: t.colors.border,
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
      backgroundColor: t.colors.text,
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
      backgroundColor: t.colors.text,
    },
    followingButton: {
      backgroundColor: t.colors.card,
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

export default BrandFollowersScreen;
