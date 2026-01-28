import React, { useState, useEffect } from "react";
import { RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  VStack,
  HStack,
  Image,
} from "../components/ui";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.white }} edges={["top", "bottom"]}>
      {/* 头部 */}
      <HStack
        alignItems="center"
        justifyContent="space-between"
        px="$md"
        py="$md"
        borderBottomWidth={1}
        borderBottomColor="$gray100"
      >
        <Pressable p="$xs" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>
        <Text fontSize="$lg" fontWeight="$semibold" color="$black">
          关注的用户
        </Text>
        <Box width={40} />
      </HStack>

      {/* 内容 */}
      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
        }
      >
        {loading ? (
          <VStack alignItems="center" justifyContent="center" py="$xl">
            <ActivityIndicator  color={theme.colors.gray400} />
            <Text fontSize="$sm" color="$gray400" mt="$sm">
              加载中...
            </Text>
          </VStack>
        ) : followingUsers.length > 0 ? (
          <VStack py="$sm">
            {followingUsers.map((followingUser) => (
              <HStack
                key={followingUser.userId}
                alignItems="center"
                px="$md"
                py="$md"
                borderBottomWidth={1}
                borderBottomColor="$gray100"
              >
                <Pressable
                  flex={1}
                  onPress={() => handleUserPress(followingUser.userId)}
                >
                  <HStack alignItems="center">
                    {/* 头像 */}
                    {followingUser.avatar ? (
                      <Image
                        source={{ uri: followingUser.avatar }}
                        width={50}
                        height={50}
                        borderRadius={25}
                        mr="$md"
                        alt={followingUser.username}
                      />
                    ) : (
                      <Box
                        width={50}
                        height={50}
                        borderRadius={25}
                        bg="$black"
                        alignItems="center"
                        justifyContent="center"
                        mr="$md"
                      >
                        <Text color="$white" fontWeight="$semibold">
                          {followingUser.username?.slice(0, 2).toUpperCase() || "??"}
                        </Text>
                      </Box>
                    )}

                    {/* 用户信息 */}
                    <VStack flex={1}>
                      <Text
                        fontWeight="$semibold"
                        color="$black"
                        numberOfLines={1}
                        mb="$xs"
                      >
                        {followingUser.username}
                      </Text>
                      {followingUser.bio ? (
                        <Text
                          fontSize="$sm"
                          color="$gray600"
                          numberOfLines={2}
                          mb="$xs"
                        >
                          {followingUser.bio}
                        </Text>
                      ) : null}
                      {followingUser.location ? (
                        <HStack alignItems="center">
                          <Ionicons
                            name="location-outline"
                            size={12}
                            color={theme.colors.gray400}
                          />
                          <Text fontSize="$xs" color="$gray400" ml="$xs">
                            {followingUser.location}
                          </Text>
                        </HStack>
                      ) : null}
                    </VStack>
                  </HStack>
                </Pressable>

                {/* 取消关注按钮 - 只有当查看的是自己的关注列表时才显示 */}
                {user?.userId === userId && (
                  <Pressable
                    px="$md"
                    py="$sm"
                    borderRadius="$sm"
                    borderWidth={1}
                    borderColor="$gray300"
                    bg="$white"
                    onPress={() => handleUnfollow(followingUser.userId)}
                  >
                    <Text fontSize="$sm" color="$gray600" fontWeight="$medium">
                      取消关注
                    </Text>
                  </Pressable>
                )}
              </HStack>
            ))}
          </VStack>
        ) : (
          <VStack alignItems="center" justifyContent="center" py="$xl">
            <Ionicons
              name="people-outline"
              size={24}
              color={theme.colors.gray300}
            />
            <Text color="$gray400" mt="$md">
              还没有关注任何用户
            </Text>
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FollowingUsersScreen;
