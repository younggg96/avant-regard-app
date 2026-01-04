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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  getFollowingDesigners,
  FollowingDesigner,
  unfollowDesigner,
} from "../services/followService";

type RouteParams = {
  FollowingDesigners: {
    userId: number;
  };
};

const FollowingDesignersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "FollowingDesigners">>();
  const { user } = useAuthStore();
  const [followingDesigners, setFollowingDesigners] = useState<
    FollowingDesigner[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 从路由参数获取 userId，如果没有则使用当前用户的 userId
  const userId = route.params?.userId || user?.userId;

  // 加载关注的设计师列表
  const loadFollowingDesigners = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const designers = await getFollowingDesigners(userId);
      setFollowingDesigners(designers);
    } catch (error) {
      console.error("Error loading following designers:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowingDesigners();
  }, [userId]);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowingDesigners();
    setRefreshing(false);
  };

  // 取消关注
  const handleUnfollow = async (designerId: number) => {
    try {
      await unfollowDesigner(designerId);
      Alert.show("已取消关注");
      // 重新加载列表
      await loadFollowingDesigners();
    } catch (error) {
      console.error("Error unfollowing designer:", error);
      Alert.show("取消关注失败，请重试");
    }
  };

  // 导航到设计师详情页
  const handleDesignerPress = (designerId: number) => {
    (navigation as any).navigate("DesignerDetail", { designerId });
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
        <Text style={styles.headerTitle}>关注的设计师</Text>
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
        ) : followingDesigners.length > 0 ? (
          <View style={styles.designerList}>
            {followingDesigners.map((designer) => (
              <View key={designer.id} style={styles.designerItem}>
                <TouchableOpacity
                  style={styles.designerInfo}
                  onPress={() => handleDesignerPress(designer.id)}
                >
                  {/* 设计师信息 */}
                  <View style={styles.designerDetails}>
                    <Text style={styles.designerName} numberOfLines={1}>
                      {designer.name}
                    </Text>
                    {designer.latestSeason ? (
                      <View style={styles.seasonContainer}>
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={theme.colors.gray400}
                        />
                        <Text style={styles.seasonText}>
                          最新: {designer.latestSeason}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.followerContainer}>
                      <Ionicons
                        name="people-outline"
                        size={12}
                        color={theme.colors.gray400}
                      />
                      <Text style={styles.followerText}>
                        {designer.followerCount} 人关注
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 取消关注按钮 - 只有当查看的是自己的关注列表时才显示 */}
                {user?.userId === userId && (
                  <TouchableOpacity
                    style={styles.unfollowButton}
                    onPress={() => handleUnfollow(designer.id)}
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
              name="heart-outline"
              size={48}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>还没有关注任何设计师</Text>
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
  designerList: {
    paddingVertical: theme.spacing.sm,
  },
  designerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  designerInfo: {
    flex: 1,
  },
  designerDetails: {
    flex: 1,
  },
  designerName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: theme.spacing.md,
  },
  statText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginLeft: 4,
  },
  seasonContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  seasonText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: 4,
  },
  followerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  followerText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: 4,
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

export default FollowingDesignersScreen;
