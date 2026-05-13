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
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
    Box,
    Text,
    Pressable,
    VStack,
    HStack,
    OptimizedImage,
} from "../components/ui";
import { ImageSize } from "../utils/imageUtils";
import { theme, useAppTheme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import ScreenHeader from "../components/ScreenHeader";
import {
    commentService,
    LikedComment,
    LikedCommentData,
} from "../services/commentService";
import {
    postService,
    Post,
} from "../services/postService";
import { unlikeStoreComment } from "../services/buyerStoreService";
import PostCard, { Post as DisplayPost } from "../components/PostCard";
import { splitIntoMasonryColumns } from "../utils/masonryLayout";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabType = "posts" | "comments";

const styles = StyleSheet.create({
    loadingGif: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
});

const MyLikesScreen = () => {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const appTheme = useAppTheme();
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
            title: apiPost.title || t('community.noTitle'),
            image: apiPost.imageUrls?.[0] || "",
            author: {
                id: String(apiPost.userId),
                name: apiPost.username || t('profile.user'),
                avatar: apiPost.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${apiPost.userId}`,
            },
            content: {
                title: apiPost.title || t('community.noTitle'),
                description: apiPost.contentText || "",
                images: apiPost.imageUrls || [],
                coverAspectRatio:
                    apiPost.coverWidth && apiPost.coverHeight && apiPost.coverHeight > 0
                        ? apiPost.coverWidth / apiPost.coverHeight
                        : undefined,
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
            Alert.show(t('myLikes.loadFailed'));
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
            Alert.show(t('myLikes.loadFailed'));
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
            Alert.show(t('myLikes.unlikeSuccess'));
        } catch (error) {
            console.error("取消点赞失败:", error);
            Alert.show(t('myLikes.operationFailed'));
        }
    };

    const handleUnlikeComment = async (item: LikedComment) => {
        if (!user?.userId) return;
        const comment = item.comment;

        try {
            if (item.source === "store") {
                await unlikeStoreComment(comment.id, user.userId);
            } else if (item.source === "product") {
                const { unlikeStoreProductComment } = await import("../services/storeProductService");
                await unlikeStoreProductComment(comment.id);
            } else {
                await commentService.unlikeComment(comment.id, user.userId);
            }
            setLikedComments((prev) => prev.filter((c) => !(c.comment.id === comment.id && c.source === item.source)));
            Alert.show(t('myLikes.unlikeSuccess'));
        } catch (error) {
            console.error("取消点赞失败:", error);
            Alert.show(t('myLikes.operationFailed'));
        }
    };

    const handlePostPress = (post: DisplayPost) => {
        (navigation as any).navigate("PostDetail", { postId: post.id });
    };

    const handleCommentPress = (item: LikedComment) => {
        const comment = item.comment;
        if (item.source === "store" && comment.storeId) {
            (navigation as any).navigate("StoreDetail", { storeId: comment.storeId });
        } else if (item.source === "product" && comment.productId) {
            (navigation as any).navigate("StoreProductDetail", {
                productId: comment.productId,
                storeId: comment.storeId,
            });
        } else if (comment.postId) {
            (navigation as any).navigate("PostDetail", { postId: comment.postId });
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t('time.justNow');
        if (minutes < 60) return t('time.minutesAgo', { count: minutes });
        if (hours < 24) return t('time.hoursAgo', { count: hours });
        if (days < 30) return t('time.daysAgo', { count: days });
        return date.toLocaleDateString();
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
                        {t("myLikes.noLikes")}
                    </Text>
                    <Text color="$gray300" mt="$xs" fontSize="$sm">
                        {t("myLikes.emptyPostsHint")}
                    </Text>
                </VStack>
            );
        }

        // Two-column masonry: columns flow independently so differently-sized
        // cards don't leave a flex-wrap row-top gap. Long-press still unlikes
        // the post; each Pressable sits directly in the column and gets its
        // width from `flex: 1` on the VStack.
        const columns = splitIntoMasonryColumns(
            likedPosts,
            (post) => post.content?.images?.[0] || post.image
        );
        return (
            <RNScrollView
                refreshControl={
                    <RefreshControl refreshing={postsRefreshing} onRefresh={onPostsRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            >
                <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
                    {columns.map((column, colIndex) => (
                        <VStack key={colIndex} flex={1} space="sm">
                            {column.map((post) => (
                                <Pressable
                                    key={post.id}
                                    onPress={() => handlePostPress(post)}
                                    onLongPress={() => handleUnlikePost(post)}
                                >
                                    <PostCard
                                        post={post}
                                        onPress={() => handlePostPress(post)}
                                    />
                                </Pressable>
                            ))}
                        </VStack>
                    ))}
                </HStack>
            </RNScrollView>
        );
    };

    const sourceLabel = (source: LikedComment["source"]) => {
        if (source === "store") return t("myLikes.storeComment");
        if (source === "product") return t("myLikes.productComment");
        return "";
    };

    const renderCommentItem = ({ item }: { item: LikedComment }) => {
        const comment = item.comment;
        return (
            <Pressable
                onPress={() => handleCommentPress(item)}
                onLongPress={() => handleUnlikeComment(item)}
            >
                <HStack
                    p="$md"
                    borderBottomWidth={1}
                    borderBottomColor="$gray100"
                    alignItems="flex-start"
                >
                    {/* 用户头像 */}
                    {comment.userAvatar ? (
                        <OptimizedImage
                            uri={comment.userAvatar}
                            size={ImageSize.THUMBNAIL}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                            contentFit="cover"
                            lazy={true}
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
                            <HStack alignItems="center" gap="$xs">
                                <Text fontSize="$sm" fontWeight="$medium" color="$black">
                                    {comment.username}
                                </Text>
                                {item.source !== "post" && (
                                    <Box bg="$gray100" px="$xs" py={1} rounded="$sm">
                                        <Text fontSize={10} color="$gray400">
                                            {sourceLabel(item.source)}
                                        </Text>
                                    </Box>
                                )}
                            </HStack>
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
                                onPress={() => handleUnlikeComment(item)}
                                hitSlop={8}
                            >
                                <HStack alignItems="center" gap="$xs">
                                    <Ionicons
                                        name="heart-dislike-outline"
                                        size={14}
                                        color={theme.colors.gray300}
                                    />
                                    <Text fontSize="$xs" color="$gray300">
                                        {t('myLikes.unlikeAction')}
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
                        {t("myLikes.noLikedComments")}
                    </Text>
                    <Text color="$gray300" mt="$xs" fontSize="$sm">
                        {t("myLikes.emptyCommentsHint")}
                    </Text>
                </VStack>
            );
        }

        return (
            <FlatList
                data={likedComments}
                renderItem={renderCommentItem}
                keyExtractor={(item) => `${item.source}-${item.comment.id}`}
                refreshControl={
                    <RefreshControl refreshing={commentsRefreshing} onRefresh={onCommentsRefresh} />
                }
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            />
        );
    };

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: "posts", label: t("myLikes.posts"), count: likedPosts.length },
        { id: "comments", label: t("myLikes.comments"), count: likedComments.length },
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
            style={{ flex: 1, backgroundColor: appTheme.colors.background }}
            edges={["top"]}
        >
            <ScreenHeader title={t("myLikes.title")} showBack={true} />

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
