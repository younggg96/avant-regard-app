import { Post as ApiPost } from "../../services/postService";
import { UserInfo } from "../../services/userInfoService";
import i18n from "../../i18n";
import { DisplayPost } from "./types";
import { resolveAvatarUrlOrEmpty } from "../../utils/avatarUtils";

/**
 * 计算相对时间
 * @param dateString ISO 日期字符串
 * @returns 相对时间描述
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return i18n.t("time.justNow");
  if (diffInMinutes < 60) return i18n.t("time.minutesAgo", { count: diffInMinutes });
  if (diffInHours < 24) return i18n.t("time.hoursAgo", { count: diffInHours });
  if (diffInDays < 7) return i18n.t("time.daysAgo", { count: diffInDays });
  if (diffInDays < 30) return i18n.t("time.weeksAgo", { count: Math.floor(diffInDays / 7) });
  return i18n.t("time.monthsAgo", { count: Math.floor(diffInDays / 30) });
};

/**
 * API Post 类型到前端 Post 类型的映射
 * @param apiPost API 返回的帖子数据
 * @param userInfoMap 用户信息映射
 * @returns 前端展示用的帖子数据
 */
export const mapApiPostToDisplayPost = (
  apiPost: ApiPost,
  userInfoMap: Map<number, UserInfo>
): DisplayPost => {
  // 获取用户信息
  const userInfo = userInfoMap.get(apiPost.userId);

  // Avatar resolution priority:
  //   1. cached user_info.avatarUrl  — freshest profile data
  //   2. apiPost.avatarUrl           — batched from backend on feed response
  //   3. empty string              — UI falls back to initials via UserAvatar
  const resolvedAvatar = resolveAvatarUrlOrEmpty(
    userInfo?.avatarUrl,
    apiPost.avatarUrl,
  );
  const resolvedName =
    userInfo?.username || apiPost.username || i18n.t("user.anonymous");

  return {
    id: String(apiPost.id),
    type: apiPost.postType, // Uses the exact Enum value
    auditStatus: apiPost.auditStatus, // 审核状态
    author: {
      id: String(apiPost.userId),
      name: resolvedName,
      avatar: resolvedAvatar,
      isVerified: false,
      title: userInfo?.primaryTitle || undefined,
    },
    content: {
      title: apiPost.title || i18n.t("user.noTitle"),
      description: apiPost.contentText || "",
      images:
        apiPost.imageUrls && apiPost.imageUrls.length > 0
          ? apiPost.imageUrls
          : [],
      tags: [],
      coverAspectRatio:
        apiPost.coverWidth && apiPost.coverHeight && apiPost.coverHeight > 0
          ? apiPost.coverWidth / apiPost.coverHeight
          : undefined,
    },
    engagement: {
      likes: apiPost.likeCount || 0,
      saves: apiPost.favoriteCount || 0,
      comments: apiPost.commentCount || 0,
      isLiked: apiPost.likedByMe || false,
      isSaved: apiPost.favoritedByMe || false,
    },
    timestamp: getRelativeTime(apiPost.createdAt),
    // 关联的秀场 ID 列表
    showIds: apiPost.showIds,
    // 论坛帖子所属社区
    communityId: apiPost.communityId,
    communityName: apiPost.communityName,
    // 买手店帖子（migration 055）
    storeId: apiPost.storeId,
    storeName: apiPost.storeName,
  };
};
