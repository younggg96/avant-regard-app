/**
 * 全局主题层。
 *
 * 设计要点：
 *
 * 1. 颜色 Proxy（`theme.colors.*`）：在 INLINE 样式里读取时永远返回当前激活
 *    主题的颜色，所以不必每个组件都改也能跟随深色模式。例：
 *      <Text style={{ color: theme.colors.black }}>...</Text>
 *
 * 2. 但 React Native 的 `StyleSheet.create({...})` 会在模块加载时把当时
 *    Proxy 返回的值固化为字符串字面量，之后切换主题不会再触发更新。涉及
 *    `StyleSheet.create` 中带颜色的样式，必须改为
 *      const styles = useThemedStyles((t) => StyleSheet.create({...}))
 *    或者把颜色挪到内联样式里。
 *
 * 3. `useAppTheme()` 通过 React Context 拿到当前完整 AppTheme 对象，是 hook
 *    形态消费主题的首选入口；`useThemedStyles(factory)` 是常见样式工厂模式
 *    的便捷封装。
 *
 * 4. `setActiveTheme(mode)` 由根 `ThemeProvider` 调用，顺带刷新 Proxy 读取
 *    的全局可变指针。注意它不会触发 React 重渲染——重渲染由 Context 完成。
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  type FC,
  type ReactNode,
} from "react";
import { StyleSheet } from "react-native";

export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | "light" | "dark";

const lightColors = {
  black: "#000000",
  white: "#FFFFFF",
  gray50: "#F9F9F9",
  gray100: "#F5F5F5",
  gray200: "#AAAAAA",
  gray300: "#666666",
  gray400: "#444444",
  gray500: "#222222",
  gray600: "#111111",
  gray700: "#000000",
  accent: "#000000",
  error: "#FF3B30",
  success: "#34C759",
  // Brand accents (kept stable across modes; only luminance adjusts).
  plusGold: "#F5A623",
  starRated: "#F5A623",
  // Semantic surfaces
  background: "#FFFFFF",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  surface: "#F5F5F5",
  text: "#000000",
  textSecondary: "#666666",
  textInverted: "#FFFFFF",
  border: "#F5F5F5",
  divider: "#EFEFEF",
  overlay: "rgba(0,0,0,0.45)",
  scrim: "rgba(0,0,0,0.4)",
  brandChipBg: "rgba(255,255,255,0.14)",
  inputBackground: "#FFFFFF",
  inputBorder: "#E5E5E5",
  placeholder: "#9A9A9A",
  skeleton: "#EFEFEF",
} as const;

const darkColors = {
  // Inverted greys: keep the same semantic naming but swap brightness so that
  // legacy code referring to `theme.colors.white` (used as a surface) still
  // looks like a "page background" rather than a literally white block.
  black: "#FFFFFF",
  white: "#0A0A0A",
  gray50: "#121212",
  gray100: "#1F1F1F",
  gray200: "#3A3A3A",
  gray300: "#A0A0A0",
  gray400: "#CFCFCF",
  gray500: "#E5E5E5",
  gray600: "#F2F2F2",
  gray700: "#FFFFFF",
  accent: "#FFFFFF",
  error: "#FF6B6B",
  success: "#5CD67A",
  // Brand accents kept readable on dark surfaces.
  plusGold: "#FFC04C",
  starRated: "#FFC04C",
  background: "#000000",
  card: "#000000",
  cardElevated: "#1A1A1A",
  surface: "#161616",
  text: "#FFFFFF",
  textSecondary: "#A0A0A0",
  textInverted: "#0A0A0A",
  border: "#262626",
  divider: "#1F1F1F",
  overlay: "rgba(0,0,0,0.7)",
  scrim: "rgba(0,0,0,0.6)",
  brandChipBg: "rgba(255,255,255,0.10)",
  inputBackground: "#161616",
  inputBorder: "#2B2B2B",
  placeholder: "#6A6A6A",
  skeleton: "#1F1F1F",
} as const;

const baseTokens = {
  typography: {
    hero: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 48,
      lineHeight: 52,
      letterSpacing: -0.5,
    },
    h1: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 32,
      lineHeight: 38,
    },
    h2: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 24,
      lineHeight: 30,
    },
    h3: {
      fontFamily: "PlayfairDisplay-Medium",
      fontSize: 18,
      lineHeight: 24,
    },
    h4: {
      fontFamily: "PlayfairDisplay-Medium",
      fontSize: 16,
      lineHeight: 22,
    },
    body: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 16,
      lineHeight: 24,
    },
    bodySmall: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 12,
      lineHeight: 16,
    },
    button: {
      fontFamily: "PlayfairDisplay-Medium",
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: 0.5,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  /**
   * 设计统一：所有非「圆形」组件的圆角统一为 4，避免大小不一的视觉割裂。
   * `full` 仍然保留 9999 用于头像 / pill 等需要完整圆形的场景。
   */
  borderRadius: {
    sm: 4,
    md: 4,
    lg: 4,
    xl: 4,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };
