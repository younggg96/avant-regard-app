/**
 * 买手店数据服务
 * 管理买手店数据的获取、筛选和推荐功能
 */

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
  phone?: string;
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
}

// Mock data - 买手店数据（重点覆盖中国）
const mockStores: BuyerStore[] = [
  {
    id: "1",
    name: "栋梁",
    address: "北京市朝阳区三里屯太古里南区S8-31",
    city: "北京",
    country: "中国",
    coordinates: { latitude: 39.9342, longitude: 116.4479 },
    brands: ["Rick Owens", "Yohji Yamamoto", "Comme des Garçons", "Issey Miyake"],
    style: ["先锋", "暗黑"],
    isOpen: true,
    phone: "+86 10 6417 8580",
    hours: "10:00-22:00",
    rating: 4.8,
    description: "中国知名设计师买手店，专注于前卫设计师品牌",
  },
  {
    id: "2",
    name: "SKP Select",
    address: "北京市朝阳区建国路87号SKP购物中心",
    city: "北京",
    country: "中国",
    coordinates: { latitude: 39.9168, longitude: 116.4668 },
    brands: ["Balenciaga", "Vetements", "Off-White", "Jacquemus"],
    style: ["街头", "潮流"],
    isOpen: true,
    phone: "+86 10 8587 8888",
    hours: "10:00-22:00",
    rating: 4.9,
    description: "高端百货精选买手店，汇集国际潮流品牌",
  },
  {
    id: "3",
    name: "Labelhood",
    address: "上海市静安区南京西路1601号芮欧百货",
    city: "上海",
    country: "中国",
    coordinates: { latitude: 31.2304, longitude: 121.4737 },
    brands: ["Julius", "Ann Demeulemeester", "Dries Van Noten", "Carol Christian Poell"],
    style: ["极简", "先锋"],
    isOpen: true,
    phone: "+86 21 5238 8990",
    hours: "10:00-22:00",
    rating: 4.7,
    description: "推广中国原创设计师品牌的先锋平台",
  },
  {
    id: "4",
    name: "Joyce",
    address: "上海市黄浦区中山东一路18号外滩18号",
    city: "上海",
    country: "中国",
    coordinates: { latitude: 31.2396, longitude: 121.4906 },
    brands: ["The Row", "Maison Margiela", "Jil Sander", "Lemaire"],
    style: ["极简", "高级"],
    isOpen: true,
    phone: "+86 21 6339 4066",
    hours: "10:00-22:00",
    rating: 4.8,
    description: "亚洲奢侈品零售领导者，精选高级时装品牌",
  },
  {
    id: "5",
    name: "I.T Beijing",
    address: "北京市朝阳区三里屯太古里北区1层N4-33",
    city: "北京",
    country: "中国",
    coordinates: { latitude: 39.9366, longitude: 116.4477 },
    brands: ["Alexander Wang", "Acne Studios", "Alexander McQueen", "Kenzo"],
    style: ["街头", "现代"],
    isOpen: true,
    phone: "+86 10 6417 6173",
    hours: "10:00-22:00",
    rating: 4.6,
    description: "香港知名时装零售集团，引领潮流文化",
  },
  {
    id: "6",
    name: "I.T Guangzhou",
    address: "广州市天河区天河路228号正佳广场",
    city: "广州",
    country: "中国",
    coordinates: { latitude: 23.1367, longitude: 113.3244 },
    brands: ["Alexander Wang", "Acne Studios", "Alexander McQueen", "A.P.C."],
    style: ["街头", "现代"],
    isOpen: false,
    phone: "+86 20 3833 0628",
    hours: "10:00-22:00",
    rating: 4.6,
    description: "I.T集团广州旗舰店",
  },
  {
    id: "7",
    name: "连卡佛 Lane Crawford",
    address: "香港中环皇后大道中15-22号置地广场",
    city: "香港",
    country: "中国",
    coordinates: { latitude: 22.2819, longitude: 114.1582 },
    brands: ["Gucci", "Saint Laurent", "Bottega Veneta", "Loewe"],
    style: ["奢华", "经典"],
    isOpen: true,
    phone: "+852 2118 2288",
    hours: "10:00-20:00",
    rating: 4.9,
    description: "香港高端时装零售标杆，精选全球奢侈品牌",
  },
  {
    id: "8",
    name: "ICICLE 之禾",
    address: "上海市黄浦区南京东路353号",
    city: "上海",
    country: "中国",
    coordinates: { latitude: 31.2353, longitude: 121.4796 },
    brands: ["ICICLE"],
    style: ["极简", "环保"],
    isOpen: true,
    phone: "+86 21 6322 1299",
    hours: "10:00-22:00",
    rating: 4.5,
    description: "中国原创设计师品牌，倡导可持续时尚",
  },
  {
    id: "9",
    name: "Dover Street Market Beijing",
    address: "北京市朝阳区建国路87号SKP购物中心4层",
    city: "北京",
    country: "中国",
    coordinates: { latitude: 39.9168, longitude: 116.4668 },
    brands: ["Comme des Garçons", "Gucci", "Supreme", "Stüssy"],
    style: ["先锋", "街头"],
    isOpen: true,
    phone: "+86 10 8587 8000",
    hours: "10:00-22:00",
    rating: 4.9,
    description: "川久保玲创立的先锋买手店",
  },
  {
    id: "10",
    name: "Dover Street Market Tokyo",
    address: "东京都渋谷区神宮前6-9-5",
    city: "东京",
    country: "日本",
    coordinates: { latitude: 35.6634, longitude: 139.7061 },
    brands: ["Comme des Garçons", "Gucci", "Supreme", "Nike"],
    style: ["先锋", "街头"],
    isOpen: true,
    phone: "+81 3 6418 0200",
    hours: "11:00-20:00",
    rating: 4.9,
    description: "DSM东京旗舰店，潮流文化朝圣地",
  },
  {
    id: "11",
    name: "Colette",
    address: "213 Rue Saint-Honoré, 75001 Paris",
    city: "巴黎",
    country: "法国",
    coordinates: { latitude: 48.8656, longitude: 2.3265 },
    brands: ["Vetements", "Off-White", "Rick Owens", "Balenciaga"],
    style: ["潮流", "先锋"],
    isOpen: true,
    phone: "+33 1 55 35 33 90",
    hours: "11:00-19:00",
    rating: 4.8,
    description: "巴黎传奇买手店（已关闭，此为历史数据）",
  },
  {
    id: "12",
    name: "成都远洋太古里 D-LEAGUE",
    address: "成都市锦江区中纱帽街8号远洋太古里",
    city: "成都",
    country: "中国",
    coordinates: { latitude: 30.6598, longitude: 104.0861 },
    brands: ["Rick Owens", "Julius", "Ann Demeulemeester"],
    style: ["先锋", "暗黑"],
    isOpen: true,
    phone: "+86 28 6667 8899",
    hours: "10:00-22:00",
    rating: 4.7,
    description: "成都知名设计师买手店",
  },
  {
    id: "13",
    name: "深圳万象城 APROPOS",
    address: "深圳市罗湖区宝安南路1881号万象城",
    city: "深圳",
    country: "中国",
    coordinates: { latitude: 22.5431, longitude: 114.1128 },
    brands: ["Saint Laurent", "Balenciaga", "Celine"],
    style: ["现代", "高级"],
    isOpen: true,
    phone: "+86 755 8266 8888",
    hours: "10:00-22:00",
    rating: 4.6,
    description: "深圳高端买手店",
  },
  {
    id: "14",
    name: "杭州国大城市广场 H.O.F",
    address: "杭州市下城区延安路385号国大城市广场",
    city: "杭州",
    country: "中国",
    coordinates: { latitude: 30.2639, longitude: 120.1647 },
    brands: ["Acne Studios", "A.P.C.", "Maison Kitsuné"],
    style: ["极简", "现代"],
    isOpen: true,
    phone: "+86 571 8888 8888",
    hours: "10:00-22:00",
    rating: 4.5,
    description: "杭州时尚买手店",
  },
  {
    id: "15",
    name: "西安SKP SELECT",
    address: "西安市碑林区南二环东段1号西安SKP",
    city: "西安",
    country: "中国",
    coordinates: { latitude: 34.2432, longitude: 108.9600 },
    brands: ["Off-White", "Palm Angels", "Amiri"],
    style: ["街头", "潮流"],
    isOpen: true,
    phone: "+86 29 8888 8888",
    hours: "10:00-22:00",
    rating: 4.7,
    description: "西安高端买手店",
  },
];

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
      return matchesName || matchesBrand || matchesCity;
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

