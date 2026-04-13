import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text as RNText,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Text,
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
  getMutualFollows,
} from "../services/followService";
import { userInfoService } from "../services/userInfoService";

type RouteParams = {
  FollowingUsers: {
    userId: number;
  };
};

type SubTab = "users" | "mutual" | "brands";

const FollowingUsersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "FollowingUsers">>();
  const { user } = useAuthStore();

  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [followingBrands, setFollowingBrands] = useState<FollowingBrand[]>([]);
  const [mutualFollows, setMutualFollows] = useState<FollowingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const userId = route.params?.userId || user?.userId;
  const isOwnProfile = userId === user?.userId;

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      if (!isOwnProfile) {
        const settings = await userInfoService.getPrivacySettings(userId);
        if (settings.hideFollowing) {
          setIsPrivate(true);
          setFollowingUsers([]);
          setFollowingBrands([]);
          setMutualFollows([]);
          return;
        }
        setIsPrivate(false);
      }

      const promises: Promise<any>[] = [
        getFollowingUsers(userId),
        getFollowingBrands(userId),
      ];
      if (isOwnProfile) {
        promises.push(getMutualFollows(userId));
      }

      const results = await Promise.all(promises);
      setFollowingUsers(results[0]);
      setFollowingBrands(results[1]);
      if (isOwnProfile && results[2]) {
        setMutualFollows(results[2]);
      }
    } catch (error) {
      console.error("Error loading following data:", error);
      Alert.show("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUnfollow = async (targetUserId: number) => {
    if (!user?.userId) return;
    try {
      await unfollowUser({
        followerId: user.userId,
        targetUserId,
      });
      Alert.show("已取消关注");
      setFollowingUsers((prev) => prev.filter((u) => u.userId !== targetUserId));
      setMutualFollows((prev) => prev.filter((u) => u.userId !== targetUserId));
    } catch (error) {
      console.error("Error unfollowing user:", error);
      Alert.show("取消关注失败，请重试");
    }
  };

  const handleUnfollowBrand = async (brandId: number) => {
    if (!user?.userId) return;
    try {
      await unfollowBrand({ userId: user.userId, brandId });
      Alert.show("已取消关注品牌");
      setFollowingBrands((prev) => prev.filter((b) => b.brandId !== brandId));
    } catch (error) {
      console.error("Error unfollowing brand:", error);
      Alert.show("取消关注失败，请重试");
    }
  };

  const handleUserPress = (uid: number) => {
    (navigation as any).navigate("UserProfile", { userId: uid });
  };

  const handleBrandPress = (brandName: string) => {
    (navigation as any).navigate("BrandDetail", { name: brandName });
  };

  const formatFollowerCount = (count: number): string => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return followingUsers;
    return followingUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(normalizedQuery) ||
        u.bio?.toLowerCase().includes(normalizedQuery) ||
        u.location?.toLowerCase().includes(normalizedQuery)
    );
  }, [followingUsers, normalizedQuery]);

  const filteredMutual = useMemo(() => {
    if (!normalizedQuery) return mutualFollows;
    return mutualFollows.filter(
      (u) =>
        u.username?.toLowerCase().includes(normalizedQuery) ||
        u.bio?.toLowerCase().includes(normalizedQuery) ||
        u.location?.toLowerCase().includes(normalizedQuery)
    );
  }, [mutualFollows, normalizedQuery]);

  const filteredBrands = useMemo(() => {
    if (!normalizedQuery) return followingBrands;
    return followingBrands.filter(
      (b) =>
        b.name?.toLowerCase().includes(normalizedQuery) ||
        b.category?.toLowerCase().includes(normalizedQuery)
    );
  }, [followingBrands, normalizedQuery]);

  const mutualFollowIds = useMemo(
    () => new Set(mutualFollows.map((u) => u.userId)),
    [mutualFollows]
  );

  const renderUserItem = ({ item }: { item: FollowingUser }) => {
    const isMutual = mutualFollowIds.has(item.userId);

    return (
      <HStack style={styles.userItem}>
        <Pressable style={{ flex: 1 }} onPress={() => handleUserPress(item.userId)}>
          <HStack alignItems="center">
            {item.avatar ? (
              <OptimizedImage
                uri={item.avatar}
                size={ImageSize.THUMBNAIL}
                style={styles.avatar}
                contentFit="cover"
                lazy={true}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <RNText style={styles.avatarText}>
                  {item.username?.slice(0, 2).toUpperCase() || "??"}
                </RNText>
              </View>
            )}
            <VStack flex={1}>
              <HStack alignItems="center" gap="$xs">
                <Text fontWeight="$semibold" color="$black" numberOfLines={1}>
                  {item.username}
                </Text>
                {isMutual && (
                  <View style={styles.mutualBadge}>
                    <RNText style={styles.mutualBadgeText}>互关</RNText>
                  </View>
                )}
              </HStack>
              {item.bio ? (
                <Text fontSize="$sm" color="$gray600" numberOfLines={1} mt={2}>
                  {item.bio}
                </Text>
              ) : null}
              {item.location ? (
                <HStack alignItems="center" mt={2}>
                  <Ionicons name="location-outline" size={12} color={theme.colors.gray400} />
                  <Text fontSize="$xs" color="$gray400" ml="$xs">
                    {item.location}
                  </Text>
                </HStack>
              ) : null}
            </VStack>
          </HStack>
        </Pressable>

        {isOwnProfile && (
          <Pressable style={styles.unfollowButton} onPress={() => handleUnfollow(item.userId)}>
            <Ionicons name="person-remove-outline" size={14} color={theme.colors.gray500} />
          </Pressable>
        )}
      </HStack>
    );
  };

  const renderBrandItem = ({ item }: { item: FollowingBrand }) => (
    <HStack style={styles.userItem}>
      <Pressable style={{ flex: 1 }} onPress={() => handleBrandPress(item.name)}>
        <HStack alignItems="center">
          {item.coverImage ? (
            <OptimizedImage
              uri={item.coverImage}
              size={ImageSize.THUMBNAIL}
              style={styles.brandAvatar}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <View style={[styles.brandAvatar, styles.avatarPlaceholder]}>
              <RNText style={styles.avatarText}>
                {item.name?.charAt(0)?.toUpperCase() || "B"}
              </RNText>
            </View>
          )}
          <VStack flex={1}>
            <Text fontWeight="$semibold" color="$black" numberOfLines={1}>
              {item.name}
            </Text>
            <HStack alignItems="center" mt={2}>
              {item.category ? (
                <Text fontSize="$xs" color="$gray400" mr="$sm">
                  {item.category}
                </Text>
              ) : null}
              <Text fontSize="$xs" color="$gray400">
                {formatFollowerCount(item.followersCount)} 人关注
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Pressable>

      {isOwnProfile && (
        <Pressable style={styles.unfollowButton} onPress={() => handleUnfollowBrand(item.brandId)}>
          <Ionicons name="heart-dislike-outline" size={14} color={theme.colors.gray500} />
        </Pressable>
      )}
    </HStack>
  );

  const renderEmptyList = (icon: string, message: string) => (
    <VStack alignItems="center" justifyContent="center" py="$xl" style={{ paddingTop: 60 }}>
      <Ionicons name={icon as any} size={24} color={theme.colors.gray300} />
      <Text color="$gray400" mt="$md">
        {normalizedQuery ? "没有找到匹配的结果" : message}
      </Text>
    </VStack>
  );

  const currentList =
    activeTab === "users"
      ? filteredUsers
      : activeTab === "mutual"
        ? filteredMutual
        : filteredBrands;

  const tabs: { id: SubTab; label: string; count: number }[] = [
    { id: "users", label: "用户", count: followingUsers.length },
    ...(isOwnProfile
      ? [{ id: "mutual" as SubTab, label: "互关", count: mutualFollows.length }]
      : []),
    { id: "brands", label: "品牌", count: followingBrands.length },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>
        <RNText style={styles.headerTitle}>关注</RNText>
        <View style={{ width: 40 }} />
      </View>

      {/* Sub-tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <RNText style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {tab.label}
              </RNText>
              <RNText style={[styles.tabChipCount, isActive && styles.tabChipCountActive]}>
                {tab.count}
              </RNText>
            </Pressable>
          );
        })}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Ionicons name="search-outline" size={18} color={theme.colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === "brands" ? "搜索品牌..." : "搜索用户..."
            }
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <VStack flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator color={theme.colors.gray400} />
          <Text fontSize="$sm" color="$gray400" mt="$sm">
            加载中...
          </Text>
        </VStack>
      ) : isPrivate ? (
        <VStack flex={1} alignItems="center" justifyContent="center">
          <Ionicons name="lock-closed-outline" size={24} color={theme.colors.gray300} />
          <Text color="$gray400" mt="$md">
            该用户已隐藏关注列表
          </Text>
        </VStack>
      ) : (
        <FlatList
          data={currentList as any[]}
          keyExtractor={(item: any) =>
            activeTab === "brands" ? String(item.brandId) : String(item.userId)
          }
          renderItem={
            activeTab === "brands"
              ? (renderBrandItem as any)
              : (renderUserItem as any)
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyList(
            activeTab === "brands"
              ? "pricetag-outline"
              : activeTab === "mutual"
                ? "people-outline"
                : "people-outline",
            activeTab === "brands"
              ? "还没有关注任何品牌"
              : activeTab === "mutual"
                ? "还没有互相关注的用户"
                : "还没有关注任何用户"
          )}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  tabChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
  tabChipTextActive: {
    color: "#FFF",
  },
  tabChipCount: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  tabChipCountActive: {
    color: "rgba(255,255,255,0.7)",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchBarFocused: {
    borderColor: theme.colors.gray300,
    backgroundColor: "#FFF",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  brandAvatar: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  mutualBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  mutualBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.gray600,
  },
  unfollowButton: {
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});

export default FollowingUsersScreen;
