import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    RefreshControl,
    ActivityIndicator,
    FlatList,
    Dimensions,
    ScrollView as RNScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Image as RNImage,
    StyleSheet,
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
import ScreenHeader from "../components/ScreenHeader";
import {
    commentService,
    PostComment,
    LikedComment,
} from "../services/commentService";
import {
    postService,
    Post,
} from "../services/postService";
import SimplePostCard from "../components/SimplePostCard";
import { Post as DisplayPost } from "../components/PostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabType = "posts" | "comments";

const styles = StyleSheet.create({
    loadingGif: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
});

const MyLikesScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabType>("posts");
    const contentScrollViewRef = useRef<RNScrollView>(null);

    // 帖子点赞
    const [likedPosts, setLikedPosts] = useState<DisplayPost[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [postsRefreshing, setPostsRefreshing] = useState(false);

    // 评论点赞
    const [likedComments, setLikedComments] = useState<LikedComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [commentsRefreshing, setCommentsRefreshing] = useState(false);

    const convertToDisplayPost = (apiPost: Post): DisplayPost => {
        return {
            id: String(apiPost.id),
            title: apiPost.title || "无标题",
            image: apiPost.imageUrls?.[0] || "https://picsum.photos/id/1/600/800",
            author: {
                id: String(apiPost.userId),
                name: apiPost.username || "用户",
                avatar: apiPost.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${apiPost.userId}`,
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
        } as DisplayPost;
    };

    const loadLikedPosts = useCallback(async () => {
        if (!user?.userId) return;

        try {
            const result = await postService.getLikedPostsByUserId(user.userId);
            setLikedPosts(result.map(convertToDisplayPost));
        } catch (error) {
            console.error("Error loading liked posts:", error);
            Alert.show("加载失败，请重试");
        } finally {
            setPostsLoading(false);
        }
    }, [user?.userId]);

    const loadLikedComments = useCallback(async () => {
        if (!user?.userId) return;

        try {
            const result = await commentService.getUserCommentLikes(user.userId);
            setLikedComments(result);
        } catch (error) {
            console.error("Error loading liked comments:", error);
            Alert.show("加载失败，请重试");
        } finally {
            setCommentsLoading(false);
        }
    }, [user?.userId]);

    useEffect(() => {
        loadLikedPosts();
        loadLikedComments();
    }, [loadLikedPosts, loadLikedComments]);

    useFocusEffect(
        useCallback(() => {
            loadLikedPosts();
            loadLikedComments();
        }, [loadLikedPosts, loadLikedComments])
    );

    const onPostsRefresh = async () => {
        setPostsRefreshing(true);
        await loadLikedPosts();
        setPostsRefreshing(false);
    };

    const onCommentsRefresh = async () => {
        setCommentsRefreshing(true);
        await loadLikedComments();
        setCommentsRefreshing(false);
    };

    const handleUnlikePost = async (post: DisplayPost) => {
        if (!user?.userId) return;

        try {
            await postService.unlikePost(Number(post.id), user.userId);
            setLikedPosts((prev) => prev.filter((p) => p.id !== post.id));
            Alert.show("已取消点赞");
        } catch (error) {
            console.error("取消点赞失败:", error);
            Alert.show("操作失败，请重试");
        }
    };

    const handleUnlikeComment = async (comment: PostComment) => {
        if (!user?.userId) return;

        try {
            await commentService.unlikeComment(comment.id, user.userId);
            setLikedComments((prev) => prev.filter((c) => c.comment.id !== comment.id));
            Alert.show("已取消点赞");
        } catch (error) {
            console.error("取消点赞失败:", error);
            Alert.show("操作失败，请重试");
        }
    };

    const handlePostPress = (post: DisplayPost) => {
        (navigation as any).navigate("PostDetail", { postId: post.id });
    };

    const handleCommentPress = (comment: PostComment) => {
        (navigation as any).navigate("PostDetail", { postId: comment.postId });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "刚刚";
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 30) return `${days}天前`;
        return date.toLocaleDateString("zh-CN");
    };

    const renderPostsTab = () => {
        if (postsLoading) {
            return (
                <VStack alignItems="center" justifyContent="center" flex={1} py="$xxl">
                    <RNImage
                        source={require("../../assets/gif/profile-loading.gif")}
                        style={styles.loadingGif}
                        resizeMode="contain"
                    />
                </VStack>
            );
        }

        if (likedPosts.length === 0) {
            return (
                <VStack alignItems="center" justifyContent="center" flex={1} py="$xxl">
                    <Ionicons
                        name="heart-outline"
                        size={48}
                        color={theme.colors.gray200}
                    />
                    <Text color="$gray400" mt="$md" fontSize="$md">
                        还没有点赞过帖子
                    </Text>
                    <Text color="$gray300" mt="$xs" fontSize="$sm">
                        去发现页浏览内容并点赞吧
                    </Text>
                </VStack>
            );
        }

        return (
            <RNScrollView
                refreshControl={
                    <RefreshControl refreshing={postsRefreshing} onRefresh={onPostsRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            >
                <HStack flexWrap="wrap" px="$md" pt="$sm" justifyContent="space-between">
                    {likedPosts.map((post) => (
                        <Box key={post.id} width="48%" mb="$md" position="relative">
                            <Pressable
                                onPress={() => handlePostPress(post)}
                                onLongPress={() => handleUnlikePost(post)}
                            >
                                <SimplePostCard
                                    post={post}
                                    onPress={() => handlePostPress(post)}
                                />
                            </Pressable>
                        </Box>
                    ))}
                </HStack>
            </RNScrollView>
        );
    };

    const renderCommentItem = ({ item }: { item: LikedComment }) => {
        const comment = item.comment;
        return (
            <Pressable
                onPress={() => handleCommentPress(comment)}
                onLongPress={() => handleUnlikeComment(comment)}
            >
                <HStack
                    p="$md"
                    borderBottomWidth={1}
                    borderBottomColor="$gray100"
                    alignItems="flex-start"
                >
                    {/* 用户头像 */}
                    {comment.userAvatar ? (
                        <Image
                            source={{ uri: comment.userAvatar }}
                            width={40}
                            height={40}
                            borderRadius={20}
                            alt="avatar"
                        />
                    ) : (
                        <Box
                            width={40}
                            height={40}
                            borderRadius={20}
                            bg="$gray200"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Text color="$gray400" fontSize="$sm" fontWeight="$medium">
                                {comment.username?.slice(0, 1).toUpperCase() || "U"}
                            </Text>
                        </Box>
                    )}

                    <VStack flex={1} ml="$sm">
                        {/* 用户名和时间 */}
                        <HStack justifyContent="space-between" alignItems="center">
                            <Text fontSize="$sm" fontWeight="$medium" color="$black">
                                {comment.username}
                            </Text>
                            <Text fontSize="$xs" color="$gray300">
                                {formatTime(item.likedAt)}
                            </Text>
                        </HStack>

                        {/* 评论内容 */}
                        <Text
                            fontSize="$sm"
                            color="$gray600"
                            mt="$xs"
                            numberOfLines={3}
                        >
                            {comment.content}
                        </Text>

                        {/* 操作区域 */}
                        <HStack mt="$sm" alignItems="center" gap="$md">
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons
                                    name="heart"
                                    size={14}
                                    color="#FF3040"
                                />
                                <Text fontSize="$xs" color="$gray300">
                                    {comment.likeCount}
                                </Text>
                            </HStack>
                            <Pressable
                                onPress={() => handleUnlikeComment(comment)}
                                hitSlop={8}
                            >
                                <HStack alignItems="center" gap="$xs">
                                    <Ionicons
                                        name="heart-dislike-outline"
                                        size={14}
                                        color={theme.colors.gray300}
                                    />
                                    <Text fontSize="$xs" color="$gray300">
                                        取消点赞
                                    </Text>
                                </HStack>
                            </Pressable>
                        </HStack>
                    </VStack>
                </HStack>
            </Pressable>
        );
    };

    const renderCommentsTab = () => {
        if (commentsLoading) {
            return (
                <VStack alignItems="center" justifyContent="center" flex={1} py="$xxl">
                    <RNImage
                        source={require("../../assets/gif/profile-loading.gif")}
                        style={styles.loadingGif}
                        resizeMode="contain"
                    />
                </VStack>
            );
        }

        if (likedComments.length === 0) {
            return (
                <VStack alignItems="center" justifyContent="center" flex={1} py="$xxl">
                    <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={48}
                        color={theme.colors.gray200}
                    />
                    <Text color="$gray400" mt="$md" fontSize="$md">
                        还没有点赞过评论
                    </Text>
                    <Text color="$gray300" mt="$xs" fontSize="$sm">
                        去帖子详情查看并点赞评论吧
                    </Text>
                </VStack>
            );
        }

        return (
            <FlatList
                data={likedComments}
                renderItem={renderCommentItem}
                keyExtractor={(item) => String(item.comment.id)}
                refreshControl={
                    <RefreshControl refreshing={commentsRefreshing} onRefresh={onCommentsRefresh} />
                }
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            />
        );
    };

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: "posts", label: "帖子", count: likedPosts.length },
        { id: "comments", label: "评论", count: likedComments.length },
    ];

    const handleTabPress = (tabId: TabType) => {
        setActiveTab(tabId);
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        contentScrollViewRef.current?.scrollTo({
            x: tabIndex * SCREEN_WIDTH,
            animated: true,
        });
    };

    const handleTabSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const tabIndex = Math.round(offsetX / SCREEN_WIDTH);
        const newTab = tabs[tabIndex]?.id;
        if (newTab && newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: theme.colors.white }}
            edges={["top"]}
        >
            <ScreenHeader title="我的点赞" showBack={true} />

            {/* 标签栏 */}
            <HStack
                borderBottomWidth={1}
                borderBottomColor="$gray100"
                px="$md"
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
            </HStack>

            {/* 可横向滑动的内容区域 */}
            <Box flex={1}>
                <RNScrollView
                    ref={contentScrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleTabSwipe}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                >
                    {/* 帖子 Tab */}
                    <Box style={{ width: SCREEN_WIDTH, flex: 1 }}>
                        {renderPostsTab()}
                    </Box>
                    {/* 评论 Tab */}
                    <Box style={{ width: SCREEN_WIDTH, flex: 1 }}>
                        {renderCommentsTab()}
                    </Box>
                </RNScrollView>
            </Box>
        </SafeAreaView>
    );
};

export default MyLikesScreen;
