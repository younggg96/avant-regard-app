/**
 * StoreProductDetailScreen —— 买手店商家上架单品的详情页。
 *
 * 职责：
 *   - 展示商品图（横向 carousel + 指示点）、标题 / 品牌 / 价格（含折扣划线）/ 标签 / 描述；
 *   - 用户点赞 / 评论（支持 @ 回复，回复提交后一并显示在主列表中）；
 *   - 不复用 PostDetail 下的完整 CommentsSection —— 它强耦合 posts 数据模型（
 *     userTitle / showReplies 等字段，以及 lots of handler wiring），商品评论量级
 *     远小于 posts，扁平平铺的 UX 已足够；回复树 Phase 5 再按需求扩展。
 *
 * 路由参数：
 *   - `productId`（必填）：后端 `store_products.id`。
 *
 * 为什么不直接复用 PostDetail：商品不属于 posts，`post.status` / `user` / `brand`
 * 等字段语义不匹配；硬塞成 PostDetail 会污染那条路径原本已经很复杂的条件
 * 分支（lookbook / outfit / review / forum）。新屏独立维护更清晰。
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  checkStoreProductLiked,
  createStoreProductComment,
  deleteStoreProductComment,
  formatPrice,
  getStoreProductComments,
  getStoreProductDetail,
  likeStoreProduct,
  likeStoreProductComment,
  StoreProduct,
  StoreProductComment,
  unlikeStoreProduct,
  unlikeStoreProductComment,
} from "../services/storeProductService";
import { useAuthStore } from "../store/authStore";
import { formatTimestamp } from "../components/PostDetail/types";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RouteParams {
  productId: number;
}

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

type RouteProps = RouteProp<Record<string, RouteParams>, string>;

/** 顶部评论拉一页；更多评论由用户继续下滑触发分页。 */
const COMMENT_PAGE_SIZE = 20;

interface ReplyTarget {
  commentId: number;
  userId: number;
  userName: string;
}

const StoreProductDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { productId } = route.params ?? ({} as RouteParams);
  const currentUser = useAuthStore((s) => s.user);

  // ---------------------- 商品主体 -----------------------------------------
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 点赞独立的乐观态，独立于 product.likeCount
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);

  // ---------------------- 评论 ---------------------------------------------
  const [comments, setComments] = useState<StoreProductComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(true);
  const [commentsTotal, setCommentsTotal] = useState(0);

  // 评论输入
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const commentInputRef = useRef<TextInput>(null);

  // ---------------------- 图片全屏浏览 -------------------------------------
  // 暂不接入 FullscreenImageViewer（它强耦合 isVideoUrl 等 posts 逻辑），
  // 用简易 Modal 也可以，但 Phase 4 先省略：点击图片走 no-op + TODO 埋点。
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // unmount 防御
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------- 加载 ---------------------------------------------
  const loadProduct = useCallback(async () => {
    if (!productId) return;
    try {
      setIsLoading(true);
      setError(null);
      const detail = await getStoreProductDetail(productId);
      if (!mountedRef.current) return;
      setProduct(detail);
      setLikeCount(detail.likeCount ?? 0);
      setIsLiked(!!detail.likedByMe);
    } catch (e) {
      console.error("[StoreProductDetail] load product failed:", e);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : t("store.loadFailed"));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [productId]);

  const loadComments = useCallback(
    async (mode: "initial" | "more" = "initial") => {
      if (!productId) return;
      try {
        if (mode === "initial") setCommentsLoading(true);
        const targetPage = mode === "more" ? commentsPage + 1 : 1;
        const result = await getStoreProductComments(
          productId,
          targetPage,
          COMMENT_PAGE_SIZE
        );
        if (!mountedRef.current) return;
        setCommentsTotal(result.total);
        setCommentsPage(targetPage);
        const next =
          mode === "more"
            ? [...comments, ...result.comments]
            : result.comments;
        setComments(next);
        setCommentsHasMore(
          next.length < result.total && result.comments.length > 0
        );
      } catch (e) {
        console.warn("[StoreProductDetail] load comments failed:", e);
      } finally {
        if (mountedRef.current && mode === "initial") setCommentsLoading(false);
      }
    },
    // comments/commentsPage 故意不放进 deps：避免 load 自身依赖自己；用闭包抓值即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId]
  );

  useEffect(() => {
    loadProduct();
    loadComments("initial");
  }, [loadProduct, loadComments]);

  // 登录后再补一次精确 liked 状态（后端 detail 已带，但冷缓存下可能失败）。
  useEffect(() => {
    if (!productId || !currentUser) return;
    checkStoreProductLiked(productId)
      .then((liked) => {
        if (!mountedRef.current) return;
        setIsLiked(liked);
      })
      .catch(() => {
        /* 忽略 */
      });
  }, [productId, currentUser]);

  // ---------------------- 交互 --------------------------------------------
  const handleToggleLike = useCallback(async () => {
    if (likePending) return;
    if (!currentUser) {
      Alert.show(t("common.pleaseLogin"));
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((n) => Math.max(0, n + (nextLiked ? 1 : -1)));
    setLikePending(true);
    try {
      if (nextLiked) await likeStoreProduct(productId);
      else await unlikeStoreProduct(productId);
    } catch (e) {
      // 回滚乐观态
      setIsLiked(!nextLiked);
      setLikeCount((n) => Math.max(0, n + (nextLiked ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setLikePending(false);
    }
  }, [isLiked, likePending, currentUser, productId]);

  const handleStartReply = useCallback((c: StoreProductComment) => {
    if (c.userId == null || !c.username) return;
    setReplyTarget({
      commentId: c.id,
      userId: c.userId,
      userName: c.username,
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const handleSubmitComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text) return;
    if (!currentUser) {
      Alert.show(t("common.pleaseLogin"));
      return;
    }
    if (isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const newComment = await createStoreProductComment(productId, {
        content: text,
        parentId: replyTarget?.commentId,
        replyToUserId: replyTarget?.userId,
      });
      if (!mountedRef.current) return;
      setComments((prev) => [newComment, ...prev]);
      setCommentsTotal((n) => n + 1);
      setCommentInput("");
      setReplyTarget(null);
      Keyboard.dismiss();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("store.publishFailed"));
    } finally {
      if (mountedRef.current) setIsSubmittingComment(false);
    }
  }, [
    commentInput,
    currentUser,
    isSubmittingComment,
    productId,
    replyTarget,
  ]);

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      try {
        await deleteStoreProductComment(commentId);
        if (!mountedRef.current) return;
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsTotal((n) => Math.max(0, n - 1));
      } catch (e) {
        Alert.show(e instanceof Error ? e.message : t("store.deleteFailed"));
      }
    },
    []
  );

  const handleToggleCommentLike = useCallback(
    async (c: StoreProductComment) => {
      const nextLiked = !c.likedByMe;
      setComments((prev) =>
        prev.map((it) =>
          it.id === c.id
            ? {
                ...it,
                likedByMe: nextLiked,
                likeCount: Math.max(0, (it.likeCount ?? 0) + (nextLiked ? 1 : -1)),
              }
            : it
        )
      );
      try {
        if (nextLiked) await likeStoreProductComment(c.id);
        else await unlikeStoreProductComment(c.id);
      } catch (e) {
        // 回滚
        setComments((prev) =>
          prev.map((it) =>
            it.id === c.id
              ? {
                  ...it,
                  likedByMe: !nextLiked,
                  likeCount: Math.max(
                    0,
                    (it.likeCount ?? 0) + (nextLiked ? -1 : 1)
                  ),
                }
              : it
          )
        );
        Alert.show(e instanceof Error ? e.message : t("store.likeFailed"));
      }
    },
    []
  );

  const handleEndReached = useCallback(() => {
    if (commentsLoading || !commentsHasMore) return;
    loadComments("more");
  }, [commentsLoading, commentsHasMore, loadComments]);

  // ---------------------- 派生 --------------------------------------------
  const hasDiscount = useMemo(
    () =>
      product != null &&
      product.discountPriceCents != null &&
      product.discountPriceCents < product.priceCents,
    [product]
  );

  const mainImageIndex = Math.max(0, Math.min(activeImageIndex, (product?.images?.length ?? 1) - 1));

  const handleCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (idx !== activeImageIndex) setActiveImageIndex(idx);
    },
    [activeImageIndex]
  );

  // ---------------------- 分支渲染 ----------------------------------------
  if (isLoading && !product) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title={t("store.productDetail")} onBack={navigation.goBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title={t("store.productDetail")} onBack={navigation.goBack} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.gray300} />
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$sm">
            {t("store.loadFailed")}
          </Text>
          <Text fontSize="$xs" color="$gray300" mt="$xs" textAlign="center">
            {error ?? t("store.productNotFound")}
          </Text>
          <Pressable onPress={loadProduct} px="$lg" py="$sm" mt="$md" bg="$black" rounded="$md">
            <Text color="$white" fontWeight="$semibold" fontSize="$sm">
              {t("store.tapRetry")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Header title={t("store.productDetail")} onBack={navigation.goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollEndDrag={() => Keyboard.dismiss()}
          showsVerticalScrollIndicator={false}
        >
          {/* 图片轮播 */}
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
            >
              {(product.images && product.images.length > 0
                ? product.images
                : [null]
              ).map((uri, idx) =>
                uri ? (
                  <OptimizedImage
                    key={`${idx}`}
                    uri={uri}
                    size={ImageSize.LARGE}
                    style={styles.heroImage}
                    contentFit="cover"
                    lazy={idx > 0}
                  />
                ) : (
                  <View key={`ph-${idx}`} style={[styles.heroImage, styles.heroPlaceholder]}>
                    <Ionicons name="image-outline" size={48} color={theme.colors.gray300} />
                  </View>
                )
              )}
            </ScrollView>
            {product.images && product.images.length > 1 && (
              <View style={styles.dotsRow}>
                {product.images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      idx === mainImageIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* 信息区 */}
          <VStack px="$md" pt="$md" gap={8}>
            <HStack gap={6} alignItems="center" flexWrap="wrap">
              {product.isNew && (
                <Box bg="$black" px="$sm" py={3} rounded="$xs">
                  <Text fontSize={10} fontWeight="$bold" color="$white">
                    NEW
                  </Text>
                </Box>
              )}
              {hasDiscount && (
                <Box bg="$error" px="$sm" py={3} rounded="$xs">
                  <Text fontSize={10} fontWeight="$bold" color="$white">
                    SALE
                  </Text>
                </Box>
              )}
              {product.categoryName && (
                <Box bg="$gray100" px="$sm" py={3} rounded="$xs">
                  <Text fontSize={10} fontWeight="$medium" color="$gray700">
                    {product.categoryName}
                  </Text>
                </Box>
              )}
            </HStack>

            <Text fontSize={20} fontWeight="$bold" color="$black" lineHeight={28}>
              {product.title}
            </Text>

            {!!product.brand && (
              <Text fontSize={13} color="$gray600">
                {t("store.brandLabel")}{product.brand}
              </Text>
            )}

            <HStack alignItems="baseline" gap={8}>
              <Text fontSize={24} fontWeight="$bold" color={hasDiscount ? "$error" : "$black"}>
                {formatPrice(
                  hasDiscount
                    ? (product.discountPriceCents as number)
                    : product.priceCents,
                  product.currency
                )}
              </Text>
              {hasDiscount && (
                <Text
                  fontSize={14}
                  color="$gray300"
                  style={{ textDecorationLine: "line-through" }}
                >
                  {formatPrice(product.priceCents, product.currency)}
                </Text>
              )}
            </HStack>

            {product.tags && product.tags.length > 0 && (
              <HStack gap={6} flexWrap="wrap">
                {product.tags.map((tag) => (
                  <Box
                    key={tag}
                    bg="$gray50"
                    px={10}
                    py={4}
                    rounded="$lg"
                    borderWidth={StyleSheet.hairlineWidth}
                    borderColor="$gray100"
                  >
                    <Text fontSize={11} color="$gray700">
                      {tag}
                    </Text>
                  </Box>
                ))}
              </HStack>
            )}

            {!!product.description && (
              <Text fontSize={14} color="$gray800" lineHeight={22} mt={4}>
                {product.description}
              </Text>
            )}
          </VStack>

          {/* 评论区 */}
          <View style={styles.commentsSection}>
            <Text fontSize={16} fontWeight="$semibold" color="$black">
              {t("store.comments")} ({commentsTotal})
            </Text>

            {commentsLoading && comments.length === 0 && (
              <View style={styles.commentsPending}>
                <ActivityIndicator size="small" color={theme.colors.gray300} />
              </View>
            )}

            {!commentsLoading && comments.length === 0 && (
              <View style={styles.commentsEmpty}>
                <Ionicons name="chatbubble-outline" size={28} color={theme.colors.gray300} />
                <Text fontSize={13} color="$gray400" mt={8}>
                  {t("store.noComments")}
                </Text>
              </View>
            )}

            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={currentUser?.userId}
                onReply={() => handleStartReply(c)}
                onDelete={() => handleDeleteComment(c.id)}
                onLike={() => handleToggleCommentLike(c)}
              />
            ))}

            {commentsHasMore && comments.length > 0 && (
              <Pressable
                onPress={handleEndReached}
                py={12}
                alignItems="center"
              >
                <Text fontSize={12} color="$gray400">
                  {t("store.loadMoreComments")}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        {/* 底部操作栏：点赞 + 评论输入 */}
        <View style={styles.bottomBar}>
          <Pressable onPress={handleToggleLike} style={styles.bottomAction}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? theme.colors.error : theme.colors.gray600}
            />
            <Text fontSize={11} color={isLiked ? "$error" : "$gray600"} mt={2}>
              {likeCount}
            </Text>
          </Pressable>

          <View style={styles.inputWrapper}>
            {replyTarget && (
              <View style={styles.replyHint}>
                <Text fontSize={11} color="$gray600">
                  {t("store.reply")} <Text color="$accent" fontWeight="$medium">@{replyTarget.userName}</Text>
                </Text>
                <TouchableOpacity onPress={handleCancelReply} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.gray400} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                ref={commentInputRef}
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder={
                  replyTarget ? `${t("store.reply")} @${replyTarget.userName}` : t("store.writeComment")
                }
                placeholderTextColor={theme.colors.gray400}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleSubmitComment}
                maxLength={500}
              />
              <Pressable
                onPress={handleSubmitComment}
                disabled={isSubmittingComment || !commentInput.trim()}
                style={styles.sendButton}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={
                      commentInput.trim()
                        ? theme.colors.accent
                        : theme.colors.gray400
                    }
                  />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// Header
// ============================================================================

const Header: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <HStack
    style={styles.header}
    alignItems="center"
    justifyContent="between"
    px="$md"
    py="$sm"
  >
    <Pressable onPress={onBack} hitSlop={8}>
      <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
    </Pressable>
    <Text fontSize={15} fontWeight="$semibold" color="$black">
      {title}
    </Text>
    <View style={{ width: 24 }} />
  </HStack>
);

// ============================================================================
// CommentItem
// ============================================================================

const CommentItemImpl: React.FC<{
  comment: StoreProductComment;
  currentUserId?: number;
  onReply: () => void;
  onDelete: () => void;
  onLike: () => void;
}> = ({ comment, currentUserId, onReply, onDelete, onLike }) => {
  const { t } = useTranslation();
  const isMine = currentUserId != null && comment.userId === currentUserId;
  const timestamp = comment.createdAt
    ? formatTimestamp(comment.createdAt)
    : "";
  const avatarUri =
    comment.userAvatar ||
    "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=200";

  return (
    <HStack gap={10} py={10}>
      <OptimizedImage
        uri={avatarUri}
        size={ImageSize.THUMBNAIL}
        style={styles.commentAvatar}
        contentFit="cover"
        lazy
      />
      <VStack flex={1} gap={4}>
        <HStack gap={6} alignItems="center" flexWrap="wrap">
          <Text fontSize={13} fontWeight="$semibold" color="$black">
            {comment.username || t("store.anonymous")}
          </Text>
          {comment.replyToUsername && (
            <>
              <Ionicons
                name="arrow-forward"
                size={10}
                color={theme.colors.gray400}
              />
              <Text fontSize={12} color="$accent" fontWeight="$medium">
                @{comment.replyToUsername}
              </Text>
            </>
          )}
          {!!timestamp && (
            <Text fontSize={11} color="$gray400" ml="auto">
              {timestamp}
            </Text>
          )}
        </HStack>
        <Text fontSize={13} color="$gray800" lineHeight={20}>
          {comment.content}
        </Text>
        <HStack gap={14} mt={2} alignItems="center">
          <Pressable onPress={onLike}>
            <HStack gap={3} alignItems="center">
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={14}
                color={comment.likedByMe ? theme.colors.error : theme.colors.gray400}
              />
              {!!comment.likeCount && (
                <Text
                  fontSize={11}
                  color={comment.likedByMe ? "$error" : "$gray500"}
                >
                  {comment.likeCount}
                </Text>
              )}
            </HStack>
          </Pressable>
          <Pressable onPress={onReply}>
            <Text fontSize={11} color="$gray500">
              {t("store.reply")}
            </Text>
          </Pressable>
          {isMine && (
            <Pressable onPress={onDelete}>
              <Text fontSize={11} color="$error">
                {t("common.delete")}
              </Text>
            </Pressable>
          )}
        </HStack>
      </VStack>
    </HStack>
  );
};

const CommentItem = React.memo(CommentItemImpl);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: theme.colors.gray100,
  },
  heroPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: theme.colors.white,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 8,
    borderTopColor: theme.colors.gray50,
  },
  commentsPending: {
    paddingVertical: 20,
    alignItems: "center",
  },
  commentsEmpty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  bottomAction: {
    alignItems: "center",
    width: 44,
  },
  inputWrapper: {
    flex: 1,
  },
  replyHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: theme.colors.gray50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },
  sendButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default StoreProductDetailScreen;
