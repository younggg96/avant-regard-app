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
    KeyboardAvoidingView,
    Platform,
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
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import {
    UserSubmittedStore,
    getPendingSubmissions,
    reviewSubmission,
    batchReviewSubmissions,
} from "../services/buyerStoreService";
import { useTranslation } from "react-i18next";

const StoreReviewScreen = () => {
    const theme = useAppTheme();
    const { t } = useTranslation();
    const styles = useThemedStyles(makeStyles);
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
            Alert.alert(t("store.loadFailed"), error.message || t("store.pleaseRetryLater"));
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
            t("store.batchApprove"),
            t("store.confirmBatchApproveMsg", { count: selectedIds.size }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("store.approveAll"),
                    onPress: async () => {
                        try {
                            setIsSubmitting(true);
                            await batchReviewSubmissions({
                                submissionIds: Array.from(selectedIds),
                                status: "APPROVED",
                            });
                            Alert.alert(t("common.success"), t("store.batchApprovedMsg", { count: selectedIds.size }));
                            setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
                            setTotal((prev) => prev - selectedIds.size);
                            setSelectedIds(new Set());
                            setIsBatchMode(false);
                        } catch (error: any) {
                            Alert.alert(t("store.operationFailed"), error.message || t("store.pleaseRetryLater"));
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
            t("store.reviewApproved"),
            t("store.confirmApproveMsg", { name: submission.name }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("store.approve"),
                    onPress: async () => {
                        try {
                            setIsSubmitting(true);
                            // storeId 完全交由后端生成 (`u-<10 位 hex>`),
                            // 避免前端按 `user-${city.slice(0,2)}-${Date.now()}`
                            // 拼出带中文的 id,污染主键 / URL.
                            await reviewSubmission(submission.id, {
                                status: "APPROVED",
                            });
                            Alert.alert(t("common.success"), t("store.approvedMsg"));
                            setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
                            setTotal((prev) => prev - 1);
                            closeDetailModal();
                        } catch (error: any) {
                            Alert.alert(t("store.operationFailed"), error.message || t("store.pleaseRetryLater"));
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
            Alert.alert(t("common.notice"), t("store.pleaseInputRejectReason"));
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
                Alert.alert(t("common.success"), t("store.batchRejectedMsg", { count: selectedIds.size }));
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
                Alert.alert(t("common.success"), t("store.rejectedMsg"));
                setSubmissions((prev) => prev.filter((s) => s.id !== selectedSubmission!.id));
                setTotal((prev) => prev - 1);
            }

            closeRejectModal();
        } catch (error: any) {
            Alert.alert(t("store.operationFailed"), error.message || t("store.pleaseRetryLater"));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==================== 渲染 ====================

    const renderSubmissionItem = ({ item }: { item: UserSubmittedStore }) => {
        const isSelected = selectedIds.has(item.id);

        return (
            <Pressable
                style={[{ backgroundColor: theme.colors.card }, { borderColor: isBatchMode && isSelected ? theme.colors.text : theme.colors.border }]}
                rounded={4}
                p={10}
                mb="$sm"
                borderWidth={isBatchMode && isSelected ? 2 : 1}

                onPress={() => openDetailModal(item)}
                sx={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                }}
            >
                <HStack justifyContent="between" alignItems="start" mb={6}>
                    {isBatchMode && (
                        <Box
                            w={18}
                            h={18}
                            rounded={4}
                            borderWidth={2}
                            style={[{ borderColor: isSelected ? theme.colors.text : theme.colors.gray200 }, { backgroundColor: isSelected ? theme.colors.text : theme.colors.card }]}

                            justifyContent="center"
                            alignItems="center"
                            mr="$xs"
                            mt={2}
                        >
                            {isSelected && (
                                <Ionicons name="checkmark" size={12} color={theme.colors.textInverted} />
                            )}
                        </Box>
                    )}
                    <VStack flex={1}>
                        <Text fontSize={14} lineHeight={18} fontWeight="$bold" style={{ color: theme.colors.text }} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray300 }} mt={2}>
                            {item.city}, {item.country}
                        </Text>
                    </VStack>
                    <Box bg="#FFF3E0" px={6} py={1} rounded={4}>
                        <Text fontSize={11} lineHeight={14} fontWeight="$bold" color="#FF9800">
                            {t("merchant.pendingReview")}
                        </Text>
                    </Box>
                </HStack>

                <HStack alignItems="center" mb={6}>
                    <Ionicons name="location-outline" size={12} color={theme.colors.gray300} />
                    <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray300 }} ml="$xs" flex={1} numberOfLines={1}>
                        {item.address}
                    </Text>
                </HStack>

                {(item.style?.length ?? 0) > 0 && (
                    <HStack flexWrap="wrap" gap="$xs" mb={6}>
                        {item.style.slice(0, 3).map((s, idx) => (
                            <Box key={idx} style={{ backgroundColor: theme.colors.gray100 }} px={6} py={1} rounded={4}>
                                <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray300 }}>
                                    {s}
                                </Text>
                            </Box>
                        ))}
                    </HStack>
                )}

                <HStack justifyContent="between" alignItems="center" mt={6} pt={6} borderTopWidth={1} style={{ borderTopColor: theme.colors.border }}>
                    <HStack alignItems="center">
                        <Box
                            w={20}
                            h={20}
                            rounded={4}
                            style={{ backgroundColor: theme.colors.gray100 }}
                            justifyContent="center"
                            alignItems="center"
                            mr="$xs"
                        >
                            <Ionicons name="person" size={11} color={theme.colors.gray300} />
                        </Box>
                        <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray300 }}>
                            {item.username}
                        </Text>
                        <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray200 }} ml="$sm">
                            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                        </Text>
                    </HStack>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.gray200} />
                </HStack>
            </Pressable>
        );
    };

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
                <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.gray200} />
                <Text fontSize={14} lineHeight={18} fontWeight="$medium" style={{ color: theme.colors.text }} mt="$sm">
                    {t("store.noPendingStores")}
                </Text>
                <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }} mt="$xs">
                    {t("store.allSubmissionsProcessed")}
                </Text>
            </VStack>
        );
    };

    const rejectModalTitle = isBatchReject
        ? t("store.rejectSelectedCount", { count: selectedIds.size })
        : t("store.rejectStoreName", { name: selectedSubmission?.name });

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <ScreenHeader
                    title={t("store.storeReview")}
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator color={theme.colors.text} />
                    <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }} mt="$sm">
                        {t("common.loading")}
                    </Text>
                </VStack>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader
                title={t("store.storeReview")}
                subtitle={t("store.pendingCount", { count: total })}
                showBackButton
                onBackPress={() => navigation.goBack()}
                rightComponent={
                    submissions.length > 0 ? (
                        <Pressable onPress={toggleBatchMode} p="$xs">
                            <Ionicons
                                name={isBatchMode ? "close" : "checkbox-outline"}
                                size={20}
                                color={isBatchMode ? theme.colors.error : theme.colors.text}
                            />
                        </Pressable>
                    ) : undefined
                }
            />

            {/* 批量操作栏 */}
            {isBatchMode && (
                <HStack px={10} py="$sm" style={{ backgroundColor: theme.colors.gray50 }} alignItems="center" justifyContent="between">
                    <Pressable onPress={toggleSelectAll} flexDirection="row" alignItems="center">
                        <Box
                            w={18}
                            h={18}
                            rounded={4}
                            borderWidth={2}
                            style={[{ borderColor: selectedIds.size === submissions.length ? theme.colors.text : theme.colors.gray200 }, { backgroundColor: selectedIds.size === submissions.length ? theme.colors.text : theme.colors.card }]}

                            justifyContent="center"
                            alignItems="center"
                            mr="$xs"
                        >
                            {selectedIds.size === submissions.length && (
                                <Ionicons name="checkmark" size={11} color={theme.colors.textInverted} />
                            )}
                        </Box>
                        <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }}>
                            {t("store.selectAll")} ({selectedIds.size}/{submissions.length})
                        </Text>
                    </Pressable>
                    <HStack gap="$sm">
                        <Pressable
                            px={10}
                            py={5}
                            rounded={4}
                            borderWidth={1}
                            style={{ borderColor: selectedIds.size > 0 ? theme.colors.error : theme.colors.gray200 }}
                            opacity={selectedIds.size > 0 ? 1 : 0.4}
                            onPress={handleBatchReject}
                            disabled={selectedIds.size === 0 || isSubmitting}
                        >
                            <Text fontSize={12} lineHeight={16} fontWeight="$semibold" style={{ color: selectedIds.size > 0 ? theme.colors.error : theme.colors.gray200 }}>
                                {t("store.reject")}
                            </Text>
                        </Pressable>
                        <Pressable
                            px={10}
                            py={5}
                            rounded={4}
                            style={{ backgroundColor: selectedIds.size > 0 ? theme.colors.text : theme.colors.gray200 }}
                            opacity={selectedIds.size > 0 ? 1 : 0.4}
                            onPress={handleBatchApprove}
                            disabled={selectedIds.size === 0 || isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={theme.colors.textInverted} size="small" />
                            ) : (
                                <Text fontSize={12} lineHeight={16} fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
                                    {t("store.approve")}
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
                        <Box w={32} h={4} style={{ backgroundColor: theme.colors.gray200 }} rounded={4} alignSelf="center" mb="$sm" />
                        {selectedSubmission && (
                            <RNScrollView showsVerticalScrollIndicator={false}>
                                <Text fontSize={16} lineHeight={20} fontWeight="$bold" style={{ color: theme.colors.text }} mb={2}>
                                    {selectedSubmission.name}
                                </Text>
                                <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }} mb="$sm">
                                    {selectedSubmission.city}, {selectedSubmission.country}
                                </Text>

                                <Box style={{ backgroundColor: theme.colors.gray50 }} rounded={4} p="$sm" mb="$sm">
                                    <HStack alignItems="center">
                                        <Ionicons name="person-circle-outline" size={18} color={theme.colors.gray300} />
                                        <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }} ml="$xs">
                                            {t("store.submitter")}{selectedSubmission.username}
                                        </Text>
                                        <Text fontSize={11} lineHeight={14} style={{ color: theme.colors.gray200 }} ml="auto">
                                            {new Date(selectedSubmission.createdAt).toLocaleString("zh-CN")}
                                        </Text>
                                    </HStack>
                                </Box>

                                <VStack mb="$sm">
                                    <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                        {t("store.detailedAddress")}
                                    </Text>
                                    <Text fontSize={13} lineHeight={18} style={{ color: theme.colors.text }}>
                                        {selectedSubmission.address}
                                    </Text>
                                </VStack>

                                {selectedSubmission.latitude && selectedSubmission.longitude && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.coordinates")}
                                        </Text>
                                        <Text fontSize={13} lineHeight={18} style={{ color: theme.colors.text }}>
                                            {selectedSubmission.latitude.toFixed(6)}, {selectedSubmission.longitude.toFixed(6)}
                                        </Text>
                                    </VStack>
                                )}

                                {(selectedSubmission.style?.length ?? 0) > 0 && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.styleTags")}
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$xs">
                                            {selectedSubmission.style.map((s, idx) => (
                                                <Box key={idx} style={{ backgroundColor: theme.colors.text }} px="$sm" py={2} rounded={4}>
                                                    <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.textInverted }}>
                                                        {s}
                                                    </Text>
                                                </Box>
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {(selectedSubmission.brands?.length ?? 0) > 0 && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.salesBrands")}
                                        </Text>
                                        <HStack flexWrap="wrap" gap="$xs">
                                            {selectedSubmission.brands.map((b, idx) => (
                                                <Box key={idx} style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py={2} rounded={4}>
                                                    <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.text }}>
                                                        {b}
                                                    </Text>
                                                </Box>
                                            ))}
                                        </HStack>
                                    </VStack>
                                )}

                                {(selectedSubmission.phone?.length ?? 0) > 0 && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.phone")}
                                        </Text>
                                        <Text fontSize={13} lineHeight={18} style={{ color: theme.colors.text }}>
                                            {selectedSubmission.phone.join(", ")}
                                        </Text>
                                    </VStack>
                                )}

                                {selectedSubmission.hours && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.businessHours")}
                                        </Text>
                                        <Text fontSize={13} lineHeight={18} style={{ color: theme.colors.text }}>
                                            {selectedSubmission.hours}
                                        </Text>
                                    </VStack>
                                )}

                                {selectedSubmission.description && (
                                    <VStack mb="$sm">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.storeDescription")}
                                        </Text>
                                        <Text fontSize={13} style={{ color: theme.colors.text }} lineHeight={18}>
                                            {selectedSubmission.description}
                                        </Text>
                                    </VStack>
                                )}

                                {(selectedSubmission.images?.length ?? 0) > 0 && (
                                    <VStack mb="$md">
                                        <Text fontSize={11} lineHeight={14} fontWeight="$semibold" style={{ color: theme.colors.gray300 }} mb={2}>
                                            {t("store.storeImages")}
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
                                <HStack gap="$sm" mt="$sm" mb="$sm">
                                    <Pressable
                                        flex={1}
                                        py="$sm"
                                        rounded={4}
                                        borderWidth={1}
                                        style={{ borderColor: theme.colors.error }}
                                        alignItems="center"
                                        onPress={() => openRejectModal(selectedSubmission)}
                                        disabled={isSubmitting}
                                    >
                                        <Text fontSize={13} lineHeight={18} fontWeight="$semibold" style={{ color: theme.colors.error }}>
                                            {t("store.reject")}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        flex={1}
                                        py="$sm"
                                        rounded={4}
                                        style={{ backgroundColor: theme.colors.text }}
                                        alignItems="center"
                                        onPress={() => handleApprove(selectedSubmission)}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator color={theme.colors.textInverted} />
                                        ) : (
                                            <Text fontSize={13} lineHeight={18} fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
                                                {t("store.approve")}
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
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                                <Text fontSize={14} lineHeight={18} fontWeight="$bold" style={{ color: theme.colors.text }} mb="$sm">
                                    {t("store.rejectReason")}
                                </Text>
                                <Text fontSize={12} lineHeight={16} style={{ color: theme.colors.gray300 }} mb="$sm">
                                    {t("store.rejectReasonDescription", { target: rejectModalTitle })}
                                </Text>
                                <TextInput
                                    style={styles.rejectInput}
                                    placeholder={t("store.rejectReasonPlaceholder")}
                                    placeholderTextColor={theme.colors.gray200}
                                    value={rejectReason}
                                    onChangeText={setRejectReason}
                                    multiline
                                    maxLength={200}
                                    autoFocus
                                />
                                <HStack gap="$sm" mt="$md">
                                    <Pressable
                                        flex={1}
                                        py="$sm"
                                        rounded={4}
                                        borderWidth={1}
                                        style={{ borderColor: theme.colors.gray200 }}
                                        alignItems="center"
                                        onPress={closeRejectModal}
                                    >
                                        <Text fontSize={13} lineHeight={18} fontWeight="$semibold" style={{ color: theme.colors.text }}>
                                            {t("common.cancel")}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        flex={1}
                                        py="$sm"
                                        rounded={4}
                                        style={{ backgroundColor: rejectReason.trim() ? theme.colors.error : theme.colors.gray200 }}
                                        alignItems="center"
                                        onPress={handleConfirmReject}
                                        disabled={isSubmitting || !rejectReason.trim()}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator color={theme.colors.textInverted} />
                                        ) : (
                                            <Text fontSize={13} lineHeight={18} fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
                                                {t("store.confirmReject")}
                                            </Text>
                                        )}
                                    </Pressable>
                                </HStack>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Box>
                </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: t.colors.background,
    },
    listContent: {
        padding: 10,
        paddingBottom: t.spacing.xl,
    },
    modalContent: {
        backgroundColor: t.colors.card,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        padding: t.spacing.md,
        paddingTop: t.spacing.sm,
        paddingBottom: 34,
        maxHeight: SCREEN_HEIGHT * 0.85,
    },
    rejectModalContent: {
        backgroundColor: t.colors.card,
        borderRadius: 4,
        padding: t.spacing.md,
    },
    rejectInput: {
        backgroundColor: t.colors.gray100,
        borderRadius: t.borderRadius.md,
        padding: t.spacing.sm,
        fontSize: 13,
        color: t.colors.text,
        minHeight: 80,
        textAlignVertical: "top",
    },
    imagePreview: {
        width: 64,
        height: 64,
        borderRadius: t.borderRadius.md,
    },
});

export default StoreReviewScreen;
