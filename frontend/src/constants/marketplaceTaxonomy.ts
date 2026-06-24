/**
 * 交易（marketplace）维度的「单一事实来源」。
 *
 * 发布单品 (PublishListing) 和 筛选 (MarketplaceFilterSheet) 必须共用同一套
 * 分类 / 成色 / 颜色 选项与「入库值」，否则会出现：卖家发布的单品在买家筛选时
 * 匹配不上（后端对 color / condition / category 都是精确匹配 / 名称匹配）。
 *
 * 约定：
 *   - `value` 是真正落库 / 传给后端的值，两边必须一致。
 *   - `labelKey` 是 i18n key，用于本地化展示（中英文）。
 *
 * 任何一边需要新增 / 调整选项时，只改这里。
 */
import type { ProductCondition } from "../services/storeProductService";

// ---------------------------------------------------------------------------
// 分类（PRD 6 大类）
// ---------------------------------------------------------------------------

export interface CategoryOption {
  /** 入库 / 传后端的 PRD 大类名（中文，后端按 ``category_kind`` 精确匹配 + 名称模糊匹配）。 */
  value: string;
  labelKey: string;
}

export const MARKETPLACE_CATEGORIES: ReadonlyArray<CategoryOption> = [
  { value: "外套", labelKey: "trading.filter.categoryOuter" },
  { value: "上衣", labelKey: "trading.filter.categoryTop" },
  { value: "裤装", labelKey: "trading.filter.categoryPants" },
  { value: "鞋履", labelKey: "trading.filter.categoryShoes" },
  { value: "包袋", labelKey: "trading.filter.categoryBag" },
  { value: "配饰", labelKey: "trading.filter.categoryAccessory" },
];

const CATEGORY_VALUES = new Set(MARKETPLACE_CATEGORIES.map((c) => c.value));

/**
 * 是否是合法的 PRD 大类值。用于过滤掉「从以往帖子转入」带进来的非 PRD 分类
 * （如「裙子」「内搭」），避免传给后端触发 category_kind 的 CHECK 约束错误。
 */
export function isMarketplaceCategory(value?: string | null): boolean {
  return !!value && CATEGORY_VALUES.has(value.trim());
}

// ---------------------------------------------------------------------------
// 成色（4 档，枚举值两边统一为 BNWT / NEW_99 / USED_8 / FLAW）
// ---------------------------------------------------------------------------

export interface ConditionOption {
  value: ProductCondition;
  /** 简短标题 i18n key（筛选 + 发布共用）。 */
  labelKey: string;
  /** 副标题 i18n key（仅发布表单展示，帮助卖家自检）。 */
  subKey: string;
}

/**
 * 注意：发布与筛选统一只用这 4 档。历史上发布用 NEW_99、筛选用 NEW_95，
 * 导致发布的「几乎全新」单品在筛选时匹配不到 —— 现已统一为 NEW_99。
 */
export const MARKETPLACE_CONDITIONS: ReadonlyArray<ConditionOption> = [
  {
    value: "BNWT",
    labelKey: "trading.filter.conditionBnwt",
    subKey: "trading.publishListing.conditionBrandNewSub",
  },
  {
    value: "NEW_99",
    labelKey: "trading.filter.conditionNear",
    subKey: "trading.publishListing.conditionGentlyUsedSub",
  },
  {
    value: "USED_8",
    labelKey: "trading.filter.conditionLight",
    subKey: "trading.publishListing.conditionUsedSub",
  },
  {
    value: "FLAW",
    labelKey: "trading.filter.conditionUsed",
    subKey: "trading.publishListing.conditionWornSub",
  },
];

// ---------------------------------------------------------------------------
// 颜色（入库值统一为英文 slug，与后端 mock 数据 / 筛选精确匹配一致）
// ---------------------------------------------------------------------------

export interface ColorOption {
  /** 入库 / 传后端的值（英文 slug，例如 ``black``）。 */
  value: string;
  labelKey: string;
  /** 色板展示用 hex。 */
  hex: string;
  /** 浅色（白 / 米）需要描边才看得清。 */
  bordered?: boolean;
}

export const MARKETPLACE_COLORS: ReadonlyArray<ColorOption> = [
  { value: "black", labelKey: "trading.filter.colorBlack", hex: "#000000" },
  {
    value: "white",
    labelKey: "trading.filter.colorWhite",
    hex: "#FFFFFF",
    bordered: true,
  },
  { value: "gray", labelKey: "trading.filter.colorGray", hex: "#9CA3AF" },
  {
    value: "beige",
    labelKey: "trading.filter.colorBeige",
    hex: "#D9C9A8",
    bordered: true,
  },
  { value: "brown", labelKey: "trading.filter.colorBrown", hex: "#8B4513" },
  { value: "red", labelKey: "trading.filter.colorRed", hex: "#DC2626" },
  { value: "pink", labelKey: "trading.filter.colorPink", hex: "#EC4899" },
  { value: "orange", labelKey: "trading.filter.colorOrange", hex: "#F97316" },
  { value: "yellow", labelKey: "trading.filter.colorYellow", hex: "#FACC15" },
  { value: "green", labelKey: "trading.filter.colorGreen", hex: "#16A34A" },
  { value: "blue", labelKey: "trading.filter.colorBlue", hex: "#2563EB" },
  { value: "purple", labelKey: "trading.filter.colorPurple", hex: "#7C3AED" },
  { value: "gold", labelKey: "trading.filter.colorGold", hex: "#C8A951" },
  {
    value: "silver",
    labelKey: "trading.filter.colorSilver",
    hex: "#C0C0C0",
    bordered: true,
  },
  { value: "multi", labelKey: "trading.filter.colorMulti", hex: "#A1A1AA" },
];

const COLOR_BY_VALUE = new Map(MARKETPLACE_COLORS.map((c) => [c.value, c]));

/** 按入库 slug 查预设颜色。 */
export function getColorOptionByValue(value: string): ColorOption | undefined {
  return COLOR_BY_VALUE.get(value.trim());
}

// ---------------------------------------------------------------------------
// 尺码（入库值两边统一；体系分组仅影响展示，不影响落库值）
// ---------------------------------------------------------------------------

/** 字母码（上衣 / 外套 / 配饰）。 */
export const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];
/** 数字号（上衣 / 外套 / 裤装：欧码 36–54）。 */
export const NUMERIC_SIZES = [
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
];
/** 鞋码 EU。 */
export const SHOE_SIZES_EU = [
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
];
/** 鞋码 US。 */
export const SHOE_SIZES_US = [
  "4.5",
  "5",
  "5.5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
];
