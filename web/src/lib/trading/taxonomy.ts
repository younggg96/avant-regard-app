/**
 * 交易维度的选项「单一事实来源」，对齐移动端
 * `frontend/src/constants/marketplaceTaxonomy.ts`。
 *
 * 发布单品与买家筛选必须共用同一套入库值，否则卖家发出去的单品在筛选里
 * 匹配不上——后端对 categoryKind / color / condition 都是精确匹配。
 *
 * 约定：`value` 是落库值（不可随意改动），`labelKey` 只影响展示。
 */

import type { ProductCondition } from "../services/listing";

export interface TaxonomyOption<T extends string = string> {
  value: T;
  labelKey: string;
}

/** PRD 6 大类。后端按 `category_kind` 精确匹配，所以入库值是中文。 */
export const MARKETPLACE_CATEGORIES: ReadonlyArray<TaxonomyOption> = [
  { value: "外套", labelKey: "trading.taxonomy.categoryOuter" },
  { value: "上衣", labelKey: "trading.taxonomy.categoryTop" },
  { value: "裤装", labelKey: "trading.taxonomy.categoryPants" },
  { value: "鞋履", labelKey: "trading.taxonomy.categoryShoes" },
  { value: "包袋", labelKey: "trading.taxonomy.categoryBag" },
  { value: "配饰", labelKey: "trading.taxonomy.categoryAccessory" },
];

const CATEGORY_VALUES = new Set(MARKETPLACE_CATEGORIES.map((c) => c.value));

export function isMarketplaceCategory(value?: string | null): boolean {
  return !!value && CATEGORY_VALUES.has(value.trim());
}

/**
 * 成色只用这 4 档。历史上发布用 NEW_99、筛选用 NEW_95，导致「几乎全新」
 * 的单品筛不出来，现已统一到 NEW_99。
 */
export const MARKETPLACE_CONDITIONS: ReadonlyArray<
  TaxonomyOption<ProductCondition>
> = [
  { value: "BNWT", labelKey: "trading.taxonomy.conditionBnwt" },
  { value: "NEW_99", labelKey: "trading.taxonomy.conditionNear" },
  { value: "USED_8", labelKey: "trading.taxonomy.conditionLight" },
  { value: "FLAW", labelKey: "trading.taxonomy.conditionUsed" },
];

export interface ColorOption extends TaxonomyOption {
  hex: string;
  /** 浅色需要描边才看得清。 */
  bordered?: boolean;
}

/** 颜色入库值是英文 slug，与后端筛选的精确匹配一致。 */
export const MARKETPLACE_COLORS: ReadonlyArray<ColorOption> = [
  { value: "black", labelKey: "trading.taxonomy.colorBlack", hex: "#000000" },
  {
    value: "white",
    labelKey: "trading.taxonomy.colorWhite",
    hex: "#FFFFFF",
    bordered: true,
  },
  { value: "gray", labelKey: "trading.taxonomy.colorGray", hex: "#9CA3AF" },
  {
    value: "beige",
    labelKey: "trading.taxonomy.colorBeige",
    hex: "#D9C9A8",
    bordered: true,
  },
  { value: "brown", labelKey: "trading.taxonomy.colorBrown", hex: "#8B4513" },
  { value: "red", labelKey: "trading.taxonomy.colorRed", hex: "#DC2626" },
  { value: "pink", labelKey: "trading.taxonomy.colorPink", hex: "#EC4899" },
  { value: "orange", labelKey: "trading.taxonomy.colorOrange", hex: "#F97316" },
  { value: "yellow", labelKey: "trading.taxonomy.colorYellow", hex: "#FACC15" },
  { value: "green", labelKey: "trading.taxonomy.colorGreen", hex: "#16A34A" },
  { value: "blue", labelKey: "trading.taxonomy.colorBlue", hex: "#2563EB" },
  { value: "purple", labelKey: "trading.taxonomy.colorPurple", hex: "#7C3AED" },
  { value: "gold", labelKey: "trading.taxonomy.colorGold", hex: "#C8A951" },
  {
    value: "silver",
    labelKey: "trading.taxonomy.colorSilver",
    hex: "#C0C0C0",
    bordered: true,
  },
  { value: "multi", labelKey: "trading.taxonomy.colorMulti", hex: "#A1A1AA" },
];

/** 字母码（上衣 / 外套 / 配饰）。 */
export const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];

/** 数字号（欧码 36–54，上衣 / 外套 / 裤装）。 */
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

/**
 * 按分类给出建议尺码。鞋履单独一套，其余走字母码 + 欧码。
 * 只是输入辅助，用户仍可自由填写。
 */
export function suggestedSizes(categoryKind?: string | null): string[] {
  if (categoryKind === "鞋履") return SHOE_SIZES_EU;
  if (categoryKind === "包袋" || categoryKind === "配饰") return LETTER_SIZES;
  return [...LETTER_SIZES, ...NUMERIC_SIZES];
}

/** 7 视角必拍图槽位，与后端 `PhotoAngles.REQUIRED_SLOTS` 对齐。 */
export const REQUIRED_PHOTO_SLOTS = [
  "front",
  "back",
  "wash_label",
  "wash_label_back",
  "brand_label",
  "brand_label_back",
  "flaw",
] as const;

export type RequiredPhotoSlot = (typeof REQUIRED_PHOTO_SLOTS)[number];

export const PHOTO_SLOT_LABEL_KEY: Record<RequiredPhotoSlot, string> = {
  front: "trading.publish.photoFront",
  back: "trading.publish.photoBack",
  wash_label: "trading.publish.photoWashLabel",
  wash_label_back: "trading.publish.photoWashLabelBack",
  brand_label: "trading.publish.photoBrandLabel",
  brand_label_back: "trading.publish.photoBrandLabelBack",
  flaw: "trading.publish.photoFlaw",
};
