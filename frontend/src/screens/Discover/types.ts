import { UserInfo } from "../../services/userInfoService";

// 用于展示的Post类型（与PostCard组件兼容）
export interface DisplayPost {
  id: string;
  type: string;
  auditStatus?: string; // 审核状态
  author: {
    id: string;
    name: string;
    avatar: string;
    isVerified?: boolean;
    title?: string;
  };
  content: {
    title: string;
    description?: string;
    images: string[];
    tags?: string[];
    /**
     * Natural aspect ratio (width / height) of the cover image, derived from
     * backend-provided `coverWidth` / `coverHeight`. When present, feed cards
     * can size themselves on first paint instead of running an async
     * `Image.getSize` on every scroll — the main source of MasonryFlashList
     * re-layout jank. `undefined` falls back to the 3/4 portrait default.
     */
    coverAspectRatio?: number;
  };
  engagement: {
    likes: number;
    saves: number;
    comments: number;
    isLiked?: boolean;
    isSaved?: boolean;
  };
  timestamp: string;
  // 关联的秀场 ID 列表（ID 可能是整数或字符串）
  showIds?: (number | string)[];
  // 论坛帖子所属社区
  communityId?: number;
  communityName?: string;
  // 买手店帖子（migration 055）— 设置后 PostCard 会显示「店铺」角标。
  storeId?: string;
  storeName?: string;
}

/**
 * 数据层 / 发布分流用的细粒度 Tab 标识。
 *
 * 说明：`recommend` / `following` 现在是「帖子」顶部 Tab 内部的二级切换，
 * `myArchive` 是新的「My Archive」顶部 Tab。这些值仍写进 `discoverTabStore`
 * 供底部「+」发布按钮判断当前语境；`trading` 保留仅用于兼容（顶部不再展示）。
 */
export type TabType =
  | "forum"
  | "recommend"
  | "trading"
  | "buyer"
  | "following"
  | "myArchive"
  | "events";

/**
 * 顶部一级 Tab：论坛 / 帖子 / 活动 / My Archive / 买手店。
 * 「交易」隐藏；「推荐 / 关注」下沉为「帖子」内部二级 Tab。
 */
export type TopTab = "forum" | "posts" | "events" | "myArchive" | "buyer";

/** 「帖子」Tab 内部二级切换 */
export type PostsSubTab = "recommend" | "following";

/** 「My Archive」Tab 内部二级切换 */
export type ArchiveSubTab = "mine" | "world";

/** 「买手店」Tab 内部二级切换：地图 / 详情 */
export type BuyerSubTab = "map" | "detail";

// 用户信息缓存类型
export type UserInfoCache = Map<number, UserInfo>;
