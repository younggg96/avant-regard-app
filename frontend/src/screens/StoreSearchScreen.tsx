import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  TextInput,
  FlatList,
  Keyboard,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { theme } from "../theme";
import {
  BuyerStore,
  getStoresPaginated,
} from "../services/buyerStoreService";
import { useStoreFavorites } from "../hooks/useStoreFavorites";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

const StoreSearchScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isFavorited, toggleFavorite, getFavoriteCount, syncCountsFromStores } = useStoreFavorites();

  const [searchQuery, setSearchQuery] = useState("");
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [totalStores, setTotalStores] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setStores([]);
      setTotalStores(0);
      setIsSearching(false);
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setIsLoading(true);

    try {
      const result = await getStoresPaginated({
        page: 1,
        pageSize: PAGE_SIZE,
        searchQuery: query,
      });
      setStores(result.stores);
      syncCountsFromStores(result.stores);
      setTotalStores(result.total);
      setCurrentPage(1);
      setHasMore(result.stores.length < result.total);
    } catch (error) {
      console.error("Store search failed:", error);
      setStores([]);
      setTotalStores(0);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || !searchQuery.trim()) return;

    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const result = await getStoresPaginated({
        page: nextPage,
        pageSize: PAGE_SIZE,
        searchQuery: searchQuery.trim(),
      });

      if (result.stores.length > 0) {
        setStores((prev) => [...prev, ...result.stores]);
        syncCountsFromStores(result.stores);
        setCurrentPage(nextPage);
        setHasMore(stores.length + result.stores.length < result.total);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Load more stores failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setStores([]);
    setTotalStores(0);
    setIsSearching(false);
  }, []);

  const handleStorePress = useCallback(
    (store: BuyerStore) => {
      (navigation.navigate as any)("StoreDetail", { storeId: store.id });
    },
    [navigation]
  );

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
    if (url) Linking.openURL(url);
  };

  const renderStoreItem = useCallback(
    ({ item: store }: { item: BuyerStore }) => (
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
        <HStack justifyContent="between" alignItems="start" mb="$sm">
          <VStack flex={1} mr="$sm">
            <Text fontSize="$lg" fontWeight="$bold" color="$black" numberOfLines={1}>
              {store.name}
            </Text>
            <Text fontSize="$sm" color="$gray300" mt="$xs" numberOfLines={1}>
              {store.city}, {store.country}
            </Text>
          </VStack>
          <HStack alignItems="center" gap="$sm">
            {getFavoriteCount(store.id) > 0 && (
              <Text fontSize={11} color="$gray300">
                {t("store.followersCount", { count: getFavoriteCount(store.id) })}
              </Text>
            )}
            <Pressable
              onPress={() => toggleFavorite(store.id)}
              hitSlop={8}
              bg={isFavorited(store.id) ? "$black" : "$white"}
              borderWidth={1}
              borderColor="$black"
              rounded="$sm"
              px="$sm"
              py={3}
            >
              <Text
                fontSize={11}
                fontWeight="$bold"
                color={isFavorited(store.id) ? "$white" : "$black"}
              >
                {isFavorited(store.id) ? t("store.followed") : t("store.follow")}
              </Text>
            </Pressable>
          </HStack>
        </HStack>

        <HStack alignItems="center" mb="$sm">
          <Ionicons name="location-outline" size={14} color={theme.colors.gray300} />
          <Text fontSize="$sm" color="$gray300" ml="$xs" flex={1} numberOfLines={1}>
            {store.address}
          </Text>
        </HStack>

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

        {store.brands.length > 0 && (
          <Box pb="$sm">
            <Text fontSize="$xs" color="$gray300" numberOfLines={2} fontStyle="italic">
              {store.brands.join(" / ")}
            </Text>
          </Box>
        )}
      </Pressable>
    ),
    [handleStorePress, isFavorited, toggleFavorite, getFavoriteCount]
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <Box py="$lg" alignItems="center">
        <ActivityIndicator color={theme.colors.black} />
        <Text color="$gray300" fontSize="$sm" mt="$sm">
          {t("common.loadMore")}
        </Text>
      </Box>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (!isSearching) {
      return (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons name="search-outline" size={64} color={theme.colors.gray300} />
          <Text fontSize="$lg" color="$gray600" fontWeight="$medium" mt="$md" textAlign="center">
            {t("store.searchStores")}
          </Text>
          <Text fontSize="$sm" color="$gray400" mt="$sm" textAlign="center" lineHeight="$lg">
            {t("store.searchHint")}
          </Text>
        </VStack>
      );
    }

    return (
      <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
        <Ionicons name="storefront-outline" size={64} color={theme.colors.gray300} />
        <Text fontSize="$lg" color="$gray600" fontWeight="$medium" mt="$md" textAlign="center">
          {t("store.noSearchResults")}
        </Text>
        <Text fontSize="$sm" color="$gray400" mt="$sm" textAlign="center" lineHeight="$lg">
          {t("store.tryOtherKeywords")}
        </Text>
      </VStack>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <HStack
        px="$md"
        py="$sm"
        alignItems="center"
        space="sm"
        borderBottomWidth={1}
        borderBottomColor="$gray100"
      >
        <Pressable onPress={() => navigation.goBack()} p="$xs">
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>

        <Box
          flex={1}
          bg="$gray100"
          rounded="$sm"
          px="$md"
          py="$xs"
          flexDirection="row"
          alignItems="center"
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.gray400}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t("store.searchPlaceholder")}
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} p="$xs" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
            </Pressable>
          )}
        </Box>

        <Pressable onPress={handleSearch} px="$lg" py="$sm" bg="$black" rounded="$sm">
          <Text color="$white" fontSize="$sm" fontWeight="$semibold">
            {t("common.search")}
          </Text>
        </Pressable>
      </HStack>

      {/* Content */}
      {isLoading ? (
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text fontSize="$md" color="$gray600" mt="$md">
            {t("store.searching")}
          </Text>
        </VStack>
      ) : isSearching && stores.length > 0 ? (
        <Box flex={1} bg="$gray50">
          <HStack px="$md" py="$md" alignItems="center">
            <Text fontSize="$md" color="$gray600">
              {t("store.foundStores", { count: totalStores })}
            </Text>
          </HStack>
          <FlatList
            data={stores}
            keyExtractor={(item) => item.id}
            renderItem={renderStoreItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
          />
        </Box>
      ) : (
        renderEmpty()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    color: theme.colors.black,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default StoreSearchScreen;
