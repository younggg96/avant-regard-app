/**
 * 买手店数据服务
 * 管理买手店数据的获取、筛选和推荐功能
 */

import storesData from "../data/buyer-stores.json";

export interface BuyerStore {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  brands: string[];
  style: string[];
  isOpen: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string; // 休息日信息
}

// 判断当前是否在营业时间内
const isCurrentlyOpen = (hours?: string): boolean => {
  if (!hours || hours.includes("需预约")) return false;

  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // 解析营业时间，如 "10:00-22:00" 或 "周三至周日14:00-20:00"
    const timeMatch = hours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const openTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      const closeTime = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
      return currentTime >= openTime && currentTime < closeTime;
    }
  } catch {
    return true;
  }

  return true;
};

// 从 JSON 文件加载数据并动态计算营业状态
const mockStores: BuyerStore[] = (storesData as BuyerStore[]).map((store) => ({
  ...store,
  isOpen: store.hours ? isCurrentlyOpen(store.hours) : store.isOpen,
}));

/**
 * 获取所有买手店
 */
export const getAllStores = async (): Promise<BuyerStore[]> => {
  // 模拟 API 延迟
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockStores];
};

/**
 * 根据ID获取买手店详情
 */
export const getStoreById = async (id: string): Promise<BuyerStore | null> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockStores.find((store) => store.id === id) || null;
};

/**
 * 根据条件筛选买手店
 */
export const filterStores = async (filters: {
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  openOnly?: boolean;
  searchQuery?: string;
}): Promise<BuyerStore[]> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  let filtered = [...mockStores];

  // 搜索过滤
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter((store) => {
      const matchesName = store.name.toLowerCase().includes(query);
      const matchesBrand = store.brands.some((brand) =>
        brand.toLowerCase().includes(query)
      );
      const matchesCity = store.city.toLowerCase().includes(query);
      const matchesStyle = store.style.some((s) =>
        s.toLowerCase().includes(query)
      );
      return matchesName || matchesBrand || matchesCity || matchesStyle;
    });
  }

  // 国家筛选
  if (filters.country) {
    filtered = filtered.filter((store) => store.country === filters.country);
  }

  // 城市筛选
  if (filters.city) {
    filtered = filtered.filter((store) => store.city === filters.city);
  }

  // 品牌筛选
  if (filters.brand) {
    filtered = filtered.filter((store) =>
      store.brands.some((brand) =>
        brand.toLowerCase().includes(filters.brand!.toLowerCase())
      )
    );
  }

  // 风格筛选
  if (filters.style) {
    filtered = filtered.filter((store) =>
      store.style.some((style) =>
        style.toLowerCase().includes(filters.style!.toLowerCase())
      )
    );
  }

  // 营业状态筛选
  if (filters.openOnly) {
    filtered = filtered.filter((store) => store.isOpen);
  }

  return filtered;
};

/**
 * 获取所有国家列表
 */
export const getAllCountries = (): string[] => {
  return Array.from(new Set(mockStores.map((s) => s.country)));
};

/**
 * 获取所有城市列表
 */
export const getAllCities = (): string[] => {
  return Array.from(new Set(mockStores.map((s) => s.city)));
};

/**
 * 获取所有风格列表
 */
export const getAllStyles = (): string[] => {
  return Array.from(new Set(mockStores.flatMap((s) => s.style)));
};

/**
 * 根据品牌推荐买手店
 */
export const getStoresByBrand = async (
  brand: string
): Promise<BuyerStore[]> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return mockStores.filter((store) =>
    store.brands.some((b) => b.toLowerCase().includes(brand.toLowerCase()))
  );
};

/**
 * 获取品牌关联推荐
 * 根据用户搜索的品牌，推荐包含该品牌的店铺以及相似品牌
 */
export const getBrandRecommendations = async (
  brand: string
): Promise<{
  stores: BuyerStore[];
  relatedBrands: string[];
}> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 找到包含该品牌的店铺
  const storesWithBrand = mockStores.filter((store) =>
    store.brands.some((b) => b.toLowerCase().includes(brand.toLowerCase()))
  );

  // 获取这些店铺的其他品牌（作为相似品牌推荐）
  const relatedBrands = Array.from(
    new Set(storesWithBrand.flatMap((s) => s.brands))
  ).filter((b) => b.toLowerCase() !== brand.toLowerCase());

  return {
    stores: storesWithBrand,
    relatedBrands,
  };
};

/**
 * 根据用户位置推荐附近的买手店
 */
export const getNearbyStores = async (
  userLocation: { latitude: number; longitude: number },
  radius: number = 50 // 默认50公里
): Promise<BuyerStore[]> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 简单的距离计算（实际应使用更精确的地理计算）
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // 地球半径（公里）
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return mockStores
    .map((store) => ({
      ...store,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        store.coordinates.latitude,
        store.coordinates.longitude
      ),
    }))
    .filter((store) => store.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
};
