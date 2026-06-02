/**
 * 发货地选项：canonical 值为中文（与历史数据 / 后端一致），展示走 i18n。
 */
import type { TFunction } from "i18next";

export const REGION_COUNTRY_CANONICAL = [
  "中国",
  "日本",
  "美国",
  "英国",
  "法国",
  "意大利",
  "德国",
  "韩国",
  "加拿大",
  "澳大利亚",
  "新加坡",
  "西班牙",
  "比利时",
  "荷兰",
  "瑞士",
  "其他",
] as const;

export type RegionCountryCanonical = (typeof REGION_COUNTRY_CANONICAL)[number];

const COUNTRY_I18N_KEY: Record<string, string> = {
  中国: "china",
  日本: "japan",
  美国: "usa",
  英国: "uk",
  法国: "france",
  意大利: "italy",
  德国: "germany",
  韩国: "korea",
  加拿大: "canada",
  澳大利亚: "australia",
  新加坡: "singapore",
  西班牙: "spain",
  比利时: "belgium",
  荷兰: "netherlands",
  瑞士: "switzerland",
  其他: "other",
};

export const CN_REGIONS: {
  state: string;
  stateKey: string;
  cities: { name: string; key: string }[];
}[] = [
  { state: "北京市", stateKey: "beijing", cities: [{ name: "北京", key: "beijing" }] },
  { state: "上海市", stateKey: "shanghai", cities: [{ name: "上海", key: "shanghai" }] },
  { state: "天津市", stateKey: "tianjin", cities: [{ name: "天津", key: "tianjin" }] },
  { state: "重庆市", stateKey: "chongqing", cities: [{ name: "重庆", key: "chongqing" }] },
  {
    state: "广东省",
    stateKey: "guangdong",
    cities: [
      { name: "广州", key: "guangzhou" },
      { name: "深圳", key: "shenzhen" },
      { name: "佛山", key: "foshan" },
      { name: "东莞", key: "dongguan" },
      { name: "珠海", key: "zhuhai" },
      { name: "汕头", key: "shantou" },
      { name: "中山", key: "zhongshan" },
    ],
  },
  {
    state: "江苏省",
    stateKey: "jiangsu",
    cities: [
      { name: "南京", key: "nanjing" },
      { name: "苏州", key: "suzhou" },
      { name: "无锡", key: "wuxi" },
      { name: "常州", key: "changzhou" },
      { name: "南通", key: "nantong" },
      { name: "扬州", key: "yangzhou" },
    ],
  },
  {
    state: "浙江省",
    stateKey: "zhejiang",
    cities: [
      { name: "杭州", key: "hangzhou" },
      { name: "宁波", key: "ningbo" },
      { name: "温州", key: "wenzhou" },
      { name: "金华", key: "jinhua" },
      { name: "嘉兴", key: "jiaxing" },
      { name: "绍兴", key: "shaoxing" },
    ],
  },
  {
    state: "山东省",
    stateKey: "shandong",
    cities: [
      { name: "济南", key: "jinan" },
      { name: "青岛", key: "qingdao" },
      { name: "烟台", key: "yantai" },
      { name: "潍坊", key: "weifang" },
      { name: "威海", key: "weihai" },
    ],
  },
  {
    state: "四川省",
    stateKey: "sichuan",
    cities: [
      { name: "成都", key: "chengdu" },
      { name: "绵阳", key: "mianyang" },
      { name: "德阳", key: "deyang" },
      { name: "宜宾", key: "yibin" },
    ],
  },
  {
    state: "湖北省",
    stateKey: "hubei",
    cities: [
      { name: "武汉", key: "wuhan" },
      { name: "宜昌", key: "yichang" },
      { name: "襄阳", key: "xiangyang" },
    ],
  },
  {
    state: "湖南省",
    stateKey: "hunan",
    cities: [
      { name: "长沙", key: "changsha" },
      { name: "株洲", key: "zhuzhou" },
      { name: "湘潭", key: "xiangtan" },
    ],
  },
  {
    state: "福建省",
    stateKey: "fujian",
    cities: [
      { name: "福州", key: "fuzhou" },
      { name: "厦门", key: "xiamen" },
      { name: "泉州", key: "quanzhou" },
    ],
  },
  {
    state: "辽宁省",
    stateKey: "liaoning",
    cities: [
      { name: "沈阳", key: "shenyang" },
      { name: "大连", key: "dalian" },
      { name: "鞍山", key: "anshan" },
    ],
  },
  {
    state: "陕西省",
    stateKey: "shaanxi",
    cities: [
      { name: "西安", key: "xian" },
      { name: "咸阳", key: "xianyang" },
    ],
  },
  {
    state: "河南省",
    stateKey: "henan",
    cities: [
      { name: "郑州", key: "zhengzhou" },
      { name: "洛阳", key: "luoyang" },
      { name: "开封", key: "kaifeng" },
    ],
  },
  {
    state: "河北省",
    stateKey: "hebei",
    cities: [
      { name: "石家庄", key: "shijiazhuang" },
      { name: "唐山", key: "tangshan" },
      { name: "保定", key: "baoding" },
    ],
  },
  {
    state: "云南省",
    stateKey: "yunnan",
    cities: [
      { name: "昆明", key: "kunming" },
      { name: "大理", key: "dali" },
    ],
  },
  {
    state: "广西壮族自治区",
    stateKey: "guangxi",
    cities: [
      { name: "南宁", key: "nanning" },
      { name: "桂林", key: "guilin" },
    ],
  },
  { state: "贵州省", stateKey: "guizhou", cities: [{ name: "贵阳", key: "guiyang" }] },
  {
    state: "海南省",
    stateKey: "hainan",
    cities: [
      { name: "海口", key: "haikou" },
      { name: "三亚", key: "sanya" },
    ],
  },
  { state: "其他", stateKey: "other", cities: [] },
];

