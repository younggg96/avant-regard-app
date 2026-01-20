import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView as RNScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
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
import { postService, Post as ApiPost } from "../services/postService";
import {
  followService,
  isFollowingUser,
  getFollowersCount,
  getFollowingCount,
} from "../services/followService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
} from "../services/userInfoService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

type TabType = "posts" | "saved" | "liked";

type TabData = {
  posts: DisplayPost[];
  isLoading: boolean;
  hasLoaded: boolean;
  count: number;
};

const initialTabState: TabData = {
  posts: [],
  isLoading: false,
  hasLoaded: false,
  count: 0,
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuthStore();

  const { userId, username, avatar } = route.params as {
    userId: number;
    username?: string;
    avatar?: string;
  };

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [refreshing, setRefreshing] = useState(false);

  const tabScrollViewRef = useRef<RNScrollView>(null);
  const contentScrollViewRef = useRef<RNScrollView>(null);

  const isCurrentUser = currentUser?.userId === userId;

  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    posts: { ...initialTabState },
    saved: { ...initialTabState },
    liked: { ...initialTabState },
  });

  const updateTabState = useCallback(
    (tab: TabType, updates: Partial<TabData>) => {
      setTabsData((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], ...updates },
      }));
    },
    []
  );

  const tabs = [
    { id: "posts" as TabType, label: "笔记" },
    { id: "saved" as TabType, label: "收藏" },
    { id: "liked" as TabType, label: "赞过" },
  ];

  const convertToDisplayPost = (
    apiPost: ApiPost,
    authorInfo: { name: string; avatar: string }
  ): DisplayPost => {
    return {
      id: String(apiPost.id),
      title: apiPost.title || "无标题",
      image: apiPost.imageUrls?.[0] || "https://picsum.photos/id/1/600/800",
      author: {
        id: String(apiPost.userId),
        name: authorInfo.name,
        avatar: authorInfo.avatar,
      },
      content: {
        title: apiPost.title || "无标题",
        description: apiPost.contentText || "",
        images: apiPost.imageUrls || [],
      },
      engagement: {
        likes: apiPost.likeCount || 0,
        saves: apiPost.favoriteCount || 0,
        comments: apiPost.commentCount || 0,
        isLiked: apiPost.likedByMe || false,
        isSaved: apiPost.favoritedByMe || false,
      },
      likes: apiPost.likeCount || 0,
    };
  };

  const loadUserInfo = async () => {
    try {
      const info = await userInfoService.getUserInfo(userId);
      setUserInfo(info);
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await userInfoService.getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadFollowCounts = async () => {
    try {
      const [followers, following] = await Promise.all([
        getFollowersCount(userId),
        getFollowingCount(userId),
      ]);
      setFollowersCount(followers);
      setFollowingCount(following);
    } catch (error) {
      console.error("Error loading follow counts:", error);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUser?.userId || isCurrentUser) return;
    try {
      const isFollowingResult = await isFollowingUser(
        currentUser.userId,
        userId
      );
      setIsFollowing(isFollowingResult);
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }

      updateTabState(targetTab, { isLoading: true });

      try {
        const authorName = userInfo?.username || username || "用户";
        const authorAvatar =
          userInfo?.avatarUrl ||
          avatar ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`;

        let newPosts: DisplayPost[] = [];

        if (targetTab === "posts") {
          const apiPosts = await postService.getPostsByUserId(
            userId,
            "PUBLISHED"
          );
          const approvedPosts = apiPosts.filter(
            (p: ApiPost) => p.auditStatus === "APPROVED"
          );
          newPosts = approvedPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, { name: authorName, avatar: authorAvatar })
          );
        }

        updateTabState(targetTab, {
          posts: newPosts,
          count: newPosts.length,
          isLoading: false,
          hasLoaded: true,
        });
      } catch (error) {
        console.error(`Error loading ${targetTab}:`, error);
        updateTabState(targetTab, { isLoading: false });
      }
    },
    [userId, userInfo, username, avatar, tabsData, updateTabState]
  );

  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowCounts();
    checkFollowStatus();
    setTabsData({
      posts: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
    });
  }, [userId]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowCounts();
      checkFollowStatus();
      fetchTabData(activeTab, true);
    }, [activeTab, userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserInfo(),
      loadUserProfile(),
      loadFollowCounts(),
      checkFollowStatus(),
      fetchTabData(activeTab, true),
    ]);
    setRefreshing(false);
  };

  const handleTabSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    const tabIds: TabType[] = ["posts", "saved", "liked"];
    if (
      pageIndex >= 0 &&
      pageIndex < tabIds.length &&
      tabIds[pageIndex] !== activeTab
    ) {
      setActiveTab(tabIds[pageIndex]);
    }
  };

  const handleTabPress = (tabId: TabType) => {
    const tabIds: TabType[] = ["posts", "saved", "liked"];
    const index = tabIds.indexOf(tabId);
    if (index >= 0 && contentScrollViewRef.current) {
      contentScrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTab(tabId);
  };

  const handleFollowToggle = async () => {
    console.log(
      "handleFollowToggle called, currentUser:",
      currentUser?.userId,
      "targetUserId:",
      userId,
      "isFollowing:",
      isFollowing
    );

    if (!currentUser?.userId) {
      Alert.show("请先登录");
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        console.log("Attempting to unfollow user:", userId);
        await followService.unfollowUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        Alert.show("已取消关注");
      } else {
        console.log("Attempting to follow user:", userId);
        await followService.followUser({
          followerId: currentUser.userId,
          targetUserId: userId,
        });
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        Alert.show("关注成功");
      }
    } catch (error) {
      console.error("Follow toggle error:", error);
      const message = error instanceof Error ? error.message : "操作失败";
      Alert.show(message);
    } finally {
      setFollowLoading(false);
    }
  };

  const getGenderText = (gender?: string): string => {
    switch (gender) {
      case "MALE":
        return "♂";
      case "FEMALE":
        return "♀";
      default:
        return "";
    }
  };

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  const getTotalLikes = () => {
    return tabsData.posts.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.white }}
      edges={["top", "bottom"]}
    >
      {/* 顶部导航栏 */}
      <HStack px="$md" py="$sm" alignItems="center" justifyContent="flex-start" bg="$white">
        <Pressable p="$xs" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>
      </HStack>

      {/* 头部信息区域 */}
      <VStack px="$md" pb="$md">
        {/* 第一行：头像和操作按钮 */}
        <HStack alignItems="center" mb="$md">
          <Box mr="$md">
            {userInfo?.avatarUrl || avatar ? (
              <Image
                source={{ uri: userInfo?.avatarUrl || avatar }}
                width={80}
                height={80}
                borderRadius={40}
                alt="avatar"
              />
            ) : (
              <Box
                width={80}
                height={80}
                borderRadius={40}
                bg="$black"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="$white" fontSize="$xl" fontWeight="$bold">
                  {(userInfo?.username || username)
                    ?.slice(0, 2)
                    .toUpperCase() || "AG"}
                </Text>
              </Box>
            )}
          </Box>

          <VStack flex={1}>
            <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
              {userInfo?.username || username || "用户"}
            </Text>
            <Text fontSize="$xs" color="$gray300">
              {userInfo?.location ? `  · ${userInfo.location}` : ""}
            </Text>
          </VStack>

          {/* 关注/编辑按钮 */}
          <Box ml="$sm">
            {!isCurrentUser ? (
              <Pressable
                px="$lg"
                py="$sm"
                bg={isFollowing ? "$gray100" : "$black"}
                borderRadius={20}
                borderWidth={isFollowing ? 1 : 0}
                borderColor="$gray200"
                onPress={handleFollowToggle}
                disabled={followLoading}
                minWidth={72}
                alignItems="center"
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? theme.colors.gray600 : theme.colors.white}
                  />
                ) : (
                  <Text
                    fontSize="$sm"
                    fontWeight="$semibold"
                    color={isFollowing ? "$gray600" : "$white"}
                  >
                    {isFollowing ? "已关注" : "关注"}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                px="$md"
                py="$sm"
                bg="$white"
                borderWidth={1}
                borderColor="$gray200"
                borderRadius={20}
                onPress={() => (navigation as any).navigate("EditProfile")}
              >
                <Text fontSize="$sm" fontWeight="$medium" color="$black">
                  编辑资料
                </Text>
              </Pressable>
            )}
          </Box>
        </HStack>

        {/* Bio */}
        <Box mb="$sm">
          <Text fontSize="$sm" color="$gray400" numberOfLines={2}>
            {userInfo?.bio || "暂无简介"}
          </Text>
        </Box>

        {/* 标签（年龄、位置等） */}
        <HStack flexWrap="wrap" gap="$sm" mb="$md">
          {userProfile?.age != null && userProfile.age > 0 ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$full">
              <Text fontSize="$xs" color="$gray400">
                {getGenderText(userProfile?.gender)} {userProfile.age}岁
              </Text>
            </Box>
          ) : null}
          {userInfo?.location ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$full">
              <Text fontSize="$xs" color="$gray400">
                {userInfo.location}
              </Text>
            </Box>
          ) : null}
          {userProfile?.preference ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$full">
              <Text fontSize="$xs" color="$gray400">
                {userProfile.preference}
              </Text>
            </Box>
          ) : null}
        </HStack>

        {/* 统计数据 */}
        <HStack alignItems="center" gap="$lg">
          <Pressable
            onPress={() =>
              (navigation as any).navigate("FollowingUsers", { userId })
            }
          >
            <HStack alignItems="baseline" gap="$xs">
              <Text fontSize="$lg" fontWeight="$bold" color="$black">
                {followingCount}
              </Text>
              <Text fontSize="$xs" color="$gray300">
                关注
              </Text>
            </HStack>
          </Pressable>
          <Pressable
            onPress={() =>
              (navigation as any).navigate("Followers", { userId })
            }
          >
            <HStack alignItems="baseline" gap="$xs">
              <Text fontSize="$lg" fontWeight="$bold" color="$black">
                {followersCount}
              </Text>
              <Text fontSize="$xs" color="$gray300">
                粉丝
              </Text>
            </HStack>
          </Pressable>
          <HStack alignItems="baseline" gap="$xs">
            <Text fontSize="$lg" fontWeight="$bold" color="$black">
              {tabsData.posts.hasLoaded ? getTotalLikes() : "-"}
            </Text>
            <Text fontSize="$xs" color="$gray300">
              获赞与收藏
            </Text>
          </HStack>
        </HStack>
      </VStack>

      {/* 帖子区域 */}
      <Box flex={1}>
        {/* 标签栏 */}
        <RNScrollView
          ref={tabScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.gray100,
            maxHeight: 44,
          }}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              py="$sm"
              mr="$lg"
              position="relative"
              onPress={() => handleTabPress(tab.id)}
            >
              <HStack alignItems="center" gap="$xs">
                <Text
                  color={activeTab === tab.id ? "$black" : "$gray300"}
                  fontWeight={activeTab === tab.id ? "$semibold" : "$medium"}
                >
                  {tab.label}
                </Text>
              </HStack>
              {activeTab === tab.id && (
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  height={2}
                  bg="$black"
                />
              )}
            </Pressable>
          ))}
        </RNScrollView>

        {/* 可滑动的内容区域 */}
        <RNScrollView
          ref={contentScrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleTabSwipe}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          nestedScrollEnabled={true}
        >
          {tabs.map((tab) => {
            const currentTabData = tabsData[tab.id];
            const isCurrentTab = activeTab === tab.id;
            const shouldShowLoading =
              currentTabData.isLoading && !currentTabData.hasLoaded;

            return (
              <RNScrollView
                key={tab.id}
                style={{ width: SCREEN_WIDTH }}
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingBottom: theme.spacing.xl,
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing && isCurrentTab}
                    onRefresh={onRefresh}
                  />
                }
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {shouldShowLoading ? (
                  <VStack alignItems="center" justifyContent="center" py="$xl">
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.gray400}
                    />
                    <Text fontSize="$sm" color="$gray400" mt="$sm">
                      加载中...
                    </Text>
                  </VStack>
                ) : currentTabData.posts.length > 0 ? (
                  <HStack
                    flexWrap="wrap"
                    px="$md"
                    pt="$sm"
                    justifyContent="space-between"
                  >
                    {currentTabData.posts.map((post) => (
                      <Box key={post.id} width="48%" mb="$md">
                        <Pressable onPress={() => handlePostPress(post)}>
                          <SimplePostCard
                            post={post}
                            onPress={() => handlePostPress(post)}
                          />
                        </Pressable>
                      </Box>
                    ))}
                  </HStack>
                ) : currentTabData.hasLoaded ? (
                  <VStack alignItems="center" justifyContent="center" py="$xl">
                    <Ionicons
                      name={
                        tab.id === "saved"
                          ? "bookmark-outline"
                          : tab.id === "liked"
                            ? "heart-outline"
                            : "camera-outline"
                      }
                      size={24}
                      color={theme.colors.gray300}
                    />
                    <Text color="$gray400" mt="$md">
                      {tab.id === "posts" && "还没有发布内容"}
                      {tab.id === "saved" && "还没有收藏帖子"}
                      {tab.id === "liked" && "还没有点赞帖子"}
                    </Text>
                    <Text fontSize="$sm" color="$gray300" mt="$xs">
                      {tab.id === "posts" &&
                        (isCurrentUser
                          ? "快去发布你的第一篇笔记吧"
                          : "TA 还没有发布任何笔记")}
                    </Text>
                  </VStack>
                ) : null}
              </RNScrollView>
            );
          })}
        </RNScrollView>
      </Box>
    </SafeAreaView>
  );
};

export default UserProfileScreen;
