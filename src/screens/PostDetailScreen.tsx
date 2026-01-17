import React, { useRef, useEffect } from "react";
import {
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, NavigationProp } from "@react-navigation/native";
import { Box, Text, HStack } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
import { Show } from "@/services/showService";

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
  const { handleAuthorPress, handleUserPress, handleShowPress } =
    useNavigationHandlers({
      post,
      navigation,
    });

  // 骨架屏动画
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [isLoading, shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // 骨架屏组件
  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.gray200,
          borderRadius: 4,
          opacity: skeletonOpacity,
        },
        style,
      ]}
    />
  );

  // 加载中状态 - 骨架屏
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header 骨架 */}
        <HStack px="$md" py="$sm" alignItems="center" gap="$sm">
          <SkeletonBox width={32} height={32} style={{ borderRadius: 16 }} />
          <Box flex={1}>
            <SkeletonBox width={100} height={14} style={{ marginBottom: 4 }} />
            <SkeletonBox width={60} height={10} />
          </Box>
          <SkeletonBox width={60} height={28} style={{ borderRadius: 14 }} />
        </HStack>

        {/* 大图骨架 */}
        <Animated.View
          style={[
            skeletonStyles.mainImage,
            { opacity: skeletonOpacity },
          ]}
        />

        {/* 标题和描述骨架 */}
        <Box px="$md" py="$md">
          <SkeletonBox width="80%" height={20} style={{ marginBottom: 12 }} />
          <SkeletonBox width="100%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonBox width="90%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonBox width="60%" height={14} />
        </Box>

        {/* 互动栏骨架 */}
        <HStack px="$md" py="$sm" gap="$lg">
          <SkeletonBox width={50} height={24} />
          <SkeletonBox width={50} height={24} />
          <SkeletonBox width={50} height={24} />
        </HStack>

        {/* 评论区骨架 */}
        <Box px="$md" py="$md">
          <SkeletonBox width={80} height={16} style={{ marginBottom: 16 }} />
          {[1, 2, 3].map((i) => (
            <HStack key={i} alignItems="flex-start" gap="$sm" mb="$md">
              <SkeletonBox width={36} height={36} style={{ borderRadius: 18 }} />
              <Box flex={1}>
                <SkeletonBox width={80} height={12} style={{ marginBottom: 6 }} />
                <SkeletonBox width="90%" height={12} style={{ marginBottom: 4 }} />
                <SkeletonBox width="70%" height={12} />
              </Box>
            </HStack>
          ))}
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

            {/* 关联秀场区域 - 仅 DAILY_SHARE 类型显示 */}
            {post.type === "DAILY_SHARE" && post.shows && (
              <RelatedLooks
                shows={post.shows}
                onShowPress={handleShowPress}
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

const skeletonStyles = StyleSheet.create({
  mainImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
    backgroundColor: theme.colors.gray200,
  },
});

export default PostDetailScreen;
