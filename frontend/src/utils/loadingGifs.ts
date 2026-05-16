/**
 * Theme-aware loading GIF picker.
 *
 * 设计要点：
 *
 * - `profile-loading.gif` / `map-loading.gif` 是浅色品牌动图，丢在 dark mode
 *   的深色页面里会出现一大块刺眼白底；产品又分别提供了深色版本
 *   (`*-dark.gif`)，在 dark mode 下要替换成深色版本以保持品牌闪屏体感、又
 *   不破坏暗色主题观感。
 *
 * - `require()` 调用必须是常量字面量（Metro 在编译期解析），所以这里把四个
 *   asset 提前 require 出来缓存为模块级常量，hooks 只做主题分支选择，零额外
 *   分配 / 零运行时 IO。
 *
 * - 用 hook 形式（依赖 `useAppTheme`）避免每个调用点重复写
 *   `theme.mode === 'dark' ? darkGif : lightGif`，并保证主题切换时 React 重
 *   渲染会自动取到新的 source。
 */
import { useAppTheme } from "../theme";

const PROFILE_LOADING_LIGHT = require("../../assets/gif/profile-loading.gif");
const PROFILE_LOADING_DARK = require("../../assets/gif/profile-loading-dark.gif");
const MAP_LOADING_LIGHT = require("../../assets/gif/map-loading.gif");
const MAP_LOADING_DARK = require("../../assets/gif/map-loading-dark.gif");

export const useProfileLoadingGif = () => {
  const theme = useAppTheme();
  return theme.mode === "dark" ? PROFILE_LOADING_DARK : PROFILE_LOADING_LIGHT;
};

export const useMapLoadingGif = () => {
  const theme = useAppTheme();
  return theme.mode === "dark" ? MAP_LOADING_DARK : MAP_LOADING_LIGHT;
};
