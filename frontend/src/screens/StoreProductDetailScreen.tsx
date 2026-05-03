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
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Image, Pressable, ScrollView, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  checkStoreProductFavorited,
  checkStoreProductLiked,
  checkStoreProductWanted,
  createStoreProductComment,
  deleteStoreProductComment,
  favoriteStoreProduct,
  formatPrice,
  getStoreProductComments,
  getStoreProductDetail,
  likeStoreProduct,
  likeStoreProductComment,
  StoreProduct,
  StoreProductComment,
  unfavoriteStoreProduct,
  unlikeStoreProduct,
  unlikeStoreProductComment,
  unwantStoreProduct,
  wantStoreProduct,
} from "../services/storeProductService";
import { useAuthStore } from "../store/authStore";
import { formatTimestamp } from "../components/PostDetail/types";
import {
  CommentInputBar,
  CommentInputBarRef,
  FullscreenImageViewer,
  WantPopup,
} from "../components/PostDetail";
import {
  clampAspectRatio,
  useMediaAspectRatio,
} from "../utils/useMediaAspectRatio";
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

  // 「收藏」(Save / Bookmark) 独立乐观态 —— 与 like 同结构、与 want 同结构
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [favoritePending, setFavoritePending] = useState(false);

  // 「想要」(愿望单) 同样独立乐观态，参考 useEngagement 在 posts 上的实现
  const [isWanted, setIsWanted] = useState(false);
  const [wantCount, setWantCount] = useState(0);
  const [wantPending, setWantPending] = useState(false);
  // 自动浮窗 —— 进入页面 0.8s 后弹一次（已加愿望单则不弹），与 PostDetail 一致
  const [showWantPopup, setShowWantPopup] = useState(false);

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
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const commentInputRef = useRef<CommentInputBarRef>(null);

  // ---------------------- 图片全屏浏览 -------------------------------------
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

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
      setFavoriteCount(detail.favoriteCount ?? 0);
      setIsFavorited(!!detail.favoritedByMe);
      setWantCount(detail.wantCount ?? 0);
      setIsWanted(!!detail.wantedByMe);
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

  // 登录后再补一次精确 liked / favorited / wanted 状态（后端 detail 已带，
  // 但冷缓存下可能失败）。三个独立请求并发，不彼此阻塞。
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
    checkStoreProductFavorited(productId)
      .then((favorited) => {
        if (!mountedRef.current) return;
        setIsFavorited(favorited);
      })
      .catch(() => {
        /* 忽略 */
      });
    checkStoreProductWanted(productId)
      .then((wanted) => {
        if (!mountedRef.current) return;
        setIsWanted(wanted);
      })
      .catch(() => {
        /* 忽略 */
      });
  }, [productId, currentUser]);

  // 进入页面 0.8s 后自动弹 WantPopup —— 已加愿望单则不弹。同 PostDetail 行为。
  useEffect(() => {
    if (!product) return;
    if (isWanted) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setShowWantPopup(true);
    }, 800);
    return () => clearTimeout(timer);
    // 仅依赖 product?.id 与 isWanted 的初始值；后续 isWanted 变化不应再触发自动弹窗。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // ---------------------- 交互 --------------------------------------------
  const handleToggleLike = useCallback(async () => {
    if (likePending) return;
    if (!currentUser) {
      Alert.show(t("engagement.pleaseLogin"));
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

  const handleToggleFavorite = useCallback(async () => {
    if (favoritePending) return;
    if (!currentUser) {
      Alert.show(t("engagement.pleaseLogin"));
      return;
    }
    const nextFavorited = !isFavorited;
    setIsFavorited(nextFavorited);
    setFavoriteCount((n) => Math.max(0, n + (nextFavorited ? 1 : -1)));
    setFavoritePending(true);
    try {
      if (nextFavorited) await favoriteStoreProduct(productId);
      else await unfavoriteStoreProduct(productId);
    } catch (e) {
      // 回滚乐观态
      setIsFavorited(!nextFavorited);
      setFavoriteCount((n) => Math.max(0, n + (nextFavorited ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setFavoritePending(false);
    }
  }, [isFavorited, favoritePending, currentUser, productId]);

  const handleToggleWant = useCallback(async () => {
    if (wantPending) return;
    if (!currentUser) {
      Alert.show(t("engagement.pleaseLogin"));
      return;
    }
    const nextWanted = !isWanted;
    setIsWanted(nextWanted);
    setWantCount((n) => Math.max(0, n + (nextWanted ? 1 : -1)));
    setWantPending(true);
    try {
      if (nextWanted) await wantStoreProduct(productId);
      else await unwantStoreProduct(productId);
    } catch (e) {
      // 回滚乐观态
      setIsWanted(!nextWanted);
      setWantCount((n) => Math.max(0, n + (nextWanted ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setWantPending(false);
    }
  }, [isWanted, wantPending, currentUser, productId]);

  const handleStartReply = useCallback((c: StoreProductComment) => {
    if (c.userId == null || !c.username) return;
    setReplyTarget({
      commentId: c.id,
      userId: c.userId,
      userName: c.username,
    });
    setIsCommentFocused(true);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
    setIsCommentFocused(false);
    Keyboard.dismiss();
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsCommentFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    if (!commentInput) {
      setIsCommentFocused(false);
    }
  }, [commentInput]);

  const handleOverlayPress = useCallback(() => {
    Keyboard.dismiss();
    commentInputRef.current?.blur();
    setIsCommentFocused(false);
    setReplyTarget(null);
  }, []);


  const handleSubmitComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text) return;
    if (!currentUser) {
      Alert.show(t("engagement.pleaseLogin"));
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
      setIsCommentFocused(false);
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

  const productImages = useMemo(
    () => product?.images?.filter((uri): uri is string => !!uri) ?? [],
    [product?.images]
  );
  const hasProductImages = productImages.length > 0;
  // Drive the carousel height from the cover (first) slide's natural aspect
  // ratio, clamped to a pleasant range — mirrors LookbookContent so the
  // post-detail and product-detail screens render identical hero frames.
  const coverRatio = clampAspectRatio(
    useMediaAspectRatio(productImages[0], 4 / 5),
    3 / 4,
    16 / 9
  );
  const heroFrameStyle = useMemo(
    () => ({
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH / coverRatio,
    }),
    [coverRatio]
  );
  // Inner media fills the wrapper; `contentFit="contain"` then letterboxes
  // mismatched slides so nothing is cropped (same approach as LookbookContent).
  const heroMediaStyle = useMemo(
    () => ({ width: "100%" as const, height: "100%" as const }),
    []
  );
  const mainImageIndex = Math.max(
    0,
    Math.min(activeImageIndex, Math.max(productImages.length, 1) - 1)
  );

  const handleCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (idx !== activeImageIndex) setActiveImageIndex(idx);
    },
    [activeImageIndex]
  );

  const handleOpenFullscreen = useCallback((index: number) => {
    setActiveImageIndex(index);
    setFullscreenVisible(true);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  // ---------------------- 分支渲染 ----------------------------------------
  if (isLoading && !product) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title={t("store.productDetail")} onBack={navigation.goBack} />
        <Box style={styles.center}>
          <Image
            source={require("../../assets/gif/profile-loading.gif")}
            style={styles.loadingGif}
            resizeMode="contain"
          />
        </Box>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title={t("store.productDetail")} onBack={navigation.goBack} />
        <Box style={styles.center}>
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
        </Box>
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
          {/* 图片轮播 —— 与 LookbookContent 保持一致：FlatList 横向分页 + 圆点指示器 */}
          <Box style={styles.heroSection}>
            {hasProductImages ? (
              <FlatList
                data={productImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleCarouselScroll}
                keyExtractor={(_, index) => `product-img-${index}`}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => handleOpenFullscreen(index)}
                    style={heroFrameStyle}
                  >
                    <OptimizedImage
                      uri={item}
                      size={ImageSize.LARGE}
                      style={heroMediaStyle}
                      contentFit="contain"
                      lazy={index > 0}
                    />
                  </Pressable>
                )}
              />
            ) : (
              <Box style={[heroFrameStyle, styles.heroPlaceholder]}>
                <Ionicons name="image-outline" size={48} color={theme.colors.gray300} />
              </Box>
            )}
            {productImages.length > 1 && (
              <HStack style={styles.dotIndicatorContainer}>
                {productImages.map((_, idx) => (
                  <Box
                    key={idx}
                    style={[
                      styles.dotIndicator,
                      idx === mainImageIndex && styles.dotIndicatorActive,
                    ]}
                  />
                ))}
              </HStack>
            )}
          </Box>

          {/* 信息区 —— 小红书风格的内容区域，与 LookbookContent 一致 */}
          <VStack px="$md" pt="$md" pb="$sm" space="sm">
            <HStack space="xs" alignItems="center" flexWrap="wrap">
              {product.isNew && (
                <Box bg="$black" px="$sm" py="$xs" rounded="$sm">
                  <Text fontSize="$2xs" fontWeight="$bold" color="$white">
                    NEW
                  </Text>
                </Box>
              )}
              {hasDiscount && (
                <Box bg="$error" px="$sm" py="$xs" rounded="$sm">
                  <Text fontSize="$2xs" fontWeight="$bold" color="$white">
                    SALE
                  </Text>
                </Box>
              )}
              {product.categoryName && (
                <Box bg="$gray100" px="$sm" py="$xs" rounded="$sm">
                  <Text fontSize="$2xs" fontWeight="$medium" color="$gray700">
                    {product.categoryName}
                  </Text>
                </Box>
              )}
            </HStack>

            <Text fontSize="$lg" fontWeight="$bold" color="$black" lineHeight="$xl">
              {product.title}
            </Text>

            {/* {!!product.brand && (
              <Text fontSize="$xs" color="$gray600">
                {t("store.brandLabel")}{product.brand}
              </Text>
            )} */}

            <HStack alignItems="baseline" space="sm">
              <Text fontSize="$2xl" fontWeight="$bold" color={hasDiscount ? "$error" : "$black"}>
                {formatPrice(
                  hasDiscount
                    ? (product.discountPriceCents as number)
                    : product.priceCents,
                  product.currency
                )}
              </Text>
              {hasDiscount && (
                <Text
                  fontSize="$sm"
                  color="$gray300"
                  style={{ textDecorationLine: "line-through" }}
                >
                  {formatPrice(product.priceCents, product.currency)}
                </Text>
              )}
            </HStack>

            {product.tags && product.tags.length > 0 && (
              <HStack space="xs" flexWrap="wrap">
                {product.tags.map((tag) => (
                  <Box
                    key={tag}
                    bg="$gray50"
                    px="$sm"
                    py="$xs"
                    rounded="$lg"
                    borderWidth={StyleSheet.hairlineWidth}
                    borderColor="$gray100"
                  >
                    <Text fontSize="$xs" color="$gray700">
                      #{tag}
                    </Text>
                  </Box>
                ))}
              </HStack>
            )}

            {!!product.description && (
              <Text fontSize="$sm" color="$gray800" lineHeight="$lg" mt="$xs">
                {product.description}
              </Text>
            )}
          </VStack>

          {/* 评论区 —— 与 PostDetail 的 CommentsSection 保持一致：8px 灰色分隔条 + $lg 标题 */}
          <VStack
            space="md"
            px="$md"
            py="$lg"
            mt="$md"
            borderTopWidth={8}
            borderTopColor="$gray100"
          >
            <Text fontSize="$lg" fontWeight="$semibold" color="$black">
              {t("store.comments", { count: commentsTotal })}
            </Text>

            {commentsLoading && comments.length === 0 && (
              <Box style={styles.commentsLoading}>
                <Image
                  source={require("../../assets/gif/profile-loading.gif")}
                  style={styles.commentsLoadingGif}
                  resizeMode="contain"
                />
              </Box>
            )}

            {!commentsLoading && comments.length === 0 && (
              <Box style={styles.commentsEmpty}>
                <Ionicons name="chatbubble-outline" size={32} color={theme.colors.gray300} />
                <Text fontSize="$sm" color="$gray400" mt="$sm">
                  {t("store.noComments")}
                </Text>
              </Box>
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
                py="$sm"
                alignItems="center"
              >
                <Text fontSize="$xs" color="$gray400">
                  {t("store.loadMoreComments")}
                </Text>
              </Pressable>
            )}
          </VStack>
        </ScrollView>

        {/* 遮罩层：点击退出评论输入 */}
        {isCommentFocused && (
          <Pressable onPress={handleOverlayPress} style={styles.contentOverlay} />
        )}

        {/* 「我想要」浮窗 —— 进入页面 0.8s 后弹出 (已加愿望单则跳过)，与 PostDetail 一致 */}
        <WantPopup
          visible={showWantPopup}
          isWanted={isWanted}
          productImage={productImages[0]}
          productName={product.title}
          brandName={product.brand ?? undefined}
          onWant={handleToggleWant}
          onDismiss={() => setShowWantPopup(false)}
        />

        {/* 底部操作栏 —— 复用 PostDetail 的 CommentInputBar；isItemReview=true 才会渲染「想要」按钮 */}
        <CommentInputBar
          ref={commentInputRef}
          commentInput={commentInput}
          isSubmitting={isSubmittingComment}
          isFocused={isCommentFocused}
          displayLikes={likeCount}
          displaySaves={favoriteCount}
          displayComments={commentsTotal}
          displayIsLiked={isLiked}
          displayIsSaved={isFavorited}
          displayWants={wantCount}
          displayIsWanted={isWanted}
          isItemReview
          replyTarget={
            replyTarget
              ? {
                  commentId: String(replyTarget.commentId),
                  userId: replyTarget.userId,
                  userName: replyTarget.userName,
                }
              : null
          }
          onInputChange={setCommentInput}
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onSubmit={handleSubmitComment}
          onLike={handleToggleLike}
          onSave={handleToggleFavorite}
          onWant={handleToggleWant}
          onOverlayPress={handleOverlayPress}
          onCancelReply={handleCancelReply}
        />
      </KeyboardAvoidingView>
      <FullscreenImageViewer
        visible={fullscreenVisible}
        images={productImages}
        currentIndex={mainImageIndex}
        onClose={handleCloseFullscreen}
        onIndexChange={setActiveImageIndex}
      />
    </SafeAreaView>
  );
};

// ============================================================================
// Header
// ============================================================================

const Header: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <HStack
    bg="$white"
    alignItems="center"
    justifyContent="between"
    px="$md"
    py="$sm"
    borderBottomWidth={1}
    borderBottomColor="$gray100"
  >
    <Pressable onPress={onBack} p="$xs" hitSlop={8}>
      <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
    </Pressable>
    <Text fontSize="$md" fontWeight="$semibold" color="$black">
      {title}
    </Text>
    <Box w={32} />
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
    <HStack space="sm">
      <OptimizedImage
        uri={avatarUri}
        size={ImageSize.THUMBNAIL}
        style={styles.commentAvatar}
        contentFit="cover"
        lazy
      />
      <VStack flex={1} space="xs">
        <HStack justifyContent="between" alignItems="center">
          <HStack space="xs" alignItems="center" flexWrap="wrap" flex={1}>
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              {comment.username || t("store.anonymous")}
            </Text>
            {comment.replyToUsername && (
              <HStack space="xs" alignItems="center">
                <Ionicons
                  name="arrow-forward"
                  size={10}
                  color={theme.colors.gray400}
                />
                <Text fontSize="$xs" color="$accent" fontWeight="$medium">
                  @{comment.replyToUsername}
                </Text>
              </HStack>
            )}
          </HStack>
          {!!timestamp && (
            <Text fontSize="$xs" color="$gray600">
              {timestamp}
            </Text>
          )}
        </HStack>
        <Text fontSize="$sm" color="$gray800" lineHeight="$md">
          {comment.content}
        </Text>
        <HStack space="md" mt="$xs" alignItems="center">
          <Pressable onPress={onLike}>
            <HStack space="xs" alignItems="center">
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={16}
                color={comment.likedByMe ? "#FF3040" : theme.colors.gray400}
              />
              <Text
                fontSize="$xs"
                color={comment.likedByMe ? "#FF3040" : "$gray600"}
              >
                {comment.likeCount > 0 ? comment.likeCount : ""}
              </Text>
            </HStack>
          </Pressable>
          <Pressable onPress={onReply}>
            <Text fontSize="$xs" color="$gray600">
              {t("store.reply")}
            </Text>
          </Pressable>
          {isMine && (
            <Pressable onPress={onDelete}>
              <Text fontSize="$xs" color="$error">
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
  loadingGif: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  heroSection: {
    position: "relative",
    backgroundColor: theme.colors.black,
  },
  heroPlaceholder: {
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  // 圆点指示器 —— 与 LookbookContent 一致 (bottom: 20, 6/8px 圆点, 4px 间距)
  dotIndicatorContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 4,
  },
  dotIndicatorActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
  },
  commentsLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  commentsLoadingGif: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
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
  contentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
});

export default StoreProductDetailScreen;
