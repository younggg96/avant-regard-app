import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Linking,
    Platform,
    RefreshControl,
    TextInput,
    Keyboard,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    ScrollView as RNScrollView,
    Dimensions,
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
import {
    BuyerStore,
    getStoresPaginated,
} from "../services/buyerStoreService";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const StoreListScreen = () => {
    const navigation = useNavigation();
    const [stores, setStores] = useState<BuyerStore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalStores, setTotalStores] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // 搜索相关状态
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<TextInput>(null);

    // 店铺详情弹窗状态
    const [showStoreDetail, setShowStoreDetail] = useState(false);
    const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
    const detailSheetAnim = useRef(new Animated.Value(0)).current;

    // 初始加载
    useEffect(() => {
        loadInitialStores();
    }, []);

    // 搜索防抖
    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        searchDebounceRef.current = setTimeout(() => {
            handleSearch(searchQuery);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchQuery]);

    const handleSearch = async (query: string) => {
        try {
            setIsSearching(true);
            const result = await getStoresPaginated({
                page: 1,
                pageSize: PAGE_SIZE,
                searchQuery: query.trim() || undefined,
            });
            setStores(result.stores);
            setTotalStores(result.total);
            setCurrentPage(1);
            setHasMore(result.stores.length < result.total);
        } catch (error) {
            console.error("Error searching stores:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const loadInitialStores = async () => {
        try {
            setIsLoading(true);
            const result = await getStoresPaginated({ page: 1, pageSize: PAGE_SIZE });
            setStores(result.stores);
            setTotalStores(result.total);
            setCurrentPage(1);
            setHasMore(result.stores.length < result.total);
        } catch (error) {
            console.error("Error loading stores:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery("");
        inputRef.current?.blur();
        Keyboard.dismiss();
    };

    // 下拉刷新
    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            const result = await getStoresPaginated({
                page: 1,
                pageSize: PAGE_SIZE,
                searchQuery: searchQuery.trim() || undefined,
            });
            setStores(result.stores);
            setTotalStores(result.total);
            setCurrentPage(1);
            setHasMore(result.stores.length < result.total);
        } catch (error) {
            console.error("Error refreshing stores:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // 加载更多
    const loadMoreStores = async () => {
        if (isLoadingMore || !hasMore) return;

        try {
            setIsLoadingMore(true);
            const nextPage = currentPage + 1;
            const result = await getStoresPaginated({
                page: nextPage,
                pageSize: PAGE_SIZE,
                searchQuery: searchQuery.trim() || undefined,
            });

            if (result.stores.length > 0) {
                setStores((prev) => [...prev, ...result.stores]);
                setCurrentPage(nextPage);
                setHasMore(stores.length + result.stores.length < result.total);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error loading more stores:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleCallPress = (phone: string) => {
        const phoneNumber = phone.replace(/[^0-9+]/g, "");
        Linking.openURL(`tel:${phoneNumber}`);
    };

    const handleMapPress = (address: string) => {
        const encodedAddress = encodeURIComponent(address);
        const url = Platform.select({
            ios: `maps:0,0?q=${encodedAddress}`,
            android: `geo:0,0?q=${encodedAddress}`,
        });
        if (url) {
            Linking.openURL(url);
        }
    };

    // 打开店铺详情弹窗
    const handleStorePress = (store: BuyerStore) => {
        setSelectedStore(store);
        setShowStoreDetail(true);
        Animated.timing(detailSheetAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    // 关闭店铺详情弹窗
    const closeStoreDetail = () => {
        Animated.timing(detailSheetAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowStoreDetail(false));
    };

    // 弹窗动画样式
    const detailSheetStyle = {
        transform: [
            {
                translateY: detailSheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SCREEN_HEIGHT, 0],
                }),
            },
        ],
    };

    const renderStoreItem = useCallback(({ item: store }: { item: BuyerStore }) => (
        <Pressable
            mx="$md"
            mb="$md"
            bg="$white"
            rounded="$lg"
            p="$md"
            borderWidth={1}
            borderColor="$gray100"
            sx={styles.cardShadow}
            onPress={() => handleStorePress(store)}
        >
            {/* 店铺头部 */}
            <HStack justifyContent="between" alignItems="start" mb="$sm">
                <VStack flex={1} mr="$sm">
                    <Text fontSize="$lg" fontWeight="$bold" color="$black" numberOfLines={1}>
                        {store.name}
                    </Text>
                    <Text fontSize="$sm" color="$gray300" mt="$xs" numberOfLines={1}>
                        {store.city}, {store.country}
                    </Text>
                </VStack>
                <Box
                    px="$sm"
                    py="$xs"
                    rounded="$sm"
                    bg={store.isOpen ? "#E8F5E9" : "$gray100"}
                >
                    <Text
                        fontSize="$xs"
                        fontWeight="$bold"
                        color={store.isOpen ? "#27AE60" : "$gray300"}
                    >
                        {store.isOpen ? "营业中" : "休息"}
                    </Text>
                </Box>
            </HStack>

            {/* 地址 */}
            <HStack alignItems="center" mb="$sm">
                <Ionicons name="location-outline" size={14} color={theme.colors.gray300} />
                <Text fontSize="$sm" color="$gray300" ml="$xs" flex={1} numberOfLines={1}>
                    {store.address}
                </Text>
            </HStack>

            {/* 风格标签 */}
            {store.style.length > 0 && (
                <HStack mb="$sm" gap="$xs" flexWrap="wrap">
                    {store.style.slice(0, 3).map((s, idx) => (
                        <Box key={idx} bg="$black" px="$sm" py="$xs" rounded="$sm">
                            <Text fontSize="$xs" color="$white" fontWeight="$medium">
                                {s}
                            </Text>
                        </Box>
                    ))}
                    {store.style.length > 3 && (
                        <Box bg="$gray100" px="$sm" py="$xs" rounded="$sm">
                            <Text fontSize="$xs" color="$gray300">
                                +{store.style.length - 3}
                            </Text>
                        </Box>
                    )}
                </HStack>
            )}

            {/* 品牌 */}
            {store.brands.length > 0 && (
                <Box mb="$sm" pb="$sm">
                    <Text fontSize="$xs" color="$gray300" numberOfLines={2} fontStyle="italic">
                        {store.brands.join(" / ")}
                    </Text>
                </Box>
            )}
        </Pressable>
    ), []);

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return (
            <Box py="$lg" alignItems="center">
                <ActivityIndicator size="small" color={theme.colors.black} />
                <Text color="$gray300" fontSize="$sm" mt="$sm">
                    加载更多...
                </Text>
            </Box>
        );
    };

    const renderEmpty = () => {
        if (isLoading || isSearching) return null;
        return (
            <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
                <Ionicons
                    name={searchQuery.trim() ? "search-outline" : "storefront-outline"}
                    size={64}
                    color={theme.colors.gray200}
                />
                <Text fontSize="$lg" fontWeight="$medium" color="$black" mt="$md">
                    {searchQuery.trim() ? "未找到相关店铺" : "暂无店铺"}
                </Text>
                <Text color="$gray300" mt="$sm" textAlign="center" px="$lg">
                    {searchQuery.trim()
                        ? `没有找到与 "${searchQuery.trim()}" 相关的店铺`
                        : "请稍后再试"}
                </Text>
                {searchQuery.trim() && (
                    <Pressable
                        mt="$md"
                        px="$lg"
                        py="$sm"
                        bg="$black"
                        rounded="$full"
                        onPress={clearSearch}
                    >
                        <Text color="$white" fontWeight="$medium">
                            清除搜索
                        </Text>
                    </Pressable>
                )}
            </VStack>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
                <ScreenHeader
                    title="全部店铺"
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />
                <VStack flex={1} justifyContent="center" alignItems="center" bg="$gray50">
                    <ActivityIndicator size="large" color={theme.colors.black} />
                    <Text color="$gray300" mt="$md">加载中...</Text>
                </VStack>
            </SafeAreaView>
        );
    }

    // 搜索框组件
    const renderSearchBar = () => (
        <Box px="$md" py="$sm" bg="$white" borderBottomWidth={1} borderBottomColor="$gray100">
            <HStack
                alignItems="center"
                bg="$gray50"
                rounded="$lg"
                px="$md"
                h={44}
            >
                <Ionicons
                    name="search"
                    size={18}
                    color={theme.colors.gray300}
                />
                <TextInput
                    ref={inputRef}
                    style={styles.searchInput}
                    placeholder="搜索店铺名称、城市或品牌..."
                    placeholderTextColor={theme.colors.gray300}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {isSearching && (
                    <ActivityIndicator size="small" color={theme.colors.gray300} />
                )}
                {searchQuery.length > 0 && !isSearching && (
                    <Pressable onPress={clearSearch} hitSlop={8}>
                        <Ionicons
                            name="close-circle"
                            size={18}
                            color={theme.colors.gray300}
                        />
                    </Pressable>
                )}
            </HStack>
            {searchQuery.trim().length > 0 && (
                <Text fontSize="$xs" color="$gray300" mt="$xs" ml="$xs">
                    找到 {totalStores} 个结果
                </Text>
            )}
        </Box>
    );

    return (
        <>
            <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
                <ScreenHeader
                    title="全部店铺"
                    subtitle={searchQuery.trim() ? undefined : `共 ${totalStores} 家`}
                    showBackButton
                    onBackPress={() => navigation.goBack()}
                />

                {renderSearchBar()}

                <Box flex={1} bg="$gray50">
                    <FlatList
                        data={stores}
                        keyExtractor={(item) => item.id}
                        renderItem={renderStoreItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        onEndReached={loadMoreStores}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={renderEmpty}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                                tintColor={theme.colors.black}
                                colors={[theme.colors.black]}
                            />
                        }
                    />
                </Box>
            </SafeAreaView>

            {/* 店铺详情 Bottom Sheet */}
            <Modal
                visible={showStoreDetail}
                animationType="none"
                transparent={true}
                onRequestClose={closeStoreDetail}
            >
                <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
                    <TouchableWithoutFeedback onPress={closeStoreDetail}>
                        <Box flex={1} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.sheetContainer, detailSheetStyle, { maxHeight: "85%" }]}>
                        <Box w={40} h={4} bg="$gray100" rounded="$full" alignSelf="center" mt="$sm" mb="$sm" />

                        {selectedStore && (
                            <>
                                <HStack
                                    justifyContent="between"
                                    alignItems="start"
                                    px="$lg"
                                    pb="$md"
                                    borderBottomWidth={1}
                                    borderBottomColor="$gray100"
                                >
                                    <VStack flex={1}>
                                        <Text fontSize="$lg" fontWeight="$bold" color="$black" numberOfLines={1}>
                                            {selectedStore.name}
                                        </Text>
                                        <Text fontSize="$sm" color="$gray300" mt="$xs">
                                            {selectedStore.city} · {selectedStore.country}
                                        </Text>
                                    </VStack>
                                    <Pressable onPress={closeStoreDetail}>
                                        <Ionicons name="close" size={24} color={theme.colors.gray300} />
                                    </Pressable>
                                </HStack>

                                <RNScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                                    {/* 状态和营业时间 */}
                                    <Box bg="$gray100" rounded="$lg" p="$md" mt="$md">
                                        <HStack alignItems="center" mb="$sm">
                                            <Box
                                                w={8}
                                                h={8}
                                                rounded="$full"
                                                bg={selectedStore.isOpen ? "#27AE60" : "$gray300"}
                                                mr="$sm"
                                            />
                                            <Text
                                                fontSize="$sm"
                                                fontWeight="$semibold"
                                                color={selectedStore.isOpen ? "#27AE60" : "$gray300"}
                                            >
                                                {selectedStore.isOpen ? "营业中" : "休息中"}
                                            </Text>
                                        </HStack>
                                        {selectedStore.hours && (
                                            <HStack alignItems="start">
                                                <Ionicons
                                                    name="time-outline"
                                                    size={16}
                                                    color={theme.colors.gray300}
                                                    style={{ marginTop: 2 }}
                                                />
                                                <Text fontSize="$sm" color="$gray300" ml="$sm" flex={1} lineHeight="$lg">
                                                    营业时间：{selectedStore.hours}
                                                </Text>
                                            </HStack>
                                        )}
                                    </Box>

                                    {/* 地址 */}
                                    <Pressable
                                        bg="$gray100"
                                        rounded="$lg"
                                        p="$md"
                                        mt="$md"
                                        onPress={() => handleMapPress(selectedStore.address)}
                                    >
                                        <HStack alignItems="center">
                                            <Ionicons name="location-outline" size={18} color={theme.colors.black} />
                                            <Text fontSize="$md" color="$black" fontWeight="$medium" ml="$sm" flex={1}>
                                                {selectedStore.address}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color={theme.colors.gray200} />
                                        </HStack>
                                    </Pressable>

                                    {/* 电话 */}
                                    {selectedStore.phone && selectedStore.phone.length > 0 && (
                                        <Box bg="$gray100" rounded="$lg" p="$md" mt="$md">
                                            {selectedStore.phone.map((phone, idx) => (
                                                <Pressable
                                                    key={idx}
                                                    flexDirection="row"
                                                    alignItems="center"
                                                    mt={idx > 0 ? "$sm" : 0}
                                                    onPress={() => handleCallPress(phone)}
                                                >
                                                    <Ionicons name="call-outline" size={18} color={theme.colors.black} />
                                                    <Text fontSize="$md" color="$black" ml="$sm" flex={1}>
                                                        {phone}
                                                    </Text>
                                                    <Box bg="#E8F5E9" px="$sm" py="$xs" rounded="$sm">
                                                        <Text fontSize="$xs" color="#27AE60" fontWeight="$semibold">
                                                            拨打
                                                        </Text>
                                                    </Box>
                                                </Pressable>
                                            ))}
                                        </Box>
                                    )}

                                    {/* 风格 */}
                                    {selectedStore.style.length > 0 && (
                                        <VStack mt="$lg">
                                            <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                                                店铺风格
                                            </Text>
                                            <HStack flexWrap="wrap" gap="$xs">
                                                {selectedStore.style.map((s, idx) => (
                                                    <Box key={idx} bg="$black" px="$md" py="$sm" rounded="$sm">
                                                        <Text fontSize="$sm" color="$white" fontWeight="$medium">
                                                            {s}
                                                        </Text>
                                                    </Box>
                                                ))}
                                            </HStack>
                                        </VStack>
                                    )}

                                    {/* 品牌 */}
                                    {selectedStore.brands.length > 0 && (
                                        <VStack mt="$lg" mb="$2xl">
                                            <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                                                主营品牌
                                            </Text>
                                            <HStack flexWrap="wrap" gap="$xs">
                                                {selectedStore.brands.map((brand, idx) => (
                                                    <Box key={idx} bg="$gray100" px="$md" py="$sm" rounded="$sm">
                                                        <Text fontSize="$sm" color="$black">
                                                            {brand}
                                                        </Text>
                                                    </Box>
                                                ))}
                                            </HStack>
                                        </VStack>
                                    )}
                                </RNScrollView>

                                {/* 底部操作 */}
                                <HStack
                                    p="$lg"
                                    borderTopWidth={1}
                                    borderTopColor="$gray100"
                                    bg="$white"
                                    gap="$sm"
                                >
                                    <Pressable
                                        flex={1}
                                        flexDirection="row"
                                        py="$md"
                                        rounded="$full"
                                        borderWidth={1}
                                        borderColor="$gray100"
                                        alignItems="center"
                                        justifyContent="center"
                                        onPress={() => handleMapPress(selectedStore.address)}
                                    >
                                        <Ionicons name="navigate-outline" size={20} color={theme.colors.black} />
                                        <Text fontSize="$md" fontWeight="$semibold" color="$black" ml="$sm">
                                            导航
                                        </Text>
                                    </Pressable>

                                    {selectedStore.phone && selectedStore.phone.length > 0 ? (
                                        <Pressable
                                            flex={1}
                                            flexDirection="row"
                                            py="$md"
                                            rounded="$full"
                                            bg="$black"
                                            alignItems="center"
                                            justifyContent="center"
                                            onPress={() => handleCallPress(selectedStore.phone![0])}
                                        >
                                            <Ionicons name="call" size={20} color={theme.colors.white} />
                                            <Text fontSize="$md" fontWeight="$semibold" color="$white" ml="$sm">
                                                联系商家
                                            </Text>
                                        </Pressable>
                                    ) : (
                                        <Box
                                            flex={1}
                                            py="$md"
                                            rounded="$full"
                                            bg="$gray100"
                                            alignItems="center"
                                            justifyContent="center"
                                        >
                                            <Text fontSize="$md" fontWeight="$semibold" color="$gray300">
                                                暂无联系方式
                                            </Text>
                                        </Box>
                                    )}
                                </HStack>
                            </>
                        )}
                    </Animated.View>
                </Box>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.white,
    },
    listContent: {
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
        backgroundColor: theme.colors.gray50,
    },
    cardShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: theme.spacing.sm,
        marginRight: theme.spacing.sm,
        fontSize: 15,
        color: theme.colors.black,
        paddingVertical: 0,
    },
    sheetContainer: {
        backgroundColor: theme.colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SCREEN_HEIGHT * 0.9,
        minHeight: 300,
        paddingBottom: 34,
    },
});

export default StoreListScreen;
