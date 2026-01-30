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

const AllCommunitiesScreen = () => {
  const navigation = useNavigation();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 获取社区列表
  const fetchCommunities = useCallback(async () => {
    try {
      const data = await getCommunities();
      setCommunities(data.all);
      setFilteredCommunities(data.all);
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

  // 搜索
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = communities.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCommunities(filtered);
    } else {
      setFilteredCommunities(communities);
    }
  }, [searchQuery, communities]);

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
      try {
        if (community.isFollowing) {
          await unfollowCommunity(community.id);
        } else {
          await followCommunity(community.id);
        }
        // 更新本地状态
        setCommunities((prev) =>
          prev.map((c) =>
            c.id === community.id
              ? {
                  ...c,
                  isFollowing: !c.isFollowing,
                  memberCount: c.isFollowing
                    ? c.memberCount - 1
                    : c.memberCount + 1,
                }
              : c
          )
        );
      } catch (err) {
        console.error("关注操作失败:", err);
      }
    },
    []
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
          onPress={(e) => {
            e.stopPropagation();
            handleFollowPress(community);
          }}
          px="$md"
          py="$sm"
          rounded="$full"
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
              name="search-outline"
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
              未找到社区
            </Text>
            <Text color="$gray400" textAlign="center">
              {searchQuery ? "尝试其他关键词" : "暂无社区"}
            </Text>
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
