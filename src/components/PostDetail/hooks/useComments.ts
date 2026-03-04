import { useState, useCallback, useEffect, useRef } from "react";
import { Alert as RNAlert, Keyboard } from "react-native";
import { Comment, CommentReply, ReplyTarget, formatTimestamp, PostStatus } from "../types";
import { commentService } from "../../../services/commentService";
import { userInfoService } from "../../../services/userInfoService";
import { Alert } from "../../../utils/Alert";
import { CommentInputBarRef } from "../CommentInputBar";

interface UseCommentsOptions {
  postId: string | undefined;
  postStatus: PostStatus;
  userId?: number;
  username?: string;
}

interface UseCommentsReturn {
  // 评论数据
  comments: Comment[];
  isLoadingComments: boolean;

  // 输入状态
  commentInput: string;
  isSubmittingComment: boolean;
  isCommentFocused: boolean;
  replyTarget: ReplyTarget | null;
  commentInputRef: React.RefObject<CommentInputBarRef>;

  // 操作方法
  setCommentInput: (value: string) => void;
  handleInputFocus: () => void;
  handleInputBlur: () => void;
  handleOverlayPress: () => void;
  handleCommentLike: (commentId: string) => Promise<void>;
  handleReplyLike: (replyId: string, parentId: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => void;
  handleDeleteReply: (replyId: string, parentId: string) => void;
  handleReplyPress: (target: ReplyTarget) => void;
  handleCancelReply: () => void;
  handleToggleReplies: (commentId: string) => void;
  handleSubmitComment: () => Promise<void>;
  loadComments: () => Promise<void>;
}

/**
 * 管理评论相关逻辑
 */
export const useComments = ({
  postId,
  postStatus,
  userId,
  username,
}: UseCommentsOptions): UseCommentsReturn => {
  const commentInputRef = useRef<CommentInputBarRef>(null);

  // 评论数据状态
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // 输入状态
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  // 加载评论数据
  const loadComments = useCallback(async () => {
    if (!postId || postStatus !== "PUBLISHED") return;

    setIsLoadingComments(true);
    try {
      const numericPostId = parseInt(postId, 10);
      if (isNaN(numericPostId)) return;

      const apiComments = await commentService.getPostComments(numericPostId);

      // 收集所有用户ID（包括回复中的用户）
      const userIds = new Set<number>();
      apiComments.forEach((c) => {
        userIds.add(c.userId);
        c.replies?.forEach((r) => {
          userIds.add(r.userId);
          if (r.replyToUserId) userIds.add(r.replyToUserId);
        });
      });

      const userInfoPromises = Array.from(userIds).map((id) =>
        userInfoService.getUserInfo(id).catch(() => null)
      );
      const usersInfo = await Promise.all(userInfoPromises);
      const userInfoMap = new Map(
        usersInfo
          .filter((info) => info !== null)
          .map((info) => [info!.userId, info!])
      );

      const displayComments: Comment[] = apiComments.map((apiComment) => {
        const userInfo = userInfoMap.get(apiComment.userId);

        // 格式化回复
        const formattedReplies: CommentReply[] = (apiComment.replies || []).map(
          (apiReply) => {
            const replyUserInfo = userInfoMap.get(apiReply.userId);
            return {
              id: String(apiReply.id),
              parentId: String(apiReply.parentId),
              userId: apiReply.userId,
              userName: replyUserInfo?.username || apiReply.username || "用户",
              userAvatar:
                replyUserInfo?.avatarUrl ||
                apiReply.userAvatar ||
                `https://api.dicebear.com/7.x/avataaars/png?seed=${apiReply.userId}`,
              replyToUserId: apiReply.replyToUserId,
              replyToUsername: apiReply.replyToUsername,
              content: apiReply.content,
              timestamp: formatTimestamp(apiReply.createdAt),
              likes: apiReply.likeCount || 0,
              isLiked: false,
            };
          }
        );

        return {
          id: String(apiComment.id),
          userId: apiComment.userId,
          userName: userInfo?.username || apiComment.username || "用户",
          userAvatar:
            userInfo?.avatarUrl ||
            apiComment.userAvatar ||
            `https://api.dicebear.com/7.x/avataaars/png?seed=${apiComment.userId}`,
          content: apiComment.content,
          timestamp: formatTimestamp(apiComment.createdAt),
          likes: apiComment.likeCount || 0,
          isLiked: false,
          replyCount: apiComment.replyCount || 0,
          replies: formattedReplies,
          showReplies: false,
        };
      });

      setComments(displayComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId, postStatus]);

  // 初始化加载评论
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 处理输入框焦点
  const handleInputFocus = useCallback(() => {
    setIsCommentFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    if (!commentInput) {
      setIsCommentFocused(false);
    }
  }, [commentInput]);

  // 处理点击遮罩层
  const handleOverlayPress = useCallback(() => {
    Keyboard.dismiss();
    commentInputRef.current?.blur();
    setIsCommentFocused(false);
    setReplyTarget(null);
  }, []);

  // 处理评论点赞
  const handleCommentLike = useCallback(
    async (commentId: string) => {
      if (!userId) {
        Alert.show("提示", "请先登录");
        return;
      }

      const targetComment = comments.find((c) => c.id === commentId);
      if (!targetComment) return;

      const newIsLiked = !targetComment.isLiked;
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: newIsLiked,
                likes: newIsLiked ? comment.likes + 1 : comment.likes - 1,
              }
            : comment
        )
      );

      try {
        const numericCommentId = parseInt(commentId, 10);
        if (newIsLiked) {
          await commentService.likeComment(numericCommentId, userId);
        } else {
          await commentService.unlikeComment(numericCommentId, userId);
        }
      } catch (error) {
        console.error("Error toggling comment like:", error);
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  isLiked: !newIsLiked,
                  likes: newIsLiked ? comment.likes - 1 : comment.likes + 1,
                }
              : comment
          )
        );
      }
    },
    [userId, comments]
  );

  // 处理回复点赞
  const handleReplyLike = useCallback(
    async (replyId: string, parentId: string) => {
      if (!userId) {
        Alert.show("提示", "请先登录");
        return;
      }

      // 找到父评论和目标回复
      const parentComment = comments.find((c) => c.id === parentId);
      if (!parentComment) return;

      const targetReply = parentComment.replies?.find((r) => r.id === replyId);
      if (!targetReply) return;

      const newIsLiked = !targetReply.isLiked;

      // 乐观更新
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === parentId
            ? {
                ...comment,
                replies: comment.replies.map((reply) =>
                  reply.id === replyId
                    ? {
                        ...reply,
                        isLiked: newIsLiked,
                        likes: newIsLiked ? reply.likes + 1 : reply.likes - 1,
                      }
                    : reply
                ),
              }
            : comment
        )
      );

      try {
        const numericReplyId = parseInt(replyId, 10);
        if (newIsLiked) {
          await commentService.likeComment(numericReplyId, userId);
        } else {
          await commentService.unlikeComment(numericReplyId, userId);
        }
      } catch (error) {
        console.error("Error toggling reply like:", error);
        // 回滚
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parentId
              ? {
                  ...comment,
                  replies: comment.replies.map((reply) =>
                    reply.id === replyId
                      ? {
                          ...reply,
                          isLiked: !newIsLiked,
                          likes: newIsLiked
                            ? reply.likes - 1
                            : reply.likes + 1,
                        }
                      : reply
                  ),
                }
              : comment
          )
        );
      }
    },
    [userId, comments]
  );

  // 删除评论
  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (!userId) return;

      RNAlert.alert("确认删除", "确定要删除这条评论吗？删除后不可恢复。", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            const numericId = parseInt(commentId, 10);
            if (isNaN(numericId)) return;

            setComments((prev) => prev.filter((c) => c.id !== commentId));

            try {
              await commentService.deleteComment(numericId, userId);
            } catch (error) {
              console.error("Error deleting comment:", error);
              Alert.show("错误", "删除失败，请重试");
              loadComments();
            }
          },
        },
      ]);
    },
    [userId, loadComments]
  );

  // 删除回复
  const handleDeleteReply = useCallback(
    (replyId: string, parentId: string) => {
      if (!userId) return;

      RNAlert.alert("确认删除", "确定要删除这条回复吗？删除后不可恢复。", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            const numericId = parseInt(replyId, 10);
            if (isNaN(numericId)) return;

            setComments((prev) =>
              prev.map((comment) =>
                comment.id === parentId
                  ? {
                      ...comment,
                      replyCount: Math.max(0, comment.replyCount - 1),
                      replies: comment.replies.filter((r) => r.id !== replyId),
                    }
                  : comment
              )
            );

            try {
              await commentService.deleteComment(numericId, userId);
            } catch (error) {
              console.error("Error deleting reply:", error);
              Alert.show("错误", "删除失败，请重试");
              loadComments();
            }
          },
        },
      ]);
    },
    [userId, loadComments]
  );

  // 处理回复点击
  const handleReplyPress = useCallback((target: ReplyTarget) => {
    setReplyTarget(target);
    setIsCommentFocused(true);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  }, []);

  // 取消回复
  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  // 切换显示/隐藏回复
  const handleToggleReplies = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, showReplies: !comment.showReplies }
          : comment
      )
    );
  }, []);

  // 处理提交评论或回复
  const handleSubmitComment = useCallback(async () => {
    if (!commentInput.trim()) return;

    if (!userId) {
      Alert.show("提示", "请先登录");
      return;
    }

    if (!postId) return;

    Keyboard.dismiss();
    setIsCommentFocused(false);
    setIsSubmittingComment(true);

    try {
      const numericPostId = parseInt(postId, 10);
      if (isNaN(numericPostId)) throw new Error("无效的帖子 ID");

      // 构建评论参数
      const commentParams: {
        userId: number;
        content: string;
        parentId?: number;
        replyToUserId?: number;
      } = {
        userId: userId,
        content: commentInput.trim(),
      };

      // 如果是回复
      if (replyTarget) {
        commentParams.parentId = parseInt(replyTarget.commentId, 10);
        commentParams.replyToUserId = replyTarget.userId;
      }

      const newApiComment = await commentService.createComment(
        numericPostId,
        commentParams
      );

      let userAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`;
      try {
        const userInfo = await userInfoService.getUserInfo(userId);
        if (userInfo?.avatarUrl) {
          userAvatar = userInfo.avatarUrl;
        }
      } catch {
        // 忽略获取用户信息失败
      }

      if (replyTarget) {
        // 添加回复到对应的评论
        const newReply: CommentReply = {
          id: String(newApiComment.id),
          parentId: replyTarget.commentId,
          userId: userId,
          userName: username || "我",
          userAvatar: userAvatar,
          replyToUserId: replyTarget.userId,
          replyToUsername: replyTarget.userName,
          content: commentInput.trim(),
          timestamp: "刚刚",
          likes: 0,
          isLiked: false,
        };

        setComments((prev) =>
          prev.map((comment) =>
            comment.id === replyTarget.commentId
              ? {
                  ...comment,
                  replyCount: comment.replyCount + 1,
                  replies: [...comment.replies, newReply],
                  showReplies: true,
                }
              : comment
          )
        );

        Alert.show("成功", "回复已发布");
      } else {
        // 添加新评论
        const newComment: Comment = {
          id: String(newApiComment.id),
          userId: newApiComment.userId,
          userName: username || "我",
          userAvatar: userAvatar,
          content: newApiComment.content,
          timestamp: "刚刚",
          likes: 0,
          isLiked: false,
          replyCount: 0,
          replies: [],
          showReplies: false,
        };

        setComments((prev) => [newComment, ...prev]);
        Alert.show("成功", "评论已发布");
      }

      setCommentInput("");
      setReplyTarget(null);
    } catch (error) {
      console.error("Error submitting comment:", error);
      Alert.show("错误", error instanceof Error ? error.message : "发布失败");
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentInput, userId, username, postId, replyTarget]);

  return {
    comments,
    isLoadingComments,
    commentInput,
    isSubmittingComment,
    isCommentFocused,
    replyTarget,
    commentInputRef,
    setCommentInput,
    handleInputFocus,
    handleInputBlur,
    handleOverlayPress,
    handleCommentLike,
    handleReplyLike,
    handleDeleteComment,
    handleDeleteReply,
    handleReplyPress,
    handleCancelReply,
    handleToggleReplies,
    handleSubmitComment,
    loadComments,
  };
};
