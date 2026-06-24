/**
 * 发布单品 Step 1 / 基本信息 用的快捷选项常量。
 *
 * 设计目标:
 *   - 颜色 / 尺码不再让用户自由"诗意发挥"(雾霾蓝/做旧靛蓝...) —— 这种自由文本
 *     无法做后续筛选和后台分类, 也容易让买家搜不到.
 *   - 提供一套精简且行业通用的预设供一键选择, 仍保留自定义文本输入做兜底.
 *   - 尺码按"体系" (鞋码 EUR/US, 女装 / 男装 含身高+胸围, 数字, 简码) 分组,
 *     用户先挑体系再挑值, 减少展示的 chip 数量.
 */
import {
  MARKETPLACE_COLORS,
  getColorOptionByValue,
} from "../../constants/marketplaceTaxonomy";

/**
 * 颜色快捷选项 —— 直接复用共享 taxonomy（`MARKETPLACE_COLORS`），保证发布与筛选
 * 用同一套颜色与「入库值」。
 *
 * 入库值是英文 slug（如 `black`），与筛选 / 后端 mock 数据精确匹配一致；展示时通过
 * `labelKey` 做中英文本地化。历史上发布存中文（"黑色"）而筛选发英文 slug，导致
 * 发布的单品在按颜色筛选时匹配不到 —— 现已统一为 slug。
 */
export const COLOR_PRESETS = MARKETPLACE_COLORS;

/**
 * 尺码体系。
 *
 * `value` 是体系标识 (供未来按尺码体系做筛选 / 上架分类时用),
 * `labelKey` 在 `trading.publishListing.sizeStandards.*` 下,
 * `options[].value` 是落库到 `store_products.size` 的字符串.
 *
 * 注意: 女装 / 男装 chip 文案是 "XS · 155/80" 这种形式 (XS 体型 + 身高/胸围)。
 * 后端只存第一个 token (XS / S / M ...) 以便和 marketplace 已有
 * `SIZE_PRESETS = ["XS","S","M","L","XL","XXL"]` 兼容; chip 上完整显示给卖家
 * 看是为了帮他/她对照身高 + 胸围选最合适的码.
 */
export const SIZE_STANDARDS: ReadonlyArray<{
  key:
    | "shoeEur"
    | "shoeUs"
    | "womensCn"
    | "mensCn"
    | "numeric"
    | "compact";
  labelKey: string;
  /** 选项: `value` 入库, `label` 直接展示 (chip 文案) */
  options: ReadonlyArray<{ value: string; label: string }>;
}> = [
  {
    key: "shoeEur",
    labelKey: "shoeEur",
    // value 落库为裸号（"42"），与筛选 / 后端精确匹配一致（旧版存 "EUR 42" 导致筛选匹配不到）。
    options: [
      { value: "34", label: "34" },
      { value: "35", label: "35" },
      { value: "36", label: "36" },
      { value: "37", label: "37" },
      { value: "38", label: "38" },
      { value: "39", label: "39" },
      { value: "40", label: "40" },
      { value: "41", label: "41" },
      { value: "42", label: "42" },
      { value: "43", label: "43" },
      { value: "44", label: "44" },
      { value: "45", label: "45" },
      { value: "46", label: "46" },
    ],
  },
  {
    key: "shoeUs",
    labelKey: "shoeUs",
    options: [
      { value: "4.5", label: "4.5" },
      { value: "5", label: "5" },
      { value: "5.5", label: "5.5" },
      { value: "6", label: "6" },
      { value: "7", label: "7" },
      { value: "8", label: "8" },
      { value: "9", label: "9" },
      { value: "10", label: "10" },
      { value: "11", label: "11" },
    ],
  },
  {
    key: "womensCn",
    labelKey: "womensCn",
    options: [
      { value: "XS", label: "XS · 155/80" },
      { value: "S", label: "S · 160/84" },
      { value: "M", label: "M · 165/88" },
      { value: "L", label: "L · 170/92" },
      { value: "XL", label: "XL · 175/96" },
    ],
  },
  {
    key: "mensCn",
    labelKey: "mensCn",
    options: [
      { value: "XS", label: "XS · 160/84" },
      { value: "S", label: "S · 165/88" },
      { value: "M", label: "M · 170/92" },
      { value: "L", label: "L · 175/96" },
      { value: "XL", label: "XL · 180/100" },
      { value: "XXL", label: "XXL · 185/104" },
    ],
  },
  {
    key: "numeric",
    labelKey: "numeric",
    // 欧码数字号 36–54，与筛选「数字码」选项一致。
    options: [
      { value: "36", label: "36" },
      { value: "38", label: "38" },
      { value: "40", label: "40" },
      { value: "42", label: "42" },
      { value: "44", label: "44" },
      { value: "46", label: "46" },
      { value: "48", label: "48" },
      { value: "50", label: "50" },
      { value: "52", label: "52" },
      { value: "54", label: "54" },
    ],
  },
  {
    key: "compact",
    labelKey: "compact",
    options: [
      { value: "0", label: "0" },
      { value: "1", label: "1 · XS" },
      { value: "2", label: "2 · S" },
      { value: "3", label: "3 · M" },
      { value: "4", label: "4 · L" },
    ],
  },
];

export type SizeStandardKey = (typeof SIZE_STANDARDS)[number]["key"];

/** 按入库 slug 查找预设 */
export function getColorPresetByStoredValue(value: string) {
  return getColorOptionByValue(value);
}

/** 表单展示：预设走 i18n（本地化中英文），自定义文本原样显示 */
export function getColorDisplayText(
  value: string,
  t: (key: string) => string
): string {
  const preset = getColorPresetByStoredValue(value);
  if (preset) {
    return t(preset.labelKey);
  }
  return value;
}

/**
 * 尺码在标题里的写法：中文追加「码」，英文追加「 size」。
 * 例: "M" -> "M码" / "M size"; "1" -> "1码"; "44" -> "44码"。
 */
export function formatSizeForTitle(size: string, isEnglish: boolean): string {
  const trimmed = size.trim();
  if (!trimmed) return "";
  return isEnglish ? `${trimmed} size` : `${trimmed}码`;
}

/**
 * 自动生成商品标题：品牌 + 颜色 + 单品类型 + 尺码。
 * 缺失的字段自动跳过，颜色走 i18n 展示文案。
 */
export function buildListingTitle(
  parts: {
    brand?: string;
    color?: string;
    categoryName?: string | null;
    size?: string;
  },
  t: (key: string) => string,
  language?: string
): string {
  const isEnglish = (language ?? "").toLowerCase().startsWith("en");
  const segments: string[] = [];

  const brand = parts.brand?.trim();
  if (brand) segments.push(brand);

  const color = parts.color?.trim();
  if (color) segments.push(getColorDisplayText(color, t));

  const category = parts.categoryName?.trim();
  if (category) segments.push(category);

  const size = formatSizeForTitle(parts.size ?? "", isEnglish);
  if (size) segments.push(size);

  return segments.join(" ").trim();
}
