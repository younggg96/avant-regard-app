import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Dimensions,
  Modal,
  Linking,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  ScrollView as RNScrollView,
  ActivityIndicator,
  Alert,
  Image,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import { useMapLoadingGif } from "../utils/loadingGifs";
import {
  BuyerStore,
  getStoresPaginated,
  getAllCities,
  getAllCountries,
  filterStores,
  getNearbyStores,
  getStoresInViewport,
  hasValidCoordinates,
} from "../services/buyerStoreService";
import { useStoreFavorites } from "../hooks/useStoreFavorites";
import { useMapFocusStore } from "../store/mapFocusStore";
import { useTranslation } from "react-i18next";

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

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
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

// 风格分类 - keys are i18n'd in the render function
const STYLE_CATEGORIES_DATA: { key: string; styles: string[] }[] = [
  { key: "map.styleDesigner", styles: ["先锋", "暗黑", "工匠", "极简"] },
  { key: "map.styleVintage", styles: ["vintage", "archive", "中古", "美式复古", "美式vintage"] },
  { key: "map.styleUnique", styles: ["日系", "女装", "哥特", "视觉系", "亚文化", "银饰"] },
  { key: "map.styleCollection", styles: ["设计师品牌", "设计师品牌集合店", "集合店"] },
];

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

const SEARCH_BAR_HEIGHT = 48; // 40px input + 8px bottom padding

/**
 * 单个买手店的 marker。
 *
 * 为什么单独抽成组件 + 内部 `tracksViewChanges` state？
 * react-native-maps 在 iOS (PROVIDER_DEFAULT = Apple Maps) 上有一个长期已知问题：
 * 如果 `<Marker>` 直接给自定义 children `<View>` 又把 `tracksViewChanges`
 * 写死 `false`，首次挂载时原生层来不及对自定义 View 测量截图，marker 就被
 * 注册成"空的"——位置在地图上但视觉完全不可见。
 *
 * 标准修法：挂载时先 `tracksViewChanges=true` 让原生层抓一帧位图缓存，
 * 800ms 后切回 `false` 释放性能（marker 多时这步至关重要，否则每一帧都重抓
 * 位图会拖到 5fps）。当 marker 的视觉状态变化（选中 / 置灰 / 开关切换）时
 * 再重新打开一次 track，让缓存更新。
 */
interface StoreMarkerProps {
  store: BuyerStore & { coordinates: NonNullable<BuyerStore["coordinates"]> };
  isSelected: boolean;
  isDimmed: boolean;
  markerStyle: any;
  onPress: (store: BuyerStore) => void;
  registerRef: (ref: any) => void;
}

function StoreMarker({
  store,
  isSelected,
  isDimmed,
  markerStyle,
  onPress,
  registerRef,
}: StoreMarkerProps) {
  const t = useAppTheme();
  // 首次挂载时打开 track，让原生层把自定义 View 截一帧
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    if (!tracksViewChanges) return;
    const timer = setTimeout(() => setTracksViewChanges(false), 800);
    return () => clearTimeout(timer);
  }, [tracksViewChanges]);

  // 视觉状态变了 → 重新打开 track 把新外观刷进去
  useEffect(() => {
    setTracksViewChanges(true);
  }, [isSelected, isDimmed, store.isOpen, t.mode]);

  const size = isSelected ? 32 : 24;
  const innerSize = isSelected ? 10 : 8;

  // marker 三种状态：
  //   - selected: 反色（在 light 上 = 白底黑边，在 dark 上 = 黑底白边），最醒目
  //   - open: 默认色（light 下黑底白边；dark 下白底黑边）—— 在两种地图样式上都能看清
  //   - closed: 半弱化的中性灰，不与营业店争视觉
  //   - dimmed: 用 token gray200（light=#AAA, dark=#3A3A3A），靠 opacity=0.3 加上"被
  //     筛掉"的语义；写死 #CCCCCC 在 dark 下反而比正常 marker 更亮，语义会反过来。
  const bodyColor = isSelected
    ? t.colors.white
    : isDimmed
      ? t.colors.gray200
      : store.isOpen
        ? t.colors.black
        : t.colors.gray200;
  const borderColor = isSelected ? t.colors.black : t.colors.white;
  const innerColor = isSelected ? t.colors.black : t.colors.white;

  return (
    <Marker
      ref={registerRef}
      coordinate={store.coordinates}
      title={store.name}
      description={store.address}
      onPress={() => onPress(store)}
      zIndex={isSelected ? 999 : isDimmed ? 0 : 1}
      tracksViewChanges={tracksViewChanges}
      opacity={isDimmed ? 0.3 : 1}
    >
      <View
        style={[
          markerStyle,
          {
            width: size,
            height: size,
            backgroundColor: bodyColor,
            borderWidth: isSelected ? 3 : 2,
            borderColor,
          },
        ]}
      >
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: innerColor,
          }}
        />
      </View>
    </Marker>
  );
}

