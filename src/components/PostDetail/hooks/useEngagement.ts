import { useCallback, useState } from "react";
import { Share } from "react-native";
import { Post } from "../../PostCard";
import { postService } from "../../../services/postService";
import { Alert } from "../../../utils/Alert";

interface UseEngagementOptions {
  post: Post | null;
  userId?: number;
  setPost: React.Dispatch<React.SetStateAction<Post | null>>;
}

interface UseEngagementReturn {
  isFollowing: boolean;
  handleLike: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleShare: () => Promise<void>;
  handleFollow: () => void;
}

/**
 * 管理社交互动逻辑（点赞、收藏、分享、关注）
 */
export const useEngagement = ({
  post,
  userId,
  setPost,
}: UseEngagementOptions): UseEngagementReturn => {
  const [isFollowing, setIsFollowing] = useState(false);

  // 处理点赞
  const handleLike = useCallback(async () => {
    if (!post) return;
    if (!userId) {
      Alert.show("提示", "请先登录");
      return;
    }

    const currentIsLiked = post.engagement?.isLiked || false;
    const currentLikes = post.engagement?.likes || 0;

    // 乐观更新UI
    setPost((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          likes: currentIsLiked ? currentLikes - 1 : currentLikes + 1,
          isLiked: !currentIsLiked,
        },
      } as Post;
    });

    // 调用API
    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) return;

      if (currentIsLiked) {
        await postService.unlikePost(postId, userId);
      } else {
        await postService.likePost(postId, userId);
      }
    } catch (error) {
      console.error("点赞操作失败:", error);
      // 回滚UI状态
      setPost((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          engagement: {
            ...prev.engagement,
            likes: currentLikes,
            isLiked: currentIsLiked,
          },
        } as Post;
      });
    }
  }, [post, userId, setPost]);

  // 处理收藏
  const handleSave = useCallback(async () => {
    if (!post) return;
    if (!userId) {
      Alert.show("提示", "请先登录");
      return;
    }

    const currentIsSaved = post.engagement?.isSaved || false;
    const currentSaves = post.engagement?.saves || 0;

    // 乐观更新UI
    setPost((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          saves: currentIsSaved ? currentSaves - 1 : currentSaves + 1,
          isSaved: !currentIsSaved,
        },
      } as Post;
    });

    // 调用API
    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) return;

      if (currentIsSaved) {
        await postService.unfavoritePost(postId, userId);
      } else {
        await postService.favoritePost(postId, userId);
      }
    } catch (error) {
      console.error("收藏操作失败:", error);
      // 回滚UI状态
      setPost((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          engagement: {
            ...prev.engagement,
            saves: currentSaves,
            isSaved: currentIsSaved,
          },
        } as Post;
      });
    }
  }, [post, userId, setPost]);

  // 处理分享
  const handleShare = useCallback(async () => {
    if (!post) return;

    try {
      await Share.share({
        message: `查看这篇精彩内容：${
          post.content?.title || ""
        }\n分享自 AVANT REGARD`,
        title: post.content?.title,
      });
    } catch (error) {
      console.error("分享失败:", error);
    }
  }, [post]);

  // 处理关注
  const handleFollow = useCallback(() => {
    setIsFollowing((prev) => !prev);
    Alert.show("成功", isFollowing ? "已取消关注" : "已关注");
  }, [isFollowing]);

  return {
    isFollowing,
    handleLike,
    handleSave,
    handleShare,
    handleFollow,
  };
};
