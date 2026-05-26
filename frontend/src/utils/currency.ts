/**
 * 价格格式化工具
 * ------------------------------------------------------------------
 * 业务背景：
 *   - 后端价格统一以 `priceCents` + `currency`（CNY / USD）存储；
 *   - 历史数据里 99% 商品 currency = "CNY"，后续会逐步出现 USD；
 *   - 用户层面有一个"展示偏好" `preferred_currency`（见 currencyStore），
 *     用来决定 UI 上看到的符号 / 千分位 / 是否走汇率换算；
 *   - 汇率走 `exchangeRateStore`（实时 USD/CNY，AsyncStorage 缓存 + 6h TTL）。
 *
 * 设计思路：
 *   1. 保留原 `formatPrice(cents, currency)` 行为不变（按 source currency
 *      原样展示，不做换算）；存量调用点不需要改。
 *   2. 新增 `formatPriceDisplay(cents, sourceCurrency, displayCurrency)`：
 *      - sourceCurrency 与 displayCurrency 相同 → 原样展示；
 *      - 不同 → 走 `exchangeRateStore` 的实时汇率换算（拉不到则用静态 7.2 兜底）。
 *   3. 提供 React hook `useFormatPrice` 自动读取当前用户偏好 + 实时汇率；
 *      用户切币种 / 汇率刷新时，所有调用点会自动 rerender。
 *   4. `useSellerCurrencyHint(cents, sourceCurrency)`：当卖家原币种 ≠ 当前展示币种
 *      时，返回 "原价 ¥ 9,600 · 汇率 1 USD ≈ 7.20 CNY"；相同时返回 null。
 *
 * 重要：以下汇率换算仅用于"展示给买家看的金额"，
 * 真实下单 / 钱包 / 结算金额永远以后端返回的原始 currency + cents 为准。
 */

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  type CurrencyPreference,
  useCurrency,
} from "../store/currencyStore";
import {
  getUsdToCnyRate,
  useExchangeRateStore,
} from "../store/exchangeRateStore";

