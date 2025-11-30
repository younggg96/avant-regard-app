import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Modal,
  Linking,
  Platform,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  BuyerStore,
  getAllStores,
  getAllCities,
  getAllStyles,
  filterStores,
} from "../services/buyerStoreService";

interface FilterState {
  city: string;
  brand: string;
  styles: string[];
  openOnly: boolean;
  hasPhone: boolean;
}

// 热门品牌列表
const POPULAR_BRANDS = [
  "Rick Owens",
  "Yohji Yamamoto",
  "COMME des GARÇONS",
  "Ann Demeulemeester",
  "Guidi",
  "Jean Paul Gaultier",
  "Vivienne Westwood",
  "Undercover",
  "Dries Van Noten",
  "Maison Margiela",
];

// 风格分类
const STYLE_CATEGORIES = {
  设计师风格: ["先锋", "暗黑", "工匠", "极简"],
  复古潮流: ["vintage", "archive", "中古", "美式复古", "美式vintage"],
  特色风格: ["日系", "女装", "哥特", "视觉系", "亚文化", "银饰"],
  集合店: ["设计师品牌", "设计师品牌集合店", "集合店"],
};

const BuyerMapScreen = () => {
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showStoreDetail, setShowStoreDetail] = useState(false);
  const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [filteredStores, setFilteredStores] = useState<BuyerStore[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    city: "",
    brand: "",
    styles: [],
    openOnly: false,
    hasPhone: false,
  });

  // 动画值
  const filterSheetAnim = useRef(new Animated.Value(0)).current;
  const detailSheetAnim = useRef(new Animated.Value(0)).current;

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
      let filtered = await filterStores({
        city: filters.city,
        brand: filters.brand,
        style: filters.styles.length === 1 ? filters.styles[0] : "",
        openOnly: filters.openOnly,
        searchQuery: searchQuery,
      });

      // 多风格筛选
      if (filters.styles.length > 1) {
        filtered = filtered.filter((store) =>
          filters.styles.some((style) =>
            store.style.some((s) =>
              s.toLowerCase().includes(style.toLowerCase())
            )
          )
        );
      }

      // 有联系方式筛选
      if (filters.hasPhone) {
        filtered = filtered.filter(
          (store) => store.phone && store.phone.length > 0
        );
      }

      setFilteredStores(filtered);
    } catch (error) {
      console.error("Error filtering stores:", error);
    }
  };

  // 获取筛选选项
  const cities = getAllCities();

  // 计算各城市店铺数量
  const cityStoreCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    stores.forEach((store) => {
      counts[store.city] = (counts[store.city] || 0) + 1;
    });
    return counts;
  }, [stores]);

  // 计算激活的筛选数量
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.city) count++;
    if (filters.brand) count++;
    if (filters.styles.length > 0) count++;
    if (filters.openOnly) count++;
    if (filters.hasPhone) count++;
    return count;
  }, [filters]);

  const handleStorePress = (store: BuyerStore) => {
    setSelectedStore(store);
    // 将地图中心移动到选中的店铺
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: store.coordinates.latitude,
        longitude: store.coordinates.longitude,
        latitudeDelta: 0.02, // 稍微放大一点
        longitudeDelta: 0.02,
      });
    }
  };

  const handleStoreDetailPress = (store: BuyerStore) => {
    setSelectedStore(store);
    setShowStoreDetail(true);
    Animated.timing(detailSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeStoreDetail = () => {
    Animated.timing(detailSheetAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowStoreDetail(false));
  };

  const openFilters = () => {
    setShowFilters(true);
    Animated.timing(filterSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeFilters = () => {
    Animated.timing(filterSheetAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowFilters(false));
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

  const resetFilters = () => {
    setFilters({
      city: "",
      brand: "",
      styles: [],
      openOnly: false,
      hasPhone: false,
    });
    setSearchQuery("");
  };

  const toggleStyleFilter = (style: string) => {
    setFilters((prev) => {
      const newStyles = prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style];
      return { ...prev, styles: newStyles };
    });
  };

  const handleQuickCityFilter = (city: string) => {
    setFilters((prev) => ({
      ...prev,
      city: prev.city === city ? "" : city,
    }));
  };

  const renderMarker = (store: BuyerStore) => {
    const isSelected = selectedStore?.id === store.id;
    return (
      <Marker
        key={store.id}
        coordinate={store.coordinates}
        title={store.name}
        description={store.address}
        onPress={() => handleStorePress(store)}
        zIndex={isSelected ? 999 : 1}
      >
        <View
          style={[
            styles.customMarker,
            !store.isOpen && styles.closedMarker,
            isSelected && styles.selectedMarker,
          ]}
        >
          <View
            style={[
              styles.markerInner,
              isSelected && styles.selectedMarkerInner,
            ]}
          />
        </View>
        {isSelected && <View style={styles.markerArrow} />}
      </Marker>
    );
  };

  // Sheet 动画样式
  const filterSheetStyle = {
    transform: [
      {
        translateY: filterSheetAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [600, 0],
        }),
      },
    ],
  };

  const detailSheetStyle = {
    transform: [
      {
        translateY: detailSheetAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [600, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="买手店地图" />

      {/* 搜索栏 */}
      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={20}
              color={theme.colors.gray500}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索品牌、店铺或风格..."
              placeholderTextColor={theme.colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
            ]}
            onPress={openFilters}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={
                activeFilterCount > 0 ? theme.colors.white : theme.colors.black
              }
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 快速城市筛选标签 */}
        <View style={styles.quickFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.quickFilterTag,
                filters.openOnly && styles.quickFilterTagActive,
              ]}
              onPress={() =>
                setFilters((prev) => ({ ...prev, openOnly: !prev.openOnly }))
              }
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={
                  filters.openOnly ? theme.colors.white : theme.colors.black
                }
              />
              <Text
                style={[
                  styles.quickFilterText,
                  filters.openOnly && styles.quickFilterTextActive,
                  { marginLeft: 4 },
                ]}
              >
                营业中
              </Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            {cities.map((city) => (
              <TouchableOpacity
                key={city}
                style={[
                  styles.quickFilterTag,
                  filters.city === city && styles.quickFilterTagActive,
                ]}
                onPress={() => handleQuickCityFilter(city)}
              >
                <Text
                  style={[
                    styles.quickFilterText,
                    filters.city === city && styles.quickFilterTextActive,
                  ]}
                >
                  {city}
                </Text>
                {/* <Text
                  style={[
                    styles.quickFilterCount,
                    filters.city === city && styles.quickFilterCountActive,
                  ]}
                >
                  {cityStoreCounts[city] || 0}
                </Text> */}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* 地图视图 */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 31.2304,
            longitude: 121.4737,
            latitudeDelta: 15,
            longitudeDelta: 15,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          rotateEnabled={false}
        >
          {filteredStores.map(renderMarker)}
        </MapView>

        {/* 悬浮列表按钮 - 当列表被折叠时可能需要一个展开按钮，这里暂不需要因为列表一直显示 */}
      </View>

      {/* 底部店铺列表卡片 */}
      <View style={styles.storesListContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            发现 {filteredStores.length} 家好店
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.clearButton}>清除筛选</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storesList}
          snapToInterval={296} // card width + margin
          decelerationRate="fast"
        >
          {filteredStores.map((store) => (
            <TouchableOpacity
              key={store.id}
              style={[
                styles.storeCard,
                selectedStore?.id === store.id && styles.selectedStoreCard,
              ]}
              onPress={() => handleStorePress(store)}
              onLongPress={() => handleStoreDetailPress(store)}
              activeOpacity={0.9}
            >
              <View style={styles.storeHeader}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {store.name}
                </Text>
                {store.isOpen ? (
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>营业中</Text>
                  </View>
                ) : (
                  <View style={styles.closedBadge}>
                    <Text style={styles.closedBadgeText}>
                      {store.hours?.includes("需预约") ? "需预约" : "休息"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.storeAddress} numberOfLines={1}>
                {store.city} · {store.address}
              </Text>

              <View style={styles.storeTagsRow}>
                {store.style.slice(0, 2).map((s, idx) => (
                  <View key={idx} style={styles.miniTag}>
                    <Text style={styles.miniTagText}>{s}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.storeBrands}>
                <Text style={styles.brandText} numberOfLines={1}>
                  {store.brands.join(" / ")}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleStoreDetailPress(store)}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={theme.colors.black}
                  />
                </TouchableOpacity>
                <View style={styles.footerActions}>
                  {store.phone && store.phone.length > 0 && (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleCallPress(store.phone![0])}
                    >
                      <Ionicons
                        name="call-outline"
                        size={18}
                        color={theme.colors.black}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.iconButton, styles.navigateButton]}
                    onPress={() => handleMapPress(store.address)}
                  >
                    <Ionicons
                      name="navigate"
                      size={16}
                      color={theme.colors.white}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 筛选 Bottom Sheet */}
      <Modal
        visible={showFilters}
        animationType="none"
        transparent={true}
        onRequestClose={closeFilters}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={closeFilters}>
            <View style={styles.overlayTouchArea} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sheetContainer, filterSheetStyle]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>筛选条件</Text>
              <TouchableOpacity
                onPress={closeFilters}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
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
                        {city}{" "}
                        <Text style={{ fontSize: 10, opacity: 0.8 }}>
                          {cityStoreCounts[city]}
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 热门品牌筛选 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>热门品牌</Text>
                <View style={styles.filterOptions}>
                  {POPULAR_BRANDS.map((brand) => (
                    <TouchableOpacity
                      key={brand}
                      style={[
                        styles.filterOption,
                        filters.brand === brand && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          brand: prev.brand === brand ? "" : brand,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.brand === brand &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {brand}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 风格分类筛选 */}
              {Object.entries(STYLE_CATEGORIES).map(
                ([category, categoryStyles]) => (
                  <View key={category} style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>{category}</Text>
                    <View style={styles.filterOptions}>
                      {categoryStyles.map((styleItem) => (
                        <TouchableOpacity
                          key={styleItem}
                          style={[
                            styles.filterOption,
                            filters.styles.includes(styleItem) &&
                              styles.filterOptionActive,
                          ]}
                          onPress={() => toggleStyleFilter(styleItem)}
                        >
                          <Text
                            style={[
                              styles.filterOptionText,
                              filters.styles.includes(styleItem) &&
                                styles.filterOptionTextActive,
                            ]}
                          >
                            {styleItem}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )
              )}

              {/* 其他条件 */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>更多选项</Text>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={[
                      styles.checkboxOption,
                      filters.openOnly && styles.checkboxOptionActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        openOnly: !prev.openOnly,
                      }))
                    }
                  >
                    <Ionicons
                      name={filters.openOnly ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        filters.openOnly
                          ? theme.colors.black
                          : theme.colors.gray400
                      }
                    />
                    <Text
                      style={[
                        styles.checkboxLabel,
                        filters.openOnly && styles.checkboxLabelActive,
                      ]}
                    >
                      仅显示营业中
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.checkboxOption,
                      filters.hasPhone && styles.checkboxOptionActive,
                    ]}
                    onPress={() =>
                      setFilters((prev) => ({
                        ...prev,
                        hasPhone: !prev.hasPhone,
                      }))
                    }
                  >
                    <Ionicons
                      name={filters.hasPhone ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        filters.hasPhone
                          ? theme.colors.black
                          : theme.colors.gray400
                      }
                    />
                    <Text
                      style={[
                        styles.checkboxLabel,
                        filters.hasPhone && styles.checkboxLabelActive,
                      ]}
                    >
                      有联系电话
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetButtonText}>重置</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={closeFilters}
              >
                <Text style={styles.applyButtonText}>
                  查看 {filteredStores.length} 家店铺
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* 店铺详情 Bottom Sheet */}
      <Modal
        visible={showStoreDetail}
        animationType="none"
        transparent={true}
        onRequestClose={closeStoreDetail}
      >
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={closeStoreDetail}>
            <View style={styles.overlayTouchArea} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.sheetContainer,
              detailSheetStyle,
              { maxHeight: "85%" },
            ]}
          >
            <View style={styles.sheetHandle} />

            {selectedStore && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {selectedStore.name}
                    </Text>
                    <Text style={styles.sheetSubtitle}>
                      {selectedStore.city} · {selectedStore.country}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeStoreDetail}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.colors.gray500}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.sheetContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Status & Hours */}
                  <View style={styles.detailInfoBox}>
                    <View style={styles.detailRow}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: selectedStore.isOpen
                              ? "#27AE60"
                              : theme.colors.gray400,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: selectedStore.isOpen
                              ? "#27AE60"
                              : theme.colors.gray500,
                          },
                        ]}
                      >
                        {selectedStore.isOpen
                          ? "营业中"
                          : selectedStore.hours?.includes("需预约")
                          ? "需预约"
                          : "休息中"}
                      </Text>
                    </View>
                    {selectedStore.hours && (
                      <View style={styles.detailTextRow}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={theme.colors.gray500}
                          style={{ marginTop: 2 }}
                        />
                        <Text style={styles.detailTextContent}>
                          {selectedStore.hours}
                          {selectedStore.rest ? `\n${selectedStore.rest}` : ""}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Location */}
                  <TouchableOpacity
                    style={styles.detailInfoBox}
                    onPress={() => handleMapPress(selectedStore.address)}
                  >
                    <View style={styles.detailTextRow}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={theme.colors.black}
                      />
                      <Text
                        style={[
                          styles.detailTextContent,
                          { color: theme.colors.black, fontWeight: "500" },
                        ]}
                      >
                        {selectedStore.address}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.colors.gray400}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Phone */}
                  {selectedStore.phone && selectedStore.phone.length > 0 && (
                    <View style={styles.detailInfoBox}>
                      {selectedStore.phone.map((phone, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.detailTextRow,
                            idx > 0 && { marginTop: 12 },
                          ]}
                          onPress={() => handleCallPress(phone)}
                        >
                          <Ionicons
                            name="call-outline"
                            size={18}
                            color={theme.colors.black}
                          />
                          <Text
                            style={[
                              styles.detailTextContent,
                              { color: theme.colors.black },
                            ]}
                          >
                            {phone}
                          </Text>
                          <View style={styles.callButtonSmall}>
                            <Text style={styles.callButtonText}>拨打</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Styles */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>店铺风格</Text>
                    <View style={styles.detailTags}>
                      {selectedStore.style.map((s, idx) => (
                        <View key={idx} style={styles.detailTag}>
                          <Text style={styles.detailTagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Brands */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>主营品牌</Text>
                    <View style={styles.detailTags}>
                      {selectedStore.brands.map((brand, idx) => (
                        <View key={idx} style={styles.detailBrandTag}>
                          <Text style={styles.detailBrandText}>{brand}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={{ height: 100 }} />
                </ScrollView>

                {/* Fixed Bottom Actions */}
                <View style={styles.sheetFooter}>
                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={() => handleMapPress(selectedStore.address)}
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={20}
                      color={theme.colors.black}
                    />
                    <Text style={styles.secondaryActionText}>导航</Text>
                  </TouchableOpacity>

                  {selectedStore.phone && selectedStore.phone.length > 0 ? (
                    <TouchableOpacity
                      style={styles.primaryActionButton}
                      onPress={() => handleCallPress(selectedStore.phone![0])}
                    >
                      <Ionicons
                        name="call"
                        size={20}
                        color={theme.colors.white}
                      />
                      <Text style={styles.primaryActionText}>联系商家</Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        styles.primaryActionButton,
                        { backgroundColor: theme.colors.gray300 },
                      ]}
                    >
                      <Text style={styles.primaryActionText}>暂无联系方式</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Animated.View>
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
  headerContainer: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 22,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 15,
    color: theme.colors.black,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  filterButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 22,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.black,
  },
  filterBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E74C3C",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  filterBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: "bold",
  },
  quickFilterContainer: {
    paddingLeft: theme.spacing.md,
  },
  quickFilterScroll: {
    paddingRight: theme.spacing.md,
    alignItems: "center",
  },
  quickFilterTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickFilterTagActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  quickFilterText: {
    fontSize: 13,
    color: theme.colors.gray700,
    fontWeight: "500",
  },
  quickFilterTextActive: {
    color: theme.colors.white,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.gray300,
    marginRight: 8,
  },
  mapContainer: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  customMarker: {
    backgroundColor: theme.colors.black,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  closedMarker: {
    backgroundColor: theme.colors.gray500,
  },
  selectedMarker: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.black,
    borderWidth: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: 10,
    transform: [{ scale: 1.1 }],
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
  },
  selectedMarkerInner: {
    backgroundColor: theme.colors.black,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme.colors.black,
    alignSelf: "center",
    marginTop: -2,
  },

  // Store List Styles
  storesListContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  clearButton: {
    fontSize: 12,
    color: theme.colors.black,
    textDecorationLine: "underline",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  storesList: {
    paddingHorizontal: theme.spacing.md,
  },
  storeCard: {
    width: 280,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedStoreCard: {
    borderColor: theme.colors.black,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    flex: 1,
    marginRight: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  openBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  openBadgeText: {
    color: "#27AE60",
    fontSize: 10,
    fontWeight: "700",
  },
  closedBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedBadgeText: {
    color: theme.colors.gray500,
    fontSize: 10,
    fontWeight: "700",
  },
  storeAddress: {
    fontSize: 13,
    color: theme.colors.gray500,
    marginBottom: 12,
  },
  storeTagsRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  miniTag: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
  },
  miniTagText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "600",
  },
  storeBrands: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  brandText: {
    fontSize: 12,
    color: theme.colors.gray600,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerActions: {
    flexDirection: "row",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  navigateButton: {
    backgroundColor: theme.colors.black,
  },

  // Bottom Sheet Styles
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  overlayTouchArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get("window").height * 0.9,
    minHeight: 300,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  sheetFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    backgroundColor: theme.colors.white,
  },

  // Filter Styles
  filterSection: {
    marginTop: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: theme.colors.white,
    margin: 4,
  },
  filterOptionActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterOptionText: {
    fontSize: 14,
    color: theme.colors.black,
  },
  filterOptionTextActive: {
    color: theme.colors.white,
  },
  checkboxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
    paddingVertical: 8,
  },
  checkboxOptionActive: {
    opacity: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    color: theme.colors.gray700,
    marginLeft: 8,
  },
  checkboxLabelActive: {
    color: theme.colors.black,
    fontWeight: "500",
  },

  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    fontSize: 16,
    color: theme.colors.black,
    fontWeight: "600",
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    fontSize: 16,
    color: theme.colors.white,
    fontWeight: "600",
  },

  // Detail Styles
  detailInfoBox: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailTextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailTextContent: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.gray700,
    lineHeight: 22,
    marginLeft: 8,
  },
  callButtonSmall: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  callButtonText: {
    color: "#27AE60",
    fontSize: 12,
    fontWeight: "600",
  },
  detailSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 12,
  },
  detailTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  detailTag: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    margin: 4,
  },
  detailTagText: {
    fontSize: 12,
    color: theme.colors.white,
    fontWeight: "500",
  },
  detailBrandTag: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    margin: 4,
  },
  detailBrandText: {
    fontSize: 12,
    color: theme.colors.black,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.colors.black,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  primaryActionText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  secondaryActionText: {
    color: theme.colors.black,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default BuyerMapScreen;
