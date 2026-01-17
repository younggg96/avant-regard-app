import { useState, useCallback } from "react";
import { Post } from "../../PostCard";
import { postService } from "../../../services/postService";
import { Alert } from "../../../utils/Alert";

interface UsePostActionsOptions {
  post: Post | null;
  userId?: number;
  navigation: { goBack: () => void };
}

interface UsePostActionsReturn {
  showOptionsMenu: boolean;
  showDeleteDialog: boolean;
  isDeleting: boolean;
  setShowOptionsMenu: (visible: boolean) => void;
  setShowDeleteDialog: (visible: boolean) => void;
  handleContinueEdit: () => void;
  handleDeletePost: () => void;
  handleConfirmDelete: () => Promise<void>;
}

/**
 * 管理帖子操作逻辑（删除、编辑）
 */
export const usePostActions = ({
  post,
  userId,
  navigation,
}: UsePostActionsOptions): UsePostActionsReturn => {
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 处理继续编辑（草稿）
  const handleContinueEdit = useCallback(() => {
    Alert.show("编辑", "跳转到编辑页面");
    // TODO: 实现跳转到对应的编辑页面
  }, []);

  // 处理删除帖子
  const handleDeletePost = useCallback(() => {
    if (!post?.id || !userId) return;
    setShowDeleteDialog(true);
  }, [post?.id, userId]);

  // 确认删除帖子
  const handleConfirmDelete = useCallback(async () => {
    if (!post?.id || !userId) {
      Alert.show("错误", "缺少必要的参数");
      setShowDeleteDialog(false);
      return;
    }

    setIsDeleting(true);

    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;

      if (isNaN(postId) || postId <= 0) {
        throw new Error("无效的帖子 ID");
      }

      if (!userId || userId <= 0) {
        throw new Error("无效的用户 ID");
      }

      await postService.deletePost(postId, userId);

      setShowDeleteDialog(false);
      Alert.show("成功", "帖子已删除");

      setTimeout(() => {
        navigation.goBack();
      }, 300);
    } catch (error) {
      console.error("删除帖子时出错:", error);

      let errorMessage = "请稍后重试";

      if (error instanceof Error) {
        if (
          error.message.includes("网络") ||
          error.message.includes("Network")
        ) {
          errorMessage = "网络连接失败，请检查网络后重试";
        } else if (
          error.message.includes("权限") ||
          error.message.includes("Permission")
        ) {
          errorMessage = "没有删除权限";
        } else if (error.message.includes("无效")) {
          errorMessage = error.message;
        } else if (
          error.message.includes("找不到") ||
          error.message.includes("not found")
        ) {
          errorMessage = "帖子不存在或已被删除";
        } else {
          errorMessage = error.message;
        }
      }

      Alert.show("删除失败", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [post, userId, navigation]);

  return {
    showOptionsMenu,
    showDeleteDialog,
    isDeleting,
    setShowOptionsMenu,
    setShowDeleteDialog,
    handleContinueEdit,
    handleDeletePost,
    handleConfirmDelete,
  };
};
