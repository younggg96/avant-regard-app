import React, { useState, useEffect, useCallback } from "react";
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
  OptimizedImage,
} from "../components/ui";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  getFollowingUsers,
  FollowingUser,
  unfollowUser,
  getFollowingBrands,
  FollowingBrand,
  unfollowBrand,
} from "../services/followService";
import { userInfoService } from "../services/userInfoService";

type RouteParams = {
  FollowingUsers: {
    userId: number;
  };
};

type SubTab = "users" | "brands";

const FollowingUsersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "FollowingUsers">>();
  const { user } = useAuthStore();
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [followingBrands, setFollowingBrands] = useState<FollowingBrand[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>("users");

  const userId = route.params?.userId || user?.userId;
  const isOwnProfile = userId === user?.userId;

  const loadFollowingUsers = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      if (!isOwnProfile) {
        const settings = await userInfoService.getPrivacySettings(userId);
        if (settings.hideFollowing) {
          setIsPrivate(true);
          setFollowingUsers([]);
          setFollowingBrands([]);
          return;
        }
        setIsPrivate(false);
      }

      const [users, brands] = await Promise.all([
        getFollowingUsers(userId),
        getFollowingBrands(userId),
      ]);
      setFollowingUsers(users);
      setFollowingBrands(brands);
    } catch (error) {
      console.error("Error loading following data:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowingUsers();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowingUsers();
    setRefreshing(false);
  };

  const handleUnfollow = async (targetUserId: number) => {
    if (!user?.userId) return;

    try {
      await unfollowUser({
        followerId: user.userId,
        targetUserId: targetUserId,
      });
      Alert.show("已取消关注");
      await loadFollowingUsers();
    } catch (error) {
      console.error("Error unfollowing user:", error);
      Alert.show("取消关注失败，请重试");
    }
  };

  const handleUnfollowBrand = async (brandId: number) => {
    if (!user?.userId) return;

    try {
      await unfollowBrand({
        userId: user.userId,
        brandId: brandId,
      });
      Alert.show("已取消关注品牌");
      setFollowingBrands((prev) => prev.filter((b) => b.brandId !== brandId));
    } catch (error) {
      console.error("Error unfollowing brand:", error);
      Alert.show("取消关注失败，请重试");
    }
  };

  const handleUserPress = (userId: number) => {
    (navigation as any).navigate("UserProfile", { userId });
  };

  const handleBrandPress = (brandName: string) => {
    (navigation as any).navigate("BrandDetail", { name: brandName });
  };

  const formatFollowerCount = (count: number): string => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const renderUsersList = () => {
    if (followingUsers.length === 0) {
      return (
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
      );
    }

    return (
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
                {followingUser.avatar ? (
                  <OptimizedImage
                    uri={followingUser.avatar}
                    size={ImageSize.THUMBNAIL}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      marginRight: theme.spacing.md,
                    }}
                    contentFit="cover"
                    lazy={true}
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

            {isOwnProfile && (
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
    );
  };

  const renderBrandsList = () => {
    if (followingBrands.length === 0) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl">
          <Ionicons
            name="pricetag-outline"
            size={24}
            color={theme.colors.gray300}
          />
          <Text color="$gray400" mt="$md">
            还没有关注任何品牌
          </Text>
        </VStack>
      );
    }

    return (
      <VStack py="$sm">
        {followingBrands.map((brand) => (
          <HStack
            key={brand.brandId}
            alignItems="center"
            px="$md"
            py="$md"
            borderBottomWidth={1}
            borderBottomColor="$gray100"
          >
            <Pressable
              flex={1}
              onPress={() => handleBrandPress(brand.name)}
            >
              <HStack alignItems="center">
                {brand.coverImage ? (
                  <OptimizedImage
                    uri={brand.coverImage}
                    size={ImageSize.THUMBNAIL}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      marginRight: theme.spacing.md,
                    }}
                    contentFit="cover"
                    lazy={true}
                  />
                ) : (
                  <Box
                    width={50}
                    height={50}
                    borderRadius={8}
                    bg="$black"
                    alignItems="center"
                    justifyContent="center"
                    mr="$md"
                  >
                    <Text color="$white" fontWeight="$semibold" fontSize="$lg">
                      {brand.name?.charAt(0)?.toUpperCase() || "B"}
                    </Text>
                  </Box>
                )}

                <VStack flex={1}>
                  <Text
                    fontWeight="$semibold"
                    color="$black"
                    numberOfLines={1}
                    mb="$xs"
                  >
                    {brand.name}
                  </Text>
                  <HStack alignItems="center">
                    {brand.category ? (
                      <Text fontSize="$xs" color="$gray400" mr="$sm">
                        {brand.category}
                      </Text>
                    ) : null}
                    <Text fontSize="$xs" color="$gray400">
                      {formatFollowerCount(brand.followersCount)} 人关注
                    </Text>
                  </HStack>
                </VStack>
              </HStack>
            </Pressable>

            {isOwnProfile && (
              <Pressable
                px="$md"
                py="$sm"
                borderRadius="$sm"
                borderWidth={1}
                borderColor="$gray300"
                bg="$white"
                onPress={() => handleUnfollowBrand(brand.brandId)}
              >
                <Text fontSize="$sm" color="$gray600" fontWeight="$medium">
                  取消关注
                </Text>
              </Pressable>
            )}
          </HStack>
        ))}
      </VStack>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.white }} edges={["top", "bottom"]}>
      {/* Header */}
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
          关注
        </Text>
        <Box width={40} />
      </HStack>

      {/* Sub-tabs */}
      <HStack
        px="$md"
        py="$sm"
        borderBottomWidth={1}
        borderBottomColor="$gray100"
      >
        <Pressable
          px="$md"
          py="$xs"
          mr="$sm"
          borderRadius="$full"
          bg={activeTab === "users" ? "$black" : "$white"}
          borderWidth={1}
          borderColor={activeTab === "users" ? "$black" : "$gray200"}
          onPress={() => setActiveTab("users")}
        >
          <HStack alignItems="center" gap="$xs">
            <Text
              fontSize="$sm"
              fontWeight="$medium"
              color={activeTab === "users" ? "$white" : "$gray600"}
            >
              用户
            </Text>
            <Text
              fontSize="$xs"
              color={activeTab === "users" ? "$white" : "$gray400"}
            >
              {followingUsers.length}
            </Text>
          </HStack>
        </Pressable>
        <Pressable
          px="$md"
          py="$xs"
          borderRadius="$full"
          bg={activeTab === "brands" ? "$black" : "$white"}
          borderWidth={1}
          borderColor={activeTab === "brands" ? "$black" : "$gray200"}
          onPress={() => setActiveTab("brands")}
        >
          <HStack alignItems="center" gap="$xs">
            <Text
              fontSize="$sm"
              fontWeight="$medium"
              color={activeTab === "brands" ? "$white" : "$gray600"}
            >
              品牌
            </Text>
            <Text
              fontSize="$xs"
              color={activeTab === "brands" ? "$white" : "$gray400"}
            >
              {followingBrands.length}
            </Text>
          </HStack>
        </Pressable>
      </HStack>

      {/* Content */}
      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <VStack alignItems="center" justifyContent="center" py="$xl">
            <ActivityIndicator color={theme.colors.gray400} />
            <Text fontSize="$sm" color="$gray400" mt="$sm">
              加载中...
            </Text>
          </VStack>
        ) : isPrivate ? (
          <VStack alignItems="center" justifyContent="center" py="$xl">
            <Ionicons
              name="lock-closed-outline"
              size={24}
              color={theme.colors.gray300}
            />
            <Text color="$gray400" mt="$md">
              该用户已隐藏关注列表
            </Text>
          </VStack>
        ) : activeTab === "users" ? (
          renderUsersList()
        ) : (
          renderBrandsList()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FollowingUsersScreen;
