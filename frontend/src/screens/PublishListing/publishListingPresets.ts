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

/**
 * 颜色快捷选项。展示文案 = 入库值（中文）。
 * 后端 `store_products.color` 是 VARCHAR(32), 直接存中文即可（保留与现有数据
 * 一致的写法, e.g. "黑色"）。需要做英文展示时由调用方做 i18n key 映射。
 */
export const COLOR_PRESETS: ReadonlyArray<{
  /** 入库值（中文） */
  value: string;
  /** i18n key (在 trading.publishListing.colors.* 下) */
  labelKey: string;
}> = [
  { value: "黑色", labelKey: "black" },
  { value: "白色", labelKey: "white" },
  { value: "灰色", labelKey: "gray" },
  { value: "米色", labelKey: "beige" },
  { value: "棕色", labelKey: "brown" },
  { value: "红色", labelKey: "red" },
  { value: "粉色", labelKey: "pink" },
  { value: "橙色", labelKey: "orange" },
  { value: "黄色", labelKey: "yellow" },
  { value: "绿色", labelKey: "green" },
  { value: "蓝色", labelKey: "blue" },
  { value: "紫色", labelKey: "purple" },
  { value: "金色", labelKey: "gold" },
  { value: "银色", labelKey: "silver" },
  { value: "彩色", labelKey: "multi" },
];

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
    options: [
      { value: "EUR 35", label: "35" },
      { value: "EUR 36", label: "36" },
      { value: "EUR 37", label: "37" },
      { value: "EUR 38", label: "38" },
      { value: "EUR 39", label: "39" },
      { value: "EUR 40", label: "40" },
      { value: "EUR 41", label: "41" },
      { value: "EUR 42", label: "42" },
      { value: "EUR 43", label: "43" },
      { value: "EUR 44", label: "44" },
      { value: "EUR 45", label: "45" },
      { value: "EUR 46", label: "46" },
    ],
  },
  {
    key: "shoeUs",
    labelKey: "shoeUs",
    options: [
      { value: "US 5", label: "5" },
      { value: "US 6", label: "6" },
      { value: "US 7", label: "7" },
      { value: "US 8", label: "8" },
      { value: "US 9", label: "9" },
      { value: "US 10", label: "10" },
      { value: "US 11", label: "11" },
      { value: "US 12", label: "12" },
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
    options: [
      { value: "44", label: "44" },
      { value: "46", label: "46" },
      { value: "48", label: "48" },
      { value: "50", label: "50" },
      { value: "52", label: "52" },
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