/** 标准化后端可能传回的各种 currency 字符串。 */
export function normalizeCurrency(
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

/**
 * 计算 source → target 的换算倍率。
 *
 * - source = target → 1
 * - USD → CNY → `usdToCny`
 * - CNY → USD → `1 / usdToCny`
 *
 * `usdToCny` 来自 `exchangeRateStore`（实时；6h TTL；持久化）。
 */
export function getConversionRate(
  source: CurrencyPreference,
  target: CurrencyPreference,
  /** 注入 rate；不传时同步读 store。便于纯函数测试。 */
  usdToCny: number = getUsdToCnyRate()
): number {
  if (source === target) return 1;
  if (source === "USD" && target === "CNY") return usdToCny;
  if (source === "CNY" && target === "USD") return 1 / usdToCny;
  return 1;
}

interface FormatOptions {
  /**
   * 是否把整元金额省略 `.00`。默认 false（与历史 `formatPrice` 行为一致：
   * 始终展示 2 位小数）。Marketplace 网格 / Product 卡需要紧凑视觉时传 true，
   * 整数走千分位（"¥ 5,890"），带小数固定 2 位（"$ 58.90"）。
   */
  trimZeroFraction?: boolean;
  /** 是否在符号后插入空格。默认 true，与现有 UI 风格保持一致。 */
  spaceAfterSymbol?: boolean;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  trimZeroFraction: false,
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
  options: FormatOptions = {},
  /** 可选注入；默认走 store。 */
  usdToCny: number = getUsdToCnyRate()
): string {
  if (priceCents == null || Number.isNaN(priceCents)) return "";
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const src = normalizeCurrency(sourceCurrency);
  const rate = getConversionRate(src, displayCurrency, usdToCny);
  const amountUnits = (priceCents / 100) * rate;
  const formatted = formatAmount(amountUnits, opts);
  const symbol = getCurrencySymbol(displayCurrency);
  return opts.spaceAfterSymbol ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
}

/**
 * React hook：拿当前用户偏好币种 + 已绑定 displayCurrency / 实时汇率的格式化器。
 *
 * 用法：
 * ```ts
 * const formatPrice = useFormatPrice();
 * <Text>{formatPrice(product.priceCents, product.currency)}</Text>
 * ```
 *
 * 当用户在 Settings 切换币种 或 汇率刷新时，所有用了该 hook 的组件会自动 rerender。
 */
export function useFormatPrice(): (
  priceCents: number | null | undefined,
  sourceCurrency?: string | null | undefined,
  options?: FormatOptions
) => string {
  const { currency } = useCurrency();
  const usdToCny = useExchangeRateStore((s) => s.usdToCny);
  return useCallback(
    (priceCents, sourceCurrency, options) =>
      formatPriceDisplay(priceCents, sourceCurrency, currency, options, usdToCny),
    [currency, usdToCny]
  );
}

/** 当前生效币种符号（hook 版）；多用于不带金额的标签场景（如输入框前的 `¥`）。 */
export function useCurrencySymbol(): string {
  const { currency } = useCurrency();
  return getCurrencySymbol(currency);
}

// ============================================================================
// 卖家原币种提示
// ============================================================================

export interface SellerCurrencyHintParts {
  /** 卖家原币种下的原价（如 "¥ 9,600.00" / "$ 1,333.33"）。 */
  originalPrice: string;
  /** 当前对照汇率（如 "1 USD ≈ 7.20 CNY" / "1 CNY ≈ 0.139 USD"）。 */
  rate: string;
  /** 卖家原币种 ISO 码。 */
  sourceCurrency: CurrencyPreference;
  /** 当前展示币种 ISO 码。 */
  displayCurrency: CurrencyPreference;
}

/**
 * 给一份 `(cents, sourceCurrency)`，相对当前用户偏好币种生成结构化提示。
 * 当 source = display 时返回 null（上层据此决定是否渲染该行）。
 */
export function buildSellerCurrencyHint(
  priceCents: number | null | undefined,
  sourceCurrency: string | null | undefined,
  displayCurrency: CurrencyPreference,
  usdToCny: number = getUsdToCnyRate()
): SellerCurrencyHintParts | null {
  if (priceCents == null || Number.isNaN(priceCents)) return null;
  const src = normalizeCurrency(sourceCurrency);
  if (src === displayCurrency) return null;

  // 原价：按卖家币种原样展示（不换算），方便买家校对。
  const originalPrice = formatPriceDisplay(
    priceCents,
    src,
    src,
    { trimZeroFraction: false },
    usdToCny
  );

  // 汇率描述：固定 "1 srcUnit ≈ rate dstUnit"，rate 保留 4 位 + 千分位。
  const rateSrcToDst = getConversionRate(src, displayCurrency, usdToCny);
  const rateStr = rateSrcToDst.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const rate = `1 ${src} ≈ ${rateStr} ${displayCurrency}`;

  return {
    originalPrice,
    rate,
    sourceCurrency: src,
    displayCurrency,
  };
}

/**
 * React hook：当卖家原币种 ≠ 用户当前展示币种时，返回可直接渲染的字符串行。
 *
 * 返回 `{ originalLine, rateLine }`：
 *   - originalLine：i18n 文案，例如 "Originally ¥ 9,600.00" / "原价 ¥ 9,600.00"
 *   - rateLine：i18n 文案，例如 "Rate 1 USD ≈ 7.20 CNY" / "汇率 1 USD ≈ 7.20 CNY"
 *
 * 返回 null 表示卖家与买家币种一致，UI 不渲染该提示。
 */
export function useSellerCurrencyHint(
  priceCents: number | null | undefined,
  sourceCurrency: string | null | undefined
): { originalLine: string; rateLine: string; parts: SellerCurrencyHintParts } | null {
  const { currency: displayCurrency } = useCurrency();
  const usdToCny = useExchangeRateStore((s) => s.usdToCny);
  const { t } = useTranslation();
  return useMemo(() => {
    const parts = buildSellerCurrencyHint(
      priceCents,
      sourceCurrency,
      displayCurrency,
      usdToCny
    );
    if (!parts) return null;
    return {
      originalLine: t("currency.sellerOriginalPrice", {
        price: parts.originalPrice,
        defaultValue: "Originally {{price}}",
      }),
      rateLine: t("currency.exchangeRate", {
        rate: parts.rate,
        defaultValue: "Rate {{rate}}",
      }),
      parts,
    };
  }, [priceCents, sourceCurrency, displayCurrency, usdToCny, t]);
}
