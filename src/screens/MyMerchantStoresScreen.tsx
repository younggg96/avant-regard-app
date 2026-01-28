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
import {
    Box,
    Text,
    Pressable,
    HStack,
    VStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { useAuthStore } from "../store/authStore";
import {
    StoreMerchant,
    getMyMerchants,
} from "../services/storeMerchantService";
import { getStoreById, BuyerStore } from "../services/buyerStoreService";

// 商家状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    PENDING: {
        label: "审核中",
        color: "#F57C00",
        bgColor: "#FFF3E0",
        icon: "time-outline",
    },
    APPROVED: {
        label: "已认证",
        color: "#27AE60",
        bgColor: "#E8F5E9",
        icon: "checkmark-circle-outline",
    },
    REJECTED: {
        label: "已拒绝",
        color: "#E53935",
        bgColor: "#FFEBEE",
        icon: "close-circle-outline",
    },
    SUSPENDED: {
        label: "已暂停",
        color: "#757575",
        bgColor: "#F5F5F5",
        icon: "pause-circle-outline",
    },
};

interface MerchantWithStore extends StoreMerchant {
    storeInfo?: BuyerStore | null;
}

const MyMerchantStoresScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuthStore();

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
            Alert.alert("加载失败", error.message || "请稍后重试");
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
            Alert.alert("提示", "只有认证通过的商家才能管理店铺内容");
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
                bg="$white"
                rounded="$md"
                p="$md"
                mb="$md"
                borderWidth={1}
                borderColor="$gray100"
            >
                {/* 店铺信息 */}
                <Pressable onPress={() => goToStoreDetail(item.storeId)}>
                    <HStack justifyContent="between" alignItems="start" mb="$sm">
                        <VStack flex={1}>
                            <Text
                                fontSize="$lg"
                                fontWeight="$bold"
                                color="$black"
                                style={styles.textBold}
                            >
                                {item.storeInfo?.name || item.storeId}
                            </Text>
                            {item.storeInfo && (
                                <Text
                                    fontSize="$sm"
                                    color="$gray300"
                                    mt="$xs"
                                    style={styles.textRegular}
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
                <Box bg="$gray50" rounded="$sm" p="$sm" mb="$sm">
                    <HStack gap="$lg">
                        {item.contactName && (
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons name="person-outline" size={14} color={theme.colors.gray300} />
                                <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                                    {item.contactName}
                                </Text>
                            </HStack>
                        )}
                        {item.contactPhone && (
                            <HStack alignItems="center" gap="$xs">
                                <Ionicons name="call-outline" size={14} color={theme.colors.gray300} />
                                <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
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
                                    拒绝原因
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
                    <Text fontSize="$xs" color="$gray200" style={styles.textRegular}>
                        申请时间: {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </Text>

                    {/* 操作按钮 */}
                    {item.status === "APPROVED" && (
                        <Pressable
                            flexDirection="row"
                            alignItems="center"
                            bg="$black"
                            px="$md"
                            py="$sm"
                            rounded="$sm"
                            onPress={() => goToMerchantManage(item)}
                        >
                            <Ionicons name="settings-outline" size={14} color={theme.colors.white} />
                            <Text fontSize="$xs" fontWeight="$semibold" color="$white" ml="$xs" style={styles.textBold}>
                                管理店铺
                            </Text>
                        </Pressable>
                    )}
                </HStack>

                {/* 商家权益（已认证） */}
                {item.status === "APPROVED" && (
                    <Box mt="$sm" pt="$sm" borderTopWidth={1} borderTopColor="$gray100">
                        <Text fontSize="$xs" color="$gray300" mb="$xs" style={styles.textRegular}>
                            商家权益
                        </Text>
                        <HStack flexWrap="wrap" gap="$xs">
                            {item.canPostBanner && (
                                <Box bg="$gray100" px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} color="$gray400" style={styles.textRegular}>
                                        Banner 发布
                                    </Text>
                                </Box>
                            )}
                            {item.canPostAnnouncement && (
                                <Box bg="$gray100" px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} color="$gray400" style={styles.textRegular}>
                                        公告发布
                                    </Text>
                                </Box>
                            )}
                            {item.canPostActivity && (
                                <Box bg="$gray100" px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} color="$gray400" style={styles.textRegular}>
                                        活动发布
                                    </Text>
                                </Box>
                            )}
                            {item.canPostDiscount && (
                                <Box bg="$gray100" px="$sm" py="$xs" rounded="$xs">
                                    <Text fontSize={10} color="$gray400" style={styles.textRegular}>
                                        折扣发布
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
                color="$gray300"
                mt="$md"
                textAlign="center"
                style={styles.textRegular}
            >
                您还没有申请入驻任何店铺
            </Text>
            <Text
                fontSize="$sm"
                color="$gray200"
                mt="$xs"
                textAlign="center"
                style={styles.textRegular}
            >
                在店铺详情页点击"我是商家"申请入驻
            </Text>
            <Pressable
                mt="$md"
                px="$lg"
                py="$sm"
                rounded="$sm"
                bg="$black"
                onPress={() => (navigation as any).navigate("Main", { screen: "Map" })}
            >
                <Text fontSize="$sm" fontWeight="$semibold" color="$white" style={styles.textBold}>
                    浏览买手店
                </Text>
            </Pressable>
        </VStack>
    );

    if (isLoading && merchants.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <ScreenHeader
                    title="我的店铺"
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator  color={theme.colors.black} />
                    <Text color="$gray300" mt="$md" style={styles.textRegular}>
                        加载中...
                    </Text>
                </VStack>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader
                title="我的店铺"
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
                <Box px="$lg" py="$sm" bg="$gray50">
                    <HStack alignItems="center" gap="$xs">
                        <Ionicons name="information-circle-outline" size={14} color={theme.colors.gray300} />
                        <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                            点击店铺名称可查看店铺详情，认证通过后可管理店铺内容
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.white,
    },
    listContent: {
        padding: theme.spacing.md,
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
