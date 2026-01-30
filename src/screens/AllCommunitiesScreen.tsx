/**
 * 所有社区页面
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  RefreshControl,
  View,
  Image,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  VStack,
  HStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  getCommunities,
  Community,
  followCommunity,
  unfollowCommunity,
  searchCommunities,
} from "../services/communityService";
import { useAuthStore } from "../store/authStore";

type TabType = "following" | "all";

const AllCommunitiesScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [followingCommunities, setFollowingCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");

  // 获取社区列表
  const fetchCommunities = useCallback(async () => {
    try {
      const data = await getCommunities();
      setAllCommunities(data.all);
      setFollowingCommunities(data.following);
    } catch (err) {
      console.error("获取社区列表失败:", err);
    }
  }, []);

  // 初始化
  useEffect(() => {
    const init = async () => {
      await fetchCommunities();
      setIsInitialized(true);
    };
    init();
  }, [fetchCommunities]);

  // 根据 Tab 和搜索过滤社区
  useEffect(() => {
    const sourceCommunities = activeTab === "following" ? followingCommunities : allCommunities;

    if (searchQuery.trim()) {
      const filtered = sourceCommunities.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCommunities(filtered);
    } else {
      setFilteredCommunities(sourceCommunities);
    }
  }, [searchQuery, activeTab, allCommunities, followingCommunities]);

  // 刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  }, [fetchCommunities]);

  // 点击社区
  const handleCommunityPress = useCallback(
    (community: Community) => {
      (navigation.navigate as any)("CommunityDetail", { communityId: community.id });
    },
    [navigation]
  );

  // 关注/取消关注
  const handleFollowPress = useCallback(
    async (community: Community) => {
      // 检查用户是否已登录
      if (!user) {
        (navigation.navigate as any)("Auth");
        return;
      }

      try {
        const wasFollowing = community.isFollowing;

        if (wasFollowing) {
          await unfollowCommunity(community.id);
        } else {
          await followCommunity(community.id);
        }

        // 更新社区的函数
        const updateCommunity = (c: Community) =>
          c.id === community.id
            ? {
              ...c,
              isFollowing: !wasFollowing,
              memberCount: wasFollowing
                ? Math.max(0, c.memberCount - 1)
                : c.memberCount + 1,
            }
            : c;

        // 更新全部社区列表
        setAllCommunities((prev) => prev.map(updateCommunity));

        // 更新关注社区列表
        if (wasFollowing) {
          // 取消关注 - 从关注列表中移除
          setFollowingCommunities((prev) => prev.filter((c) => c.id !== community.id));
        } else {
          // 关注 - 添加到关注列表
          const updatedCommunity = { ...community, isFollowing: true, memberCount: community.memberCount + 1 };
          setFollowingCommunities((prev) => [...prev, updatedCommunity]);
        }
      } catch (err) {
        console.error("关注操作失败:", err);
        alert("关注操作失败，请稍后重试");
      }
    },
    [user, navigation]
  );

  // 渲染社区项
  const renderCommunityItem = (community: Community) => (
    <Pressable
      key={community.id}
      onPress={() => handleCommunityPress(community)}
      bg="$white"
      p="$md"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      <HStack alignItems="center" gap="$md">
        <View style={styles.communityIcon}>
          {community.iconUrl ? (
            <Image
              source={{ uri: community.iconUrl }}
              style={styles.communityImage}
            />
          ) : (
            <View style={styles.communityPlaceholder}>
              <Text fontSize="$lg" fontWeight="$bold" color="$white">
                {community.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
        <VStack flex={1}>
          <HStack alignItems="center" gap="$xs">
            <Text fontSize="$md" fontWeight="$semibold" color="$black">
              {community.name}
            </Text>
            {community.isOfficial && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.colors.black}
              />
            )}
          </HStack>
          <Text fontSize="$sm" color="$gray500" numberOfLines={1}>
            {community.description || "暂无简介"}
          </Text>
          <Text fontSize="$xs" color="$gray400" mt="$xs">
            {community.memberCount} 成员 · {community.postCount} 帖子
          </Text>
        </VStack>
        <Pressable
          onPress={(e: any) => {
            e.stopPropagation();
            handleFollowPress(community);
          }}
          px="$md"
          py="$sm"
          rounded="$sm"
          bg={community.isFollowing ? "$gray100" : "$black"}
        >
          <Text
            fontSize="$sm"
            color={community.isFollowing ? "$black" : "$white"}
            fontWeight="$medium"
          >
            {community.isFollowing ? "已关注" : "关注"}
          </Text>
        </Pressable>
      </HStack>
    </Pressable>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="全部社区"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color="$gray400">加载中...</Text>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="全部社区"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 搜索框 */}
      <Box px="$md" py="$sm" bg="$white" borderBottomWidth={1} borderBottomColor="$gray100">
        <HStack
          bg="$gray100"
          rounded="$md"
          px="$md"
          py="$sm"
          alignItems="center"
          gap="$sm"
        >
          <Ionicons name="search" size={18} color={theme.colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索社区"
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
            </Pressable>
          )}
        </HStack>
      </Box>

      {/* Tab 切换 */}
      <HStack bg="$white" px="$md" py="$sm" gap="$md" borderBottomWidth={1} borderBottomColor="$gray100">
        <Pressable
          onPress={() => setActiveTab("following")}
          py="$sm"
          px="$md"
          borderBottomWidth={2}
          borderBottomColor={activeTab === "following" ? "$black" : "transparent"}
        >
          <Text
            fontSize="$md"
            fontWeight={activeTab === "following" ? "$semibold" : "$regular"}
            color={activeTab === "following" ? "$black" : "$gray400"}
          >
            我关注的
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("all")}
          py="$sm"
          px="$md"
          borderBottomWidth={2}
          borderBottomColor={activeTab === "all" ? "$black" : "transparent"}
        >
          <Text
            fontSize="$md"
            fontWeight={activeTab === "all" ? "$semibold" : "$regular"}
            color={activeTab === "all" ? "$black" : "$gray400"}
          >
            全部社区
          </Text>
        </Pressable>
      </HStack>

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {filteredCommunities.length === 0 ? (
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons
              name={activeTab === "following" ? "heart-outline" : "search-outline"}
              size={48}
              color={theme.colors.gray400}
            />
            <Text
              fontSize="$lg"
              color="$black"
              fontWeight="$medium"
              mb="$sm"
              mt="$md"
              textAlign="center"
            >
              {activeTab === "following" && !searchQuery ? "还没有关注社区" : "未找到社区"}
            </Text>
            <Text color="$gray400" textAlign="center">
              {searchQuery
                ? "尝试其他关键词"
                : activeTab === "following"
                  ? "去全部社区看看吧"
                  : "暂无社区"}
            </Text>
            {activeTab === "following" && !searchQuery && (
              <Pressable
                mt="$md"
                px="$lg"
                py="$sm"
                bg="$black"
                rounded="$sm"
                onPress={() => setActiveTab("all")}
              >
                <Text color="$white" fontWeight="$medium">
                  浏览全部社区
                </Text>
              </Pressable>
            )}
          </VStack>
        ) : (
          filteredCommunities.map(renderCommunityItem)
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
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  communityImage: {
    width: "100%",
    height: "100%",
  },
  communityPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },
});

export default AllCommunitiesScreen;