const BuyerMapScreen = ({ embedded }: { embedded?: boolean }) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const mapLoadingGif = useMapLoadingGif();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isFavorited, toggleFavorite, getFavoriteCount, syncCountsFromStores } = useStoreFavorites();
  const mapRef = useRef<MapView>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showStoreDetail, setShowStoreDetail] = useState(false);
  const [selectedStore, setSelectedStore] = useState<BuyerStore | null>(null);
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [filteredStores, setFilteredStores] = useState<BuyerStore[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 首次 stores / countries 加载失败时的错误文案。用于渲染"加载失败 + 点击重试"占位。
  // 成功加载后会被清空；只针对首屏，视口更新/附近更新的失败不改动这个 state，避免把
  // 局部错误放大成全屏 fallback。
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [visibleStores, setVisibleStores] = useState<BuyerStore[]>([]);
  const [currentMapRegion, setCurrentMapRegion] = useState<MapRegion | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomScrollRef = useRef<RNScrollView>(null);
  const markerRefs = useRef<{ [key: string]: any }>({});
  const shouldScrollToSelected = useRef(false);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 39.9042,
    longitude: 116.4074,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  });
  const [filters, setFilters] = useState<FilterState>({
    country: "",
    city: "",
    brand: "",
    styles: [],
    openOnly: false,
    hasPhone: false,
  });

  // ---- Dark-mode 友好的"浮在地图上"表面 ----
  // theme.colors.white 在 dark mode 下会被 invert 成 #0A0A0A（近黑），跟 Apple Maps
  // dark theme 的地图背景几乎同色，chip / 浮动药丸的视觉边界就消失了。
  // 这里用一个 mode 相关的半透明灰白：light 模式下接近原来的白色磨砂，dark 模式下
  // 用一个比地图背景稍亮的灰，避免控件"沉进"地图。
  const isDark = theme.mode === "dark";
  const floatingPillBg = isDark ? "rgba(38,38,38,0.92)" : "rgba(255,255,255,0.95)";
  const floatingPillBorder = isDark ? theme.colors.border : "transparent";

  // 动画值
  const filterSheetAnim = useRef(new Animated.Value(0)).current;
  const detailSheetAnim = useRef(new Animated.Value(0)).current;

  // 加载所有店铺和国家列表，并获取用户位置
  useEffect(() => {
    loadInitialData();
  }, []);

  // 首屏初始化：并发拉 stores + countries + 定位，任一首屏必需数据失败都要展示
  // 错误占位。抽出来是为了"点击重试"时能直接调用（而不是 reload 整个 Screen）。
  const loadInitialData = () => {
    loadStores();
    loadCountries();
    initUserLocation();
  };

  const initUserLocation = async () => {
    try {
      setIsLoadingLocation(true);
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

        const nearbyRegion = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 2,
          longitudeDelta: 2,
        };
        setInitialRegion(nearbyRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(nearbyRegion, 600);
        }

        // 默认开启附近模式
        setNearbyMode(true);
        try {
          const nearbyStores = await getNearbyStores(loc, 100);
          setFilteredStores(nearbyStores);
        } catch {
          // API 不支持时使用本地筛选（stores 可能还在加载，后续 effect 会刷新）
        }
      }
    } catch (error) {
      console.log("无法获取用户位置，使用默认位置");
    } finally {
      setIsLoadingLocation(false);
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

  const storesLoadedRef = useRef(false);
  /** 每页条数（API 上限 200）。首屏只等第一页，其余后台补齐。 */
  const STORE_PAGE_SIZE = 200;
  /** 后台补齐的安全阀：最多再拉 99 页，防止后端异常时死循环。 */
  const STORE_MAX_PAGES = 100;

  /**
   * 后台补齐剩余页（第 2 页起，串行）。
   * 任何一页失败只打 log —— 首屏已经有第一页数据可用，剩余 marker
   * 属于渐进增强，不该把整个地图打成错误态。
   */
  const loadRemainingStores = async () => {
    const extra: BuyerStore[] = [];
    try {
      for (let page = 2; page <= STORE_MAX_PAGES; page++) {
        const result = await getStoresPaginated({
          page,
          pageSize: STORE_PAGE_SIZE,
        });
        extra.push(...result.stores);
        if (result.stores.length < STORE_PAGE_SIZE) break;
      }
    } catch (error) {
      console.warn("后台补齐买手店目录失败（首屏不受影响）:", error);
    }
    if (extra.length > 0) {
      syncCountsFromStores(extra);
      setStores((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...extra.filter((s) => !seen.has(s.id))];
      });
    }
  };

  const loadStores = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      // 首屏只等第一页：一次请求（~200 家）就足够铺开地图主要城市的
      // marker。原先的 getAllStores 会串行拉完整张目录（4+ 次请求），
      // 弱网下任何一页超时都会让整个地图卡在 loading 直至报错。
      const first = await getStoresPaginated({
        page: 1,
        pageSize: STORE_PAGE_SIZE,
      });
      setStores(first.stores);
      syncCountsFromStores(first.stores);
      storesLoadedRef.current = true;
      setIsLoading(false);
      if (currentMapRegion) {
        fetchVisibleStores(currentMapRegion);
      }
      // 剩余页后台静默补齐，不阻塞首屏、失败不报错。
      if (first.stores.length === STORE_PAGE_SIZE) {
        loadRemainingStores();
      }
    } catch (error) {
      console.error("Error loading stores:", error);
      setLoadError(
        error instanceof Error
          ? error.message || t("store.loadFailed")
          : t("store.loadFailed")
      );
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
        Alert.alert(t("map.locationPermission"), t("map.locationPermissionMessage"));
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
      Alert.alert(t("map.locationFailed"), t("map.enableLocationService"));
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  // 切换附近模式
  const toggleNearbyMode = useCallback(async () => {
    if (nearbyMode) {
      setNearbyMode(false);
      setFilteredStores(stores);
      if (mapRef.current && userLocation) {
        mapRef.current.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.8,
          longitudeDelta: 0.8,
        }, 600);
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
            if (!hasValidCoordinates(store)) return false;
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

  // 根据地图区域计算视口边界
  const getViewportBounds = useCallback((region: MapRegion) => {
    return {
      ne_lat: region.latitude + region.latitudeDelta / 2,
      ne_lng: region.longitude + region.longitudeDelta / 2,
      sw_lat: region.latitude - region.latitudeDelta / 2,
      sw_lng: region.longitude - region.longitudeDelta / 2,
    };
  }, []);

  // 获取视口内的店铺（通过后端 API）
  const fetchVisibleStores = useCallback(
    async (region: MapRegion) => {
      try {
        const bounds = getViewportBounds(region);
        const stores = await getStoresInViewport({
          ...bounds,
          country: filters.country || undefined,
          city: filters.city || undefined,
          brand: filters.brand || undefined,
          style: filters.styles.length === 1 ? filters.styles[0] : undefined,
          styles: filters.styles.length > 1 ? filters.styles : undefined,
          openOnly: filters.openOnly || undefined,
          hasPhone: filters.hasPhone || undefined,
          searchQuery: debouncedSearchQuery || undefined,
        });
        setVisibleStores(stores);
      } catch (error) {
        console.error("Error fetching viewport stores:", error);
        // 降级方案：从已加载的 filteredStores 中本地筛选
        const bounds = getViewportBounds(region);
        const localVisible = filteredStores.filter((store) => {
          if (!hasValidCoordinates(store)) return false;
          const { latitude, longitude } = store.coordinates;
          return (
            latitude >= bounds.sw_lat &&
            latitude <= bounds.ne_lat &&
            longitude >= bounds.sw_lng &&
            longitude <= bounds.ne_lng
          );
        });
        setVisibleStores(localVisible);
      }
    },
    [filters, debouncedSearchQuery, filteredStores, getViewportBounds]
  );

  // 地图区域变化回调（带防抖）
  const handleRegionChangeComplete = useCallback(
    (region: MapRegion) => {
      setCurrentMapRegion(region);
      // 防抖：避免频繁请求
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
      viewportDebounceRef.current = setTimeout(() => {
        fetchVisibleStores(region);
      }, 300);
    },
    [fetchVisibleStores]
  );

  // 店铺数据和用户位置都就绪后，立即计算附近可见店铺
  useEffect(() => {
    if (stores.length > 0 && userLocation && !currentMapRegion) {
      const initRegion: MapRegion = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.8,
        longitudeDelta: 0.8,
      };
      fetchVisibleStores(initRegion);
    }
  }, [stores, userLocation]);

  // 当筛选条件变化时，重新获取视口内店铺
  useEffect(() => {
    if (currentMapRegion) {
      fetchVisibleStores(currentMapRegion);
    }
  }, [filters, debouncedSearchQuery, nearbyMode]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

  const handleSearchPress = useCallback(() => {
    // 在地图上下文里发起的搜索：让搜索屏知道用户点中结果时应当把"待聚焦"
    // 信号写进 mapFocusStore，并 navigate 回地图，而不是默认地跳到 StoreDetail。
    (navigation.navigate as any)("StoreSearch", { mode: "locate" });
  }, [navigation]);

  // 把地图视口动画 + 打开 callout 抽成一个稳定的回调，给从搜索回来时复用。
  // 注意：marker 必须先被渲染（即对应的 store 出现在 `stores` 里），否则
  // `markerRefs.current[id]` 是空的，showCallout 会无声失败。因此渲染层
  // 还得把 selectedStore 临时插到 marker 集合里（见下面的 renderedMarkerStores）。
  const focusOnStore = useCallback((store: BuyerStore) => {
    if (!hasValidCoordinates(store)) return;
    setSelectedStore(store);
    shouldScrollToSelected.current = true;
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: store.coordinates.latitude,
          longitude: store.coordinates.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
    // 等地图飞过去 + marker mount 之后再开 callout。600ms 经验值，
    // 与 StoreMarker 内部 tracksViewChanges=true 抓首帧的 800ms 同量级即可。
    setTimeout(() => {
      markerRefs.current[store.id]?.showCallout();
    }, 600);
  }, []);

  // 订阅"待聚焦"信号：搜索屏 requestFocus → 这里消费并飞过去。
  useEffect(() => {
    const unsub = useMapFocusStore.subscribe((state, prev) => {
      if (state.pending && state.pending !== prev.pending) {
        const store = state.pending;
        useMapFocusStore.setState({ pending: null });
        focusOnStore(store);
      }
    });
    return unsub;
  }, [focusOnStore]);

  // 首挂载时也消费一次：覆盖"BuyerMapScreen 还没挂载就被压入信号"的边角情况
  // （例如用户初次从其它入口直接进入买手店 Tab 时）。
  useEffect(() => {
    const pending = useMapFocusStore.getState().consume();
    if (pending) {
      // 让 map / 子组件先完成首挂载，再触发动画，避免 ref 还没绑就 showCallout。
      const timer = setTimeout(() => focusOnStore(pending), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 应用筛选
  useEffect(() => {
    if (nearbyMode && userLocation && stores.length > 0) {
      // 附近模式：用本地数据刷新附近店铺
      const nearby = stores.filter((store) => {
        if (!hasValidCoordinates(store)) return false;
        const distance = getDistanceFromLatLonInKm(
          userLocation.latitude,
          userLocation.longitude,
          store.coordinates.latitude,
          store.coordinates.longitude
        );
        return distance <= 100;
      });
      setFilteredStores(nearby);
    } else if (!nearbyMode) {
      applyFilters();
    }
  }, [debouncedSearchQuery, filters, stores, nearbyMode]);

  const applyFilters = async () => {
    try {
      let filtered = await filterStores({
        country: filters.country,
        city: filters.city,
        brand: filters.brand,
        style: filters.styles.length === 1 ? filters.styles[0] : "",
        openOnly: filters.openOnly,
        searchQuery: debouncedSearchQuery,
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
        if (firstStore.coordinates) {
          mapRef.current.animateToRegion({
            latitude: firstStore.coordinates.latitude,
            longitude: firstStore.coordinates.longitude,
            latitudeDelta: 5,
            longitudeDelta: 5,
          });
        }
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

  const displayStores = useMemo(() => {
    if (!selectedStore) return visibleStores;
    if (visibleStores.some(s => s.id === selectedStore.id)) return visibleStores;
    return [selectedStore, ...visibleStores];
  }, [visibleStores, selectedStore]);

  useEffect(() => {
    if (!shouldScrollToSelected.current || !selectedStore || !bottomScrollRef.current) return;
    const idx = displayStores.findIndex(s => s.id === selectedStore.id);
    if (idx >= 0) {
      const cardInterval = 280 + theme.spacing.sm;
      bottomScrollRef.current.scrollTo({ x: idx * cardInterval, animated: true });
      shouldScrollToSelected.current = false;
    }
  }, [displayStores, selectedStore]);

  const handleMarkerPress = useCallback((store: BuyerStore) => {
    setSelectedStore(store);
    shouldScrollToSelected.current = true;
  }, []);

  const handleCardPress = useCallback((store: BuyerStore) => {
    setSelectedStore(store);
    shouldScrollToSelected.current = false;
    if (mapRef.current && hasValidCoordinates(store)) {
      const delta = currentMapRegion
        ? Math.min(currentMapRegion.latitudeDelta, 0.05)
        : 0.02;
      mapRef.current.animateToRegion({
        latitude: store.coordinates.latitude,
        longitude: store.coordinates.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 300);
    }
    setTimeout(() => {
      markerRefs.current[store.id]?.showCallout();
    }, 350);
  }, [currentMapRegion]);

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
    setDebouncedSearchQuery("");
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

  const filteredStoreIds = useMemo(() => {
    return new Set(filteredStores.map((s) => s.id));
  }, [filteredStores]);

  // 把 selectedStore 兜底拼到 marker 集合里。
  // 场景：从搜索屏 requestFocus 一家 store，但这家 store 还没被全量 `stores`
  // 拉到（首屏 stores 还在加载，或者分页节奏没跟上）。如果 marker 不存在，
  // ref 拿不到，showCallout 会无声失败、地图上也看不到聚焦点。
  // 这里只是渲染兜底，selected 还是 `selectedStore` state；它已在主集合时不会重复。
  const renderedMarkerStores = useMemo(() => {
    const valid = stores.filter(hasValidCoordinates);
    if (!selectedStore || !hasValidCoordinates(selectedStore)) return valid;
    if (valid.some((s) => s.id === selectedStore.id)) return valid;
    return [selectedStore, ...valid];
  }, [stores, selectedStore]);

  const renderMarker = (store: BuyerStore & { coordinates: NonNullable<BuyerStore["coordinates"]> }) => {
    const isSelected = selectedStore?.id === store.id;
    const isFiltered = filteredStoreIds.has(store.id);
    const isDimmed = filteredStores.length > 0 && !isFiltered && !isSelected;
    return (
      <StoreMarker
        key={store.id}
        store={store}
        isSelected={isSelected}
        isDimmed={isDimmed}
        markerStyle={styles.markerOuter}
        onPress={handleMarkerPress}
        registerRef={(ref) => {
          if (ref) markerRefs.current[store.id] = ref;
        }}
      />
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

  const Wrapper = embedded ? View : SafeAreaView;
  const wrapperProps = embedded
    ? { style: styles.container }
    : { style: styles.container, edges: ["top"] as const };

  return (
    <Wrapper {...(wrapperProps as any)}>
      {/* 搜索栏 */}
      <Box px="$md" pb="$sm" pt="$xs">
        <HStack alignItems="center" gap="$sm">
          <Pressable
            flex={1}
            flexDirection="row"
            alignItems="center"
            style={{ backgroundColor: theme.colors.gray50 }}
            rounded="$sm"
            px="$md"
            h={40}
            onPress={handleSearchPress}
          >
            <Ionicons
              name="search"
              size={20}
              color={theme.colors.gray400}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>
              {t("store.searchPlaceholder")}
            </Text>
          </Pressable>
          <Pressable
            w={40}
            h={40}
            rounded="$sm"
            style={[{ backgroundColor: activeFilterCount > 0 ? theme.colors.black : theme.colors.white }, { borderColor: activeFilterCount > 0 ? theme.colors.black : theme.colors.gray100 }]}
            borderWidth={1}

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
                style={{ backgroundColor: theme.colors.error }}
                justifyContent="center"
                alignItems="center"
              >
                <Text style={{ color: theme.colors.white }} fontSize="$xs" fontWeight="$medium" lineHeight={16}>
                  {activeFilterCount}
                </Text>
              </Box>
            )}
          </Pressable>
        </HStack>
      </Box>

      {/* 地图视图 */}
      <Box flex={1}>
        {isLoading ? (
          // 全屏 loading：直接让 GIF 撑满 `flex:1` 容器，避免 540x960 的
          // 竖版 dark GIF 被居中收成小方块，浪费屏幕空间又露出 GIF 外的黑底
          // 让品牌字 "AVANT REGARD" 看起来像是被切掉一半的截图。
          <Image
            source={mapLoadingGif}
            style={styles.loadingGif}
            resizeMode="contain"
          />
        ) : loadError ? (
          // 首屏加载失败占位：明确的错误文案 + 重试按钮，取代原先的"空白地图"体感。
          // 上游瞬时 502 会被后端映射成 502 并由 http.ts 自动重试 2 次；若仍失败，
          // 用户看到这个占位后可主动重试。
          <VStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            px="$lg"
            gap="$md"
          >
            <Ionicons
              name="cloud-offline-outline"
              size={56}
              color={theme.colors.gray300}
            />
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
              {t("store.loadFailed")}
            </Text>
            <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} textAlign="center">
              {loadError}
            </Text>
            <Pressable
              mt="$sm"
              px="$lg"
              py="$sm"
              style={{ backgroundColor: theme.colors.black }}
              rounded="$sm"
              onPress={loadInitialData}
            >
              <Text fontSize="$sm" style={{ color: theme.colors.white }} fontWeight="$semibold">
                {t("store.tapRetry")}
              </Text>
            </Pressable>
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
            onRegionChangeComplete={handleRegionChangeComplete}
          >
            {renderedMarkerStores.map(renderMarker)}
          </MapView>
        )}
      </Box>

      {/* 快速筛选标签 - 浮在地图上方，位于搜索栏下方 (渲染在 Map 之后以确保显示在上层) */}
      <Box
        position="absolute"
        top={(embedded ? 0 : insets.top) + SEARCH_BAR_HEIGHT}
        left={0}
        right={0}
        zIndex={100}
        sx={{ elevation: 10 }}
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
            style={{
              backgroundColor: nearbyMode ? theme.colors.black : floatingPillBg,
              borderColor: nearbyMode ? "transparent" : floatingPillBorder,
              borderWidth: isDark && !nearbyMode ? 1 : 0,
            }}
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
              style={{ color: nearbyMode ? theme.colors.white : theme.colors.black }}
              fontSize="$sm"
              fontWeight="$medium"
              ml="$xs"
            >
              {t("map.nearby")}
            </Text>
          </Pressable>

          {/* 营业中按钮 */}
          <Pressable
            flexDirection="row"
            alignItems="center"
            px="$md"
            py="$xs"
            rounded="$sm"
            style={{
              backgroundColor: filters.openOnly ? theme.colors.black : floatingPillBg,
              borderColor: filters.openOnly ? "transparent" : floatingPillBorder,
              borderWidth: isDark && !filters.openOnly ? 1 : 0,
            }}
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
              style={{ color: filters.openOnly ? theme.colors.white : theme.colors.black }}
              fontSize="$sm"
              fontWeight="$medium"
              ml="$xs"
            >
              {t("store.open")}
            </Text>
          </Pressable>

          <Box w={1} h={16} style={{ backgroundColor: theme.colors.gray200 }} mr="$sm" alignSelf="center" />

          {/* 国家选择（按数量排序） */}
          {sortedCountries.map((country) => {
            const isActive = filters.country === country;
            return (
            <Pressable
              key={country}
              flexDirection="row"
              alignItems="center"
              px="$md"
              py="$xs"
              rounded="$sm"
              style={{
                backgroundColor: isActive ? theme.colors.black : floatingPillBg,
                borderColor: isActive ? "transparent" : floatingPillBorder,
                borderWidth: isDark && !isActive ? 1 : 0,
              }}
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
                color={isActive ? theme.colors.white : theme.colors.gray300}
                style={{ marginRight: 4 }}
              />
              <Text
                style={{ color: isActive ? theme.colors.white : theme.colors.black }}
                fontSize="$sm"
                fontWeight="$medium"
              >
                {getCountryDisplayName(country)}
              </Text>
              {countryStoreCounts[country] && (
                <Text
                  style={{ color: isActive ? theme.colors.gray100 : theme.colors.gray300 }}
                  fontSize="$xs"
                  ml="$xs"
                >
                  {countryStoreCounts[country]}
                </Text>
              )}
            </Pressable>
            );
          })}
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
            {sortedCities.slice(0, 15).map((city) => {
              const isActive = filters.city === city;
              return (
              <Pressable
                key={city}
                flexDirection="row"
                alignItems="center"
                px="$md"
                py="$xs"
                rounded="$sm"
                style={{
                  backgroundColor: isActive ? theme.colors.black : floatingPillBg,
                  borderColor: isActive
                    ? theme.colors.black
                    : isDark
                      ? theme.colors.border
                      : theme.colors.gray100,
                }}
                borderWidth={1}

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
                  style={{ color: isActive ? theme.colors.white : theme.colors.black }}
                  fontSize="$sm"
                  fontWeight="$medium"
                >
                  {getCityDisplayName(city)}
                </Text>
                {cityStoreCounts[city] && (
                  <Text
                    style={{ color: isActive ? theme.colors.gray100 : theme.colors.gray300 }}
                    fontSize="$xs"
                    ml="$xs"
                  >
                    {cityStoreCounts[city]}
                  </Text>
                )}
              </Pressable>
              );
            })}
          </ScrollView>
        )}
      </Box>

      {/* 底部店铺列表（仅显示当前视口内的店铺） */}
      <Box position="absolute" bottom={20} left={0} right={0}>
        <HStack
          justifyContent="between"
          alignItems="center"
          px="$md"
          mb="$sm"
        >
          <Box
            style={{
              backgroundColor: floatingPillBg,
              borderColor: floatingPillBorder,
              borderWidth: isDark ? 1 : 0,
            }}
            px="$sm"
            py="$xs"
            rounded="$sm"
          >
            <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.black }}>
              {t("map.foundStores", { count: visibleStores.length })}
            </Text>
          </Box>
          <HStack gap="$sm">
            {activeFilterCount > 0 && (
              <Pressable
                style={{
                  backgroundColor: floatingPillBg,
                  borderColor: floatingPillBorder,
                  borderWidth: isDark ? 1 : 0,
                }}
                px="$sm"
                py="$xs"
                rounded="$sm"
                onPress={resetFilters}
              >
                <Text fontSize="$xs" style={{ color: theme.colors.black }} textDecorationLine="underline">
                  {t("map.clearFilters")}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={{
                backgroundColor: floatingPillBg,
                borderColor: floatingPillBorder,
                borderWidth: isDark ? 1 : 0,
              }}
              px="$md"
              py="$xs"
              rounded="$sm"
              flexDirection="row"
              alignItems="center"
              onPress={() => (navigation.navigate as any)("SubmitStore")}
            >
              <Ionicons name="add" size={14} color={theme.colors.black} />
              <Text fontSize="$xs" fontWeight="$semibold" style={{ color: theme.colors.black }} ml="$xs">
                {t("map.upload")}
              </Text>
            </Pressable>
            <Pressable
              style={{ backgroundColor: theme.colors.black }}
              px="$md"
              py="$xs"
              rounded="$sm"
              flexDirection="row"
              alignItems="center"
              onPress={() => (navigation.navigate as any)("StoreList")}
            >
              <Ionicons name="list" size={14} color={theme.colors.white} />
              <Text fontSize="$xs" fontWeight="$semibold" style={{ color: theme.colors.white }} ml="$xs">
                {t("common.all")}
              </Text>
            </Pressable>
          </HStack>
        </HStack>

        <RNScrollView
          ref={bottomScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
          snapToInterval={280 + theme.spacing.sm}
          decelerationRate="fast"
        >
          {displayStores.map((store) => (
            <Pressable
              key={store.id}
              w={280}
              style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.black }]}
              rounded="$lg"
              p="$md"
              mr="$sm"
              borderWidth={selectedStore?.id === store.id ? 2 : 0}

              sx={styles.cardShadow}
              onPress={() => handleCardPress(store)}
              onLongPress={() => handleStoreDetailPress(store)}
            >
              {/* 店铺头部 */}
              <HStack justifyContent="between" alignItems="start" mb="$sm">
                <Text
                  fontSize="$lg"
                  fontWeight="$bold"
                  style={{ color: theme.colors.black }}
                  flex={1}
                  mr="$sm"
                  numberOfLines={1}
                >
                  {store.name}
                </Text>
              </HStack>

              {/* 地址 */}
              <Text fontSize="$sm" style={{ color: theme.colors.gray300 }} mb="$sm" numberOfLines={1}>
                {store.city} · {store.address}
              </Text>

              {/* 风格标签 */}
              <HStack mb="$sm" gap="$xs">
                {store.style.slice(0, 2).map((s, idx) => (
                  <Box key={idx} style={{ backgroundColor: theme.colors.black }} px="$sm" py="$xs" rounded="$sm">
                    <Text fontSize="$xs" style={{ color: theme.colors.white }} fontWeight="$medium">
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
                style={{ borderBottomColor: theme.colors.gray100 }}
              >
                <Text fontSize="$xs" style={{ color: theme.colors.gray300 }} numberOfLines={1} fontStyle="italic">
                  {store.brands.join(" / ") || t("store.noBrandInfo")}
                </Text>
              </Box>

              {/* 操作按钮 */}
              <HStack justifyContent="between" alignItems="center">
                <HStack gap="$sm">
                  {getFavoriteCount(store.id) > 0 && (
                    <Text fontSize={11} style={{ color: theme.colors.gray300 }} alignSelf="center">
                      {t("store.followersCount", { count: getFavoriteCount(store.id) })}
                    </Text>
                  )}
                  <Pressable
                    rounded="$sm"
                    style={[{ borderColor: theme.colors.black }, { backgroundColor: isFavorited(store.id) ? theme.colors.black : theme.colors.white }]}
                    borderWidth={1}

                    justifyContent="center"
                    alignItems="center"
                    px="$sm"
                    py={4}
                    onPress={() => toggleFavorite(store.id)}
                  >
                    <Text
                      fontSize={11}
                      fontWeight="$bold"
                      style={{ color: isFavorited(store.id) ? theme.colors.white : theme.colors.black }}
                    >
                      {isFavorited(store.id) ? t("store.followed") : t("store.follow")}
                    </Text>
                  </Pressable>
                  <Pressable
                    w={36}
                    h={36}
                    rounded="$sm"
                    style={{ backgroundColor: theme.colors.gray100 }}
                    justifyContent="center"
                    alignItems="center"
                    onPress={() => (navigation.navigate as any)("StoreDetail", { storeId: store.id })}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={theme.colors.black} />
                  </Pressable>
                </HStack>
                <HStack gap="$sm">
                  {store.phone && store.phone.length > 0 && (
                    <Pressable
                      w={36}
                      h={36}
                      rounded="$sm"
                      style={{ backgroundColor: theme.colors.gray100 }}
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
                    style={{ backgroundColor: theme.colors.black }}
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
            <Box w={40} h={4} style={{ backgroundColor: theme.colors.gray100 }} rounded="$sm" alignSelf="center" mt="$sm" mb="$sm" />

            <HStack
              justifyContent="between"
              alignItems="center"
              px="$lg"
              pb="$md"
              borderBottomWidth={1}
              style={{ borderBottomColor: theme.colors.gray100 }}
            >
              <Text fontSize="$lg" fontWeight="$bold" style={{ color: theme.colors.black }}>
                {t("map.filterConditions")}
              </Text>
              <Pressable onPress={closeFilters}>
                <Ionicons name="close" size={24} color={theme.colors.gray300} />
              </Pressable>
            </HStack>

            <RNScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {/* 国家筛选（按数量排序） */}
              <VStack mt="$lg">
                <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                  {t("map.country")}
                </Text>
                <HStack flexWrap="wrap" gap="$xs">
                  {sortedCountries.map((country) => (
                    <Pressable
                      key={country}
                      px="$md"
                      py="$sm"
                      rounded="$sm"
                      borderWidth={1}
                      style={[{ borderColor: filters.country === country ? theme.colors.black : theme.colors.gray100 }, { backgroundColor: filters.country === country ? theme.colors.black : theme.colors.white }]}

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
                        style={{ color: filters.country === country ? theme.colors.white : theme.colors.black }}
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
                  <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                    {t("map.city")} {filters.country && <Text fontSize="$xs" style={{ color: theme.colors.gray300 }}>({filters.country})</Text>}
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {sortedCities.map((city) => (
                      <Pressable
                        key={city}
                        px="$md"
                        py="$sm"
                        rounded="$sm"
                        borderWidth={1}
                        style={[{ borderColor: filters.city === city ? theme.colors.black : theme.colors.gray100 }, { backgroundColor: filters.city === city ? theme.colors.black : theme.colors.white }]}

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
                          style={{ color: filters.city === city ? theme.colors.white : theme.colors.black }}
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
                <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                  {t("map.popularBrands")}
                </Text>
                <HStack flexWrap="wrap" gap="$xs">
                  {POPULAR_BRANDS.map((brand) => (
                    <Pressable
                      key={brand}
                      px="$md"
                      py="$sm"
                      rounded="$sm"
                      borderWidth={1}
                      style={[{ borderColor: filters.brand === brand ? theme.colors.black : theme.colors.gray100 }, { backgroundColor: filters.brand === brand ? theme.colors.black : theme.colors.white }]}

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
                        style={{ color: filters.brand === brand ? theme.colors.white : theme.colors.black }}
                      >
                        {brand}
                      </Text>
                    </Pressable>
                  ))}
                </HStack>
              </VStack>

              {/* 风格分类筛选 */}
              {STYLE_CATEGORIES_DATA.map((category) => (
                <VStack key={category.key} mt="$lg">
                  <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                    {t(category.key)}
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {category.styles.map((styleItem) => (
                      <Pressable
                        key={styleItem}
                        px="$md"
                        py="$sm"
                        rounded="$sm"
                        borderWidth={1}
                        style={[{ borderColor: filters.styles.includes(styleItem) ? theme.colors.black : theme.colors.gray100 }, { backgroundColor: filters.styles.includes(styleItem) ? theme.colors.black : theme.colors.white }]}

                        mb="$xs"
                        onPress={() => toggleStyleFilter(styleItem)}
                      >
                        <Text
                          fontSize="$sm"
                          style={{ color: filters.styles.includes(styleItem) ? theme.colors.white : theme.colors.black }}
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
                <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                  {t("map.moreOptions")}
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
                      style={{ color: filters.openOnly ? theme.colors.black : theme.colors.gray300 }}
                      fontWeight={filters.openOnly ? "$medium" : "$normal"}
                    >
                      {t("map.openOnly")}
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
                      style={{ color: filters.hasPhone ? theme.colors.black : theme.colors.gray300 }}
                      fontWeight={filters.hasPhone ? "$medium" : "$normal"}
                    >
                      {t("map.hasPhone")}
                    </Text>
                  </Pressable>
                </HStack>
              </VStack>
            </RNScrollView>

            <HStack
              p="$lg"
              borderTopWidth={1}
              style={[{ borderTopColor: theme.colors.gray100 }, { backgroundColor: theme.colors.white }]}

              gap="$sm"
            >
              <Pressable
                flex={1}
                py="$md"
                rounded="$sm"
                borderWidth={1}
                style={{ borderColor: theme.colors.gray100 }}
                alignItems="center"
                justifyContent="center"
                onPress={resetFilters}
              >
                <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
                  {t("map.reset")}
                </Text>
              </Pressable>
              <Pressable
                flex={2}
                py="$md"
                rounded="$sm"
                style={{ backgroundColor: theme.colors.black }}
                alignItems="center"
                justifyContent="center"
                onPress={closeFilters}
              >
                <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.white }}>
                  {t("map.viewStores", { count: filteredStores.length })}
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
            <Box w={40} h={4} style={{ backgroundColor: theme.colors.gray100 }} rounded="$sm" alignSelf="center" mt="$sm" mb="$sm" />

            {selectedStore && (
              <>
                <HStack
                  justifyContent="between"
                  alignItems="start"
                  px="$lg"
                  pb="$md"
                  borderBottomWidth={1}
                  style={{ borderBottomColor: theme.colors.gray100 }}
                >
                  <VStack flex={1}>
                    <Text fontSize="$lg" fontWeight="$bold" style={{ color: theme.colors.black }} numberOfLines={1}>
                      {selectedStore.name}
                    </Text>
                    <Text fontSize="$sm" style={{ color: theme.colors.gray300 }} mt="$xs">
                      {selectedStore.city} · {selectedStore.country}
                    </Text>
                  </VStack>
                  <HStack alignItems="center" gap="$md">
                    {getFavoriteCount(selectedStore.id) > 0 && (
                      <Text fontSize="$xs" style={{ color: theme.colors.gray300 }}>
                        {t("store.followersCount", { count: getFavoriteCount(selectedStore.id) })}
                      </Text>
                    )}
                    <Pressable
                      onPress={() => toggleFavorite(selectedStore.id)}
                      hitSlop={8}
                      style={[{ borderColor: theme.colors.black }, { backgroundColor: isFavorited(selectedStore.id) ? theme.colors.black : theme.colors.white }]}
                      borderWidth={1}

                      rounded="$sm"
                      px="$md"
                      py="$xs"
                    >
                      <Text
                        fontSize="$xs"
                        fontWeight="$bold"
                        style={{ color: isFavorited(selectedStore.id) ? theme.colors.white : theme.colors.black }}
                      >
                        {isFavorited(selectedStore.id) ? t("store.followed") : t("store.follow")}
                      </Text>
                    </Pressable>
                    <Pressable onPress={closeStoreDetail}>
                      <Ionicons name="close" size={24} color={theme.colors.gray300} />
                    </Pressable>
                  </HStack>
                </HStack>

                <RNScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                  {/* 营业时间 */}
                  <Box style={{ backgroundColor: theme.colors.gray100 }} rounded="$lg" p="$md" mt="$md">
                    {selectedStore.hours && (
                      <HStack alignItems="start">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={theme.colors.gray300}
                          style={{ marginTop: 2 }}
                        />
                        <Text fontSize="$sm" style={{ color: theme.colors.gray300 }} ml="$sm" flex={1} lineHeight="$lg">
                          {selectedStore.hours}
                        </Text>
                      </HStack>
                    )}
                  </Box>

                  {/* 地址 */}
                  <Pressable
                    style={{ backgroundColor: theme.colors.gray100 }}
                    rounded="$lg"
                    p="$md"
                    mt="$md"
                    onPress={() => handleMapPress(selectedStore.address)}
                  >
                    <HStack alignItems="center">
                      <Ionicons name="location-outline" size={18} color={theme.colors.black} />
                      <Text fontSize="$md" style={{ color: theme.colors.black }} fontWeight="$medium" ml="$sm" flex={1}>
                        {selectedStore.address}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.gray200} />
                    </HStack>
                  </Pressable>

                  {/* 电话 */}
                  {selectedStore.phone && selectedStore.phone.length > 0 && (
                    <Box style={{ backgroundColor: theme.colors.gray100 }} rounded="$lg" p="$md" mt="$md">
                      {selectedStore.phone.map((phone, idx) => (
                        <Pressable
                          key={idx}
                          flexDirection="row"
                          alignItems="center"
                          mt={idx > 0 ? "$sm" : 0}
                          onPress={() => handleCallPress(phone)}
                        >
                          <Ionicons name="call-outline" size={18} color={theme.colors.black} />
                          <Text fontSize="$md" style={{ color: theme.colors.black }} ml="$sm" flex={1}>
                            {phone}
                          </Text>
                          <Box
                            style={{
                              backgroundColor: isDark
                                ? "rgba(92,214,122,0.16)"
                                : "#E8F5E9",
                            }}
                            px="$sm"
                            py="$xs"
                            rounded="$sm"
                          >
                            <Text
                              fontSize="$xs"
                              fontWeight="$semibold"
                              style={{ color: theme.colors.success }}
                            >
                              {t("store.call")}
                            </Text>
                          </Box>
                        </Pressable>
                      ))}
                    </Box>
                  )}

                  {/* 风格 */}
                  {selectedStore.style.length > 0 && (
                    <VStack mt="$lg">
                      <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                        {t("store.storeStyle")}
                      </Text>
                      <HStack flexWrap="wrap" gap="$xs">
                        {selectedStore.style.map((s, idx) => (
                          <Box key={idx} style={{ backgroundColor: theme.colors.black }} px="$md" py="$sm" rounded="$sm">
                            <Text fontSize="$sm" style={{ color: theme.colors.white }} fontWeight="$medium">
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
                      <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }} mb="$sm">
                        {t("store.mainBrands")}
                      </Text>
                      <HStack flexWrap="wrap" gap="$xs">
                        {selectedStore.brands.map((brand, idx) => (
                          <Box key={idx} style={{ backgroundColor: theme.colors.gray100 }} px="$md" py="$sm" rounded="$sm">
                            <Text fontSize="$sm" style={{ color: theme.colors.black }}>
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
                  style={[{ borderTopColor: theme.colors.gray100 }, { backgroundColor: theme.colors.white }]}

                  gap="$sm"
                >
                  <Pressable
                    flex={1}
                    flexDirection="row"
                    py="$md"
                    rounded="$sm"
                    borderWidth={1}
                    style={{ borderColor: theme.colors.gray100 }}
                    alignItems="center"
                    justifyContent="center"
                    onPress={() => handleMapPress(selectedStore.address)}
                  >
                    <Ionicons name="navigate-outline" size={20} color={theme.colors.black} />
                    <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }} ml="$sm">
                      {t("store.navigate")}
                    </Text>
                  </Pressable>

                  {selectedStore.phone && selectedStore.phone.length > 0 ? (
                    <Pressable
                      flex={1}
                      flexDirection="row"
                      py="$md"
                      rounded="$sm"
                      style={{ backgroundColor: theme.colors.black }}
                      alignItems="center"
                      justifyContent="center"
                      onPress={() => handleCallPress(selectedStore.phone![0])}
                    >
                      <Ionicons name="call" size={20} color={theme.colors.white} />
                      <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.white }} ml="$sm">
                        {t("store.contactMerchant")}
                      </Text>
                    </Pressable>
                  ) : (
                    <Box
                      flex={1}
                      py="$md"
                      rounded="$sm"
                      style={{ backgroundColor: theme.colors.gray100 }}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.gray300 }}>
                        {t("store.noContact")}
                      </Text>
                    </Box>
                  )}
                </HStack>
              </>
            )}
          </Animated.View>
        </Box>
      </Modal>
    </Wrapper>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 16,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    color: t.colors.gray400,
  },
  map: {
    flex: 1,
  },
  loadingGif: {
    flex: 1,
    width: "100%",
    backgroundColor: t.colors.background,
  },
  markerOuter: {
    borderRadius: 9999,
    justifyContent: "center" as const,
    alignItems: "center" as const,
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
    backgroundColor: t.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get("window").height * 0.9,
    minHeight: 300,
    paddingBottom: 34,
  },
});

export default BuyerMapScreen;
