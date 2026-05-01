import React, { useState, useEffect, useCallback } from "react";
import {
    RefreshControl,
    ActivityIndicator,
    FlatList,
    Modal,
    TouchableWithoutFeedback,
    View,
    Dimensions,
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
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import ScreenHeader from "../components/ScreenHeader";
import {
    commentService,
    PostComment,
} from "../services/commentService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MyCommentsScreen = () => {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const [comments, setComments] = useState<PostComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<PostComment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadComments = useCallback(async () => {
        if (!user?.userId) return;

        try {
            const result = await commentService.getUserComments(user.userId);
            setComments(result);
        } catch (error) {
            console.error("Error loading comments:", error);
            Alert.show(t("common.loadFailed"));
        } finally {
            setIsLoading(false);
        }
    }, [user?.userId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    useFocusEffect(
        useCallback(() => {
            loadComments();
        }, [loadComments])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadComments();
        setRefreshing(false);
    };

    const handleDeletePress = (comment: PostComment) => {
        setCommentToDelete(comment);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!commentToDelete || !user?.userId) {
            setShowDeleteDialog(false);
            setCommentToDelete(null);
            return;
        }

        setIsDeleting(true);

        try {
            await commentService.deleteComment(commentToDelete.id, user.userId);
            setShowDeleteDialog(false);
            Alert.show(t("admin.commentDeleted"));

            // 从列表中移除
            setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id));
        } catch (error) {
            console.error("删除评论失败:", error);
            Alert.show(t("common.deleteFailed"), t("common.retryLater"));
        } finally {
            setIsDeleting(false);
            setCommentToDelete(null);
        }
    };

    const handleCommentPress = (comment: PostComment) => {
        // 跳转到帖子详情
        (navigation as any).navigate("PostDetail", { postId: comment.postId });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t("time.justNow");
        if (minutes < 60) return t("time.minutesAgo", { count: minutes });
        if (hours < 24) return t("time.hoursAgo", { count: hours });
        if (days < 30) return t("time.daysAgo", { count: days });
        return date.toLocaleDateString("zh-CN");
    };

    const renderComment = ({ item }: { item: PostComment }) => (
        <Pressable
            onPress={() => handleCommentPress(item)}
            onLongPress={() => handleDeletePress(item)}
        >
            <HStack
                p="$md"
                borderBottomWidth={1}
                borderBottomColor="$gray100"
                alignItems="flex-start"
            >
                {/* 用户头像 */}
                {item.userAvatar ? (
                    <OptimizedImage
                        uri={item.userAvatar}
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
                            {item.username?.slice(0, 1).toUpperCase() || "U"}
                        </Text>
                    </Box>
                )}

                <VStack flex={1} ml="$sm">
                    {/* 用户名和时间 */}
                    <HStack justifyContent="space-between" alignItems="center">
                        <Text fontSize="$sm" fontWeight="$medium" color="$black">
                            {item.username}
                        </Text>
                        <Text fontSize="$xs" color="$gray300">
                            {formatTime(item.createdAt)}
                        </Text>
                    </HStack>

                    {/* 评论内容 */}
                    <Text
                        fontSize="$sm"
                        color="$gray600"
                        mt="$xs"
                        numberOfLines={3}
                    >
                        {item.content}
                    </Text>

                    {/* 操作区域 */}
                    <HStack mt="$sm" alignItems="center" gap="$md">
                        <HStack alignItems="center" gap="$xs">
                            <Ionicons
                                name="heart-outline"
                                size={14}
                                color={theme.colors.gray300}
                            />
                            <Text fontSize="$xs" color="$gray300">
                                {item.likeCount}
                            </Text>
                        </HStack>
                        {item.replyCount > 0 && (
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons
                                    name="chatbubble-outline"
                                    size={14}
                                    color={theme.colors.gray300}
                                />
                                <Text fontSize="$xs" color="$gray300">
                                    {item.replyCount} {t("post.reply")}
                                </Text>
                            </HStack>
                        )}
                        <Pressable
                            onPress={() => handleDeletePress(item)}
                            hitSlop={8}
                        >
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons
                                    name="trash-outline"
                                    size={14}
                                    color={theme.colors.gray300}
                                />
                                <Text fontSize="$xs" color="$gray300">
                                    {t("common.delete")}
                                </Text>
                            </HStack>
                        </Pressable>
                    </HStack>
                </VStack>
            </HStack>
        </Pressable>
    );

    const renderEmptyState = () => (
        <VStack alignItems="center" justifyContent="center" py="$xxl" flex={1}>
            <Ionicons
                name="chatbubble-ellipses-outline"
                size={48}
                color={theme.colors.gray200}
            />
            <Text color="$gray400" mt="$md" fontSize="$md">
                {t("myComments.noComments")}
            </Text>
            <Text color="$gray300" mt="$xs" fontSize="$sm">
                {t("myComments.emptyHint")}
            </Text>
        </VStack>
    );

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: theme.colors.white }}
            edges={["top"]}
        >
            <ScreenHeader title={t("myComments.title")} showBack={true} />

            {isLoading ? (
                <VStack alignItems="center" justifyContent="center" flex={1}>
                    <RNImage
                        source={require("../../assets/gif/profile-loading.gif")}
                        style={styles.loadingGif}
                        resizeMode="contain"
                    />
                </VStack>
            ) : (
                <FlatList
                    data={comments}
                    renderItem={renderComment}
                    keyExtractor={(item) => String(item.id)}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={renderEmptyState}
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

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
                                        {t("comments.confirmDelete")}
                                    </Text>
                                    <Text
                                        fontSize="$sm"
                                        color="$gray600"
                                        textAlign="center"
                                        mt="$sm"
                                    >
                                        {t("comments.confirmDeleteComment")}
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
                                            setCommentToDelete(null);
                                        }}
                                        disabled={isDeleting}
                                        opacity={isDeleting ? 0.5 : 1}
                                    >
                                        <Text
                                            fontSize="$md"
                                            fontWeight="$medium"
                                            color="$gray600"
                                        >
                                            {t("common.cancel")}
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
                                                        {t("common.loading")}
                                                    </Text>
                                                </>
                                            ) : (
                                                <Text
                                                    fontSize="$md"
                                                    fontWeight="$semibold"
                                                    color="#FF3040"
                                                >
                                                    {t("common.delete")}
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

const styles = StyleSheet.create({
    loadingGif: {
        width: Dimensions.get("window").width * 0.5,
        height: Dimensions.get("window").width * 0.5,
    },
});

export default MyCommentsScreen;
