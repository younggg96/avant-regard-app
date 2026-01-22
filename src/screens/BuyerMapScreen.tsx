import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  TextInput,
  Dimensions,
  Modal,
  Linking,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  ScrollView as RNScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
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
  BuyerStore,
  getAllStores,
  getAllCities,
  getAllCountries,
  filterStores,
  getNearbyStores,
} from "../services/buyerStoreService";

interface FilterState {
  country: string;
  city: string;
  brand: string;
  styles: string[];
  openOnly: boolean;
  hasPhone: boolean;
}

interface UserLocation {
  latitude: number;
  longitude: number;
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

// 国家中英文映射
const COUNTRY_TRANSLATIONS: { [key: string]: string } = {
  中国: "China",
  以色列: "Israel",
  俄罗斯: "Russia",
  加拿大: "Canada",
  南非: "South Africa",
  台湾: "Taiwan",
  奥地利: "Austria",
  希腊: "Greece",
  德国: "Germany",
  意大利: "Italy",
  挪威: "Norway",
  新加坡: "Singapore",
  日本: "Japan",
  法国: "France",
  澳大利亚: "Australia",
  瑞典: "Sweden",
  瑞士: "Switzerland",
  罗马尼亚: "Romania",
  美国: "USA",
  芬兰: "Finland",
  英国: "UK",
  荷兰: "Netherlands",
  西班牙: "Spain",
  越南: "Vietnam",
  阿联酋: "UAE",
};

// 城市中英文映射
const CITY_TRANSLATIONS: { [key: string]: string } = {
  // 英文城市 → 中文
  Barcelona: "巴塞罗那",
  Berlin: "柏林",
  Birmingham: "伯明翰",
  Bucharest: "布加勒斯特",
  "Cape Town": "开普敦",
  Carpi: "卡尔皮",
  Chicago: "芝加哥",
  Dubai: "迪拜",
  Frankfurt: "法兰克福",
  Gothenburg: "哥德堡",
  Graz: "格拉茨",
  "Ha Noi": "河内",
  Hamburg: "汉堡",
  Helsinki: "赫尔辛基",
  Ibiza: "伊比萨",
  Kobe: "神户",
  Kyoto: "京都",
  Leeds: "利兹",
  Leicester: "莱斯特",
  Leipzig: "莱比锡",
  London: "伦敦",
  "Los Angeles": "洛杉矶",
  Lugano: "卢加诺",
  Madrid: "马德里",
  Mallorca: "马略卡",
  Milan: "米兰",
  Montréal: "蒙特利尔",
  Monza: "蒙扎",
  Moscow: "莫斯科",
  Munich: "慕尼黑",
  Mykonos: "米科诺斯",
  Nagoya: "名古屋",
  "New York": "纽约",
  Osaka: "大阪",
  Oslo: "奥斯陆",
  Padua: "帕多瓦",
  Paris: "巴黎",
  Rome: "罗马",
  Rotterdam: "鹿特丹",
  "San Francisco": "旧金山",
  Singapore: "新加坡",
  Sittard: "锡塔德",
  Sydney: "悉尼",
  Taipei: "台北",
  "Tel Aviv": "特拉维夫",
  Tokyo: "东京",
  Torino: "都灵",
  Toulouse: "图卢兹",
  Vienna: "维也纳",
  // 中文城市 → 英文
  上海: "Shanghai",
  北京: "Beijing",
  广州: "Guangzhou",
  杭州: "Hangzhou",
  深圳: "Shenzhen",
  香港: "Hong Kong",
};

// 获取显示名称（中英文）
const getCountryDisplayName = (country: string): string => {
  const translation = COUNTRY_TRANSLATIONS[country];
  return translation ? `${country} ${translation}` : country;
};

const getCityDisplayName = (city: string): string => {
  const translation = CITY_TRANSLATIONS[city];
  return translation ? `${city} ${translation}` : city;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BuyerMapScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showStoreDetail, setShowStoreDetail] = useState(false);
  const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [filteredStores, setFilteredStores] = useState<BuyerStore[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  // 默认北京坐标
  const [initialRegion, setInitialRegion] = useState({
    latitude: 39.9042,
    longitude: 116.4074,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const [filters, setFilters] = useState<FilterState>({
    country: "",
    city: "",
    brand: "",
    styles: [],
    openOnly: false,
    hasPhone: false,
  });

  // 动画值
  const filterSheetAnim = useRef(new Animated.Value(0)).current;
  const detailSheetAnim = useRef(new Animated.Value(0)).current;

  // 加载所有店铺和国家列表，并获取用户位置
  useEffect(() => {
    loadStores();
    loadCountries();
    initUserLocation();
  }, []);

  // 初始化用户位置
  const initUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const loc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(loc);
        setInitialRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 5,
          longitudeDelta: 5,
        });
        // 移动地图到用户位置
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 5,
            longitudeDelta: 5,
          });
        }
      }
    } catch (error) {
      console.log("无法获取用户位置，使用默认位置（北京）");
    }
  };

  // 当选择国家时，加载该国家的城市列表
  useEffect(() => {
    if (filters.country) {
      loadCities(filters.country);
    } else {
      setCities([]);
    }
  }, [filters.country]);

  const loadStores = async () => {
    try {
      setIsLoading(true);
      const data = await getAllStores();
      setStores(data);
      setFilteredStores(data);
    } catch (error) {
      console.error("Error loading stores:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const data = await getAllCountries();
      setCountries(data);
    } catch (error) {
      console.error("Error loading countries:", error);
    }
  };

  const loadCities = async (country?: string) => {
    try {
      const data = await getAllCities(country);
      setCities(data);
    } catch (error) {
      console.error("Error loading cities:", error);
    }
  };

  // 获取用户位置
  const getUserLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("位置权限", "需要位置权限来发现附近的店铺");
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const loc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(loc);
      return loc;
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("获取位置失败", "请确保已开启定位服务");
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  // 切换附近模式
  const toggleNearbyMode = useCallback(async () => {
    if (nearbyMode) {
      // 关闭附近模式，恢复显示所有店铺
      setNearbyMode(false);
      setFilteredStores(stores);
      // 重置地图视图
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: 45.5,
          longitude: 9.0,
          latitudeDelta: 20,
          longitudeDelta: 20,
        });
      }
    } else {
      // 开启附近模式
      let loc = userLocation;
      if (!loc) {
        loc = await getUserLocation();
      }
      if (loc) {
        setNearbyMode(true);
        // 获取附近店铺
        try {
          const nearbyStores = await getNearbyStores(loc, 100); // 100km 半径
          setFilteredStores(nearbyStores);
          // 移动地图到用户位置
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: loc.latitude,
              longitude: loc.longitude,
              latitudeDelta: 2,
              longitudeDelta: 2,
            });
          }
        } catch (error) {
          console.error("Error loading nearby stores:", error);
          // 如果 API 不支持，使用本地筛选
          const nearby = stores.filter((store) => {
            const distance = getDistanceFromLatLonInKm(
              loc!.latitude,
              loc!.longitude,
              store.coordinates.latitude,
              store.coordinates.longitude
            );
            return distance <= 100;
          });
          setFilteredStores(nearby);
        }
      }
    }
  }, [nearbyMode, userLocation, stores, getUserLocation]);

  // 计算两点之间的距离（公里）
  const getDistanceFromLatLonInKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371; // 地球半径（公里）
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  // 应用筛选（当不在附近模式时）
  useEffect(() => {
    if (!nearbyMode) {
      applyFilters();
    }
  }, [searchQuery, filters, stores, nearbyMode]);

  const applyFilters = async () => {
    try {
      let filtered = await filterStores({
        country: filters.country,
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

      // 如果选择了国家，自动移动地图到该国家的第一个店铺
      if (filters.country && filtered.length > 0 && mapRef.current) {
        const firstStore = filtered[0];
        mapRef.current.animateToRegion({
          latitude: firstStore.coordinates.latitude,
          longitude: firstStore.coordinates.longitude,
          latitudeDelta: 5,
          longitudeDelta: 5,
        });
      }
    } catch (error) {
      console.error("Error filtering stores:", error);
    }
  };

  // 计算各国家店铺数量
  const countryStoreCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    stores.forEach((store) => {
      counts[store.country] = (counts[store.country] || 0) + 1;
    });
    return counts;
  }, [stores]);

  // 计算各城市店铺数量
  const cityStoreCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const storesInCountry = filters.country
      ? stores.filter((s) => s.country === filters.country)
      : stores;
    storesInCountry.forEach((store) => {
      counts[store.city] = (counts[store.city] || 0) + 1;
    });
    return counts;
  }, [stores, filters.country]);

  // 按店铺数量排序的国家列表
  const sortedCountries = useMemo(() => {
    return [...countries].sort((a, b) => {
      const countA = countryStoreCounts[a] || 0;
      const countB = countryStoreCounts[b] || 0;
      return countB - countA;
    });
  }, [countries, countryStoreCounts]);

  // 按店铺数量排序的城市列表
  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      const countA = cityStoreCounts[a] || 0;
      const countB = cityStoreCounts[b] || 0;
      return countB - countA;
    });
  }, [cities, cityStoreCounts]);

  // 计算激活的筛选数量
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.country) count++;
    if (filters.city) count++;
    if (filters.brand) count++;
    if (filters.styles.length > 0) count++;
    if (filters.openOnly) count++;
    if (filters.hasPhone) count++;
    return count;
  }, [filters]);

  const handleStorePress = (store: BuyerStore) => {
    setSelectedStore(store);
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: store.coordinates.latitude,
        longitude: store.coordinates.longitude,
        latitudeDelta: 0.02,
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
      country: "",
      city: "",
      brand: "",
      styles: [],
      openOnly: false,
      hasPhone: false,
    });
    setSearchQuery("");
    setNearbyMode(false);
  };

  // 选择国家
  const handleCountrySelect = (country: string) => {
    if (filters.country === country) {
      // 取消选择
      setFilters((prev) => ({ ...prev, country: "", city: "" }));
    } else {
      // 选择新国家，清空城市
      setFilters((prev) => ({ ...prev, country, city: "" }));
    }
    setNearbyMode(false);
  };

  // 选择城市
  const handleCitySelect = (city: string) => {
    setFilters((prev) => ({
      ...prev,
      city: prev.city === city ? "" : city,
    }));
    setNearbyMode(false);
  };

  const toggleStyleFilter = (style: string) => {
    setFilters((prev) => {
      const newStyles = prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style];
      return { ...prev, styles: newStyles };
    });
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
        <Box
          w={isSelected ? 32 : 24}
          h={isSelected ? 32 : 24}
          rounded="$sm"
          bg={isSelected ? "$white" : store.isOpen ? "$black" : "$gray200"}
          borderWidth={isSelected ? 3 : 2}
          borderColor={isSelected ? "$black" : "$white"}
          justifyContent="center"
          alignItems="center"
          sx={styles.markerShadow}
        >
          <Box
            w={isSelected ? 10 : 8}
            h={isSelected ? 10 : 8}
            rounded="$sm"
            bg={isSelected ? "$black" : "$white"}
          />
        </Box>
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
      {/* 搜索栏 */}
      <Box px="$md" pb="$sm">
        <HStack alignItems="center" gap="$sm">
          <Box
            flex={1}
            flexDirection="row"
            alignItems="center"
            bg="$gray100"
            rounded="$sm"
            px="$md"
            h={44}
          >
            <Ionicons
              name="search"
              size={20}
              color={theme.colors.gray200}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索品牌、店铺或风格..."
              placeholderTextColor={theme.colors.gray200}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.gray200}
                />
              </Pressable>
            ) : null}
          </Box>
          <Pressable
            w={44}
            h={44}
            rounded="$sm"
            bg={activeFilterCount > 0 ? "$black" : "$white"}
            borderWidth={1}
            borderColor={activeFilterCount > 0 ? "$black" : "$gray100"}
            justifyContent="center"
            alignItems="center"
            onPress={openFilters}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={activeFilterCount > 0 ? theme.colors.white : theme.colors.black}
            />
            {activeFilterCount > 0 && (
              <Box
                position="absolute"
                top={-4}
                right={-4}
                w={16}
                h={16}
                rounded="$sm"
                bg="$error"
                justifyContent="center"
                alignItems="center"
              >
                <Text color="$white" fontSize="$xs" fontWeight="$medium" lineHeight={16}>
                  {activeFilterCount}
                </Text>
              </Box>
            )}
          </Pressable>
        </HStack>
      </Box>

      {/* 快速筛选标签 - 浮在地图上方 */}
      <Box
        position="absolute"
        top={110}
        left={0}
        right={0}
        zIndex={10}
        sx={{ elevation: 5 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm
          }}
        >
          {/* 附近按钮 */}
          <Pressable
            flexDirection="row"
            alignItems="center"
            px="$md"
            py="$xs"
            rounded="$sm"
            bg={nearbyMode ? "$black" : "$white"}
            mr="$sm"
            onPress={toggleNearbyMode}
            opacity={isLoadingLocation ? 0.6 : 1}
            disabled={isLoadingLocation}
            sx={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color={nearbyMode ? theme.colors.white : theme.colors.black} />
            ) : (
              <Ionicons
                name="location"
                size={14}
                color={nearbyMode ? theme.colors.white : theme.colors.black}
              />
            )}
            <Text
              color={nearbyMode ? "$white" : "$black"}
              fontSize="$sm"
              fontWeight="$medium"
              ml="$xs"
            >
              附近
            </Text>
          </Pressable>

          {/* 营业中按钮 */}
          <Pressable
            flexDirection="row"
            alignItems="center"
            px="$md"
            py="$xs"
            rounded="$sm"
            bg={filters.openOnly ? "$black" : "$white"}
            mr="$sm"
            onPress={() => setFilters((prev) => ({ ...prev, openOnly: !prev.openOnly }))}
            sx={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={filters.openOnly ? theme.colors.white : theme.colors.black}
            />
            <Text
              color={filters.openOnly ? "$white" : "$black"}
              fontSize="$sm"
              fontWeight="$medium"
              ml="$xs"
            >
              营业中
            </Text>
          </Pressable>

          <Box w={1} h={16} bg="$gray200" mr="$sm" alignSelf="center" />

          {/* 国家选择（按数量排序） */}
          {sortedCountries.map((country) => (
            <Pressable
              key={country}
              flexDirection="row"
              alignItems="center"
              px="$md"
              py="$xs"
              rounded="$sm"
              bg={filters.country === country ? "$black" : "$white"}
              mr="$sm"
              onPress={() => handleCountrySelect(country)}
              sx={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons
                name="globe-outline"
                size={12}
                color={filters.country === country ? theme.colors.white : theme.colors.gray300}
                style={{ marginRight: 4 }}
              />
              <Text
                color={filters.country === country ? "$white" : "$black"}
                fontSize="$sm"
                fontWeight="$medium"
              >
                {getCountryDisplayName(country)}
              </Text>
              {countryStoreCounts[country] && (
                <Text
                  color={filters.country === country ? "$gray100" : "$gray300"}
                  fontSize="$xs"
                  ml="$xs"
                >
                  {countryStoreCounts[country]}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* 城市选择（仅在选择国家后显示，按数量排序） */}
        {filters.country && sortedCities.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.sm
            }}
          >
            {sortedCities.slice(0, 15).map((city) => (
              <Pressable
                key={city}
                flexDirection="row"
                alignItems="center"
                px="$md"
                py="$xs"
                rounded="$sm"
                bg={filters.city === city ? "$black" : "$white"}
                borderWidth={1}
                borderColor={filters.city === city ? "$black" : "$gray100"}
                mr="$sm"
                onPress={() => handleCitySelect(city)}
                sx={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text
                  color={filters.city === city ? "$white" : "$black"}
                  fontSize="$sm"
                  fontWeight="$medium"
                >
                  {getCityDisplayName(city)}
                </Text>
                {cityStoreCounts[city] && (
                  <Text
                    color={filters.city === city ? "$gray100" : "$gray300"}
                    fontSize="$xs"
                    ml="$xs"
                  >
                    {cityStoreCounts[city]}
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Box>

      {/* 地图视图 */}
      <Box flex={1}>
        {isLoading ? (
          <VStack flex={1} justifyContent="center" alignItems="center">
            <ActivityIndicator size="small" color={theme.colors.black} />
            <Text color="$gray300" mt="$md">加载中...</Text>
          </VStack>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            rotateEnabled={false}
          >
            {filteredStores.map(renderMarker)}
          </MapView>
        )}
      </Box>

      {/* 底部店铺列表 */}
      <Box position="absolute" bottom={20} left={0} right={0}>
        <HStack
          justifyContent="between"
          alignItems="center"
          px="$md"
          mb="$sm"
        >
          <Box bg="rgba(255,255,255,0.95)" px="$sm" py="$xs" rounded="$sm">
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              发现 {filteredStores.length} 家好店
            </Text>
          </Box>
          <HStack gap="$sm">
            {activeFilterCount > 0 && (
              <Pressable
                bg="rgba(255,255,255,0.95)"
                px="$sm"
                py="$xs"
                rounded="$sm"
                onPress={resetFilters}
              >
                <Text fontSize="$xs" color="$black" textDecorationLine="underline">
                  清除筛选
                </Text>
              </Pressable>
            )}
            <Pressable
              bg="rgba(255,255,255,0.95)"
              px="$md"
              py="$xs"
              rounded="$sm"
              flexDirection="row"
              alignItems="center"
              onPress={() => (navigation.navigate as any)("SubmitStore")}
            >
              <Ionicons name="add" size={14} color={theme.colors.black} />
              <Text fontSize="$xs" fontWeight="$semibold" color="$black" ml="$xs">
                上传
              </Text>
            </Pressable>
            <Pressable
              bg="$black"
              px="$md"
              py="$xs"
              rounded="$sm"
              flexDirection="row"
              alignItems="center"
              onPress={() => (navigation.navigate as any)("StoreList")}
            >
              <Ionicons name="list" size={14} color={theme.colors.white} />
              <Text fontSize="$xs" fontWeight="$semibold" color="$white" ml="$xs">
                全部
              </Text>
            </Pressable>
          </HStack>
        </HStack>

        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
          snapToInterval={280 + theme.spacing.sm}
          decelerationRate="fast"
        >
          {filteredStores.map((store) => (
            <Pressable
              key={store.id}
              w={280}
              bg="$white"
              rounded="$lg"
              p="$md"
              mr="$sm"
              borderWidth={selectedStore?.id === store.id ? 2 : 0}
              borderColor="$black"
              sx={styles.cardShadow}
              onPress={() => handleStorePress(store)}
              onLongPress={() => handleStoreDetailPress(store)}
            >
              {/* 店铺头部 */}
              <HStack justifyContent="between" alignItems="start" mb="$sm">
                <Text
                  fontSize="$lg"
                  fontWeight="$bold"
                  color="$black"
                  flex={1}
                  mr="$sm"
                  numberOfLines={1}
                >
                  {store.name}
                </Text>
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
              <Text fontSize="$sm" color="$gray300" mb="$sm" numberOfLines={1}>
                {store.city} · {store.address}
              </Text>

              {/* 风格标签 */}
              <HStack mb="$sm" gap="$xs">
                {store.style.slice(0, 2).map((s, idx) => (
                  <Box key={idx} bg="$black" px="$sm" py="$xs" rounded="$sm">
                    <Text fontSize="$xs" color="$white" fontWeight="$medium">
                      {s}
                    </Text>
                  </Box>
                ))}
              </HStack>

              {/* 品牌 */}
              <Box
                pb="$sm"
                mb="$sm"
                borderBottomWidth={1}
                borderBottomColor="$gray100"
              >
                <Text fontSize="$xs" color="$gray300" numberOfLines={1} fontStyle="italic">
                  {store.brands.join(" / ") || "暂无品牌信息"}
                </Text>
              </Box>

              {/* 操作按钮 */}
              <HStack justifyContent="between" alignItems="center">
                <Pressable
                  w={36}
                  h={36}
                  rounded="$sm"
                  bg="$gray100"
                  justifyContent="center"
                  alignItems="center"
                  onPress={() => (navigation.navigate as any)("StoreDetail", { storeId: store.id })}
                >
                  <Ionicons name="information-circle-outline" size={20} color={theme.colors.black} />
                </Pressable>
                <HStack gap="$sm">
                  {store.phone && store.phone.length > 0 && (
                    <Pressable
                      w={36}
                      h={36}
                      rounded="$sm"
                      bg="$gray100"
                      justifyContent="center"
                      alignItems="center"
                      onPress={() => handleCallPress(store.phone![0])}
                    >
                      <Ionicons name="call-outline" size={18} color={theme.colors.black} />
                    </Pressable>
                  )}
                  <Pressable
                    w={36}
                    h={36}
                    rounded="$sm"
                    bg="$black"
                    justifyContent="center"
                    alignItems="center"
                    onPress={() => handleMapPress(store.address)}
                  >
                    <Ionicons name="navigate" size={16} color={theme.colors.white} />
                  </Pressable>
                </HStack>
              </HStack>
            </Pressable>
          ))}
        </RNScrollView>
      </Box>

      {/* 筛选 Bottom Sheet */}
      <Modal
        visible={showFilters}
        animationType="none"
        transparent={true}
        onRequestClose={closeFilters}
      >
        <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
          <TouchableWithoutFeedback onPress={closeFilters}>
            <Box flex={1} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sheetContainer, filterSheetStyle]}>
            <Box w={40} h={4} bg="$gray100" rounded="$sm" alignSelf="center" mt="$sm" mb="$sm" />

            <HStack
              justifyContent="between"
              alignItems="center"
              px="$lg"
              pb="$md"
              borderBottomWidth={1}
              borderBottomColor="$gray100"
            >
              <Text fontSize="$lg" fontWeight="$bold" color="$black">
                筛选条件
              </Text>
              <Pressable onPress={closeFilters}>
                <Ionicons name="close" size={24} color={theme.colors.gray300} />
              </Pressable>
            </HStack>

            <RNScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {/* 国家筛选（按数量排序） */}
              <VStack mt="$lg">
                <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                  国家 / Country
                </Text>
                <HStack flexWrap="wrap" gap="$xs">
                  {sortedCountries.map((country) => (
                    <Pressable
                      key={country}
                      px="$md"
                      py="$sm"
                      rounded="$sm"
                      borderWidth={1}
                      borderColor={filters.country === country ? "$black" : "$gray100"}
                      bg={filters.country === country ? "$black" : "$white"}
                      mb="$xs"
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          country: prev.country === country ? "" : country,
                          city: prev.country === country ? prev.city : "", // 切换国家时清空城市
                        }))
                      }
                    >
                      <Text
                        fontSize="$sm"
                        color={filters.country === country ? "$white" : "$black"}
                      >
                        {getCountryDisplayName(country)}{" "}
                        <Text fontSize="$xs" style={{ opacity: 0.7 }}>
                          {countryStoreCounts[country]}
                        </Text>
                      </Text>
                    </Pressable>
                  ))}
                </HStack>
              </VStack>

              {/* 城市筛选（按数量排序） */}
              {sortedCities.length > 0 && (
                <VStack mt="$lg">
                  <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                    城市 / City {filters.country && <Text fontSize="$xs" color="$gray300">({filters.country})</Text>}
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {sortedCities.map((city) => (
                      <Pressable
                        key={city}
                        px="$md"
                        py="$sm"
                        rounded="$sm"
                        borderWidth={1}
                        borderColor={filters.city === city ? "$black" : "$gray100"}
                        bg={filters.city === city ? "$black" : "$white"}
                        mb="$xs"
                        onPress={() =>
                          setFilters((prev) => ({
                            ...prev,
                            city: prev.city === city ? "" : city,
                          }))
                        }
                      >
                        <Text
                          fontSize="$sm"
                          color={filters.city === city ? "$white" : "$black"}
                        >
                          {getCityDisplayName(city)}{" "}
                          <Text fontSize="$xs" style={{ opacity: 0.7 }}>
                            {cityStoreCounts[city]}
                          </Text>
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              )}

              {/* 热门品牌筛选 */}
              <VStack mt="$lg">
                <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                  热门品牌
                </Text>
                <HStack flexWrap="wrap" gap="$xs">
                  {POPULAR_BRANDS.map((brand) => (
                    <Pressable
                      key={brand}
                      px="$md"
                      py="$sm"
                      rounded="$sm"
                      borderWidth={1}
                      borderColor={filters.brand === brand ? "$black" : "$gray100"}
                      bg={filters.brand === brand ? "$black" : "$white"}
                      mb="$xs"
                      onPress={() =>
                        setFilters((prev) => ({
                          ...prev,
                          brand: prev.brand === brand ? "" : brand,
                        }))
                      }
                    >
                      <Text
                        fontSize="$sm"
                        color={filters.brand === brand ? "$white" : "$black"}
                      >
                        {brand}
                      </Text>
                    </Pressable>
                  ))}
                </HStack>
              </VStack>

              {/* 风格分类筛选 */}
              {Object.entries(STYLE_CATEGORIES).map(([category, categoryStyles]) => (
                <VStack key={category} mt="$lg">
                  <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                    {category}
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {categoryStyles.map((styleItem) => (
                      <Pressable
                        key={styleItem}
                        px="$md"
                        py="$sm"
                        rounded="$sm"
                        borderWidth={1}
                        borderColor={filters.styles.includes(styleItem) ? "$black" : "$gray100"}
                        bg={filters.styles.includes(styleItem) ? "$black" : "$white"}
                        mb="$xs"
                        onPress={() => toggleStyleFilter(styleItem)}
                      >
                        <Text
                          fontSize="$sm"
                          color={filters.styles.includes(styleItem) ? "$white" : "$black"}
                        >
                          {styleItem}
                        </Text>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              ))}

              {/* 其他条件 */}
              <VStack mt="$lg" mb="$2xl">
                <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$sm">
                  更多选项
                </Text>
                <HStack gap="$lg">
                  <Pressable
                    flexDirection="row"
                    alignItems="center"
                    onPress={() =>
                      setFilters((prev) => ({ ...prev, openOnly: !prev.openOnly }))
                    }
                  >
                    <Ionicons
                      name={filters.openOnly ? "checkbox" : "square-outline"}
                      size={20}
                      color={filters.openOnly ? theme.colors.black : theme.colors.gray200}
                    />
                    <Text
                      ml="$sm"
                      fontSize="$md"
                      color={filters.openOnly ? "$black" : "$gray300"}
                      fontWeight={filters.openOnly ? "$medium" : "$normal"}
                    >
                      仅显示营业中
                    </Text>
                  </Pressable>

                  <Pressable
                    flexDirection="row"
                    alignItems="center"
                    onPress={() =>
                      setFilters((prev) => ({ ...prev, hasPhone: !prev.hasPhone }))
                    }
                  >
                    <Ionicons
                      name={filters.hasPhone ? "checkbox" : "square-outline"}
                      size={20}
                      color={filters.hasPhone ? theme.colors.black : theme.colors.gray200}
                    />
                    <Text
                      ml="$sm"
                      fontSize="$md"
                      color={filters.hasPhone ? "$black" : "$gray300"}
                      fontWeight={filters.hasPhone ? "$medium" : "$normal"}
                    >
                      有联系电话
                    </Text>
                  </Pressable>
                </HStack>
              </VStack>
            </RNScrollView>

            <HStack
              p="$lg"
              borderTopWidth={1}
              borderTopColor="$gray100"
              bg="$white"
              gap="$sm"
            >
              <Pressable
                flex={1}
                py="$md"
                rounded="$sm"
                borderWidth={1}
                borderColor="$gray100"
                alignItems="center"
                justifyContent="center"
                onPress={resetFilters}
              >
                <Text fontSize="$md" fontWeight="$semibold" color="$black">
                  重置
                </Text>
              </Pressable>
              <Pressable
                flex={2}
                py="$md"
                rounded="$sm"
                bg="$black"
                alignItems="center"
                justifyContent="center"
                onPress={closeFilters}
              >
                <Text fontSize="$md" fontWeight="$semibold" color="$white">
                  查看 {filteredStores.length} 家店铺
                </Text>
              </Pressable>
            </HStack>
          </Animated.View>
        </Box>
      </Modal>

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
            <Box w={40} h={4} bg="$gray100" rounded="$sm" alignSelf="center" mt="$sm" mb="$sm" />

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
                        rounded="$sm"
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
                          {selectedStore.hours}
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
                    rounded="$sm"
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
                      rounded="$sm"
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
                      rounded="$sm"
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
    fontSize: 15,
    color: theme.colors.black,
    paddingVertical: 0,
  },
  map: {
    flex: 1,
  },
  markerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sheetContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get("window").height * 0.9,
    minHeight: 300,
    paddingBottom: 34,
  },
});

export default BuyerMapScreen;
