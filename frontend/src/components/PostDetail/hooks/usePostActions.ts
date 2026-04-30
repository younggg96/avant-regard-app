import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Post } from "../../PostCard";
import { postService } from "../../../services/postService";
import { Alert } from "../../../utils/Alert";

interface UsePostActionsOptions {
  post: Post | null;
  userId?: number;
  navigation: { goBack: () => void; navigate: (name: string, params?: any) => void };
}

interface UsePostActionsReturn {
  showOptionsMenu: boolean;
  showDeleteDialog: boolean;
  showEditConfirmDialog: boolean;
  isDeleting: boolean;
  setShowOptionsMenu: (visible: boolean) => void;
  setShowDeleteDialog: (visible: boolean) => void;
  setShowEditConfirmDialog: (visible: boolean) => void;
  handleContinueEdit: () => void;
  handleEditPost: () => void;
  handleConfirmEdit: () => void;
  handleDeletePost: () => void;
  handleConfirmDelete: () => Promise<void>;
}

// 帖子类型到发布页面的映射
const POST_TYPE_TO_SCREEN: Record<string, string> = {
  OUTFIT: "PublishLookbook",
  DAILY_SHARE: "PublishOutfit",
  ITEM_REVIEW: "PublishReview",
  ARTICLES: "PublishForumPost",
};

/**
 * 管理帖子操作逻辑（删除、编辑）
 */
export const usePostActions = ({
  post,
  userId,
  navigation,
}: UsePostActionsOptions): UsePostActionsReturn => {
  const { t } = useTranslation();
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditConfirmDialog, setShowEditConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 导航到编辑页面
  const navigateToEditScreen = useCallback(() => {
    if (!post) {
      Alert.show(t("common.failed"), t("postActions.postDataMissing"));
      return;
    }

    const postType = post.type;
    console.log("Post type:", postType, "Post:", post);
    
    const screenName = POST_TYPE_TO_SCREEN[postType as keyof typeof POST_TYPE_TO_SCREEN];

    console.log("Screen name:", screenName);
    if (!screenName) {
      console.error("Unsupported post type:", postType);
      Alert.show(t("common.failed"), t("postActions.unsupportedPostType", { type: postType || "unknown" }));
      return;
    }

    console.log("Navigating to", screenName, "with editMode and draftPost");
    // 导航到对应的发布页面，传递编辑数据
    navigation.navigate(screenName, {
      editMode: true,
      draftPost: post,
    });
  }, [post, navigation]);

  // 处理继续编辑（草稿）- 直接导航，无需确认
  const handleContinueEdit = useCallback(() => {
    navigateToEditScreen();
  }, [navigateToEditScreen]);

  // 处理编辑已发布/审核中帖子 - 显示确认对话框
  const handleEditPost = useCallback(() => {
    setShowEditConfirmDialog(true);
  }, []);

  // 确认编辑（用户确认后导航到编辑页面）
  const handleConfirmEdit = useCallback(() => {
    setShowEditConfirmDialog(false);
    // 添加延迟确保对话框关闭动画完成后再导航
    setTimeout(() => {
      navigateToEditScreen();
    }, 300);
  }, [navigateToEditScreen]);

  // 处理删除帖子
  const handleDeletePost = useCallback(() => {
    if (!post?.id || !userId) return;
    setShowDeleteDialog(true);
  }, [post?.id, userId]);

  // 确认删除帖子
  const handleConfirmDelete = useCallback(async () => {
    if (!post?.id || !userId) {
      Alert.show(t("common.failed"), t("postActions.missingParams"));
      setShowDeleteDialog(false);
      return;
    }

    setIsDeleting(true);

    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;

      if (isNaN(postId) || postId <= 0) {
        throw new Error("Invalid post ID");
      }

      if (!userId || userId <= 0) {
        throw new Error("Invalid user ID");
      }

      await postService.deletePost(postId, userId);

      setShowDeleteDialog(false);
      Alert.show(t("common.success"), t("postActions.postDeleted"));

      setTimeout(() => {
        navigation.goBack();
      }, 300);
    } catch (error) {
      console.error("Error deleting post:", error);

      let errorMessage = t("postActions.retryLater");

      if (error instanceof Error) {
        if (
          error.message.includes("网络") ||
          error.message.includes("Network")
        ) {
          errorMessage = t("postActions.networkFailed");
        } else if (
          error.message.includes("权限") ||
          error.message.includes("Permission")
        ) {
          errorMessage = t("postActions.noPermission");
        } else if (
          error.message.includes("无效") ||
          error.message.includes("Invalid")
        ) {
          errorMessage = error.message;
        } else if (
          error.message.includes("找不到") ||
          error.message.includes("not found")
        ) {
          errorMessage = t("postActions.postNotFound");
        } else {
          errorMessage = error.message;
        }
      }

      Alert.show(t("postActions.deleteFailed"), errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [post, userId, navigation, t]);

  return {
    showOptionsMenu,
    showDeleteDialog,
    showEditConfirmDialog,
    isDeleting,
    setShowOptionsMenu,
    setShowDeleteDialog,
    setShowEditConfirmDialog,
    handleContinueEdit,
    handleEditPost,
    handleConfirmEdit,
    handleDeletePost,
    handleConfirmDelete,
  };
};
