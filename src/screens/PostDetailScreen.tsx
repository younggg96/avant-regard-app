import React, { useRef } from "react";
import {
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, NavigationProp } from "@react-navigation/native";
import { Box, Text } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";

// 导入拆分后的组件和 hooks
import {
  PostDetailHeader,
  LookbookContent,
  PostContentSection,
  OutfitItemsSection,
  ImageGrid,
  RelatedLooks,
  CommentsSection,
  CommentInputBar,
  FullscreenImageViewer,
  OptionsMenuModal,
  DeleteConfirmDialog,
  PostDetailRouteParams,
  styles,
  // Hooks
  usePostDetail,
  useComments,
  useEngagement,
  useImageViewer,
  usePostActions,
  useNavigationHandlers,
} from "../components/PostDetail";

const PostDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as PostDetailRouteParams;
  const scrollViewRef = useRef<RNScrollView>(null);
  const { user } = useAuthStore();

  // 帖子详情 Hook
  const { post, isLoading, error, postStatus, setPost } = usePostDetail({
    params,
  });

  // 判断是否是本人的帖子
  const isOwnPost = user?.id === post?.author?.id;

  // 评论相关 Hook
  const {
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
    handleReplyPress,
    handleCancelReply,
    handleToggleReplies,
    handleSubmitComment,
  } = useComments({
    postId: post?.id,
    postStatus,
    userId: user?.userId,
    username: user?.username,
  });

  // 社交互动 Hook
  const { isFollowing, handleLike, handleSave, handleShare, handleFollow } =
    useEngagement({
      post,
      userId: user?.userId,
      setPost,
    });

  // 图片查看器 Hook
  const {
    fullscreenVisible,
    currentImageIndex,
    setCurrentImageIndex,
    handleOpenFullscreen,
    handleCloseFullscreen,
  } = useImageViewer();

  // 帖子操作 Hook
  const {
    showOptionsMenu,
    showDeleteDialog,
    isDeleting,
    setShowOptionsMenu,
    setShowDeleteDialog,
    handleContinueEdit,
    handleDeletePost,
    handleConfirmDelete,
  } = usePostActions({
    post,
    userId: user?.userId,
    navigation: navigation as NavigationProp<any>,
  });

  // 导航 Hook
  const { handleAuthorPress, handleUserPress, handleLookPress } =
    useNavigationHandlers({
      post,
      navigation,
    });

  // 加载中状态
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Box flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text color="$gray600" fontSize="$md" mt="$md">
            加载中...
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  // 错误状态
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Box flex={1} justifyContent="center" alignItems="center" px="$lg">
          <Text color="$gray600" fontSize="$md" textAlign="center">
            {error}
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

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
  const displayComments =
    post.engagement?.comments ||
    comments.reduce((sum, c) => sum + 1 + (c.replyCount || 0), 0);
  const displayIsLiked = post.engagement?.isLiked || false;
  const displayIsSaved = post.engagement?.isSaved || false;
  const showComments = postStatus === "published";

  return (
    <View style={localStyles.rootContainer}>
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
            {post.type === "OUTFIT" && <OutfitItemsSection items={post.items} />}

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
              onReplyLike={handleReplyLike}
              onUserPress={handleUserPress}
              onReplyPress={handleReplyPress}
              onToggleReplies={handleToggleReplies}
            />

            {/* Bottom spacing */}
            <Box height={80} />
          </RNScrollView>

          {/* Gray Overlay when focused - 覆盖内容区域但不覆盖评论输入框 */}
          {isCommentFocused && showComments && (
            <TouchableWithoutFeedback onPress={handleOverlayPress}>
              <View style={localStyles.contentOverlay} />
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
              replyTarget={replyTarget}
              onInputChange={setCommentInput}
              onInputFocus={handleInputFocus}
              onInputBlur={handleInputBlur}
              onSubmit={handleSubmitComment}
              onLike={handleLike}
              onSave={handleSave}
              onOverlayPress={handleOverlayPress}
              onCancelReply={handleCancelReply}
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
    </View>
  );
};

const localStyles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
});

export default PostDetailScreen;
