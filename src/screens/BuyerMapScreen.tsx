import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  BuyerStore,
  getAllStores,
  getAllCountries,
  getAllCities,
  getAllStyles,
  filterStores,
} from "../services/buyerStoreService";

interface FilterState {
  country: string;
  city: string;
  brand: string;
  style: string;
  openOnly: boolean;
}

const BuyerMapScreen = () => {
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [filteredStores, setFilteredStores] = useState<BuyerStore[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    country: "",
    city: "",
    brand: "",
    style: "",
    openOnly: false,
  });

  // 加载所有店铺
  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
      setFilteredStores(data);
    } catch (error) {
      console.error("Error loading stores:", error);
    }
  };

  // 应用筛选
  useEffect(() => {
    applyFilters();
  }, [searchQuery, filters, stores]);

  const applyFilters = async () => {
    try {
      const filtered = await filterStores({
        country: filters.country,
        city: filters.city,
        brand: filters.brand,
        style: filters.style,
        openOnly: filters.openOnly,
        searchQuery: searchQuery,
      });
      setFilteredStores(filtered);
    } catch (error) {
      console.error("Error filtering stores:", error);
    }
  };

  // 获取筛选选项
  const countries = getAllCountries();
  const cities = getAllCities();
  const styleOptions = getAllStyles();

  const handleStorePress = (store: BuyerStore) => {
    setSelectedStore(store);
    // 将地图中心移动到选中的店铺
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: store.coordinates.latitude,
        longitude: store.coordinates.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  const resetFilters = () => {
    setFilters({
      country: "",
      city: "",
      brand: "",
      style: "",
      openOnly: false,
    });
    setSearchQuery("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title="买手店地图" />

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.gray400}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索品牌、店铺或城市..."
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={20} color={theme.colors.black} />
          {(filters.country ||
            filters.city ||
            filters.brand ||
            filters.style ||
            filters.openOnly) && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      {/* 地图视图 */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 31.2304, // 上海作为初始中心
          longitude: 121.4737,
          latitudeDelta: 15,
          longitudeDelta: 15,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {filteredStores.map((store) => (
          <Marker
            key={store.id}
            coordinate={store.coordinates}
            title={store.name}
            description={store.address}
            onPress={() => handleStorePress(store)}
            pinColor={store.isOpen ? "#000000" : "#9CA3AF"}
          />
        ))}
      </MapView>

      {/* 店铺列表 */}
      <View style={styles.storesListContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            找到 {filteredStores.length} 家店铺
          </Text>
          {(searchQuery ||
            filters.country ||
            filters.city ||
            filters.brand ||
            filters.style ||
            filters.openOnly) && (
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.clearButton}>清除</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storesList}
        >
          {filteredStores.map((store) => (
            <TouchableOpacity
              key={store.id}
              style={[
                styles.storeCard,
                selectedStore?.id === store.id && styles.selectedStoreCard,
              ]}
              onPress={() => handleStorePress(store)}
            >
              <View style={styles.storeHeader}>
                <Text style={styles.storeName}>{store.name}</Text>
                {store.isOpen ? (
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>营业中</Text>
                  </View>
                ) : (
                  <View style={styles.closedBadge}>
                    <Text style={styles.closedBadgeText}>已打烊</Text>
                  </View>
                )}
              </View>
              <Text style={styles.storeCity} numberOfLines={1}>
                {store.city}, {store.country}
              </Text>
              <Text style={styles.storeAddress} numberOfLines={2}>
                {store.address}
              </Text>
              <View style={styles.storeBrands}>
                {store.brands.slice(0, 3).map((brand, idx) => (
                  <View key={idx} style={styles.brandTag}>
                    <Text style={styles.brandTagText} numberOfLines={1}>
                      {brand}
                    </Text>
                  </View>
                ))}
                {store.brands.length > 3 && (
                  <Text style={styles.moreBrands}>
                    +{store.brands.length - 3}
                  </Text>
                )}
              </View>
              {store.rating && (
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>{store.rating}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 筛选面板 */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>筛选条件</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent}>
              {/* 国家筛选 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>国家</Text>
                <View style={styles.filterOptions}>
                  {countries.map((country) => (
                    <TouchableOpacity
                      key={country}
                      style={[
                        styles.filterOption,
                        filters.country === country &&
                          styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          country: prev.country === country ? "" : country,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.country === country &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {country}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 城市筛选 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>城市</Text>
                <View style={styles.filterOptions}>
                  {cities.map((city) => (
                    <TouchableOpacity
                      key={city}
                      style={[
                        styles.filterOption,
                        filters.city === city && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          city: prev.city === city ? "" : city,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.city === city &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {city}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 风格筛选 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>风格</Text>
                <View style={styles.filterOptions}>
                  {styleOptions.map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.filterOption,
                        filters.style === style && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          style: prev.style === style ? "" : style,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.style === style &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {style}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 营业状态 */}
              <View style={styles.filterSection}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() =>
                    setFilters((prev) => ({
                      ...prev,
                      openOnly: !prev.openOnly,
                    }))
                  }
                >
                  <View
                    style={[
                      styles.checkbox,
                      filters.openOnly && styles.checkboxActive,
                    ]}
                  >
                    {filters.openOnly && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.colors.white}
                      />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>仅显示营业中的店铺</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetButtonText}>重置</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>应用筛选</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    marginRight: theme.spacing.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.black,
  },
  filterButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.lg,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E74C3C",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerClosed: {
    backgroundColor: theme.colors.gray400,
  },
  storesListContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: Dimensions.get("window").height * 0.35,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  listTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  clearButton: {
    ...theme.typography.body,
    color: theme.colors.accent,
  },
  storesList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  storeCard: {
    width: 280,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  selectedStoreCard: {
    borderColor: theme.colors.black,
    borderWidth: 2,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  storeName: {
    ...theme.typography.h4,
    color: theme.colors.black,
    flex: 1,
  },
  openBadge: {
    backgroundColor: "#27AE60",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  openBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 10,
  },
  closedBadge: {
    backgroundColor: theme.colors.gray400,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  closedBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 10,
  },
  storeCity: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.xs / 2,
  },
  storeAddress: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
    lineHeight: 16,
  },
  storeBrands: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  brandTag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    maxWidth: 80,
  },
  brandTagText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontSize: 10,
  },
  moreBrands: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontSize: 10,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    marginLeft: 4,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  filterModal: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  filterModalTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  filterSection: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  filterSectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  filterOptionActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterOptionText: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  filterOptionTextActive: {
    color: theme.colors.white,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  checkboxActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  checkboxLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  filterActions: {
    flexDirection: "row",
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  resetButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.black,
    marginRight: theme.spacing.sm,
    alignItems: "center",
  },
  resetButtonText: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  applyButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.black,
    alignItems: "center",
  },
  applyButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
  },
});

export default BuyerMapScreen;
