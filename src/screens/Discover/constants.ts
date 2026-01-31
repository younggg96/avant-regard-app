import { Dimensions } from "react-native";

export const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Tab 索引映射
export const TAB_INDEX_MAP = {
  forum: 0,
  recommend: 1,
  following: 2,
} as const;

// Header 动画配置
export const HEADER_ANIMATION_DURATION = 150;
export const SCROLL_THRESHOLD = 50;
export const BOTTOM_THRESHOLD = 100;
export const HEADER_HEIGHT = 80;