export type TypographyTokens = typeof baseTokens.typography;
export type SpacingTokens = typeof baseTokens.spacing;
export type RadiusTokens = typeof baseTokens.borderRadius;
export type ShadowTokens = typeof baseTokens.shadows;

export interface AppTheme {
  mode: ThemeMode;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: RadiusTokens;
  shadows: ShadowTokens;
}

export const lightTheme: AppTheme = {
  ...baseTokens,
  mode: "light",
  colors: lightColors,
};

export const darkTheme: AppTheme = {
  ...baseTokens,
  mode: "dark",
  colors: darkColors,
};

// ---- Active mode tracker (global mutable state for the legacy Proxy) ----

let activeMode: ThemeMode = "light";
const subscribers = new Set<(mode: ThemeMode) => void>();

export const getActiveThemeMode = (): ThemeMode => activeMode;
export const getActiveTheme = (): AppTheme =>
  activeMode === "dark" ? darkTheme : lightTheme;

export const setActiveThemeMode = (mode: ThemeMode) => {
  if (activeMode === mode) return;
  activeMode = mode;
  subscribers.forEach((fn) => {
    try {
      fn(mode);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const subscribeToActiveThemeMode = (
  fn: (mode: ThemeMode) => void
): (() => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

// ---- Reactive `theme` proxy (legacy compat) ----
//
// Inline references (`<View style={{ backgroundColor: theme.colors.white }} />`)
// will resolve to the active theme color on every render. Static
// `StyleSheet.create({...})` will only resolve once and stay fixed.

const reactiveColors = new Proxy({} as ColorTokens, {
  get(_target, key: string) {
    return getActiveTheme().colors[key as keyof ColorTokens];
  },
  ownKeys() {
    return Reflect.ownKeys(lightColors);
  },
  getOwnPropertyDescriptor(_target, key) {
    if (Object.prototype.hasOwnProperty.call(lightColors, key)) {
      return {
        enumerable: true,
        configurable: true,
        value: getActiveTheme().colors[key as keyof ColorTokens],
      };
    }
    return undefined;
  },
});

export const theme = {
  ...baseTokens,
  colors: reactiveColors,
};

// ---- Helpers ----

export const resolveThemeMode = (
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
): ThemeMode => {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return systemScheme === "dark" ? "dark" : "light";
};

export const getThemeByMode = (mode: ThemeMode): AppTheme =>
  mode === "dark" ? darkTheme : lightTheme;

// ---- React Context + hooks ----

const ThemeContext = createContext<AppTheme>(lightTheme);

export interface ThemeProviderProps {
  value: AppTheme;
  children: ReactNode;
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ value, children }) => {
  // Keep the global mutable mode in sync with the React tree's active value.
  // Done as a layout effect-equivalent (synchronous useMemo trigger) so legacy
  // Proxy reads stay consistent with what hook consumers see.
  if (value.mode !== activeMode) {
    setActiveThemeMode(value.mode);
  }
  // Belt-and-suspenders: also re-assert on commit, in case mounting order
  // skipped the synchronous block above.
  useEffect(() => {
    setActiveThemeMode(value.mode);
  }, [value.mode]);
  return createElement(ThemeContext.Provider, { value }, children);
};

export const useAppTheme = (): AppTheme => useContext(ThemeContext);

/**
 * Build a memoised StyleSheet that rebuilds when the theme changes. Use
 * inside components to keep StyleSheet.create benefits while still being
 * theme-reactive:
 *
 *   const styles = useThemedStyles((t) => StyleSheet.create({
 *     container: { backgroundColor: t.colors.background },
 *   }));
 *
 * The generic is intentionally unconstrained — `StyleSheet.create`'s
 * recursive `NamedStyles<T>` constraint can confuse TypeScript when the
 * factory is declared after the call site (a common pattern), causing every
 * `styles.foo` access to fall back to `unknown`. Trusting the factory's
 * return type lets inference flow naturally.
 */
export function useThemedStyles<T>(factory: (t: AppTheme) => T): T {
  const t = useAppTheme();
  return useMemo(() => factory(t), [t, factory]);
}

/** Legacy compat — not theme aware (typography hasn't changed across modes). */
export const playfairFonts = {
  regular: "PlayfairDisplay-Regular",
  medium: "PlayfairDisplay-Medium",
  bold: "PlayfairDisplay-Bold",
} as const;
