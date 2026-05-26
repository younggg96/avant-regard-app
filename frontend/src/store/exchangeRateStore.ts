import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Exchange rate store
 * ------------------------------------------------------------------
 * 维护 USD/CNY 的实时汇率。设计要点：
 *
 * 1. 数据源是公开的 `open.er-api.com`（ECB / 央行公开汇率，不需要 API key，
 *    免费可用）。失败时回退到静态 7.2 兜底，永远不让 UI 拿到 NaN。
 * 2. 拉到的值持久化在 AsyncStorage（key `avant-regard-exchange-rate`），
 *    重启 App 时立刻有可用值，不需要等首条网络请求完成。
 * 3. TTL 默认 6 小时 —— 真实零售场景下，USD/CNY 在 6 小时内的波动通常
 *    < 0.5%，对价格展示已经足够准确；过期后 store 会在下次 `refreshIfStale`
 *    被调用时静默 fetch 一次。
 * 4. **只用于展示**：订单 / 支付 / 钱包结算金额永远以后端原始 currency +
 *    priceCents 为准，绝不用这里的 rate 计算落账金额。
 */

const FALLBACK_USD_TO_CNY = 7.2;
const STORAGE_KEY = "avant-regard-exchange-rate";
const REFRESH_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 8 * 1000;
const EXCHANGE_API_URL = "https://open.er-api.com/v6/latest/USD";

/**
 * 1 USD = `usdToCny` CNY；CNY → USD 直接用倒数。
 * 单独抽出来便于上游算 cross-currency（USD↔USD = 1, CNY↔CNY = 1）。
 */
export interface ExchangeRates {
  usdToCny: number;
  /** 上次成功 fetch 的毫秒时间戳；为 0 表示尚未从网络拉到过（用 fallback）。 */
  fetchedAt: number;
  /** "live" = 从 API 拉到；"fallback" = 静态兜底；"cache" = 来自 AsyncStorage。 */
  source: "live" | "fallback" | "cache";
}

interface ExchangeRateState extends ExchangeRates {
  isLoading: boolean;
  error: string | null;
  /** 立即刷新（不看 TTL）；常用于用户在 Settings 切换币种后想看到最新汇率。 */
  refresh: () => Promise<void>;
  /** TTL 未过期就不打网络请求；冷启动 / 回到前台时调用。 */
  refreshIfStale: () => Promise<void>;
}

interface OpenErApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

async function fetchUsdToCny(): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(EXCHANGE_API_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as OpenErApiResponse;
    if (body.result !== "success" || !body.rates) return null;
    const cny = body.rates["CNY"];
    if (typeof cny !== "number" || !Number.isFinite(cny) || cny <= 0) return null;
    return cny;
  } catch (error) {
    console.warn("[exchangeRateStore] fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const useExchangeRateStore = create<ExchangeRateState>()(
  persist(
    (set, get) => ({
      usdToCny: FALLBACK_USD_TO_CNY,
      fetchedAt: 0,
      source: "fallback",
      isLoading: false,
      error: null,

      refresh: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        const rate = await fetchUsdToCny();
        if (rate != null) {
          set({
            usdToCny: rate,
            fetchedAt: Date.now(),
            source: "live",
            isLoading: false,
            error: null,
          });
        } else {
          // 拉失败：保留旧值（cache / fallback），但记录错误供调试。
          set({ isLoading: false, error: "exchange_rate_fetch_failed" });
        }
      },

      refreshIfStale: async () => {
        const { fetchedAt } = get();
        if (Date.now() - fetchedAt < REFRESH_TTL_MS) return;
        await get().refresh();
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: async (key: string) => {
          try {
            return (await AsyncStorage?.getItem(key)) || null;
          } catch (error) {
            console.warn("[exchangeRateStore] getItem error:", error);
            return null;
          }
        },
        setItem: async (key: string, value: string) => {
          try {
            await AsyncStorage?.setItem(key, value);
          } catch (error) {
            console.warn("[exchangeRateStore] setItem error:", error);
          }
        },
        removeItem: async (key: string) => {
          try {
            await AsyncStorage?.removeItem(key);
          } catch (error) {
            console.warn("[exchangeRateStore] removeItem error:", error);
          }
        },
      })),
      partialize: (state) => ({
        usdToCny: state.usdToCny,
        fetchedAt: state.fetchedAt,
        source: state.source,
      }),
      onRehydrateStorage: () => (state) => {
        // 持久化值标记为 cache（与本次启动的实时值区分），便于 UI 判断要不要
        // 显示 "汇率更新中..." 之类的提示。
        if (state && state.fetchedAt > 0) {
          useExchangeRateStore.setState({ source: "cache" });
        }
      },
    }
  )
);

/**
 * 同步读取当前 USD/CNY 汇率。在格式化器 / hint 里直接调用，比走 hook 更轻。
 */
export function getUsdToCnyRate(): number {
  const { usdToCny } = useExchangeRateStore.getState();
  return Number.isFinite(usdToCny) && usdToCny > 0
    ? usdToCny
    : FALLBACK_USD_TO_CNY;
}
