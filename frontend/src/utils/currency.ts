/**
 * 价格格式化工具
 * ------------------------------------------------------------------
 * 业务背景：
 *   - 后端价格统一以 `priceCents` + `currency`（CNY / USD）存储；
 *   - 历史数据里 99% 商品 currency = "CNY"，后续会逐步出现 USD；
 *   - 用户层面有一个"展示偏好" `preferred_currency`（见 currencyStore），
 *     用来决定 UI 上看到的符号 / 千分位 / 是否走汇率换算；
 *
 * 设计思路：
 *   1. 保留原 `formatPrice(cents, currency)` 行为不变（按 source currency
 *      原样展示，不做换算）；存量调用点不需要改。
 *   2. 新增 `formatPriceDisplay(cents, sourceCurrency, displayCurrency)`：
 *      - sourceCurrency 与 displayCurrency 相同 → 原样展示；
 *      - 不同 → 用 `EXCHANGE_RATES` 表静态换算（生产环境后续替换为后端下发或
 *        实时汇率服务，但保持当前接口不变）。
 *   3. 提供 React hook `useFormatPrice` 自动读取当前用户偏好，调用方写
 *        `const fmt = useFormatPrice(); fmt(product.priceCents, product.currency)`
 *      即可拿到本地化展示串。
 *
 * 重要：以下静态汇率仅用于"用户看 vs 实际下单"间的视觉换算，
 * 真实下单 / 结算金额永远以 priceCents + currency 为准。
 */

import { useCallback } from "react";
import {
  type CurrencyPreference,
  useCurrency,
} from "../store/currencyStore";

/**
 * 静态汇率表（base = 1 unit）。
 *
 * 例：1 USD ≈ 7.2 CNY，1 CNY ≈ 0.139 USD。
 * - 该值后续可以替换为后端 `/api/exchange-rates` 实时返回；
 * - 切勿把这个汇率用在订单 / 钱包 / 结算的"金额计算"上，那些必须沿用
 *   后端返回的原始 currency + cents。
 */
export const EXCHANGE_RATES: Record<
  CurrencyPreference,
  Record<CurrencyPreference, number>
> = {
  CNY: { CNY: 1, USD: 1 / 7.2 },
  USD: { CNY: 7.2, USD: 1 },
};

/** 标准化后端可能传回的各种 currency 字符串。 */
function normalizeCurrency(
  currency: string | null | undefined
): CurrencyPreference {
  if (!currency) return "CNY";
  const upper = currency.toUpperCase();
  if (upper === "USD") return "USD";
  if (upper === "RMB" || upper === "CNY" || upper === "JPY") return "CNY";
  return "CNY";
}

/** 币种符号；`¥` 同时表示人民币和日元，这里按 currency 字段决定上下文。 */
export function getCurrencySymbol(currency: CurrencyPreference): string {
  return currency === "USD" ? "$" : "¥";
}

interface FormatOptions {
  /**
   * 是否把整元金额省略 `.00`。默认与 marketplace `ProductCard` 行为一致：
   * 整数 → 千分位（"¥ 5,890" / "$ 999"）；带小数 → 固定 2 位（"$ 58.90"）。
   */
  trimZeroFraction?: boolean;
  /** 是否在符号后插入空格。默认 true，与现有 UI 风格保持一致。 */
  spaceAfterSymbol?: boolean;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  trimZeroFraction: true,
  spaceAfterSymbol: true,
};

const FORMATTER = new Intl.NumberFormat("en-US");

function formatAmount(
  amountUnits: number,
  options: Required<FormatOptions>
): string {
  if (options.trimZeroFraction && Number.isInteger(amountUnits)) {
    return FORMATTER.format(amountUnits);
  }
  // 用 toFixed 保留 2 位，再补千分位。
  const fixed = amountUnits.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  return `${FORMATTER.format(Number(intPart))}.${decPart}`;
}

/**
 * 把"源币种 cents" → "目标币种" 字符串。
 *
 * cents 为 null/NaN 时返回空串；目标 = 源 → 原样格式化，不走换算。
 */
export function formatPriceDisplay(
  priceCents: number | null | undefined,
  sourceCurrency: string | null | undefined,
  displayCurrency: CurrencyPreference,
  options: FormatOptions = {}
): string {
  if (priceCents == null || Number.isNaN(priceCents)) return "";
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const src = normalizeCurrency(sourceCurrency);
  const rate = EXCHANGE_RATES[src][displayCurrency];
  const amountUnits = (priceCents / 100) * rate;
  const formatted = formatAmount(amountUnits, opts);
  const symbol = getCurrencySymbol(displayCurrency);
  return opts.spaceAfterSymbol ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
}

/**
 * React hook：拿当前用户偏好币种 + 已绑定 displayCurrency 的格式化器。
 *
 * 用法：
 * ```ts
 * const formatPrice = useFormatPrice();
 * <Text>{formatPrice(product.priceCents, product.currency)}</Text>
 * ```
 *
 * 当用户在 Settings 切换币种时，所有用了该 hook 的组件会自动 rerender。
 */
export function useFormatPrice(): (
  priceCents: number | null | undefined,
  sourceCurrency?: string | null | undefined,
  options?: FormatOptions
) => string {
  const { currency } = useCurrency();
  return useCallback(
    (priceCents, sourceCurrency, options) =>
      formatPriceDisplay(priceCents, sourceCurrency, currency, options),
    [currency]
  );
}

/** 当前生效币种符号（hook 版）；多用于不带金额的标签场景（如输入框前的 `¥`）。 */
export function useCurrencySymbol(): string {
  const { currency } = useCurrency();
  return getCurrencySymbol(currency);
}
