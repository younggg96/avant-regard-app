import { Dimensions } from "react-native";
import type { TopTab } from "./types";

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// 顶部一级 Tab 顺序（信息架构重构后）：论坛 / 帖子 / My Archive / 买手店。
// 「交易」隐藏；「推荐 / 关注」下沉为「帖子」内部二级 Tab。
export const TOP_TAB_PAGES = [
  "forum",
  "posts",
  "myArchive",
  "buyer",
] as const satisfies readonly TopTab[];

export const TOP_TAB_INDEX: Record<TopTab, number> = {
  forum: 0,
  posts: 1,
  myArchive: 2,
  buyer: 3,
};

// 默认落在「帖子」Tab（其内部默认二级为「推荐」），保留旧版「首页即推荐流」的手感。
export const DEFAULT_TOP_TAB_INDEX = TOP_TAB_INDEX.posts;

// Header 动画配置
export const HEADER_ANIMATION_DURATION = 150;
// 向下滚动超过此距离即触发收起（仅在继续向下时生效）。
export const SCROLL_THRESHOLD = 50;
// 滑回到距离顶部此值以内时才展开 Header。留 10px 容差避免顶部微抖动连续触发。
export const TOP_EXPAND_THRESHOLD = 10;
export const HEADER_HEIGHT = 34; // Logo 行：pt 2 + logo 30
/** 一级 Tab 下方整行搜索条（paddingTop 2 + 输入框 32 + paddingBottom 4） */
export const SEARCH_BAR_HEIGHT = 38;
/** 收起后 Tab 右侧搜索图标槽宽（图标 32 + 右侧留白） */
export const SEARCH_ICON_SLOT = 44;
