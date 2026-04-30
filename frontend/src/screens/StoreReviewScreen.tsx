/**
 * 买手店审核页面（管理员）
 * 支持单个审核和批量审核
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
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
    Dimensions,
    ScrollView as RNScrollView,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
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
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import {
    UserSubmittedStore,
    getPendingSubmissions,
    reviewSubmission,
    batchReviewSubmissions,
} from "../services/buyerStoreService";

const StoreReviewScreen = () => {
    const navigation = useNavigation();

    const [submissions, setSubmissions] = useState<UserSubmittedStore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // 批量选择状态
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // 拒绝弹窗状态
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<UserSubmittedStore | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBatchReject, setIsBatchReject] = useState(false);
    const rejectModalAnim = useRef(new Animated.Value(0)).current;

    // 详情弹窗状态
    const [showDetailModal, setShowDetailModal] = useState(false);
    const detailModalAnim = useRef(new Animated.Value(0)).current;

    const loadSubmissions = useCallback(async (pageNum: number = 1) => {
        try {
            if (pageNum === 1) setIsLoading(true);
            else setIsLoadingMore(true);

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

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadSubmissions(1);
        setIsRefreshing(false);
    };

    const handleLoadMore = () => {
        if (submissions.length < total && !isLoadingMore) {
            loadSubmissions(page + 1);
        }
    };

    // ==================== 批量选择 ====================

    const toggleBatchMode = () => {
        if (isBatchMode) {
            setSelectedIds(new Set());
        }
        setIsBatchMode(!isBatchMode);
    };

    const toggleSelectItem = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === submissions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(submissions.map((s) => s.id)));
        }
    };

    const handleBatchApprove = () => {
        if (selectedIds.size === 0) return;
        Alert.alert(
            "批量通过",
            `确定要通过选中的 ${selectedIds.size} 条审核吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "全部通过",
                    onPress: async () => {
                        try {
                            setIsSubmitting(true);
                            await batchReviewSubmissions({
                                submissionIds: Array.from(selectedIds),
                                status: "APPROVED",
                            });
                            Alert.alert("成功", `已通过 ${selectedIds.size} 条审核`);
                            setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
                            setTotal((prev) => prev - selectedIds.size);
                            setSelectedIds(new Set());
                            setIsBatchMode(false);
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

    const handleBatchReject = () => {
        if (selectedIds.size === 0) return;
        setIsBatchReject(true);
        setRejectReason("");
        rejectModalAnim.setValue(0);
        setShowRejectModal(true);
    };

    // ==================== 详情弹窗 ====================

    const openDetailModal = (submission: UserSubmittedStore) => {
        if (isBatchMode) {
            toggleSelectItem(submission.id);
            return;
        }
        setSelectedSubmission(submission);
        detailModalAnim.setValue(0);
        setShowDetailModal(true);
    };

    const onDetailModalShow = () => {
        Animated.timing(detailModalAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeDetailModal = (clearSelection = true) => {
        Animated.timing(detailModalAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setShowDetailModal(false);
            if (clearSelection) setSelectedSubmission(null);
        });
    };

    // ==================== 单条审核 ====================

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
                            // storeId 完全交由后端生成 (`u-<10 位 hex>`),
                            // 避免前端按 `user-${city.slice(0,2)}-${Date.now()}`
                            // 拼出带中文的 id,污染主键 / URL.
                            await reviewSubmission(submission.id, {
                                status: "APPROVED",
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

    // ==================== 拒绝弹窗 ====================

    const openRejectModal = (submission: UserSubmittedStore) => {
        setIsBatchReject(false);
        setSelectedSubmission(submission);
        setRejectReason("");
        closeDetailModal(false);
        setTimeout(() => {
            rejectModalAnim.setValue(0);
            setShowRejectModal(true);
        }, 300);
    };

    const closeRejectModal = () => {
        Animated.timing(rejectModalAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setShowRejectModal(false);
            setRejectReason("");
            setIsBatchReject(false);
        });
    };

    const handleConfirmReject = async () => {
        if (!rejectReason.trim()) {
            Alert.alert("提示", "请输入拒绝原因");
            return;
        }

        try {
            setIsSubmitting(true);

            if (isBatchReject) {
                await batchReviewSubmissions({
                    submissionIds: Array.from(selectedIds),
                    status: "REJECTED",
                    rejectReason: rejectReason.trim(),
                });
                Alert.alert("成功", `已拒绝 ${selectedIds.size} 条提交`);
                setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
                setTotal((prev) => prev - selectedIds.size);
                setSelectedIds(new Set());
                setIsBatchMode(false);
            } else {
                if (!selectedSubmission) return;
                await reviewSubmission(selectedSubmission.id, {
                    status: "REJECTED",
                    rejectReason: rejectReason.trim(),
                });
                Alert.alert("成功", "已拒绝该提交");
                setSubmissions((prev) => prev.filter((s) => s.id !== selectedSubmission!.id));
                setTotal((prev) => prev - 1);
            }

            closeRejectModal();
        } catch (error: any) {
            Alert.alert("操作失败", error.message || "请稍后重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==================== 渲染 ====================

    const renderSubmissionItem = ({ item }: { item: UserSubmittedStore }) => {
        const isSelected = selectedIds.has(item.id);

        return (
            <Pressable
                bg="$white"
                rounded="$lg"
                p="$md"
                mb="$md"
                borderWidth={isBatchMode && isSelected ? 2 : 1}
                borderColor={isBatchMode && isSelected ? "$black" : "$gray100"}
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
                    {isBatchMode && (
                        <Box
                            w={22}
                            h={22}
                            rounded="$xs"
                            borderWidth={2}
                            borderColor={isSelected ? "$black" : "$gray200"}
                            bg={isSelected ? "$black" : "$white"}
                            justifyContent="center"
                            alignItems="center"
                            mr="$sm"
                            mt={2}
                        >
                            {isSelected && (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                        </Box>
                    )}
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

                {(item.style?.length ?? 0) > 0 && (
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
    };

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

    const rejectModalTitle = isBatchReject
        ? `拒绝选中的 ${selectedIds.size} 条提交`
        : `拒绝「${selectedSubmission?.name}」`;

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <ScreenHeader
                    title="买手店审核"
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator color={theme.colors.black} />
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
                rightComponent={
                    submissions.length > 0 ? (
                        <Pressable onPress={toggleBatchMode} p="$xs">
                            <Ionicons
                                name={isBatchMode ? "close" : "checkbox-outline"}
                                size={22}
                                color={isBatchMode ? theme.colors.error : theme.colors.black}
                            />
                        </Pressable>
                    ) : undefined
                }
            />

            {/* 批量操作栏 */}
            {isBatchMode && (
                <HStack px="$md" py="$sm" bg="$gray50" alignItems="center" justifyContent="between">
                    <Pressable onPress={toggleSelectAll} flexDirection="row" alignItems="center">
                        <Box
                            w={20}
                            h={20}
                            rounded="$xs"
                            borderWidth={2}
                            borderColor={selectedIds.size === submissions.length ? "$black" : "$gray200"}
                            bg={selectedIds.size === submissions.length ? "$black" : "$white"}
                            justifyContent="center"
                            alignItems="center"
                            mr="$xs"
                        >
                            {selectedIds.size === submissions.length && (
                                <Ionicons name="checkmark" size={12} color="#fff" />
                            )}
                        </Box>
                        <Text fontSize="$sm" color="$gray300">
                            全选 ({selectedIds.size}/{submissions.length})
                        </Text>
                    </Pressable>
                    <HStack gap="$sm">
                        <Pressable
                            px="$md"
                            py="$sm"
                            rounded="$sm"
                            borderWidth={1}
                            borderColor={selectedIds.size > 0 ? "$error" : "$gray200"}
                            opacity={selectedIds.size > 0 ? 1 : 0.4}
                            onPress={handleBatchReject}
                            disabled={selectedIds.size === 0 || isSubmitting}
                        >
                            <Text fontSize="$sm" fontWeight="$semibold" color={selectedIds.size > 0 ? "$error" : "$gray200"}>
                                拒绝
                            </Text>
                        </Pressable>
                        <Pressable
                            px="$md"
                            py="$sm"
                            rounded="$sm"
                            bg={selectedIds.size > 0 ? "$black" : "$gray200"}
                            opacity={selectedIds.size > 0 ? 1 : 0.4}
                            onPress={handleBatchApprove}
                            disabled={selectedIds.size === 0 || isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text fontSize="$sm" fontWeight="$semibold" color="$white">
                                    通过
                                </Text>
                            )}
                        </Pressable>
                    </HStack>
                </HStack>
            )}

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
                            <ActivityIndicator color={theme.colors.black} />
                        </Box>
                    ) : null
                }
            />

            {/* 详情弹窗 */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="none"
                onRequestClose={() => closeDetailModal()}
                onShow={onDetailModalShow}
            >
                <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
                    <TouchableWithoutFeedback onPress={() => closeDetailModal()}>
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
                            <RNScrollView showsVerticalScrollIndicator={false}>
                                <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
                                    {selectedSubmission.name}
                                </Text>
                                <Text fontSize="$sm" color="$gray300" mb="$md">
                                    {selectedSubmission.city}, {selectedSubmission.country}
                                </Text>

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

                                <VStack mb="$md">
                                    <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                        详细地址
                                    </Text>
                                    <Text fontSize="$md" color="$black">
                                        {selectedSubmission.address}
                                    </Text>
                                </VStack>

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

                                {(selectedSubmission.style?.length ?? 0) > 0 && (
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

                                {(selectedSubmission.brands?.length ?? 0) > 0 && (
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

                                {(selectedSubmission.phone?.length ?? 0) > 0 && (
                                    <VStack mb="$md">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            联系电话
                                        </Text>
                                        <Text fontSize="$md" color="$black">
                                            {selectedSubmission.phone.join(", ")}
                                        </Text>
                                    </VStack>
                                )}

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

                                {(selectedSubmission.images?.length ?? 0) > 0 && (
                                    <VStack mb="$lg">
                                        <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                                            店铺图片
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$sm">
                                            {selectedSubmission.images.map((uri, idx) => (
                                                <OptimizedImage
                                                    key={idx}
                                                    uri={uri}
                                                    size={ImageSize.MEDIUM}
                                                    style={styles.imagePreview}
                                                    contentFit="cover"
                                                    lazy={true}
                                                />
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {/* 操作按钮 */}
                                <HStack gap="$sm" mt="$md" mb="$md">
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
                                            <ActivityIndicator color={theme.colors.white} />
                                        ) : (
                                            <Text fontSize="$md" fontWeight="$semibold" color="$white">
                                                通过
                                            </Text>
                                        )}
                                    </Pressable>
                                </HStack>
                            </RNScrollView>
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
                onShow={() => {
                    Animated.timing(rejectModalAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }).start();
                }}
            >
                <TouchableWithoutFeedback onPress={closeRejectModal}>
                    <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="center" px="$lg">
                        <TouchableWithoutFeedback onPress={() => { }}>
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
                                    请填写{rejectModalTitle}的原因，以便用户了解并修正：
                                </Text>
                                <TextInput
                                    style={styles.rejectInput}
                                    placeholder="请输入拒绝原因..."
                                    placeholderTextColor={theme.colors.gray200}
                                    value={rejectReason}
                                    onChangeText={setRejectReason}
                                    multiline
                                    maxLength={200}
                                    autoFocus
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
                                        bg={rejectReason.trim() ? "$error" : "$gray200"}
                                        alignItems="center"
                                        onPress={handleConfirmReject}
                                        disabled={isSubmitting || !rejectReason.trim()}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator color={theme.colors.white} />
                                        ) : (
                                            <Text fontSize="$md" fontWeight="$semibold" color="$white">
                                                确认拒绝
                                            </Text>
                                        )}
                                    </Pressable>
                                </HStack>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Box>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.white,
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
        maxHeight: SCREEN_HEIGHT * 0.85,
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
