import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
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
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable, OptimizedImage } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";
import { ImageSize } from "../utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 导入拆分后的组件和 hooks
import {
  PostDetailHeader,
  LookbookContent,
  PostContentSection,
  OutfitItemsSection,
  ImageGrid,
  RelatedLooks,
  RelatedBrands,
  CommentsSection,
  CommentInputBar,
  FullscreenImageViewer,
  OptionsMenuModal,
  DeleteConfirmDialog,
  EditConfirmDialog,
  WantPopup,
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
import { ShareModal } from "../components/ShareModal";
import { ShareToChatModal } from "../components/ShareToChatModal";
import { ReportBlockModal } from "../components/ReportBlockModal";
import type { ReportTarget } from "../components/PostDetail/CommentsSection";

const PostDetailScreen = () => {
  const { t } = useTranslation();
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
    handleDeleteComment,
    handleDeleteReply,
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
  const {
    isFollowing,
    isFollowLoading,
    showShareModal,
    handleLike,
    handleSave,
    handleWant,
    handleShare,
    handleCloseShareModal,
    handleShareComplete,
    handleFollow,
  } = useEngagement({
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
  } = usePostActions({
    post,
    userId: user?.userId,
    navigation: navigation as any,
  });

  // 导航 Hook
  const { handleAuthorPress, handleUserPress, handleShowPress, handleBrandPress } =
    useNavigationHandlers({
      post,
      navigation,
    });

  // 举报/屏蔽 Modal（帖子）
  const [showReportModal, setShowReportModal] = useState(false);

  // 分享到聊天 Modal
  const [showShareToChat, setShowShareToChat] = useState(false);

  // 举报/屏蔽 Modal（评论）
  const [commentReportTarget, setCommentReportTarget] = useState<ReportTarget | null>(null);

  // 「我想要」弹窗（仅 ITEM_REVIEW）
  const [showWantPopup, setShowWantPopup] = useState(false);

  useEffect(() => {
    if (
      post?.type === "ITEM_REVIEW" &&
      postStatus === "PUBLISHED" &&
      !post.engagement?.isWanted
    ) {
      const timer = setTimeout(() => setShowWantPopup(true), 800);
      return () => clearTimeout(timer);
    }
  }, [post?.id, post?.type, postStatus]);

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

  const images = post?.content?.images || [];
  const isForumPost = !!post?.communityId || !!post?.communityName;
  const [viewerImages, setViewerImages] = useState<string[]>(images);

  // 论坛正文可能是 JSON blocks（text/image/video），提取其中媒体用于全屏查看器滑动。
  const articleMediaInfo = useMemo(() => {
    const merged: string[] = [...images];
    let hasInlineMediaBlocks = false;
    const description = post?.content?.description;
    if (description) {
      try {
        const parsed = JSON.parse(description);
        if (Array.isArray(parsed)) {
          parsed.forEach((block) => {
            const type = block?.type;
            const content = typeof block?.content === "string" ? block.content.trim() : "";
            if ((type === "image" || type === "video") && content) {
              hasInlineMediaBlocks = true;
              merged.push(content);
            }
          });
        }
      } catch {
        // 纯文本内容不处理
      }
    }
    return {
      media: Array.from(new Set(merged)),
      hasInlineMediaBlocks,
    };
  }, [images, post?.content?.description]);

  const articleMedia = articleMediaInfo.media;
  const hasInlineMediaBlocks = articleMediaInfo.hasInlineMediaBlocks;

  useEffect(() => {
    setViewerImages(images);
  }, [post?.id]);

  const handleOpenPostFullscreen = useCallback(
    (index: number) => {
      setViewerImages(images);
      handleOpenFullscreen(index);
    },
    [images, handleOpenFullscreen]
  );

  const handleOpenCustomFullscreen = useCallback(
    (index: number, mediaUris: string[]) => {
      const resolved = mediaUris.length > 0 ? mediaUris : images;
      setViewerImages(resolved);
      handleOpenFullscreen(index);
    },
    [images, handleOpenFullscreen]
  );

  // 加载中状态 - 骨架屏
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <HStack px="$md" py="$sm" alignItems="center" gap="$sm">
          <SkeletonBox width={32} height={32} style={{ borderRadius: 16 }} />
          <SkeletonBox width={100} height={14} />
        </HStack>

        {/* 主图 */}
        <Animated.View style={[skeletonStyles.mainImage, { opacity: skeletonOpacity }]} />

        {/* 内容 */}
        <Box px="$md" py="$md" gap="$sm">
          <SkeletonBox width="70%" height={18} />
          <SkeletonBox width="100%" height={14} />
          <SkeletonBox width="50%" height={14} />
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
            {t("post.notFound")}
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  const displayLikes = post.engagement?.likes || 0;
  const displaySaves = post.engagement?.saves || 0;
  const displayComments =
    post.engagement?.comments ||
    comments.reduce((sum, c) => sum + 1 + (c.replyCount || 0), 0);
  const displayIsLiked = post.engagement?.isLiked || false;
  const displayIsSaved = post.engagement?.isSaved || false;
  const displayWants = post.engagement?.wants || 0;
  const displayIsWanted = post.engagement?.isWanted || false;
  const isItemReview = post.type === "ITEM_REVIEW";
  // 驳回笔记对其它用户不可见，作者自己来看时也不需要看到评论入口/输入框，
  // 直接引导其用 header 上的「修改后重新提交」按钮去编辑。
  const showComments = postStatus === "PUBLISHED";
  const isRejected = postStatus === "REJECTED";

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
            isFollowLoading={isFollowLoading}
            onGoBack={() => navigation.goBack()}
            onAuthorPress={handleAuthorPress}
            onFollow={handleFollow}
            onContinueEdit={handleContinueEdit}
            onShowOptionsMenu={() => setShowOptionsMenu(true)}
            onShowReportMenu={() => setShowReportModal(true)}
          />

          {/* 驳回提示横幅：放在 header 正下方，让作者打开就能看到「为什么我看不到
              这条」并清晰知道下一步是「修改后重新提交」。文案不上锁定原因细节
              ——通用提示更稳健，避免后端没有 reject_reason 字段时空文案。 */}
          {isRejected && isOwnPost && (
            <View style={localStyles.rejectedBanner}>
              <View style={localStyles.rejectedBannerRow}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={localStyles.rejectedBannerTitle}>
                  {t("postDetail.rejectedBannerTitle")}
                </Text>
              </View>
              <Text style={localStyles.rejectedBannerBody}>
                {t("postDetail.rejectedBannerBody")}
              </Text>
            </View>
          )}

          {/* Content */}
          <RNScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Lookbook: 小红书风格 - 大图轮播在顶部 */}
            {post.type === "OUTFIT" && images.length > 0 && (
              <LookbookContent
                post={post}
                images={images}
                currentImageIndex={currentImageIndex}
                onImageIndexChange={setCurrentImageIndex}
                onOpenFullscreen={handleOpenPostFullscreen}
              />
            )}

            {/* 论坛文章封面图置顶 */}
            {isForumPost && articleMedia.length > 0 && (
              <Pressable onPress={() => handleOpenCustomFullscreen(0, articleMedia)}>
                <Box style={localStyles.forumCoverContainer}>
                  <OptimizedImage
                    uri={articleMedia[0]}
                    size={ImageSize.LARGE}
                    style={localStyles.forumCoverImage}
                    contentFit="cover"
                    lazy={false}
                  />
                </Box>
              </Pressable>
            )}

            {/* 非 Lookbook 类型的标题和描述 */}
            {post.type !== "OUTFIT" && (
              <PostContentSection
                post={post}
                onOpenMediaFullscreen={handleOpenCustomFullscreen}
                mediaUrisForViewer={articleMedia}
                hideFirstCoverImage={isForumPost && hasInlineMediaBlocks}
              />
            )}

            {/* Image Grid - 3 columns (非 lookbook 类型) */}
            {post.type !== "OUTFIT" &&
              (!isForumPost || !hasInlineMediaBlocks) &&
              (isForumPost ? images.slice(1).length > 0 : images.length > 0) && (
              <ImageGrid
                images={isForumPost ? images.slice(1) : images}
                coverAspectRatio={post.content?.coverAspectRatio}
                onOpenFullscreen={(index) =>
                  isForumPost
                    ? handleOpenCustomFullscreen(index + 1, images)
                    : handleOpenPostFullscreen(index)
                }
              />
            )}

            {/* 搭配单品 */}
            {post.type === "OUTFIT" && <OutfitItemsSection items={post.items} />}

            {/* 关联秀场区域 */}
            {(post.type === "DAILY_SHARE" || post.type === "ITEM_REVIEW") && post.shows && post.shows.length > 0 && (
              <RelatedLooks
                shows={post.shows}
                onShowPress={handleShowPress}
              />
            )}

            {/* 关联品牌区域 */}
            {post.brands && post.brands.length > 0 && (
              <RelatedBrands
                brands={post.brands}
                onBrandPress={handleBrandPress}
              />
            )}

            {/* Comments Section */}
            <CommentsSection
              comments={comments}
              isLoading={isLoadingComments}
              postStatus={postStatus}
              currentUserId={user?.userId}
              onCommentLike={handleCommentLike}
              onReplyLike={handleReplyLike}
              onDeleteComment={handleDeleteComment}
              onDeleteReply={handleDeleteReply}
              onUserPress={handleUserPress}
              onReplyPress={handleReplyPress}
              onToggleReplies={handleToggleReplies}
              onReportComment={setCommentReportTarget}
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
              displayWants={displayWants}
              displayIsWanted={displayIsWanted}
              isItemReview={isItemReview}
              replyTarget={replyTarget}
              onInputChange={setCommentInput}
              onInputFocus={handleInputFocus}
              onInputBlur={handleInputBlur}
              onSubmit={handleSubmitComment}
              onLike={handleLike}
              onSave={handleSave}
              onWant={handleWant}
              onOverlayPress={handleOverlayPress}
              onCancelReply={handleCancelReply}
            />
          )}

          {/* 「我想要」弹窗 - 仅 ITEM_REVIEW 已发布帖子 */}
          {isItemReview && showComments && (
            <WantPopup
              visible={showWantPopup}
              isWanted={displayIsWanted}
              productImage={post.content?.images?.[0]}
              productName={post.productName}
              brandName={post.brandName}
              onWant={handleWant}
              onDismiss={() => setShowWantPopup(false)}
            />
          )}
        </KeyboardAvoidingView>

        {/* Fullscreen Image Viewer */}
        <FullscreenImageViewer
          visible={fullscreenVisible}
          images={viewerImages}
          currentIndex={currentImageIndex}
          onClose={handleCloseFullscreen}
          onIndexChange={setCurrentImageIndex}
        />

        {/* Options Menu Modal */}
        <OptionsMenuModal
          visible={showOptionsMenu}
          showEditOption={
            isOwnPost && (postStatus === "PUBLISHED" || postStatus === "REJECTED")
          }
          onClose={() => setShowOptionsMenu(false)}
          onEdit={handleEditPost}
          onDelete={handleDeletePost}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          visible={showDeleteDialog}
          isDeleting={isDeleting}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleConfirmDelete}
        />

        {/* Edit Confirmation Dialog */}
        <EditConfirmDialog
          visible={showEditConfirmDialog}
          onClose={() => setShowEditConfirmDialog(false)}
          onConfirm={handleConfirmEdit}
        />

        {/* Report / Block Modal (Post) */}
        <ReportBlockModal
          visible={showReportModal}
          targetType="POST"
          targetId={post.id}
          targetAuthorId={post.author.id}
          targetAuthorName={post.author.name}
          onClose={() => setShowReportModal(false)}
          onBlockComplete={() => navigation.goBack()}
          onShare={() => setShowShareToChat(true)}
        />

        {/* Share to Chat Modal */}
        <ShareToChatModal
          visible={showShareToChat}
          post={post}
          onClose={() => setShowShareToChat(false)}
        />

        {/* Report / Block Modal (Comment) */}
        {commentReportTarget && (
          <ReportBlockModal
            visible={true}
            targetType="COMMENT"
            targetId={commentReportTarget.commentId}
            targetAuthorId={commentReportTarget.authorId}
            targetAuthorName={commentReportTarget.authorName}
            onClose={() => setCommentReportTarget(null)}
            onBlockComplete={() => setCommentReportTarget(null)}
          />
        )}

        {/* Share Modal - temporarily hidden */}
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
  forumCoverContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.gray50,
  },
  forumCoverImage: {
    width: "100%",
    height: "100%",
  },
  rejectedBanner: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rejectedBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rejectedBannerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B91C1C",
  },
  rejectedBannerBody: {
    fontSize: 12,
    color: "#7F1D1D",
    marginTop: 4,
    lineHeight: 17,
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
