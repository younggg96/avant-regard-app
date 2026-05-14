/**
 * 我的商家店铺列表页面
 * 显示用户申请的商家店铺列表、状态、并可以进行管理
 */
import React, { useState, useEffect, useCallback } from "react";
import {
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
    Box,
    Text,
    Pressable,
    HStack,
    VStack,
} from "../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { useAuthStore } from "../store/authStore";
import {
    StoreMerchant,
    getMyMerchants,
} from "../services/storeMerchantService";
import { getStoreById, BuyerStore } from "../services/buyerStoreService";

interface MerchantWithStore extends StoreMerchant {
    storeInfo?: BuyerStore | null;
}

const MyMerchantStoresScreen = () => {
    const theme = useAppTheme();
    const { t } = useTranslation();
    const styles = useThemedStyles(makeStyles);
    const navigation = useNavigation();
    const { user } = useAuthStore();

    const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
        PENDING: {
            label: t("merchant.pendingReview"),
            color: "#F57C00",
            bgColor: "#FFF3E0",
            icon: "time-outline",
        },
        APPROVED: {
            label: t("merchant.approved"),
            color: "#27AE60",
            bgColor: "#E8F5E9",
            icon: "checkmark-circle-outline",
        },
        REJECTED: {
            label: t("merchant.rejected"),
            color: "#E53935",
            bgColor: "#FFEBEE",
            icon: "close-circle-outline",
        },
        SUSPENDED: {
            label: t("merchant.suspended"),
            color: "#757575",
            bgColor: "#F5F5F5",
            icon: "pause-circle-outline",
        },
    };

    const [merchants, setMerchants] = useState<MerchantWithStore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // 加载商家列表
    const loadMerchants = useCallback(async (pageNum: number = 1) => {
        if (!user) return;

        try {
            if (pageNum === 1) {
                setIsLoading(true);
            }

            const result = await getMyMerchants(pageNum, 20);

            // 获取每个商家对应的店铺信息
            const merchantsWithStore: MerchantWithStore[] = await Promise.all(
                result.merchants.map(async (merchant) => {
                    try {
                        const storeInfo = await getStoreById(merchant.storeId);
                        return { ...merchant, storeInfo };
                    } catch (error) {
                        return { ...merchant, storeInfo: null };
                    }
                })
            );

            if (pageNum === 1) {
                setMerchants(merchantsWithStore);
            } else {
                setMerchants((prev) => [...prev, ...merchantsWithStore]);
            }

            setTotal(result.total);
            setPage(pageNum);
        } catch (error: any) {
            Alert.alert(t("common.loadFailed"), error.message || t("common.retryLater"));
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadMerchants();
    }, [loadMerchants]);

    // 下拉刷新
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadMerchants(1);
        setIsRefreshing(false);
    };

    // 加载更多
    const handleLoadMore = () => {
        if (merchants.length < total && !isLoading) {
            loadMerchants(page + 1);
        }
    };

    // 跳转到商家管理页面
    const goToMerchantManage = (merchant: MerchantWithStore) => {
        if (merchant.status !== "APPROVED") {
            Alert.alert(t("common.hint"), t("merchant.onlyApprovedCanManage"));
            return;
        }
        (navigation as any).navigate("MerchantManage", { merchantId: merchant.id });
    };

    // 跳转到店铺详情
    const goToStoreDetail = (storeId: string) => {
        (navigation as any).navigate("StoreDetail", { storeId });
    };

    // 渲染商家卡片
    const renderMerchantCard = ({ item }: { item: MerchantWithStore }) => {
        const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;

        return (
            <Box
                style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray100 }]}
                rounded="$md"
                p="$md"
                mb="$md"
                borderWidth={1}

            >
                {/* 店铺信息 */}
                <Pressable onPress={() => goToStoreDetail(item.storeId)}>
                    <HStack justifyContent="between" alignItems="start" mb="$sm">
                        <VStack flex={1}>
                            <Text
                                fontSize="$lg"
                                fontWeight="$bold"
                                style={[styles.textBold, { color: theme.colors.black }]}

                            >
                                {item.storeInfo?.name || item.storeId}
                            </Text>
                            {item.storeInfo && (
                                <Text
                                    fontSize="$sm"
                                    style={[styles.textRegular, { color: theme.colors.gray300 }]}
                                    mt="$xs"

                                >
                                    {item.storeInfo.city}, {item.storeInfo.country}
                                </Text>
                            )}
                        </VStack>
                        {/* 状态标签 */}
                        <Box
                            px="$sm"
                            py="$xs"
                            rounded="$sm"
                            bg={statusConfig.bgColor}
                            flexDirection="row"
                            alignItems="center"
                        >
                            <Ionicons
                                name={statusConfig.icon as any}
                                size={14}
                                color={statusConfig.color}
                            />
                            <Text
                                fontSize="$xs"
                                fontWeight="$semibold"
                                color={statusConfig.color}
                                ml="$xs"
                                style={styles.textBold}
                            >
                                {statusConfig.label}
                            </Text>
                        </Box>
                    </HStack>
                </Pressable>

                {/* 商家信息 */}
                <Box style={{ backgroundColor: theme.colors.gray50 }} rounded="$sm" p="$sm" mb="$sm">
                    <HStack gap="$lg">
                        {item.contactName && (
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons name="person-outline" size={14} color={theme.colors.gray300} />
                                <Text fontSize="$xs" style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                                    {item.contactName}
                                </Text>
                            </HStack>
                        )}
                        {item.contactPhone && (
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons name="call-outline" size={14} color={theme.colors.gray300} />
                                <Text fontSize="$xs" style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                                    {item.contactPhone}
                                </Text>
                            </HStack>
                        )}
                    </HStack>
                </Box>

                {/* 拒绝原因 */}
                {item.status === "REJECTED" && item.rejectReason && (
                    <Box bg="#FFEBEE" rounded="$sm" p="$sm" mb="$sm">
                        <HStack alignItems="start" gap="$xs">
                            <Ionicons name="alert-circle-outline" size={16} color="#E53935" />
                            <VStack flex={1}>
                                <Text fontSize="$xs" fontWeight="$semibold" color="#E53935" style={styles.textBold}>
                                    {t("merchant.rejectReason")}
                                </Text>
                                <Text fontSize="$xs" color="#E53935" mt="$xs" style={styles.textRegular}>
                                    {item.rejectReason}
                                </Text>
                            </VStack>
                        </HStack>
                    </Box>
                )}

                {/* 申请时间 */}
                <HStack justifyContent="between" alignItems="center" mt="$xs">
                    <Text fontSize="$xs" style={[styles.textRegular, { color: theme.colors.gray200 }]}>
                        {t("merchant.applyTime")} {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </Text>

                    {/* 操作按钮 */}
                    {item.status === "APPROVED" && (
                        <Pressable
                            flexDirection="row"
                            alignItems="center"
                            style={{ backgroundColor: theme.colors.black }}
                            px="$md"
                            py="$sm"
                            rounded="$sm"
                            onPress={() => goToMerchantManage(item)}
                        >
                            <Ionicons name="settings-outline" size={14} color={theme.colors.white} />
                            <Text fontSize="$xs" fontWeight="$semibold" style={[styles.textBold, { color: theme.colors.white }]} ml="$xs">
                                {t("merchant.manage")}
                            </Text>
                        </Pressable>
                    )}
                </HStack>

                {/* 商家权益（已认证） */}
                {item.status === "APPROVED" && (
                    <Box mt="$sm" pt="$sm" borderTopWidth={1} style={{ borderTopColor: theme.colors.gray100 }}>
                        <Text fontSize="$xs" style={[styles.textRegular, { color: theme.colors.gray300 }]} mb="$xs">
                            {t("merchant.privileges")}
                        </Text>
                        <HStack flexWrap="wrap" gap="$xs">
                            {item.canPostBanner && (
                                <Box style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} style={[styles.textRegular, { color: theme.colors.gray400 }]}>
                                        {t("merchant.bannerPublish")}
                                    </Text>
                                </Box>
                            )}
                            {item.canPostAnnouncement && (
                                <Box style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} style={[styles.textRegular, { color: theme.colors.gray400 }]}>
                                        {t("merchant.announcementPublish")}
                                    </Text>
                                </Box>
                            )}
                            {item.canPostActivity && (
                                <Box style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} style={[styles.textRegular, { color: theme.colors.gray400 }]}>
                                        {t("merchant.activityPublish")}
                                    </Text>
                                </Box>
                            )}
                            {item.canPostDiscount && (
                                <Box style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} style={[styles.textRegular, { color: theme.colors.gray400 }]}>
                                        {t("merchant.discountPublish")}
                                    </Text>
                                </Box>
                            )}
                        </HStack>
                    </Box>
                )}
            </Box>
        );
    };

    // 渲染空状态
    const renderEmptyState = () => (
        <VStack flex={1} justifyContent="center" alignItems="center" py="$xxl">
            <Ionicons name="storefront-outline" size={64} color={theme.colors.gray200} />
            <Text
                fontSize="$md"
                style={[styles.textRegular, { color: theme.colors.gray300 }]}
                mt="$md"
                textAlign="center"

            >
                {t("merchant.noStoresApplied")}
            </Text>
            <Text
                fontSize="$sm"
                style={[styles.textRegular, { color: theme.colors.gray200 }]}
                mt="$xs"
                textAlign="center"

            >
                {t("merchant.applyHint")}
            </Text>
            <Pressable
                mt="$md"
                px="$lg"
                py="$sm"
                rounded="$sm"
                style={{ backgroundColor: theme.colors.black }}
                onPress={() => (navigation as any).navigate("Main", { screen: "Map" })}
            >
                <Text fontSize="$sm" fontWeight="$semibold" style={[styles.textBold, { color: theme.colors.white }]}>
                    {t("merchant.browseStores")}
                </Text>
            </Pressable>
        </VStack>
    );

    if (isLoading && merchants.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <ScreenHeader
                    title={t("merchant.myStores")}
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator  color={theme.colors.black} />
                    <Text style={[styles.textRegular, { color: theme.colors.gray300 }]} mt="$md">
                        {t("common.loading")}
                    </Text>
                </VStack>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader
                title={t("merchant.myStores")}
                showBackButton
                onBackPress={() => navigation.goBack()}
            />

            <FlatList
                data={merchants}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMerchantCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.black}
                    />
                }
                ListEmptyComponent={renderEmptyState}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    isLoading && merchants.length > 0 ? (
                        <Box py="$md" alignItems="center">
                            <ActivityIndicator  color={theme.colors.black} />
                        </Box>
                    ) : null
                }
            />

            {/* 提示信息 */}
            {merchants.length > 0 && (
                <Box px="$lg" py="$sm" style={{ backgroundColor: theme.colors.gray50 }}>
                    <HStack alignItems="center" gap="$xs">
                        <Ionicons name="information-circle-outline" size={14} color={theme.colors.gray300} />
                        <Text fontSize="$xs" style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                            {t("merchant.infoHint")}
                        </Text>
                    </HStack>
                </Box>
            )}
        </SafeAreaView>
    );
};

// 字体常量
const FONT_REGULAR = "PlayfairDisplay-Regular";
const FONT_BOLD = "PlayfairDisplay-Bold";

const makeStyles = (t: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: t.colors.background,
    },
    listContent: {
        padding: t.spacing.md,
        flexGrow: 1,
    },
    textRegular: {
        fontFamily: FONT_REGULAR,
    },
    textBold: {
        fontFamily: FONT_BOLD,
    },
});

export default MyMerchantStoresScreen;
