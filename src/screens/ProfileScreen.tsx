import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView as RNScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  Image,
} from "../components/ui";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import {
  postService,
  Post as ApiPost,
} from "../services/postService";
import {
  userInfoService,
  UserInfo,
  UserProfileInfo,
} from "../services/userInfoService";
import {
  getFollowingCount,
  getFollowersCount,
} from "../services/followService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

type TabType = "published" | "pending" | "draft" | "saved" | "liked";

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

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("published");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<DisplayPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [followingUsersCount, setFollowingUsersCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);

  const tabScrollViewRef = useRef<RNScrollView>(null);
  const contentScrollViewRef = useRef<RNScrollView>(null);

  const [tabsData, setTabsData] = useState<Record<TabType, TabData>>({
    published: { ...initialTabState },
    pending: { ...initialTabState },
    draft: { ...initialTabState },
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
    {
      id: "published" as TabType,
      label: "已发布",
      count: tabsData.published.count,
    },
    {
      id: "pending" as TabType,
      label: "待审核",
      count: tabsData.pending.count,
    },
    { id: "liked" as TabType, label: "我喜欢的", count: tabsData.liked.count },
    { id: "saved" as TabType, label: "我收藏的", count: tabsData.saved.count },
    { id: "draft" as TabType, label: "草稿", count: tabsData.draft.count },
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
      status: apiPost.status,
    } as DisplayPost & { status?: string };
  };

  useEffect(() => {
    loadUserInfo();
    loadUserProfile();
    loadFollowingUsersCount();
    loadFollowersCount();
    setTabsData({
      published: { ...initialTabState },
      pending: { ...initialTabState },
      draft: { ...initialTabState },
      saved: { ...initialTabState },
      liked: { ...initialTabState },
    });
  }, [user?.userId]);

  const loadUserInfo = async () => {
    if (!user?.userId) return;
    try {
      const info = await userInfoService.getUserInfo(user.userId);
      setUserInfo(info);
      if (info) {
        updateProfile({
          username: info.username,
          bio: info.bio,
          location: info.location,
          avatar: info.avatarUrl,
        });
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  };

  const loadFollowingUsersCount = async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowingCount(user.userId);
      setFollowingUsersCount(count);
    } catch (error) {
      console.error("Error loading following users count:", error);
    }
  };

  const loadFollowersCount = async () => {
    if (!user?.userId) return;
    try {
      const count = await getFollowersCount(user.userId);
      setFollowersCount(count);
    } catch (error) {
      console.error("Error loading followers count:", error);
    }
  };

  const loadUserProfile = async () => {
    if (!user?.userId) return;
    try {
      const profile = await userInfoService.getUserProfile(user.userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const fetchTabData = useCallback(
    async (targetTab: TabType, isRefresh = false) => {
      if (!user?.userId) return;
      if (!isRefresh && tabsData[targetTab].hasLoaded) {
        return;
      }

      updateTabState(targetTab, { isLoading: true });

      try {
        const authorName = userInfo?.username || user?.username || "用户";
        const authorAvatar =
          userInfo?.avatarUrl ||
          user?.avatar ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;

        let newPosts: DisplayPost[] = [];

        if (targetTab === "published" || targetTab === "pending") {
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "PUBLISHED"
          );

          const pendingPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "PENDING")
            .map((p) => ({
              ...convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              }),
              auditStatus: p.auditStatus,
            }));

          const approvedPosts = apiPosts
            .filter((p: ApiPost) => p.auditStatus === "APPROVED")
            .map((p) =>
              convertToDisplayPost(p, {
                name: authorName,
                avatar: authorAvatar,
              })
            );

          setTabsData((prev) => ({
            ...prev,
            published: {
              posts: approvedPosts,
              count: approvedPosts.length,
              isLoading: false,
              hasLoaded: true,
            },
            pending: {
              posts: pendingPosts,
              count: pendingPosts.length,
              isLoading: false,
              hasLoaded: true,
            },
          }));
          return;
        }

        if (targetTab === "saved") {
          const apiPosts = await postService.getFavoritePostsByUserId(
            user.userId
          );
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
            })
          );
        } else if (targetTab === "liked") {
          const apiPosts = await postService.getLikedPostsByUserId(user.userId);
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
            })
          );
        } else if (targetTab === "draft") {
          const apiPosts = await postService.getPostsByUserId(
            user.userId,
            "DRAFT"
          );
          newPosts = apiPosts.map((p) =>
            convertToDisplayPost(p, {
              name: authorName,
              avatar: authorAvatar,
            })
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
        Alert.show("加载失败，请重试");
      }
    },
    [user?.userId, userInfo, tabsData, updateTabState]
  );

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, user?.userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      loadUserProfile();
      loadFollowingUsersCount();
      loadFollowersCount();
      fetchTabData(activeTab, true);
    }, [activeTab, user?.userId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserInfo(),
      loadUserProfile(),
      fetchTabData(activeTab, true),
      loadFollowingUsersCount(),
      loadFollowersCount(),
    ]);
    setRefreshing(false);
  };

  const handleTabSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageIndex = Math.round(contentOffset.x / layoutMeasurement.width);
    const tabIds: TabType[] = [
      "published",
      "pending",
      "liked",
      "saved",
      "draft",
    ];
    if (
      pageIndex >= 0 &&
      pageIndex < tabIds.length &&
      tabIds[pageIndex] !== activeTab
    ) {
      setActiveTab(tabIds[pageIndex]);
    }
  };

  const handleTabPress = (tabId: TabType) => {
    const tabIds: TabType[] = [
      "published",
      "pending",
      "liked",
      "saved",
      "draft",
    ];
    const index = tabIds.indexOf(tabId);
    if (index >= 0 && contentScrollViewRef.current) {
      contentScrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setActiveTab(tabId);
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

  const handleLogout = () => {
    Alert.show("正在退出...");
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  const handleDeletePost = (post: DisplayPost) => {
    setPostToDelete(post);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete || !user?.userId) {
      Alert.show("错误", "缺少必要的参数");
      setShowDeleteDialog(false);
      setPostToDelete(null);
      return;
    }

    setIsDeleting(true);

    try {
      const postId =
        typeof postToDelete.id === "string"
          ? parseInt(postToDelete.id, 10)
          : Number(postToDelete.id);

      if (isNaN(postId) || postId <= 0) {
        throw new Error("无效的帖子 ID");
      }

      if (!user.userId || user.userId <= 0) {
        throw new Error("无效的用户 ID");
      }

      console.log(`正在删除帖子 ID: ${postId}, 用户 ID: ${user.userId}`);

      await postService.deletePost(postId, user.userId);

      setShowDeleteDialog(false);
      Alert.show("成功", "帖子已删除");

      setTabsData((prev) => {
        const currentTabData = prev[activeTab];
        const newPosts = currentTabData.posts.filter(
          (p) => p.id !== postToDelete.id
        );

        return {
          ...prev,
          [activeTab]: {
            ...currentTabData,
            posts: newPosts,
            count: newPosts.length,
          },
        };
      });
    } catch (error) {
      console.error("删除帖子时出错:", error);

      let errorMessage = "请稍后重试";
      if (error instanceof Error) {
        if (
          error.message.includes("网络") ||
          error.message.includes("Network")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (
          error.message.includes("权限") ||
          error.message.includes("Permission")
        ) {
          errorMessage = "没有删除权限";
        } else if (error.message.includes("无效")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      Alert.show("删除失败", errorMessage);
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.white }}
      edges={["top", "bottom"]}
    >
      {/* 顶部操作栏 */}
      <HStack justifyContent="flex-end" px="$md" py="$sm" gap="$md">
        <Pressable
          p="$xs"
          onPress={() => (navigation as any).navigate("Settings")}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color={theme.colors.black}
          />
        </Pressable>
        <Pressable p="$xs" onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={24}
            color={theme.colors.black}
          />
        </Pressable>
      </HStack>

      {/* 头部信息 */}
      <VStack px="$md" pb="$md">
        {/* 第一行：头像和用户名 */}
        <HStack alignItems="center" mb="$md">
          <Pressable
            mr="$md"
            onPress={() => (navigation as any).navigate("EditProfile")}
          >
            {userInfo?.avatarUrl || user?.avatar ? (
              <Image
                source={{ uri: userInfo?.avatarUrl || user?.avatar }}
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
                  {(userInfo?.username || user?.username)
                    ?.slice(0, 2)
                    .toUpperCase() || "AG"}
                </Text>
              </Box>
            )}
          </Pressable>

          <VStack flex={1}>
            <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
              {userInfo?.username || user?.username || "用户"}
            </Text>
            <Text fontSize="$xs" color="$gray300">
              {userInfo?.location ? `  · ${userInfo.location}` : ""}
            </Text>
          </VStack>
        </HStack>

        {/* Bio */}
        <Pressable
          mb="$sm"
          onPress={() => (navigation as any).navigate("EditProfile")}
        >
          <Text fontSize="$sm" color="$gray400" numberOfLines={2}>
            {userInfo?.bio || "点击编辑个人简介..."}
          </Text>
        </Pressable>

        {/* 标签（年龄、位置等） */}
        <HStack flexWrap="wrap" gap="$sm" mb="$md">
          {userProfile?.age != null && userProfile.age > 0 ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$sm">
              <Text fontSize="$xs" color="$gray400">
                {getGenderText(userProfile?.gender)} {userProfile.age}岁
              </Text>
            </Box>
          ) : null}
          {userInfo?.location ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$sm">
              <Text fontSize="$xs" color="$gray400">
                {userInfo.location}
              </Text>
            </Box>
          ) : null}
          {userProfile?.preference ? (
            <Box bg="$gray100" px="$sm" py="$xs" borderRadius="$sm">
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
              (navigation as any).navigate("FollowingUsers", {
                userId: user?.userId,
              })
            }
          >
            <HStack alignItems="baseline" gap="$xs">
              <Text fontSize="$lg" fontWeight="$bold" color="$black">
                {followingUsersCount}
              </Text>
              <Text fontSize="$xs" color="$gray300">
                关注
              </Text>
            </HStack>
          </Pressable>
          <Pressable
            onPress={() =>
              (navigation as any).navigate("Followers", {
                userId: userInfo?.userId,
              })
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
          <Pressable>
            <HStack alignItems="baseline" gap="$xs">
              <Text fontSize="$lg" fontWeight="$bold" color="$black">
                {tabsData.published.count > 0
                  ? tabsData.published.count
                  : userInfo?.userId
                    ? "0"
                    : "-"}
              </Text>
              <Text fontSize="$xs" color="$gray300">
                获赞与收藏
              </Text>
            </HStack>
          </Pressable>
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
              <Text
                color={activeTab === tab.id ? "$black" : "$gray300"}
                fontWeight={activeTab === tab.id ? "$semibold" : "$medium"}
              >
                {tab.label}
              </Text>
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
                      size="large"
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
                      <Box key={post.id} width="48%" mb="$md" position="relative">
                        <Pressable
                          onPress={() => handlePostPress(post)}
                          onLongPress={() => {
                            if (
                              tab.id === "published" ||
                              tab.id === "draft" ||
                              tab.id === "pending"
                            ) {
                              handleDeletePost(post);
                            }
                          }}
                        >
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
                            : tab.id === "pending"
                              ? "time-outline"
                              : "document-text-outline"
                      }
                      size={24}
                      color={theme.colors.gray300}
                    />
                    <Text color="$gray400" mt="$md">
                      {tab.id === "published" && "还没有发布内容"}
                      {tab.id === "pending" && "没有待审核的帖子"}
                      {tab.id === "draft" && "还没有草稿"}
                      {tab.id === "saved" && "还没有收藏帖子"}
                      {tab.id === "liked" && "还没有点赞帖子"}
                    </Text>
                  </VStack>
                ) : null}
              </RNScrollView>
            );
          })}
        </RNScrollView>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent={true}
        onRequestClose={() => setShowDeleteDialog(false)}
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowDeleteDialog(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableWithoutFeedback>
              <VStack
                bg="$white"
                borderRadius={16}
                width={SCREEN_WIDTH - 80}
                overflow="hidden"
              >
                {/* 标题 */}
                <VStack px="$lg" pt="$lg" pb="$md">
                  <Text
                    fontSize="$lg"
                    fontWeight="$semibold"
                    color="$black"
                    textAlign="center"
                  >
                    确认删除
                  </Text>
                  <Text
                    fontSize="$sm"
                    color="$gray600"
                    textAlign="center"
                    mt="$sm"
                  >
                    删除后将无法恢复，确定要删除这篇帖子吗？
                  </Text>
                </VStack>

                {/* 分割线 */}
                <Box height={1} bg="$gray100" />

                {/* 按钮区域 */}
                <HStack>
                  {/* 取消按钮 */}
                  <Pressable
                    flex={1}
                    py="$md"
                    alignItems="center"
                    borderRightWidth={1}
                    borderRightColor="$gray100"
                    onPress={() => {
                      if (isDeleting) return;
                      setShowDeleteDialog(false);
                      setPostToDelete(null);
                    }}
                    disabled={isDeleting}
                    opacity={isDeleting ? 0.5 : 1}
                  >
                    <Text
                      fontSize="$md"
                      fontWeight="$medium"
                      color="$gray600"
                    >
                      取消
                    </Text>
                  </Pressable>

                  {/* 删除按钮 */}
                  <Pressable
                    flex={1}
                    py="$md"
                    alignItems="center"
                    onPress={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    <HStack alignItems="center" justifyContent="center">
                      {isDeleting ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color="#FF3040"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            fontSize="$md"
                            fontWeight="$semibold"
                            color="#FF3040"
                          >
                            删除中...
                          </Text>
                        </>
                      ) : (
                        <Text
                          fontSize="$md"
                          fontWeight="$semibold"
                          color="#FF3040"
                        >
                          删除
                        </Text>
                      )}
                    </HStack>
                  </Pressable>
                </HStack>
              </VStack>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
