/**
 * 买手店审核页面（管理员）
 * 遵循 iOS Human Interface Guidelines 设计规范
 */
import React, { useState, useEffect, useCallback } from "react";
import {
    StyleSheet,
    FlatList,
    Alert,
    RefreshControl,
    ActivityIndicator,
    Modal,
    TextInput,
    Animated,
    TouchableWithoutFeedback,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
    Box,
    Text,
    Pressable,
    HStack,
    VStack,
    ScrollView,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
    UserSubmittedStore,
    getPendingSubmissions,
    reviewSubmission,
} from "../services/buyerStoreService";

const StoreReviewScreen = () => {
    const navigation = useNavigation();

    const [submissions, setSubmissions] = useState<UserSubmittedStore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // 拒绝弹窗状态
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<UserSubmittedStore | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const rejectModalAnim = React.useRef(new Animated.Value(0)).current;

    // 详情弹窗状态
    const [showDetailModal, setShowDetailModal] = useState(false);
    const detailModalAnim = React.useRef(new Animated.Value(0)).current;

    // 加载待审核列表
    const loadSubmissions = useCallback(async (pageNum: number = 1) => {
        try {
            if (pageNum === 1) {
                setIsLoading(true);
            } else {
                setIsLoadingMore(true);
            }
            const result = await getPendingSubmissions(pageNum, 20);
            if (pageNum === 1) {
                setSubmissions(result.stores);
            } else {
                setSubmissions((prev) => [...prev, ...result.stores]);
            }
            setTotal(result.total);
            setPage(pageNum);
        } catch (error: any) {
            Alert.alert("加载失败", error.message || "请稍后重试");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    // 下拉刷新
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadSubmissions(1);
        setIsRefreshing(false);
    };

    // 加载更多
    const handleLoadMore = () => {
        if (submissions.length < total && !isLoadingMore) {
            loadSubmissions(page + 1);
        }
    };

    // 打开详情弹窗
    const openDetailModal = (submission: UserSubmittedStore) => {
        setSelectedSubmission(submission);
        setShowDetailModal(true);
        Animated.timing(detailModalAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    // 关闭详情弹窗
    const closeDetailModal = () => {
        Animated.timing(detailModalAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setShowDetailModal(false);
            setSelectedSubmission(null);
        });
    };

    // 审核通过
    const handleApprove = async (submission: UserSubmittedStore) => {
        Alert.alert(
            "审核通过",
            `确定要通过「${submission.name}」的审核吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "通过",
                    onPress: async () => {
                        try {
                            setIsSubmitting(true);
                            // 生成店铺ID
                            const cityCode = submission.city.slice(0, 2).toLowerCase();
                            const storeId = `user-${cityCode}-${Date.now()}`;

                            await reviewSubmission(submission.id, {
                                status: "APPROVED",
                                storeId,
                            });

                            Alert.alert("成功", "审核已通过");
                            setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
                            setTotal((prev) => prev - 1);
                            closeDetailModal();
                        } catch (error: any) {
                            Alert.alert("操作失败", error.message || "请稍后重试");
                        } finally {
                            setIsSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // 打开拒绝弹窗
    const openRejectModal = (submission: UserSubmittedStore) => {
        setSelectedSubmission(submission);
        setRejectReason("");
        closeDetailModal();
        setTimeout(() => {
            setShowRejectModal(true);
            Animated.timing(rejectModalAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }, 300);
    };

    // 关闭拒绝弹窗
    const closeRejectModal = () => {
        Animated.timing(rejectModalAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setShowRejectModal(false);
            setRejectReason("");
        });
    };

    // 确认拒绝
    const handleConfirmReject = async () => {
        if (!selectedSubmission) return;
        if (!rejectReason.trim()) {
            Alert.alert("提示", "请输入拒绝原因");
            return;
        }

        try {
            setIsSubmitting(true);
            await reviewSubmission(selectedSubmission.id, {
                status: "REJECTED",
                rejectReason: rejectReason.trim(),
            });

            Alert.alert("成功", "已拒绝该提交");
            setSubmissions((prev) => prev.filter((s) => s.id !== selectedSubmission.id));
            setTotal((prev) => prev - 1);
            closeRejectModal();
        } catch (error: any) {
            Alert.alert("操作失败", error.message || "请稍后重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 渲染提交项
    const renderSubmissionItem = ({ item }: { item: UserSubmittedStore }) => (
        <Pressable
            bg="$white"
            rounded="$lg"
            p="$md"
            mb="$md"
            borderWidth={1}
            borderColor="$gray100"
            onPress={() => openDetailModal(item)}
            sx={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            <HStack justifyContent="between" alignItems="start" mb="$sm">
                <VStack flex={1}>
                    <Text fontSize="$lg" fontWeight="$bold" color="$black" numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text fontSize="$sm" color="$gray300" mt="$xs">
                        {item.city}, {item.country}
                    </Text>
                </VStack>
                <Box bg="#FFF3E0" px="$sm" py="$xs" rounded="$sm">
                    <Text fontSize="$xs" fontWeight="$bold" color="#FF9800">
                        待审核
                    </Text>
                </Box>
            </HStack>

            <HStack alignItems="center" mb="$sm">
                <Ionicons name="location-outline" size={14} color={theme.colors.gray300} />
                <Text fontSize="$sm" color="$gray300" ml="$xs" flex={1} numberOfLines={1}>
                    {item.address}
                </Text>
            </HStack>

            {item.style.length > 0 && (
                <HStack flexWrap="wrap" gap="$xs" mb="$sm">
                    {item.style.slice(0, 3).map((s, idx) => (
                        <Box key={idx} bg="$gray100" px="$sm" py="$xs" rounded="$sm">
                            <Text fontSize="$xs" color="$gray300">
                                {s}
                            </Text>
                        </Box>
                    ))}
                </HStack>
            )}

            <HStack justifyContent="between" alignItems="center" mt="$sm" pt="$sm" borderTopWidth={1} borderTopColor="$gray100">
                <HStack alignItems="center">
                    <Box
                        w={24}
                        h={24}
                        rounded="$sm"
                        bg="$gray100"
                        justifyContent="center"
                        alignItems="center"
                        mr="$xs"
                    >
                        <Ionicons name="person" size={12} color={theme.colors.gray300} />
                    </Box>
                    <Text fontSize="$xs" color="$gray300">
                        {item.username}
                    </Text>
                    <Text fontSize="$xs" color="$gray200" ml="$sm">
                        {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </Text>
                </HStack>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.gray200} />
            </HStack>
        </Pressable>
    );

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
                <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.gray200} />
                <Text fontSize="$lg" fontWeight="$medium" color="$black" mt="$md">
                    暂无待审核的买手店
                </Text>
                <Text color="$gray300" mt="$sm">
                    所有用户提交已处理完毕
                </Text>
            </VStack>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <ScreenHeader
                    title="买手店审核"
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator size="small" color={theme.colors.black} />
                    <Text color="$gray300" mt="$md">
                        加载中...
                    </Text>
                </VStack>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader
                title="买手店审核"
                subtitle={`${total} 条待审核`}
                showBackButton
                onBackPress={() => navigation.goBack()}
            />

            <FlatList
                data={submissions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderSubmissionItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.black}
                    />
                }
                ListEmptyComponent={renderEmpty}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    isLoadingMore ? (
                        <Box py="$md" alignItems="center">
                            <ActivityIndicator size="small" color={theme.colors.black} />
                        </Box>
                    ) : null
                }
            />

            {/* 详情弹窗 */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="none"
                onRequestClose={closeDetailModal}
            >
                <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
                    <TouchableWithoutFeedback onPress={closeDetailModal}>
                        <Box flex={1} />
                    </TouchableWithoutFeedback>
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                transform: [
                                    {
                                        translateY: detailModalAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [600, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Box w={40} h={4} bg="$gray200" rounded="$sm" alignSelf="center" mb="$md" />

                        {selectedSubmission && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* 店铺名称 */}
                                <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
                                    {selectedSubmission.name}
                                </Text>
                                <Text fontSize="$sm" color="$gray300" mb="$md">
                                    {selectedSubmission.city}, {selectedSubmission.country}
                                </Text>

                                {/* 提交者信息 */}
                                <Box bg="$gray50" rounded="$md" p="$md" mb="$md">
                                    <HStack alignItems="center">
                                        <Ionicons name="person-circle-outline" size={20} color={theme.colors.gray300} />
                                        <Text fontSize="$sm" color="$gray300" ml="$sm">
                                            提交者：{selectedSubmission.username}
                                        </Text>
                                        <Text fontSize="$sm" color="$gray200" ml="auto">
                                            {new Date(selectedSubmission.createdAt).toLocaleString("zh-CN")}
                                        </Text>
                                    </HStack>
                                </Box>

                                {/* 地址 */}
                                <VStack mb="$md">
                                    <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                        详细地址
                                    </Text>
                                    <Text fontSize="$md" color="$black">
                                        {selectedSubmission.address}
                                    </Text>
                                </VStack>

                                {/* 坐标 */}
                                {selectedSubmission.latitude && selectedSubmission.longitude && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            位置坐标
                                        </Text>
                                        <Text fontSize="$md" color="$black">
                                            {selectedSubmission.latitude.toFixed(6)}, {selectedSubmission.longitude.toFixed(6)}
                                        </Text>
                                    </VStack>
                                )}

                                {/* 风格 */}
                                {selectedSubmission.style.length > 0 && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            风格标签
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$xs">
                                            {selectedSubmission.style.map((s, idx) => (
                                                <Box key={idx} bg="$black" px="$md" py="$sm" rounded="$sm">
                                                    <Text fontSize="$sm" color="$white">
                                                        {s}
                                                    </Text>
                                                </Box>
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {/* 品牌 */}
                                {selectedSubmission.brands.length > 0 && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            销售品牌
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$xs">
                                            {selectedSubmission.brands.map((b, idx) => (
                                                <Box key={idx} bg="$gray100" px="$md" py="$sm" rounded="$sm">
                                                    <Text fontSize="$sm" color="$black">
                                                        {b}
                                                    </Text>
                                                </Box>
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {/* 电话 */}
                                {selectedSubmission.phone.length > 0 && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            联系电话
                                        </Text>
                                        <Text fontSize="$md" color="$black">
                                            {selectedSubmission.phone.join(", ")}
                                        </Text>
                                    </VStack>
                                )}

                                {/* 营业时间 */}
                                {selectedSubmission.hours && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            营业时间
                                        </Text>
                                        <Text fontSize="$md" color="$black">
                                            {selectedSubmission.hours}
                                        </Text>
                                    </VStack>
                                )}

                                {/* 描述 */}
                                {selectedSubmission.description && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            店铺描述
                                        </Text>
                                        <Text fontSize="$md" color="$black" lineHeight={22}>
                                            {selectedSubmission.description}
                                        </Text>
                                    </VStack>
                                )}

                                {/* 图片 */}
                                {selectedSubmission.images.length > 0 && (
                                    <VStack mb="$lg">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            店铺图片
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$sm">
                                            {selectedSubmission.images.map((uri, idx) => (
                                                <Image
                                                    key={idx}
                                                    source={{ uri }}
                                                    style={styles.imagePreview}
                                                />
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {/* 操作按钮 */}
                                <HStack gap="$sm" mt="$md">
                                    <Pressable
                                        flex={1}
                                        py="$md"
                                        rounded="$sm"
                                        borderWidth={1}
                                        borderColor="$error"
                                        alignItems="center"
                                        onPress={() => openRejectModal(selectedSubmission)}
                                        disabled={isSubmitting}
                                    >
                                        <Text fontSize="$md" fontWeight="$semibold" color="$error">
                                            拒绝
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        flex={1}
                                        py="$md"
                                        rounded="$sm"
                                        bg="$black"
                                        alignItems="center"
                                        onPress={() => handleApprove(selectedSubmission)}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color={theme.colors.white} />
                                        ) : (
                                            <Text fontSize="$md" fontWeight="$semibold" color="$white">
                                                通过
                                            </Text>
                                        )}
                                    </Pressable>
                                </HStack>
                            </ScrollView>
                        )}
                    </Animated.View>
                </Box>
            </Modal>

            {/* 拒绝原因弹窗 */}
            <Modal
                visible={showRejectModal}
                transparent
                animationType="none"
                onRequestClose={closeRejectModal}
            >
                <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="center" px="$lg">
                    <Animated.View
                        style={[
                            styles.rejectModalContent,
                            {
                                opacity: rejectModalAnim,
                                transform: [
                                    {
                                        scale: rejectModalAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.9, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text fontSize="$lg" fontWeight="$bold" color="$black" mb="$md">
                            拒绝原因
                        </Text>
                        <Text fontSize="$sm" color="$gray300" mb="$md">
                            请填写拒绝「{selectedSubmission?.name}」的原因，以便用户了解并修正：
                        </Text>
                        <TextInput
                            style={styles.rejectInput}
                            placeholder="请输入拒绝原因..."
                            placeholderTextColor={theme.colors.gray200}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            maxLength={200}
                        />
                        <HStack gap="$sm" mt="$lg">
                            <Pressable
                                flex={1}
                                py="$md"
                                rounded="$sm"
                                borderWidth={1}
                                borderColor="$gray200"
                                alignItems="center"
                                onPress={closeRejectModal}
                            >
                                <Text fontSize="$md" fontWeight="$semibold" color="$black">
                                    取消
                                </Text>
                            </Pressable>
                            <Pressable
                                flex={1}
                                py="$md"
                                rounded="$sm"
                                bg="$error"
                                alignItems="center"
                                onPress={handleConfirmReject}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color={theme.colors.white} />
                                ) : (
                                    <Text fontSize="$md" fontWeight="$semibold" color="$white">
                                        确认拒绝
                                    </Text>
                                )}
                            </Pressable>
                        </HStack>
                    </Animated.View>
                </Box>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray50,
    },
    listContent: {
        padding: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
    },
    modalContent: {
        backgroundColor: theme.colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: 34,
        maxHeight: "85%",
    },
    rejectModalContent: {
        backgroundColor: theme.colors.white,
        borderRadius: 16,
        padding: theme.spacing.lg,
    },
    rejectInput: {
        backgroundColor: theme.colors.gray100,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        fontSize: 15,
        color: theme.colors.black,
        minHeight: 100,
        textAlignVertical: "top",
    },
    imagePreview: {
        width: 80,
        height: 80,
        borderRadius: theme.borderRadius.md,
    },
});

export default StoreReviewScreen;
