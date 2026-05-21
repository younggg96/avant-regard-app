import { Dimensions } from "react-native";

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Tab 索引映射
// 顺序与 DiscoverTabBar 视觉顺序保持一致：论坛 / 推荐 / 交易 / 买手店 / 关注。
// 交易 (trading) Tab 显示 PRD 模块二 Marketplace（C2C + 买手店合并瀑布流）。
export const TAB_INDEX_MAP = {
  forum: 0,
  recommend: 1,
  trading: 2,
  buyer: 3,
  following: 4,
} as const;

// Header 动画配置
export const HEADER_ANIMATION_DURATION = 150;
// 向下滚动超过此距离即触发收起（仅在继续向下时生效）。
export const SCROLL_THRESHOLD = 50;
// 滑回到距离顶部此值以内时才展开 Header。留 10px 容差避免顶部微抖动连续触发。
export const TOP_EXPAND_THRESHOLD = 10;
export const HEADER_HEIGHT = 106; // DiscoverHeader 高度（视频行 + 搜索框行）
