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
}

export type TabType = "forum" | "recommend" | "following";

// 用户信息缓存类型
export type UserInfoCache = Map<number, UserInfo>;
