import i18n from "../../i18n";
import { Post, ShowImageInfo } from "../PostCard";

// 路由参数
export interface PostDetailRouteParams {
  postId?: string;
  post?: Post;
  postStatus?: PostStatus;
}

// 评论回复显示类型
export interface CommentReply {
  id: string;
  parentId: string;
  userId: number;
  userName: string;
  userAvatar: string;
  userTitle?: string;
  replyToUserId?: number;
  replyToUsername?: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

// 评论显示类型
export interface Comment {
  id: string;
  userId: number;
  userName: string;
  userAvatar: string;
  userTitle?: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
  replyCount: number;
  replies: CommentReply[];
  showReplies?: boolean;
}

// 回复目标信息
export interface ReplyTarget {
  commentId: string;
  userId: number;
  userName: string;
}

// 帖子状态类型
export type PostStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "HIDDEN";

export const formatTimestamp = (dateString: string): string => {
  const t = i18n.t.bind(i18n);
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return t("time.justNow");
  if (diffMinutes < 60) return t("time.minutesAgo", { count: diffMinutes });
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("time.daysAgo", { count: diffDays });

  const locale = i18n.language === "zh" ? "zh-CN" : "en-US";
  return date.toLocaleDateString(locale);
};
