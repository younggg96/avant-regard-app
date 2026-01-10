import { Post, ShowImageInfo } from "../PostCard";

// 路由参数
export interface PostDetailRouteParams {
  postId?: string;
  post?: Post;
  postStatus?: "draft" | "pending" | "published";
}

// 评论显示类型
export interface Comment {
  id: string;
  userId: number;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

// 帖子状态类型
export type PostStatus = "draft" | "pending" | "published";

// 格式化时间显示
export const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN");
};
