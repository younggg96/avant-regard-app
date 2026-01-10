import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  View,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Box, Text } from "../components/ui";
import { Post, ShowImageInfo } from "../components/PostCard";
import { useAuthStore } from "../store/authStore";
import { commentService } from "../services/commentService";
import { userInfoService } from "../services/userInfoService";
import { postService } from "../services/postService";
import { Alert } from "../utils/Alert";

// 导入拆分后的组件
import {
  PostDetailHeader,
  LookbookContent,
  PostContentSection,
  OutfitItemsSection,
  ImageGrid,
  RelatedLooks,
  CommentsSection,
  CommentInputBar,
  CommentInputBarRef,
  FullscreenImageViewer,
  OptionsMenuModal,
  DeleteConfirmDialog,
  Comment,
  PostDetailRouteParams,
  formatTimestamp,
  styles,
} from "../components/PostDetail";

const PostDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as PostDetailRouteParams;
  const scrollViewRef = useRef<RNScrollView>(null);
  const commentInputRef = useRef<CommentInputBarRef>(null);
  const { user } = useAuthStore();

  // 帖子状态
  const [post, setPost] = useState<Post | null>(params.post || null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const postStatus = params.postStatus || "published";

  // 判断是否是本人的帖子
  const isOwnPost = user?.id === post?.author?.id;

  // 评论相关状态
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isCommentFocused, setIsCommentFocused] = useState(false);

  // 全屏图片查看器状态
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 菜单和对话框状态
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 监听键盘事件
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // 加载评论数据
  const loadComments = useCallback(async () => {
    if (!post?.id || postStatus !== "published") return;

    setIsLoadingComments(true);
    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) return;

      const apiComments = await commentService.getPostComments(postId);

      const userIds = [...new Set(apiComments.map((c) => c.userId))];
      const userInfoPromises = userIds.map((id) =>
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
        return {
          id: String(apiComment.id),
          userId: apiComment.userId,
          userName: userInfo?.username || apiComment.username || "用户",
          userAvatar:
            userInfo?.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/png?seed=${apiComment.userId}`,
          content: apiComment.content,
          timestamp: formatTimestamp(apiComment.createdAt),
          likes: apiComment.likeCount || 0,
          isLiked: false,
        };
      });

      setComments(displayComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [post?.id, postStatus]);

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
  }, []);

  // 处理打开全屏图片
  const handleOpenFullscreen = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setFullscreenVisible(true);
  }, []);

  // 处理关闭全屏图片
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  // 处理点赞
  const handleLike = useCallback(() => {
    if (!post) return;

    setPost((prev) => {
      if (!prev) return null;
      const currentLikes = prev.engagement?.likes || 0;
      const currentIsLiked = prev.engagement?.isLiked || false;

      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          likes: currentIsLiked ? currentLikes - 1 : currentLikes + 1,
          isLiked: !currentIsLiked,
        },
      } as Post;
    });
  }, [post]);

  // 处理收藏
  const handleSave = useCallback(() => {
    if (!post) return;

    setPost((prev) => {
      if (!prev) return null;
      const currentSaves = prev.engagement?.saves || 0;
      const currentIsSaved = prev.engagement?.isSaved || false;

      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          saves: currentIsSaved ? currentSaves - 1 : currentSaves + 1,
          isSaved: !currentIsSaved,
        },
      } as Post;
    });
  }, [post]);

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

  // 处理点击作者头像
  const handleAuthorPress = useCallback(() => {
    if (!post?.author?.id) return;
    (navigation as any).navigate("UserProfile", {
      userId: parseInt(post.author.id, 10),
      username: post.author.name,
      avatar: post.author.avatar,
    });
  }, [navigation, post]);

  // 处理用户点击（评论区）
  const handleUserPress = useCallback(
    (userId: number, userName: string, userAvatar: string) => {
      (navigation as any).navigate("UserProfile", {
        userId,
        username: userName,
        avatar: userAvatar,
      });
    },
    [navigation]
  );

  // 处理评论点赞
  const handleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user?.userId) {
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
          await commentService.likeComment(numericCommentId, user.userId);
        } else {
          await commentService.unlikeComment(numericCommentId, user.userId);
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
    [user?.userId, comments]
  );

  // 处理提交评论
  const handleSubmitComment = useCallback(async () => {
    if (!commentInput.trim()) return;

    if (!user?.userId) {
      Alert.show("提示", "请先登录");
      return;
    }

    if (!post?.id) return;

    Keyboard.dismiss();
    setIsCommentFocused(false);
    setIsSubmittingComment(true);

    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) throw new Error("无效的帖子 ID");

      const newApiComment = await commentService.createComment(postId, {
        userId: user.userId,
        content: commentInput.trim(),
      });

      let userAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;
      try {
        const userInfo = await userInfoService.getUserInfo(user.userId);
        if (userInfo?.avatarUrl) {
          userAvatar = userInfo.avatarUrl;
        }
      } catch {
        // 忽略获取用户信息失败
      }

      const newComment: Comment = {
        id: String(newApiComment.id),
        userId: newApiComment.userId,
        userName: user.username || "我",
        userAvatar: userAvatar,
        content: newApiComment.content,
        timestamp: "刚刚",
        likes: 0,
        isLiked: false,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");

      Alert.show("成功", "评论已发布");

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error submitting comment:", error);
      Alert.show(
        "错误",
        error instanceof Error ? error.message : "评论发布失败"
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentInput, user?.userId, user?.username, post?.id]);

  // 处理继续编辑（草稿）
  const handleContinueEdit = useCallback(() => {
    Alert.show("编辑", "跳转到编辑页面");
    // TODO: 实现跳转到对应的编辑页面
  }, []);

  // 处理删除帖子
  const handleDeletePost = useCallback(() => {
    if (!post?.id || !user?.userId) return;
    setShowDeleteDialog(true);
  }, [post?.id, user?.userId]);

  // 确认删除帖子
  const handleConfirmDelete = useCallback(async () => {
    if (!post?.id || !user?.userId) {
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

      if (!user.userId || user.userId <= 0) {
        throw new Error("无效的用户 ID");
      }

      await postService.deletePost(postId, user.userId);

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
  }, [post, user?.userId, navigation]);

  // 处理关联造型点击
  const handleLookPress = useCallback(
    (showImage: ShowImageInfo) => {
      (navigation as any).navigate("LookDetail", {
        imageId: showImage.id,
        imageUrl: showImage.imageUrl,
        designer: showImage.designerName,
        season: showImage.season,
      });
    },
    [navigation]
  );

  // 帖子不存在时显示
  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text color="$gray600" fontSize="$md">
            帖子不存在
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  const images = post.content?.images || [];
  const displayLikes = post.engagement?.likes || 0;
  const displaySaves = post.engagement?.saves || 0;
  const displayComments = post.engagement?.comments || comments.length;
  const displayIsLiked = post.engagement?.isLiked || false;
  const displayIsSaved = post.engagement?.isSaved || false;
  const showComments = postStatus === "published";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <PostDetailHeader
          post={post}
          postStatus={postStatus}
          isOwnPost={isOwnPost}
          isFollowing={isFollowing}
          onGoBack={() => navigation.goBack()}
          onAuthorPress={handleAuthorPress}
          onFollow={handleFollow}
          onShare={handleShare}
          onContinueEdit={handleContinueEdit}
          onShowOptionsMenu={() => setShowOptionsMenu(true)}
        />

        {/* Content */}
        <RNScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* Lookbook: 小红书风格 - 大图轮播在顶部 */}
          {post.type === "OUTFIT" && images.length > 0 && (
            <LookbookContent
              post={post}
              images={images}
              currentImageIndex={currentImageIndex}
              onImageIndexChange={setCurrentImageIndex}
              onOpenFullscreen={handleOpenFullscreen}
            />
          )}

          {/* 非 Lookbook 类型的标题和描述 */}
          {post.type !== "OUTFIT" && <PostContentSection post={post} />}

          {/* Image Grid - 3 columns (非 lookbook 类型) */}
          {post.type !== "OUTFIT" && images.length > 0 && (
            <ImageGrid
              images={images}
              onOpenFullscreen={handleOpenFullscreen}
            />
          )}

          {/* 搭配单品 */}
          {post.type === "outfit" && <OutfitItemsSection items={post.items} />}

          {/* 关联造型区域 - 仅 DAILY_SHARE 类型显示 */}
          {post.type === "DAILY_SHARE" && post.showImages && (
            <RelatedLooks
              showImages={post.showImages}
              onLookPress={handleLookPress}
            />
          )}

          {/* Comments Section */}
          <CommentsSection
            comments={comments}
            isLoading={isLoadingComments}
            postStatus={postStatus}
            onCommentLike={handleCommentLike}
            onUserPress={handleUserPress}
          />

          {/* Bottom spacing */}
          <Box height={80} />
        </RNScrollView>

        {/* Gray Overlay when focused */}
        {isCommentFocused && showComments && (
          <TouchableWithoutFeedback onPress={handleOverlayPress}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
        )}

        {/* Fixed Bottom Bar with Engagement + Input - Only for published posts */}
        {showComments && (
          <CommentInputBar
            ref={commentInputRef}
            commentInput={commentInput}
            isSubmitting={isSubmittingComment}
            isFocused={isCommentFocused}
            displayLikes={displayLikes}
            displaySaves={displaySaves}
            displayComments={displayComments}
            displayIsLiked={displayIsLiked}
            displayIsSaved={displayIsSaved}
            onInputChange={setCommentInput}
            onInputFocus={handleInputFocus}
            onInputBlur={handleInputBlur}
            onSubmit={handleSubmitComment}
            onLike={handleLike}
            onSave={handleSave}
            onOverlayPress={handleOverlayPress}
          />
        )}
      </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        visible={fullscreenVisible}
        images={images}
        currentIndex={currentImageIndex}
        onClose={handleCloseFullscreen}
        onIndexChange={setCurrentImageIndex}
      />

      {/* Options Menu Modal */}
      <OptionsMenuModal
        visible={showOptionsMenu}
        onClose={() => setShowOptionsMenu(false)}
        onDelete={handleDeletePost}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        visible={showDeleteDialog}
        isDeleting={isDeleting}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
};

export default PostDetailScreen;