export const CHINA_CANONICAL = "中国";

export function isChinaCountry(country: string | null | undefined): boolean {
  return (country ?? CHINA_CANONICAL) === CHINA_CANONICAL;
}

function countryLabel(canonical: string | null | undefined, t: TFunction): string {
  if (!canonical) return "";
  const slug = COUNTRY_I18N_KEY[canonical];
  if (!slug) return canonical;
  return t(`trading.publishListing.logistics.countries.${slug}`, {
    defaultValue: canonical,
  });
}

function stateLabel(canonical: string | null | undefined, t: TFunction): string {
  if (!canonical) return "";
  const row = CN_REGIONS.find((r) => r.state === canonical);
  if (!row) return canonical;
  return t(`trading.publishListing.logistics.cnStates.${row.stateKey}`, {
    defaultValue: canonical,
  });
}

function cityLabel(
  canonical: string | null | undefined,
  stateCanonical: string | null | undefined,
  t: TFunction
): string {
  if (!canonical) return "";
  const row = CN_REGIONS.find((r) => r.state === stateCanonical);
  const city = row?.cities.find((c) => c.name === canonical);
  if (!city) return canonical;
  return t(`trading.publishListing.logistics.cnCities.${city.key}`, {
    defaultValue: canonical,
  });
}

/** 列表 / Tab 预览用：国家 */
export function displayCountry(
  canonical: string | null | undefined,
  t: TFunction
): string {
  return countryLabel(canonical, t) || "—";
}

/** 列表 / Tab 预览用：省州（非中国原样返回） */
export function displayState(
  canonical: string | null | undefined,
  country: string | null | undefined,
  t: TFunction
): string {
  if (!canonical) return "—";
  if (!isChinaCountry(country)) return canonical;
  return stateLabel(canonical, t) || "—";
}

/** 列表 / Tab 预览用：城市（非中国原样返回） */
export function displayCity(
  canonical: string | null | undefined,
  country: string | null | undefined,
  state: string | null | undefined,
  t: TFunction
): string {
  if (!canonical) return "—";
  if (!isChinaCountry(country)) return canonical;
  return cityLabel(canonical, state, t) || "—";
}

/** 表单摘要：国家 · 省 · 市 */
export function formatRegionDisplay(
  country: string | null | undefined,
  state: string | null | undefined,
  city: string | null | undefined,
  t: TFunction
): string {
  const parts = [
    country ? countryLabel(country, t) : null,
    state ? (isChinaCountry(country) ? stateLabel(state, t) : state) : null,
    city
      ? isChinaCountry(country)
        ? cityLabel(city, state, t)
        : city
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
