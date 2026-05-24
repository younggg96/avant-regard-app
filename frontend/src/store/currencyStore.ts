import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

/**
 * 用户级展示币种偏好。
 *
 * 设计要点：
 * 1) 与 `preferred_language` / `preferred_theme` 对齐——只保留一个偏好字段，
 *    后端是 `user_info.preferred_currency`，前端在 SettingsScreen 切换；
 * 2) "未显式选择"时的默认值由 locale 决定：
 *      - locale 以 `zh` 开头 → CNY（¥）
 *      - 其它（含 `en` / 任何 fallback）→ USD（$）
 * 3) 应用启动 / 切账号时若读到服务器返回的偏好与本地不同，以服务器为准（与
 *    主题偏好一致的策略），同时也支持游客 / 未登录用户在本地直接切换；
 * 4) 真正涉及价格展示的换算 / 格式化逻辑放在 `utils/currency.ts`，本 store
 *    只负责 source-of-truth 的偏好值。
 */
export type CurrencyPreference = "CNY" | "USD";

const STORAGE_KEY = "avant-regard-currency-pref";

/**
 * 根据 OS locale 推断默认币种。
 *
 * - `expo-localization` 在 RN 启动期就可用，不需要等 i18n 初始化完成；
 * - 这里有意只看 `languageCode` 前缀，而不是用户当前 app 语言——业务上
 *   "北美 app 用美元 / 中国 app 用人民币" 是与设备所在地强绑定的，不会
 *   因为用户在设置里把界面语言改成 EN 就立刻把 RMB 换成 USD（除非他们
 *   主动在币种选择里切）。
 */
export function detectDefaultCurrency(): CurrencyPreference {
  try {
    const locales = Localization.getLocales?.() ?? [];
    const first = locales[0];
    const lang = (first?.languageCode ?? "").toLowerCase();
    const region = (first?.regionCode ?? "").toUpperCase();
    if (lang.startsWith("zh") || region === "CN") return "CNY";
    return "USD";
  } catch {
    return "USD";
  }
}

interface CurrencyState {
  /** 用户显式选择的币种；为 null 表示沿用 locale 默认。 */
  preference: CurrencyPreference | null;
  /** 是否已经从 AsyncStorage 完成 rehydrate（避免首屏被默认值闪一下）。 */
  hasHydrated: boolean;
  /** locale 默认值——只在初始化时计算一次，避免每次 selector 都走 i18n。 */
  localeDefault: CurrencyPreference;

  setPreference: (next: CurrencyPreference | null) => void;
  /** 仅当本地没有显式偏好时，才用服务器值回填，避免覆盖用户刚刚的本地切换。 */
  hydrateFromServer: (serverValue: CurrencyPreference | null | undefined) => void;
  /** 用户登出 / 清账户态时调用。 */
  reset: () => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      preference: null,
      hasHydrated: false,
      localeDefault: detectDefaultCurrency(),

      setPreference: (next) => {
        set({ preference: next });
      },

      hydrateFromServer: (serverValue) => {
        if (serverValue !== "CNY" && serverValue !== "USD") return;
        const current = get().preference;
        // 已经显式选过 → 保留本地；只在"从未选过"时让服务器值兜底。
        if (current == null) {
          set({ preference: serverValue });
        }
      },

      reset: () => {
        set({ preference: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: async (key: string) => {
          try {
            return (await AsyncStorage?.getItem(key)) || null;
          } catch (error) {
            console.warn("[currencyStore] getItem error:", error);
            return null;
          }
        },
        setItem: async (key: string, value: string) => {
          try {
            await AsyncStorage?.setItem(key, value);
          } catch (error) {
            console.warn("[currencyStore] setItem error:", error);
          }
        },
        removeItem: async (key: string) => {
          try {
            await AsyncStorage?.removeItem(key);
          } catch (error) {
            console.warn("[currencyStore] removeItem error:", error);
          }
        },
      })),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        // 即使 rehydrate 失败也得标 hasHydrated，否则 selector 会卡在加载态。
        useCurrencyStore.setState({ hasHydrated: true });
        if (state) {
          // localeDefault 不参与持久化（设备换了 locale 应当生效），重新计算一次。
          useCurrencyStore.setState({ localeDefault: detectDefaultCurrency() });
        }
      },
    }
  )
);

/**
 * 返回当前生效的展示币种：用户显式选过 → 用选择值；否则用 locale 默认。
 *
 * 推荐通过 `useCurrency()` hook 拿到该值——hook 内部走 zustand selector，
 * 偏好或 locale 默认变化时会自动重渲染。
 */
export function getCurrentCurrency(): CurrencyPreference {
  const { preference, localeDefault } = useCurrencyStore.getState();
  return preference ?? localeDefault;
}

/** React hook：拿当前生效币种 + setter。 */
export function useCurrency(): {
  currency: CurrencyPreference;
  preference: CurrencyPreference | null;
  setPreference: (next: CurrencyPreference | null) => void;
} {
  const preference = useCurrencyStore((s) => s.preference);
  const localeDefault = useCurrencyStore((s) => s.localeDefault);
  const setPreference = useCurrencyStore((s) => s.setPreference);
  return {
    currency: preference ?? localeDefault,
    preference,
    setPreference,
  };
}
