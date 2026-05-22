/**
 * StoreProductDetailScreen —— 商品详情页（PRD V2 设计稿对齐版）。
 *
 * 设计参考：`AVANT REGARD前端 partial.pdf` 的 product detail 双屏（顶部信息 + 商品详情 tab）。
 *
 * 内容分层（从上到下）：
 *   1. 图片轮播 + "1/N" 计数指示器
 *   2. 标题 + 收藏 heart（右上）
 *   3. 价格
 *   4. 快速信息行：成色 | 尺码 | 颜色（| 年份 | 渠道）
 *   5. 服务徽章：平台鉴定 / 不支持退换 / 包邮
 *   6. 卖家卡片：头像 + 用户名 + Lv + 好评率 + 关注按钮
 *   7. 关联的品牌（同卖家其他在售品牌，圆形头像）
 *   8. 关联的秀场（season + look）
 *   9. 商品描述（可展开）
 *  10. 商品详情表（品牌 / 款式 / 尺码 / 颜色 / 成色 / 购买渠道 / 购买时间 / 配件）
 *  11. 细节展示（photoAngles.extras 网格）
 *  12. 卖家信息（在售 / 成交 / 加入时间）
 *  13. 评价预览（trade_reviews，最多 3 条）
 *  14. 相关推荐（4-up grid）
 *
 * 数据源：`getStoreProductRichDetail()`（一次性聚合，避免 N+1）。
 *
 * 兼容保留：底部 TradingActionBar / CommentInputBar / WantPopup / OfferModal / FullscreenImageViewer。
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
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Image, Pressable, ScrollView, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import { useProfileLoadingGif } from "../utils/loadingGifs";
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
  getStoreProductRichDetail,
  likeStoreProduct,
  likeStoreProductComment,
  StoreProduct,
  StoreProductComment,
  StoreProductRichDetail,
  ProductCondition,
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
import TradingActionBar from "../components/TradingActionBar";
import OfferModal from "./Trading/OfferModal";
import {
  clampAspectRatio,
  useMediaAspectRatio,
} from "../utils/useMediaAspectRatio";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** 详情轮播高度跟首图比例；放宽 clamp，避免竖图被收成 3:4 导致 contain 左右留边。 */
const PRODUCT_HERO_RATIO_MIN = 0.38;
const PRODUCT_HERO_RATIO_MAX = 2.25;

const PAGE_PADDING = 16;
const SECTION_GAP = 8; // 8px 灰色分隔块（与 PostDetail 一致）

interface RouteParams {
  productId: number;
}

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

type RouteProps = RouteProp<Record<string, RouteParams>, string>;

const COMMENT_PAGE_SIZE = 20;
const DESCRIPTION_COLLAPSED_LINES = 2;

interface ReplyTarget {
  commentId: number;
  userId: number;
  userName: string;
}

const StoreProductDetailScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const profileLoadingGif = useProfileLoadingGif();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { productId } = route.params ?? ({} as RouteParams);
  const currentUser = useAuthStore((s) => s.user);

  // ---------------------- 商品主体 + 富数据 -------------------------------
  const [richDetail, setRichDetail] = useState<StoreProductRichDetail | null>(
    null
  );
  const product = richDetail?.product ?? null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------- 乐观态计数 --------------------------------------
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [favoritePending, setFavoritePending] = useState(false);

  const [isWanted, setIsWanted] = useState(false);
  const [wantCount, setWantCount] = useState(0);
  const [wantPending, setWantPending] = useState(false);
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

  // ---------------------- 描述展开 ----------------------------------------
  const [descExpanded, setDescExpanded] = useState(false);
  const [descNeedsToggle, setDescNeedsToggle] = useState(false);

  // ---------------------- Trading -----------------------------------------
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [tradingBusy, setTradingBusy] = useState(false);

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
      const detail = await getStoreProductRichDetail(productId);
      if (!mountedRef.current) return;
      setRichDetail(detail);
      const p = detail.product;
      setLikeCount(p.likeCount ?? 0);
      setIsLiked(!!p.likedByMe);
      setFavoriteCount(p.favoriteCount ?? 0);
      setIsFavorited(!!p.favoritedByMe);
      setWantCount(p.wantCount ?? 0);
      setIsWanted(!!p.wantedByMe);
    } catch (e) {
      console.error("[StoreProductDetail] load product failed:", e);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : t("store.loadFailed"));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [productId, t]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId]
  );

  useEffect(() => {
    loadProduct();
    loadComments("initial");
  }, [loadProduct, loadComments]);

  // 二次校验 like / favorite / want（冷缓存下 detail 可能漏带）
  useEffect(() => {
    if (!productId || !currentUser) return;
    checkStoreProductLiked(productId)
      .then((v) => mountedRef.current && setIsLiked(v))
      .catch(() => {});
    checkStoreProductFavorited(productId)
      .then((v) => mountedRef.current && setIsFavorited(v))
      .catch(() => {});
    checkStoreProductWanted(productId)
      .then((v) => mountedRef.current && setIsWanted(v))
      .catch(() => {});
  }, [productId, currentUser]);

  // 0.8s 自动 WantPopup（已加愿望单跳过）
  useEffect(() => {
    if (!product) return;
    if (isWanted) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setShowWantPopup(true);
    }, 800);
    return () => clearTimeout(timer);
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
      setIsLiked(!nextLiked);
      setLikeCount((n) => Math.max(0, n + (nextLiked ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setLikePending(false);
    }
  }, [isLiked, likePending, currentUser, productId, t]);

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
      setIsFavorited(!nextFavorited);
      setFavoriteCount((n) => Math.max(0, n + (nextFavorited ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setFavoritePending(false);
    }
  }, [isFavorited, favoritePending, currentUser, productId, t]);

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
      setIsWanted(!nextWanted);
      setWantCount((n) => Math.max(0, n + (nextWanted ? -1 : 1)));
      Alert.show(e instanceof Error ? e.message : t("store.operationFailed"));
    } finally {
      if (mountedRef.current) setWantPending(false);
    }
  }, [isWanted, wantPending, currentUser, productId, t]);

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
    if (!commentInput) setIsCommentFocused(false);
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
    t,
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
    [t]
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
    [t]
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
  const coverRatio = clampAspectRatio(
    useMediaAspectRatio(productImages[0], 4 / 5),
    PRODUCT_HERO_RATIO_MIN,
    PRODUCT_HERO_RATIO_MAX
  );
  const heroFrameStyle = useMemo(
    () => ({
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH / coverRatio,
    }),
    [coverRatio]
  );
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
            source={profileLoadingGif}
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
          <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }} mt="$sm">
            {t("store.loadFailed")}
          </Text>
          <Text fontSize="$xs" style={{ color: theme.colors.textSecondary }} mt="$xs" textAlign="center">
            {error ?? t("store.productNotFound")}
          </Text>
          <Pressable onPress={loadProduct} px="$lg" py="$sm" mt="$md" style={{ backgroundColor: theme.colors.text }} rounded="$md">
            <Text style={{ color: theme.colors.background }} fontWeight="$semibold" fontSize="$sm">
              {t("store.tapRetry")}
            </Text>
          </Pressable>
        </Box>
      </SafeAreaView>
    );
  }

  const seller = richDetail?.seller ?? null;
  const show = richDetail?.show ?? null;
  const relatedBrands = richDetail?.relatedBrands ?? [];
  const relatedProducts = richDetail?.relatedProducts ?? [];
  const reviews = richDetail?.reviews ?? { items: [], total: 0 };

  // photoAngles.extras 渲染为 4-up 细节展示
  const detailImages = (product.photoAngles?.extras ?? []).filter(Boolean);

  const quickInfoParts = buildQuickInfo(product, t);
  const detailRows = buildDetailRows(product, show, t);

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
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* ============ 1. 图片轮播 + N/M 计数 =============== */}
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
                    style={[heroFrameStyle, styles.heroSlide]}
                  >
                    <OptimizedImage
                      uri={item}
                      size={ImageSize.LARGE}
                      style={heroMediaStyle}
                      contentFit={index === 0 ? "contain" : "cover"}
                      placeholderColor={theme.colors.background}
                      errorColor={theme.colors.skeleton}
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
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {t("store.productDetailV2.imageCounter", {
                    current: mainImageIndex + 1,
                    total: productImages.length,
                  })}
                </Text>
              </View>
            )}
          </Box>

          {/* ============ 2. 标题 / 价格 / 快速信息行 =============== */}
          <VStack px={PAGE_PADDING} pt={PAGE_PADDING} space="sm" style={styles.section}>
            <HStack alignItems="flex-start" justifyContent="space-between" space="sm">
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={3}>
                  {product.title}
                </Text>
              </View>
              <Pressable
                onPress={handleToggleFavorite}
                hitSlop={8}
                style={styles.heartBtn}
                disabled={favoritePending}
              >
                <Ionicons
                  name={isFavorited ? "heart" : "heart-outline"}
                  size={26}
                  color={isFavorited ? "#FF3040" : theme.colors.text}
                />
              </Pressable>
            </HStack>

            <HStack alignItems="baseline" space="sm">
              <Text style={[styles.price, hasDiscount && { color: theme.colors.error }]}>
                {formatPrice(
                  hasDiscount
                    ? (product.discountPriceCents as number)
                    : product.priceCents,
                  product.currency
                )}
              </Text>
              {hasDiscount && (
                <Text style={styles.priceStrike}>
                  {formatPrice(product.priceCents, product.currency)}
                </Text>
              )}
            </HStack>

            {/* 快速信息行 —— 用细分隔符 "|" 串成一行，对齐设计图 image 4 顶部 */}
            {quickInfoParts.length > 0 && (
              <HStack alignItems="center" flexWrap="wrap">
                {quickInfoParts.map((part, idx) => (
                  <React.Fragment key={`qi-${idx}`}>
                    <Text style={styles.quickInfoText}>{part}</Text>
                    {idx < quickInfoParts.length - 1 && (
                      <Text style={styles.quickInfoSep}> | </Text>
                    )}
                  </React.Fragment>
                ))}
              </HStack>
            )}
          </VStack>

          {/* ============ 3. 服务徽章 =============== */}
          <View style={[styles.badgesRow, { paddingHorizontal: PAGE_PADDING }]}>
            <ServiceBadge
              icon="shield-checkmark-outline"
              label={t("store.productDetailV2.badgePlatformAuth")}
              theme={theme}
            />
            <ServiceBadge
              icon="sync-circle-outline"
              label={t("store.productDetailV2.badgeNoReturns")}
              theme={theme}
            />
            <ServiceBadge
              icon="cube-outline"
              label={t("store.productDetailV2.badgeFreeShipping")}
              theme={theme}
            />
          </View>

          {/* ============ 4. 卖家卡片 =============== */}
          {seller && (
            <View style={styles.sellerCard}>
              <OptimizedImage
                uri={seller.avatarUrl || undefined}
                size={ImageSize.THUMBNAIL}
                style={styles.sellerAvatar}
                contentFit="cover"
                placeholderColor={theme.colors.skeleton}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <HStack alignItems="center" space="xs">
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {seller.username}
                  </Text>
                  {seller.level > 0 && (
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelBadgeText}>
                        {t("store.productDetailV2.level", { level: seller.level })}
                      </Text>
                    </View>
                  )}
                </HStack>
                <Text style={styles.sellerMeta}>
                  {seller.positiveRate != null
                    ? t("store.productDetailV2.positiveRate", {
                        rate: Math.round(seller.positiveRate * 100),
                      })
                    : t("store.productDetailV2.noReviewsYet")}
                </Text>
              </View>
              <Pressable style={styles.followBtn} onPress={() => {}}>
                <Text style={styles.followBtnText}>
                  {t("store.productDetailV2.follow")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ============ 5. 关联的品牌 =============== */}
          {relatedBrands.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.relatedBrandsTitle")}
              </Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={relatedBrands}
                keyExtractor={(b) => `brand-${b.name}`}
                contentContainerStyle={styles.brandsRow}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.brandItem}
                    onPress={() =>
                      navigation.navigate("BrandDetail", { name: item.name })
                    }
                  >
                    <View style={styles.brandAvatarWrap}>
                      {item.imageUrl ? (
                        <OptimizedImage
                          uri={item.imageUrl}
                          size={ImageSize.THUMBNAIL}
                          style={styles.brandAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.brandAvatarLetter}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.brandCount}>{item.listingCount}</Text>
                  </Pressable>
                )}
                ListFooterComponent={
                  <Pressable
                    style={styles.brandItem}
                    onPress={() =>
                      navigation.navigate("Main", { screen: "Archive" })
                    }
                  >
                    <View style={[styles.brandAvatarWrap, styles.brandAvatarMore]}>
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={theme.colors.text}
                      />
                    </View>
                    <Text style={styles.brandName} numberOfLines={1}>
                      {t("store.productDetailV2.moreBrands")}
                    </Text>
                  </Pressable>
                }
              />
            </View>
          )}

          {/* ============ 6. 关联的秀场 =============== */}
          {show && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.relatedShowTitle")}
              </Text>
              <Pressable
                style={styles.showCard}
                onPress={() => {
                  // ShowDetail 路由暂未实现；保留 onPress 以便后续接入。
                }}
              >
                <OptimizedImage
                  uri={show.coverImage || undefined}
                  size={ImageSize.MEDIUM}
                  style={styles.showCover}
                  contentFit="cover"
                  placeholderColor={theme.colors.skeleton}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.showBrand} numberOfLines={1}>
                    {show.brandName ?? "—"}
                  </Text>
                  <Text style={styles.showSeason} numberOfLines={1}>
                    {show.year ? `${show.year} ` : ""}
                    {show.season ?? ""}
                  </Text>
                  {show.title && (
                    <Text style={styles.showLook} numberOfLines={1}>
                      {show.title}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>
          )}

          {/* ============ 7. 商品描述 =============== */}
          {!!product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.description")}
              </Text>
              <Text
                style={styles.descriptionText}
                numberOfLines={descExpanded ? undefined : DESCRIPTION_COLLAPSED_LINES}
                onTextLayout={(e) => {
                  if (
                    !descNeedsToggle &&
                    e.nativeEvent.lines.length > DESCRIPTION_COLLAPSED_LINES
                  ) {
                    setDescNeedsToggle(true);
                  }
                }}
              >
                {product.description}
              </Text>
              {descNeedsToggle && (
                <Pressable
                  onPress={() => setDescExpanded((v) => !v)}
                  style={{ alignSelf: "flex-end", marginTop: 4 }}
                >
                  <HStack alignItems="center" space="xs">
                    <Text style={styles.expandText}>
                      {descExpanded
                        ? t("store.productDetailV2.collapse")
                        : t("store.productDetailV2.expand")}
                    </Text>
                    <Ionicons
                      name={descExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                  </HStack>
                </Pressable>
              )}
            </View>
          )}

          {/* ============ 8. 商品详情表 =============== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("store.productDetailV2.detailsTable")}
            </Text>
            <View style={styles.detailsTable}>
              {detailRows.map((row, idx) => (
                <HStack key={`detail-${idx}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {row.value}
                  </Text>
                </HStack>
              ))}
            </View>
          </View>

          {/* ============ 9. 细节展示 =============== */}
          {detailImages.length > 0 && (
            <View style={styles.section}>
              <HStack
                alignItems="center"
                justifyContent="space-between"
                style={{ marginBottom: 12 }}
              >
                <Text style={styles.sectionTitle}>
                  {t("store.productDetailV2.detailImagesTitle")}
                </Text>
                {detailImages.length > 4 && (
                  <Text style={styles.sectionLink}>
                    {t("store.productDetailV2.detailImagesViewAll", {
                      count: detailImages.length,
                    })}
                  </Text>
                )}
              </HStack>
              <HStack space="xs">
                {detailImages.slice(0, 4).map((img, idx) => (
                  <Pressable
                    key={`detail-img-${idx}`}
                    style={styles.detailImg}
                    onPress={() =>
                      handleOpenFullscreen(
                        productImages.findIndex((p) => p === img) >= 0
                          ? productImages.findIndex((p) => p === img)
                          : 0
                      )
                    }
                  >
                    <OptimizedImage
                      uri={img}
                      size={ImageSize.SMALL}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </HStack>
            </View>
          )}

          {/* ============ 10. 卖家信息 stats =============== */}
          {seller && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.sellerInfo")}
              </Text>
              <View style={styles.sellerStatsCard}>
                <HStack alignItems="center">
                  <OptimizedImage
                    uri={seller.avatarUrl || undefined}
                    size={ImageSize.THUMBNAIL}
                    style={styles.sellerStatsAvatar}
                    contentFit="cover"
                    placeholderColor={theme.colors.skeleton}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <HStack alignItems="center" space="xs">
                      <Text style={styles.sellerName}>{seller.username}</Text>
                      {seller.level > 0 && (
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>
                            {t("store.productDetailV2.level", { level: seller.level })}
                          </Text>
                        </View>
                      )}
                    </HStack>
                    <Text style={styles.sellerMeta}>
                      {seller.positiveRate != null
                        ? t("store.productDetailV2.positiveRate", {
                            rate: Math.round(seller.positiveRate * 100),
                          })
                        : t("store.productDetailV2.noReviewsYet")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </HStack>

                <HStack style={styles.statsRow}>
                  <StatColumn
                    value={String(seller.listingCount)}
                    label={t("store.productDetailV2.statListing")}
                    theme={theme}
                  />
                  <StatColumn
                    value={String(seller.totalSales)}
                    label={t("store.productDetailV2.statSold")}
                    theme={theme}
                  />
                  <StatColumn
                    value={t("store.productDetailV2.joinedYears", {
                      years: yearsSince(seller.joinedAt),
                    })}
                    label={t("store.productDetailV2.statJoined")}
                    theme={theme}
                  />
                </HStack>
              </View>
            </View>
          )}

          {/* ============ 11. 评价预览（trade_reviews） =============== */}
          <View style={styles.section}>
            <HStack alignItems="center" justifyContent="space-between" style={{ marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.reviewsTitle")} ({reviews.total})
              </Text>
              {reviews.total > 0 && (
                <Pressable onPress={() => {}}>
                  <HStack alignItems="center" space="xs">
                    <Text style={styles.sectionLink}>
                      {t("store.productDetailV2.reviewsViewAll")}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                  </HStack>
                </Pressable>
              )}
            </HStack>
            {reviews.items.length === 0 ? (
              <Box style={styles.emptyBlock}>
                <Ionicons name="star-outline" size={28} color={theme.colors.gray300} />
                <Text style={styles.emptyText}>
                  {t("store.productDetailV2.noReviewsYet")}
                </Text>
              </Box>
            ) : (
              reviews.items.slice(0, 3).map((r) => (
                <ReviewRow key={`rv-${r.id}`} review={r} theme={theme} t={t} />
              ))
            )}
          </View>

          {/* ============ 12. 相关推荐 =============== */}
          {relatedProducts.length > 0 && (
            <View style={[styles.section, { paddingBottom: 24 }]}>
              <Text style={styles.sectionTitle}>
                {t("store.productDetailV2.relatedProductsTitle")}
              </Text>
              <HStack flexWrap="wrap" justifyContent="space-between">
                {relatedProducts.slice(0, 4).map((rp) => (
                  <RelatedProductCard
                    key={`rp-${rp.id}`}
                    product={rp}
                    onPress={() =>
                      navigation.navigate("StoreProductDetail", {
                        productId: rp.id,
                      })
                    }
                    theme={theme}
                  />
                ))}
              </HStack>
            </View>
          )}

          {/* 老的商品评论区放在最底（保留功能；评价区已用 trade_reviews）。 */}
          {comments.length > 0 && (
            <View style={[styles.section, { paddingBottom: 24 }]}>
              <Text style={styles.sectionTitle}>
                {t("store.comments", { count: commentsTotal })}
              </Text>
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
              {commentsHasMore && (
                <Pressable onPress={handleEndReached} py="$sm" alignItems="center">
                  <Text style={styles.expandText}>
                    {t("store.loadMoreComments")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {isCommentFocused && (
          <Pressable onPress={handleOverlayPress} style={styles.contentOverlay} />
        )}

        <WantPopup
          visible={showWantPopup}
          isWanted={isWanted}
          productImage={productImages[0]}
          productName={product.title}
          brandName={product.brand ?? undefined}
          onWant={handleToggleWant}
          onDismiss={() => setShowWantPopup(false)}
        />

        {product ? (
          <TradingActionBar
            product={product}
            isOwner={
              !!currentUser &&
              (currentUser.id === product.sellerUserId ||
                currentUser.id === (product as any).merchantOwnerUserId)
            }
            isBusy={tradingBusy}
            onOffer={() => setOfferModalVisible(true)}
            onBuyNow={() =>
              navigation.navigate("Checkout", {
                productId: product.id,
                title: product.title,
                priceCents: product.priceCents,
                coverImage: productImages[0],
              })
            }
            onEdit={() => navigation.navigate("PublishListingStep1")}
            onTakeOffline={async () => {
              try {
                setTradingBusy(true);
                const { transitionListing } = await import(
                  "../services/storeProductService"
                );
                await transitionListing(product.id, "offline");
                await loadProduct();
              } catch (e) {
                console.warn("[StoreProductDetail] take offline failed", e);
              } finally {
                setTradingBusy(false);
              }
            }}
          />
        ) : null}

        {product ? (
          <OfferModal
            visible={offerModalVisible}
            productId={product.id}
            listingPriceCents={product.priceCents}
            onClose={() => setOfferModalVisible(false)}
            onSuccess={() => {
              setOfferModalVisible(false);
              navigation.navigate("MyOffers");
            }}
          />
        ) : null}

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

const Header: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <HStack
      style={styles.header}
      alignItems="center"
      justifyContent="space-between"
      px="$md"
      py="$sm"
    >
      <Pressable onPress={onBack} p="$xs" hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </Pressable>
      <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
        {title}
      </Text>
      <Box w={32} />
    </HStack>
  );
};

// ============================================================================
// ServiceBadge
// ============================================================================

const ServiceBadge: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: AppTheme;
}> = ({ icon, label, theme }) => (
  <HStack alignItems="center" space="xs" style={{ flex: 1 }}>
    <Ionicons name={icon} size={16} color={theme.colors.textSecondary} />
    <Text
      style={{
        fontSize: 12,
        color: theme.colors.textSecondary,
        flexShrink: 1,
      }}
      numberOfLines={1}
    >
      {label}
    </Text>
  </HStack>
);

// ============================================================================
// StatColumn
// ============================================================================

const StatColumn: React.FC<{
  value: string;
  label: string;
  theme: AppTheme;
}> = ({ value, label, theme }) => (
  <View style={{ flex: 1, alignItems: "center" }}>
    <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>
      {value}
    </Text>
    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
      {label}
    </Text>
  </View>
);

// ============================================================================
// ReviewRow
// ============================================================================

const ReviewRow: React.FC<{
  review: NonNullable<StoreProductRichDetail["reviews"]["items"][number]>;
  theme: AppTheme;
  t: (k: string, opts?: any) => string;
}> = ({ review, theme, t }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <HStack space="sm" style={styles.reviewRow}>
      <OptimizedImage
        uri={review.reviewerAvatar || undefined}
        size={ImageSize.THUMBNAIL}
        style={styles.reviewAvatar}
        contentFit="cover"
        placeholderColor={theme.colors.skeleton}
      />
      <View style={{ flex: 1 }}>
        <HStack alignItems="center" space="xs">
          <Text style={styles.reviewerName} numberOfLines={1}>
            {review.reviewerUsername ?? t("store.anonymous")}
          </Text>
          {!!review.reviewerLevel && review.reviewerLevel > 0 && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>
                {t("store.productDetailV2.level", { level: review.reviewerLevel })}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", marginLeft: 4 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= review.rating ? "star" : "star-outline"}
                size={12}
                color={theme.colors.starRated}
              />
            ))}
          </View>
        </HStack>
        {!!review.comment && (
          <Text style={styles.reviewComment} numberOfLines={3}>
            {review.comment}
          </Text>
        )}
        {!!review.submittedAt && (
          <Text style={styles.reviewDate}>
            {review.submittedAt.slice(0, 10)}
          </Text>
        )}
      </View>
    </HStack>
  );
};

// ============================================================================
// RelatedProductCard
// ============================================================================

const RELATED_GAP = 8;
const RELATED_CARD_W = (SCREEN_WIDTH - PAGE_PADDING * 2 - RELATED_GAP * 3) / 4;

const RelatedProductCard: React.FC<{
  product: StoreProduct;
  onPress: () => void;
  theme: AppTheme;
}> = ({ product, onPress, theme }) => {
  const styles = useThemedStyles(makeStyles);
  const conditionLabel = product.condition ? conditionToLabelKey(product.condition) : null;
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[styles.relatedCard, { width: RELATED_CARD_W }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.relatedImageWrap, { backgroundColor: theme.colors.skeleton }]}>
        <OptimizedImage
          uri={product.images?.[0]}
          size={ImageSize.SMALL}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
        <View style={styles.relatedHeart}>
          <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
        </View>
      </View>
      <Text style={styles.relatedTitle} numberOfLines={1}>
        {product.brand || product.title}
      </Text>
      <Text style={styles.relatedSubtitle} numberOfLines={1}>
        {product.title}
      </Text>
      <Text style={styles.relatedPrice}>
        {formatPrice(product.priceCents, product.currency)}
      </Text>
      {conditionLabel && (
        <Text style={styles.relatedCondition}>
          {t(`store.productDetailV2.${conditionLabel}`)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

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
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const isMine = currentUserId != null && comment.userId === currentUserId;
  const timestamp = comment.createdAt
    ? formatTimestamp(comment.createdAt)
    : "";
  const avatarUri =
    comment.userAvatar ||
    "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=200";

  return (
    <HStack space="sm" style={{ marginBottom: 12 }}>
      <OptimizedImage
        uri={avatarUri}
        size={ImageSize.THUMBNAIL}
        style={styles.commentAvatar}
        contentFit="cover"
        lazy
      />
      <VStack flex={1} space="xs">
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space="xs" alignItems="center" flexWrap="wrap" flex={1}>
            <Text style={styles.commentName}>
              {comment.username || t("store.anonymous")}
            </Text>
            {comment.replyToUsername && (
              <HStack space="xs" alignItems="center">
                <Ionicons
                  name="arrow-forward"
                  size={10}
                  color={theme.colors.textSecondary}
                />
                <Text style={{ fontSize: 12, color: theme.colors.accent }}>
                  @{comment.replyToUsername}
                </Text>
              </HStack>
            )}
          </HStack>
          {!!timestamp && (
            <Text style={styles.commentDate}>{timestamp}</Text>
          )}
        </HStack>
        <Text style={styles.commentBody}>{comment.content}</Text>
        <HStack space="md" mt="$xs" alignItems="center">
          <Pressable onPress={onLike}>
            <HStack space="xs" alignItems="center">
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={16}
                color={comment.likedByMe ? "#FF3040" : theme.colors.textSecondary}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: comment.likedByMe ? "#FF3040" : theme.colors.textSecondary,
                }}
              >
                {comment.likeCount > 0 ? comment.likeCount : ""}
              </Text>
            </HStack>
          </Pressable>
          <Pressable onPress={onReply}>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
              {t("store.reply")}
            </Text>
          </Pressable>
          {isMine && (
            <Pressable onPress={onDelete}>
              <Text style={{ fontSize: 12, color: theme.colors.error }}>
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
// Helpers (pure)
// ============================================================================

function conditionToLabelKey(c: ProductCondition): string {
  switch (c) {
    case "BNWT":
      return "conditionBnwt";
    case "NEW_99":
      return "conditionNew99";
    case "NEW_95":
      return "conditionNew95";
    case "USED_8":
      return "conditionUsed8";
    case "FLAW":
      return "conditionFlaw";
    default:
      return "conditionNew95";
  }
}

function buildQuickInfo(
  product: StoreProduct,
  t: (k: string, opts?: any) => string
): string[] {
  const out: string[] = [];
  if (product.condition) {
    out.push(t(`store.productDetailV2.${conditionToLabelKey(product.condition)}`));
  }
  if (product.size) out.push(product.size);
  if (product.color) out.push(product.color);
  if (product.originalAcquiredAt) {
    out.push(product.originalAcquiredAt.slice(0, 4));
  }
  return out;
}

function buildDetailRows(
  product: StoreProduct,
  show: StoreProductRichDetail["show"] | null,
  t: (k: string, opts?: any) => string
): { label: string; value: string }[] {
  const dash = t("store.productDetailV2.fieldNoData");
  return [
    { label: t("store.productDetailV2.fieldBrand"), value: product.brand || dash },
    {
      label: t("store.productDetailV2.fieldStyle"),
      value: product.title || dash,
    },
    { label: t("store.productDetailV2.fieldSize"), value: product.size || dash },
    { label: t("store.productDetailV2.fieldColor"), value: product.color || dash },
    {
      label: t("store.productDetailV2.fieldCondition"),
      value: product.condition
        ? t(`store.productDetailV2.${conditionToLabelKey(product.condition)}`)
        : dash,
    },
    {
      label: t("store.productDetailV2.fieldChannel"),
      value: show?.brandName || dash,
    },
    {
      label: t("store.productDetailV2.fieldAcquiredAt"),
      value: product.originalAcquiredAt || dash,
    },
    {
      label: t("store.productDetailV2.fieldAccessories"),
      value: product.conditionNote || dash,
    },
  ];
}

function yearsSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const years = diff / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months}m`;
  }
  return years.toFixed(1);
}

// ============================================================================
// Styles
// ============================================================================

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      backgroundColor: t.colors.background,
      borderBottomColor: t.colors.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
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
      backgroundColor: t.colors.background,
    },
    heroSlide: {
      backgroundColor: t.colors.background,
    },
    heroPlaceholder: {
      backgroundColor: t.colors.skeleton,
      justifyContent: "center",
      alignItems: "center",
    },
    imageCounter: {
      position: "absolute",
      bottom: 16,
      left: 16,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    imageCounterText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "500",
    },

    section: {
      paddingHorizontal: PAGE_PADDING,
      paddingTop: 16,
      paddingBottom: 16,
      backgroundColor: t.colors.background,
      borderBottomWidth: SECTION_GAP,
      borderBottomColor: t.colors.surface,
    },

    title: {
      fontSize: 18,
      fontWeight: "600",
      color: t.colors.text,
      lineHeight: 24,
    },
    heartBtn: {
      padding: 4,
    },
    price: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.text,
    },
    priceStrike: {
      fontSize: 13,
      color: t.colors.textSecondary,
      textDecorationLine: "line-through",
    },
    quickInfoText: {
      fontSize: 12,
      color: t.colors.textSecondary,
    },
    quickInfoSep: {
      fontSize: 12,
      color: t.colors.divider,
    },

    badgesRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: t.colors.background,
      borderBottomWidth: SECTION_GAP,
      borderBottomColor: t.colors.surface,
    },

    sellerCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: 14,
      backgroundColor: t.colors.cardElevated,
      borderBottomWidth: SECTION_GAP,
      borderBottomColor: t.colors.surface,
    },
    sellerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.skeleton,
    },
    sellerName: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
    },
    sellerMeta: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    levelBadge: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    levelBadgeText: {
      color: t.colors.background,
      fontSize: 10,
      fontWeight: "700",
    },
    followBtn: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    followBtnText: {
      color: t.colors.background,
      fontSize: 12,
      fontWeight: "600",
    },

    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    sectionLink: {
      fontSize: 12,
      color: t.colors.textSecondary,
    },

    brandsRow: {
      paddingRight: 8,
    },
    brandItem: {
      width: 64,
      alignItems: "center",
      marginRight: 16,
    },
    brandAvatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    brandAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    brandAvatarLetter: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 20,
      color: t.colors.text,
    },
    brandAvatarMore: {
      borderWidth: 1,
      borderColor: t.colors.divider,
      backgroundColor: t.colors.background,
    },
    brandName: {
      fontSize: 11,
      color: t.colors.text,
      textAlign: "center",
      width: "100%",
    },
    brandCount: {
      fontSize: 10,
      color: t.colors.textSecondary,
      marginTop: 2,
    },

    showCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 8,
    },
    showCover: {
      width: 72,
      height: 72,
      borderRadius: 6,
      backgroundColor: t.colors.skeleton,
    },
    showBrand: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
    },
    showSeason: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    showLook: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },

    descriptionText: {
      fontSize: 14,
      lineHeight: 22,
      color: t.colors.text,
    },
    expandText: {
      fontSize: 12,
      color: t.colors.textSecondary,
    },

    detailsTable: {
      gap: 0,
    },
    detailRow: {
      paddingVertical: 8,
    },
    detailLabel: {
      width: 96,
      fontSize: 13,
      color: t.colors.textSecondary,
    },
    detailValue: {
      flex: 1,
      fontSize: 13,
      color: t.colors.text,
    },

    detailImg: {
      width: (SCREEN_WIDTH - PAGE_PADDING * 2 - 12) / 4,
      aspectRatio: 1,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },

    sellerStatsCard: {
      padding: 14,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 10,
    },
    sellerStatsAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.skeleton,
    },
    statsRow: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
    },

    reviewRow: {
      marginBottom: 14,
    },
    reviewAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.skeleton,
    },
    reviewerName: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
    },
    reviewComment: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.text,
      marginTop: 4,
    },
    reviewDate: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 4,
    },

    relatedCard: {
      marginBottom: 12,
    },
    relatedImageWrap: {
      width: "100%",
      aspectRatio: 0.78,
      borderRadius: 6,
      overflow: "hidden",
    },
    relatedHeart: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderRadius: 12,
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    relatedTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 6,
    },
    relatedSubtitle: {
      fontSize: 10,
      color: t.colors.textSecondary,
      marginTop: 1,
    },
    relatedPrice: {
      fontSize: 11,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 2,
    },
    relatedCondition: {
      fontSize: 10,
      color: t.colors.textSecondary,
      marginTop: 1,
    },

    emptyBlock: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 6,
    },

    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.skeleton,
    },
    commentName: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
    },
    commentDate: {
      fontSize: 11,
      color: t.colors.textSecondary,
    },
    commentBody: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.text,
    },

    contentOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
      zIndex: 10,
    },
  });

export default StoreProductDetailScreen;
