/**
 * V2 发布流程 · 论坛 Step 2：选择社区（手动模式）
 * ------------------------------------------------------------------
 * 用户在 `PublishV2ForumMode` 选了「论坛发帖」后进入。提供搜索 +
 * 关注/全部社区列表，选定后用 `navigation.replace` 跳到现有
 * `PublishForumPost`，并把 `communityId` 一并带过去（屏内会预选社区）。
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  RefreshControl,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  Box,
  Text,
  ScrollView,
  Pressable,
  VStack,
  HStack,
  OptimizedImage,
} from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { getCommunities, Community } from "../../services/communityService";
import { ImageSize } from "../../utils/imageUtils";

const PublishV2ForumSelectScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [followingCommunities, setFollowingCommunities] = useState<Community[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCommunities = async () => {
    try {
      const data = await getCommunities();
      setAllCommunities(data.all);
      setFollowingCommunities(data.following);
    } catch (err) {
      console.error("V2 forum select - fetch communities failed:", err);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchCommunities();
      setIsInitialized(true);
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const followingIds = useMemo(
    () => new Set(followingCommunities.map((c) => c.id)),
    [followingCommunities]
  );

  // 排序：已关注的优先；其次按 sortOrder / postCount。
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const base = q
      ? allCommunities.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.description ?? "").toLowerCase().includes(q)
        )
      : allCommunities.slice();
    return base.sort((a, b) => {
      const aFollow = followingIds.has(a.id) ? 1 : 0;
      const bFollow = followingIds.has(b.id) ? 1 : 0;
      if (aFollow !== bFollow) return bFollow - aFollow;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return b.postCount - a.postCount;
    });
  }, [allCommunities, debouncedQuery, followingIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  };

  const handleSelectCommunity = (community: Community) => {
    navigation.replace("PublishForumPost", { communityId: community.id });
  };

  const renderCommunityRow = (community: Community) => {
    const isFollowing = followingIds.has(community.id);
    return (
      <Pressable
        key={community.id}
        onPress={() => handleSelectCommunity(community)}
        bg="$white"
        borderWidth={1}
        borderColor="$gray100"
        rounded="$lg"
        p="$md"
        mb="$sm"
      >
        <HStack alignItems="center" gap="$md">
          <View style={styles.icon}>
            {community.iconUrl ? (
              <OptimizedImage
                uri={community.iconUrl}
                size={ImageSize.THUMBNAIL}
                style={styles.iconImage}
                contentFit="cover"
                lazy={false}
              />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Text fontSize="$lg" fontWeight="$bold" color="$white">
                  {community.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>
          <VStack flex={1}>
            <HStack alignItems="center" gap="$xs">
              <Text fontSize="$md" fontWeight="$medium" color="$black">
                {community.name}
              </Text>
              {isFollowing ? (
                <Box
                  px="$xs"
                  py={2}
                  rounded="$sm"
                  bg="$gray100"
                  borderWidth={1}
                  borderColor="$gray200"
                >
                  <Text
                    fontSize="$xs"
                    color="$gray500"
                    fontWeight="$medium"
                  >
                    {t("publishV2.forumSelect.followingBadge")}
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <Text fontSize="$xs" color="$gray500" numberOfLines={2} mt={2}>
              {community.description || t("community.noDescription")}
            </Text>
            <HStack gap="$md" mt={4}>
              <Text fontSize="$xs" color="$gray400">
                {community.memberCount} {t("community.members")}
              </Text>
              <Text fontSize="$xs" color="$gray400">
                {community.postCount} {t("community.posts")}
              </Text>
            </HStack>
          </VStack>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.gray400}
          />
        </HStack>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("publishV2.forumSelect.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <Box px="$md" py="$sm" bg="$white" borderBottomWidth={1} borderBottomColor="$gray100">
        <HStack
          alignItems="center"
          style={styles.searchContainer}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.gray400}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("publishV2.forumSelect.searchPlaceholder")}
            placeholderTextColor={theme.colors.gray400}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.gray400}
              />
            </Pressable>
          ) : null}
        </HStack>
      </Box>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
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
        {!isInitialized ? (
          <HStack justifyContent="center" alignItems="center" py="$2xl">
            <ActivityIndicator color={theme.colors.accent} />
          </HStack>
        ) : filtered.length === 0 ? (
          <VStack alignItems="center" py="$2xl">
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text mt="$md" color="$gray400">
              {t("publishV2.forumSelect.noResults")}
            </Text>
          </VStack>
        ) : (
          filtered.map(renderCommunityRow)
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
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  iconImage: {
    width: "100%",
    height: "100%",
  },
  iconPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray400,
    padding: 0,
  },
  searchContainer: {
    height: 40,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
});

export default PublishV2ForumSelectScreen;
