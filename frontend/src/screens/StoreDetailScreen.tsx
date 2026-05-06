/**
 * 买手店详情页面
 * 包含评论、评分、收藏功能
 * 遵循 iOS Human Interface Guidelines 设计规范
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  Alert,
  Linking,
  Platform,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Image as RNImage,
  FlatList,
  RefreshControl,
  ScrollView,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { useAuthStore } from "../store/authStore";
import { useStoreFavoritesStore } from "../store/storeFavoritesStore";
import {
  BuyerStoreDetail,
  StoreComment,
  StoreRatingStats,
  getStoreDetail,
  getStoreComments,
  createStoreComment,
  deleteStoreComment,
  likeStoreComment,
  unlikeStoreComment,
  rateStore,
  favoriteStore,
  unfavoriteStore,
  getCommentSuggestions,
  getCommentReplies,
  StoreCommentReply,
} from "../services/buyerStoreService";
import {
  StoreMerchantContent,
  StoreBanner,
  StoreAnnouncement,
  StoreActivity,
  StoreDiscount,
  StoreMerchant,
  getStoreMerchantContent,
  recordBannerClick,
  applyMerchant,
  getMerchantByStore,
} from "../services/storeMerchantService";
import {
  StoreProduct,
  getStoreProducts,
  formatPrice,
} from "../services/storeProductService";
import HalfStarRating from "../components/HalfStarRating";
import { formatTimestamp } from "../components/PostDetail/types";
import { ShareToChatModal } from "../components/ShareToChatModal";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

type RouteParams = {
  StoreDetail: {
    storeId: string;
  };
};

type StoreDetailNavigation = {
  goBack: () => void;
  navigate: (screen: string, params?: any) => void;
};

// 产品 preview 一次性加载多少条；超过后用户点 "View All" 进入完整列表屏。
// 12 条 = 横向滚动列表上 4-5 屏宽，足够预览且不至于多请求一页数据。
const PRODUCT_PREVIEW_LIMIT = 12;

// 评论提示建议 - loaded from i18n in component

const StoreDetailScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<StoreDetailNavigation>();
  const route = useRoute<RouteProp<RouteParams, "StoreDetail">>();
  const { storeId } = route.params;
  const { user } = useAuthStore();
  const syncFromDetail = useStoreFavoritesStore((s) => s.syncFromDetail);

  // 店铺详情状态
  const [store, setStore] = useState<BuyerStoreDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 评论状态
  const [comments, setComments] = useState<StoreComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // 评论输入状态
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    commentId: number;
    username: string;
  } | null>(null);
  const defaultSuggestions = [
    t("store.suggestion1"),
    t("store.suggestion2"),
    t("store.suggestion3"),
    t("store.suggestion4"),
    t("store.suggestion5"),
  ];
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);
  const commentInputAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  // 评分弹窗状态
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const ratingModalAnim = useRef(new Animated.Value(0)).current;

  // 商家内容状态
  const [merchantContent, setMerchantContent] = useState<StoreMerchantContent | null>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);

  // 单品 preview 状态。详情页只展示一行横向滚动的 preview，
  // 完整网格 / 搜索 / 分类筛选都在 StoreProductListScreen 里处理。
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);

  // 分享状态
  const [showShareToChat, setShowShareToChat] = useState(false);

  // 商家申请弹窗状态
  const [showMerchantApplyModal, setShowMerchantApplyModal] = useState(false);
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);
  const [existingMerchant, setExistingMerchant] = useState<StoreMerchant | null>(null);
  const merchantApplyAnim = useRef(new Animated.Value(0)).current;
  const [applyFormData, setApplyFormData] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    businessLicense: "",
  });

  // 加载店铺详情
  const loadStoreDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      const detail = await getStoreDetail(storeId, user?.id ? Number(user.id) : undefined);
      setStore(detail);
      syncFromDetail(storeId, detail.isFavorited, detail.favoriteCount);
      if (detail.userRating) {
        setSelectedRating(detail.userRating);
      }
    } catch (error: any) {
      console.error("Store detail load error:", error);
      if (error.message?.includes("404") || error.message?.includes("不存在")) {
        Alert.alert(
          t("store.storeNotExist"),
          t("store.storeNotExistDesc"),
          [
            {
              text: t("store.alertBack"),
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(t("store.alertLoadFailed"), error.message || t("store.alertRetryLater"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeId, user?.id, navigation]);

  // 加载评论
  const loadComments = useCallback(async (page: number = 1) => {
    try {
      setIsLoadingComments(true);
      const result = await getStoreComments(storeId, page, 20);
      if (page === 1) {
        setComments(result.comments);
      } else {
        setComments((prev) => [...prev, ...result.comments]);
      }
      setCommentsTotal(result.total);
      setCommentsPage(page);
    } catch (error) {
      console.error("Load comments error:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [storeId]);

  // 加载评论建议
  const loadSuggestions = useCallback(async () => {
    try {
      const result = await getCommentSuggestions();
      if (result.length > 0) {
        setSuggestions(result);
      }
    } catch (error) {
      // 使用默认建议
    }
  }, []);

  // 加载商家内容
  const loadMerchantContent = useCallback(async () => {
    try {
      const content = await getStoreMerchantContent(storeId);
      setMerchantContent(content);
    } catch (error) {
      console.error("Load merchant content error:", error);
    }
  }, [storeId]);

  // 加载单品 preview。这条接口只在该店有商家入驻并上架了商品时返回非空数组；
  // 失败 / 空数据时静默 —— 详情页不应当因为一个 optional 区域报错而破相。
  const loadProducts = useCallback(async () => {
    try {
      const result = await getStoreProducts({
        storeId,
        page: 1,
        pageSize: PRODUCT_PREVIEW_LIMIT,
      });
      setProducts(result.products || []);
      setProductsTotal(result.total || 0);
    } catch (error) {
      if (__DEV__) {
        console.warn("[StoreDetail] loadProducts failed:", error);
      }
    }
  }, [storeId]);

  useEffect(() => {
    loadStoreDetail();
    loadComments();
    loadSuggestions();
    loadMerchantContent();
    loadProducts();
  }, [loadStoreDetail, loadComments, loadSuggestions, loadMerchantContent, loadProducts]);

  // Banner 自动轮播
  useEffect(() => {
    if (!merchantContent?.banners || merchantContent.banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => {
        const next = (prev + 1) % merchantContent.banners.length;
        bannerScrollRef.current?.scrollTo({
          x: next * 300, // 假设每个 banner 宽度
          animated: true,
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [merchantContent?.banners]);

  // 下拉刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadStoreDetail(),
      loadComments(1),
      loadMerchantContent(),
      loadProducts(),
    ]);
    setIsRefreshing(false);
  };

  // Banner 点击处理。打埋点是 fire-and-forget：埋点失败不应当阻塞用户跳转，
  // 也不应当用 ERROR 级别污染日志（迁移 043_add_increment_banner_click.sql
  // 还没在所有环境跑过时，调用会拿到 PostgREST 的 schema cache miss）。
  const handleBannerClick = async (banner: StoreBanner) => {
    recordBannerClick(banner.id).catch((error) => {
      if (__DEV__) {
        console.warn("[StoreDetail] recordBannerClick failed:", error);
      }
    });
    if (banner.linkUrl) {
      Linking.openURL(banner.linkUrl);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return t("store.dateFormat", { month: date.getMonth() + 1, day: date.getDate() });
  };

  // 检查折扣是否有效
  const isDiscountActive = (discount: StoreDiscount) => {
    const now = new Date();
    const start = new Date(discount.discountStartTime);
    const end = new Date(discount.discountEndTime);
    return now >= start && now <= end;
  };

  // 检查当前用户是否已申请商家
  const checkMerchantStatus = useCallback(async () => {
    if (!user) return;
    try {
      const merchant = await getMerchantByStore(storeId);
      setExistingMerchant(merchant);
    } catch (error) {
      console.error("Check merchant status error:", error);
    }
  }, [storeId, user]);

  useEffect(() => {
    checkMerchantStatus();
  }, [checkMerchantStatus]);

  // 打开商家申请弹窗
  const openMerchantApplyModal = () => {
    if (!user) {
      Alert.alert(t("store.alertHint"), t("store.alertLoginFirst"));
      return;
    }
    if (merchantContent?.isMerchant) {
      Alert.alert(t("store.alertHint"), t("store.alertAlreadyHasMerchant"));
      return;
    }
    setShowMerchantApplyModal(true);
    Animated.timing(merchantApplyAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // 关闭商家申请弹窗
  const closeMerchantApplyModal = () => {
    Animated.timing(merchantApplyAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowMerchantApplyModal(false);
      setApplyFormData({
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        businessLicense: "",
      });
    });
  };

  // 选择营业执照图片
  const pickBusinessLicense = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert(t("store.alertNoPermission"), t("store.alertNeedPhotoPermission")); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setApplyFormData({
        ...applyFormData,
        businessLicense: result.assets[0].uri,
      });
    }
  };

  // 提交商家申请
  const handleSubmitMerchantApply = async () => {
    if (!user) return;

    if (!applyFormData.contactName.trim()) {
      Alert.alert(t("store.alertHint"), t("store.alertFillContactName"));
      return;
    }
    if (!applyFormData.contactPhone.trim()) {
      Alert.alert(t("store.alertHint"), t("store.alertFillContactPhone"));
      return;
    }

    try {
      setIsSubmittingApply(true);
      await applyMerchant({
        storeId,
        contactName: applyFormData.contactName,
        contactPhone: applyFormData.contactPhone,
        contactEmail: applyFormData.contactEmail || undefined,
        businessLicense: applyFormData.businessLicense || undefined,
      });
      closeMerchantApplyModal();
      Alert.alert(t("store.alertApplySuccess"), t("store.alertApplySuccessMsg"));
      checkMerchantStatus();
    } catch (error: any) {
      Alert.alert(t("store.alertApplyFailed"), error.message || t("store.alertRetryLater"));
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // 收藏/取消收藏
  const handleToggleFavorite = async () => {
    if (!user) {
      Alert.alert(t("store.alertHint"), t("store.alertLoginFirst"));
      return;
    }
    if (!store) return;

    try {
      if (store.isFavorited) {
        await unfavoriteStore(storeId, Number(user.id));
        const newCount = store.favoriteCount - 1;
        setStore((prev) =>
          prev
            ? { ...prev, isFavorited: false, favoriteCount: newCount }
            : null
        );
        syncFromDetail(storeId, false, newCount);
      } else {
        await favoriteStore(storeId, Number(user.id));
        const newCount = store.favoriteCount + 1;
        setStore((prev) =>
          prev
            ? { ...prev, isFavorited: true, favoriteCount: newCount }
            : null
        );
        syncFromDetail(storeId, true, newCount);
      }
    } catch (error: any) {
      Alert.alert(t("store.alertOperationFailed"), error.message || t("store.alertRetryLater"));
    }
  };

  // 打开评分弹窗
  const openRatingModal = () => {
    if (!user) {
      Alert.alert(t("store.alertHint"), t("store.alertLoginFirst"));
      return;
    }
    setShowRatingModal(true);
    Animated.timing(ratingModalAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // 关闭评分弹窗
  const closeRatingModal = () => {
    Animated.timing(ratingModalAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowRatingModal(false));
  };

  // 提交评分
  const handleSubmitRating = async () => {
    if (!user || !selectedRating) return;

    try {
      setIsSubmittingRating(true);
      await rateStore(storeId, Number(user.id), selectedRating);
      // 刷新店铺详情获取新的平均评分
      await loadStoreDetail();
      closeRatingModal();
      Alert.alert(t("store.alertRatingSuccess"), t("store.alertRatingSuccessMsg"));
    } catch (error: any) {
      Alert.alert(t("store.alertRatingFailed"), error.message || t("store.alertRetryLater"));
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // 打开评论输入
  const openCommentInput = (replyToComment?: { id: number; username: string }) => {
    if (!user) {
      Alert.alert(t("store.alertHint"), t("store.alertLoginFirst"));
      return;
    }
    if (replyToComment) {
      setReplyTo({ commentId: replyToComment.id, username: replyToComment.username });
    } else {
      setReplyTo(null);
    }
    setShowCommentInput(true);
    Animated.timing(commentInputAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      inputRef.current?.focus();
    });
  };

  // 关闭评论输入
  const closeCommentInput = () => {
    Keyboard.dismiss();
    Animated.timing(commentInputAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCommentInput(false);
      setCommentText("");
      setReplyTo(null);
    });
  };

  // 提交评论
  const handleSubmitComment = async () => {
    if (!user || !commentText.trim()) return;

    try {
      setIsSubmittingComment(true);
      await createStoreComment(storeId, {
        userId: Number(user.id),
        content: commentText.trim(),
        parentId: replyTo?.commentId,
        replyToUserId: replyTo ? Number(user.id) : undefined,
      });
      closeCommentInput();
      // 刷新评论列表
      await loadComments(1);
      // 更新评论数
      setStore((prev) =>
        prev ? { ...prev, commentCount: prev.commentCount + 1 } : null
      );
    } catch (error: any) {
      Alert.alert(t("store.alertCommentFailed"), error.message || t("store.alertRetryLater"));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 使用建议填充评论
  const useSuggestion = (suggestion: string) => {
    setCommentText(suggestion);
  };

  // 删除评论
  const handleDeleteComment = (commentId: number) => {
    if (!user) return;

    Alert.alert(t("store.alertDeleteComment"), t("store.alertDeleteCommentConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStoreComment(commentId, Number(user.id));
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setStore((prev) =>
              prev ? { ...prev, commentCount: prev.commentCount - 1 } : null
            );
          } catch (error: any) {
            Alert.alert(t("store.alertDeleteFailed"), error.message || t("store.alertRetryLater"));
          }
        },
      },
    ]);
  };

  // 点赞评论
  const handleLikeComment = async (commentId: number) => {
    if (!user) return;
    const uid = Number(user.id);
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;

    const wasLiked = !!target.likedByMe;

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likedByMe: !wasLiked, likeCount: wasLiked ? Math.max(0, c.likeCount - 1) : c.likeCount + 1 }
          : c
      )
    );

    try {
      if (wasLiked) {
        await unlikeStoreComment(commentId, uid);
      } else {
        await likeStoreComment(commentId, uid);
      }
    } catch {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likedByMe: wasLiked, likeCount: wasLiked ? c.likeCount + 1 : Math.max(0, c.likeCount - 1) }
            : c
        )
      );
    }
  };

  // 打电话
  const handleCall = (phone: string) => {
    const phoneNumber = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // 导航
  const handleNavigate = () => {
    if (!store) return;
    const encodedAddress = encodeURIComponent(store.address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  // 跳转到单品详情
  const handleOpenProduct = (productId: number) => {
    navigation.navigate("StoreProductDetail", { productId });
  };

  // 跳转到全部单品列表（mode=ALL，不带分类筛选）
  const handleOpenAllProducts = () => {
    if (!store) return;
    navigation.navigate("StoreProductList", {
      storeId,
      storeName: store.name,
      mode: "ALL",
    });
  };

  // 渲染评论项
  const renderCommentItem = ({ item }: { item: StoreComment }) => (
    <VStack mt="$md" mx="$md" pb="$md" borderBottomWidth={StyleSheet.hairlineWidth} borderBottomColor="$gray100">
      <HStack space="sm" alignItems="flex-start">
        {/* 头像 */}
        <Box style={styles.commentAvatar}>
          {item.userAvatar ? (
            <OptimizedImage
              uri={item.userAvatar}
              size={ImageSize.THUMBNAIL}
              style={styles.commentAvatarImage}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <Ionicons name="person" size={16} color={theme.colors.gray300} />
          )}
        </Box>

        {/* 内容区 */}
        <VStack flex={1} space="xs">
          {/* 用户名 + 时间 */}
          <HStack justifyContent="between" alignItems="center">
            <Text fontSize={13} fontWeight="$semibold" color="$black" style={styles.textBold}>
              {item.username}
            </Text>
            <Text fontSize={11} color="$gray400" style={styles.textRegular}>
              {formatTimestamp(item.createdAt)}
            </Text>
          </HStack>

          {/* 评论正文 */}
          <Text fontSize={13} color="$gray800" lineHeight={20} style={styles.textRegular}>
            {item.content}
          </Text>

          {/* 操作行 */}
          <HStack mt={6} gap={16} alignItems="center">
            <Pressable
              onPress={() => openCommentInput({ id: item.id, username: item.username })}
              style={styles.commentAction}
            >
              <Ionicons name="chatbubble-outline" size={13} color={theme.colors.gray400} />
              <Text fontSize={12} color="$gray400" ml={4} style={styles.textRegular}>
                {t("store.reply")}
                {item.replyCount > 0 ? ` · ${item.replyCount}` : ""}
              </Text>
            </Pressable>

            <Pressable onPress={() => handleLikeComment(item.id)} style={styles.commentAction}>
              <Ionicons
                name={item.likedByMe ? "heart" : "heart-outline"}
                size={13}
                color={item.likedByMe ? "#FF3040" : theme.colors.gray400}
              />
              {item.likeCount > 0 && (
                <Text fontSize={12} color={item.likedByMe ? "#FF3040" : "$gray400"} ml={4} style={styles.textRegular}>
                  {item.likeCount}
                </Text>
              )}
            </Pressable>

            {user && item.userId === Number(user.id) && (
              <Pressable onPress={() => handleDeleteComment(item.id)}>
                <Text fontSize={12} color="$error" style={styles.textRegular}>
                  {t("common.delete")}
                </Text>
              </Pressable>
            )}
          </HStack>
        </VStack>
      </HStack>

      {/* 回复列表 */}
      {item.replies.length > 0 && (
        <VStack ml={44} mt={8} gap={8}>
          {item.replies.map((reply) => (
            <VStack key={reply.id}>
              <HStack alignItems="center" gap={4} mb={2}>
                <Text fontSize={12} fontWeight="$semibold" color="$black" style={styles.textBold}>
                  {reply.username}
                </Text>
                {reply.replyToUsername && (
                  <>
                    <Ionicons name="arrow-forward" size={10} color={theme.colors.gray300} />
                    <Text fontSize={12} color="$gray400" style={styles.textRegular}>
                      {reply.replyToUsername}
                    </Text>
                  </>
                )}
              </HStack>
              <Text fontSize={13} color="$gray700" lineHeight={19} style={styles.textRegular}>
                {reply.content}
              </Text>
            </VStack>
          ))}
          {item.replyCount > item.replies.length && (
            <Pressable>
              <Text fontSize={12} color="$gray400" style={styles.textRegular}>
                {t("store.viewAllReplies", { count: item.replyCount })}
              </Text>
            </Pressable>
          )}
        </VStack>
      )}
    </VStack>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("store.storeDetail")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <RNImage
            source={require("../../assets/gif/profile-loading.gif")}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
            resizeMode="contain"
          />
        </VStack>
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("store.storeDetail")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Ionicons name="storefront-outline" size={64} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("store.storeNotExist")}
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={store.name}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightActions={[
          {
            icon: "share-outline",
            onPress: () => setShowShareToChat(true),
            style: "ghost",
          },
        ]}
      />

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCommentItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.black}
          />
        }
        ListHeaderComponent={
          <VStack>
            {/* ── 店铺名称 / 状态 / 关注 ── */}
            <VStack px="$md" pt="$md" pb="$sm">
              {/* 名称行 */}
              <HStack justifyContent="between" alignItems="flex-start">
                <Text fontSize={20} fontWeight="$bold" color="$black" flex={1} mr="$md" style={[styles.textBold, styles.textHero]}>
                  {store.name}
                </Text>
                <HStack alignItems="center" gap={10}>
                  <Pressable onPress={handleToggleFavorite} style={styles.followBtn}>
                    <Text fontSize={12} color={"$black"} style={[styles.textRegular]}>
                      {store.isFavorited ? t("store.followed") : t("store.follow")}
                    </Text>
                  </Pressable>
                </HStack>
              </HStack>

              {/* 城市 */}
              <Text fontSize={13} color="$gray400" mt={4} style={styles.textRegular}>
                {store.city}, {store.country}
              </Text>

              {/* 贡献者 */}
              {store.contributorName && (
                <HStack alignItems="center" mt={10} gap={5} bg="#F5F0FF" px={10} py={6} rounded="$xs" alignSelf="flex-start">
                  <Ionicons name="person-outline" size={12} color={theme.colors.gray500} />
                  <Text fontSize={11} color="$gray400" style={styles.textRegular}>
                    {t("store.contributedBy", { name: store.contributorName })}
                  </Text>
                </HStack>
              )}
            </VStack>

            {/* ── 统计行 ── */}
            <HStack
              borderTopWidth={StyleSheet.hairlineWidth}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderColor="$gray100"
              py={14}
              mx="$md"
              my="$sm"
              justifyContent="space-around"
            >
              <Pressable alignItems="center" onPress={openRatingModal}>
                <HStack alignItems="center" gap={4}>
                  <HalfStarRating
                    rating={store.averageRating || 0}
                    size={13}
                    color="#FFB800"
                    inactiveColor={theme.colors.gray200}
                  />
                  <Text fontSize={13} color="$black" fontWeight="$semibold" style={styles.textBold}>
                    {store.averageRating?.toFixed(1) || "0.0"}
                  </Text>
                </HStack>
                <Text fontSize={11} color="$gray400" mt={3} style={styles.textRegular}>
                  {t("store.ratingCount", { count: store.ratingCount })}
                </Text>
              </Pressable>

              <Box w={StyleSheet.hairlineWidth} bg="$gray200" />

              <Pressable alignItems="center" onPress={() => openCommentInput()}>
                <Ionicons name="chatbubble-outline" size={18} color={theme.colors.black} />
                <Text fontSize={11} color="$gray400" mt={3} style={styles.textRegular}>
                  {t("store.commentCount", { count: store.commentCount })}
                </Text>
              </Pressable>

              <Box w={StyleSheet.hairlineWidth} bg="$gray200" />

              <Pressable alignItems="center" onPress={handleToggleFavorite}>
                <Ionicons name="people-outline" size={18} color={theme.colors.black} />
                <Text fontSize={11} color="$gray400" mt={3} style={styles.textRegular}>
                  {t("store.followCount", { count: store.favoriteCount })}
                </Text>
              </Pressable>
            </HStack>

            {/* ── 信息行：地址 / 时间 / 电话 ── */}
            <VStack mx="$md" borderTopWidth={StyleSheet.hairlineWidth} borderColor="$gray100">
              {/* 地址 */}
              <Pressable onPress={handleNavigate} style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={theme.colors.gray400} />
                <Text fontSize={14} color="$black" flex={1} ml={10} style={styles.textRegular}>
                  {store.address}
                </Text>
                <Ionicons name="navigate-outline" size={15} color={theme.colors.gray300} />
              </Pressable>

              {/* 营业时间 */}
              {!!store.hours && (
                <Box style={styles.infoRow} flexDirection="row" alignItems="center">
                  <Ionicons name="time-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize={14} color="$black" flex={1} ml={10} style={styles.textRegular}>
                    {store.hours}
                  </Text>
                </Box>
              )}

              {/* 电话 */}
              {store.phone && store.phone.length > 0 && store.phone.map((phone, idx) => (
                <Pressable key={idx} style={styles.infoRow} onPress={() => handleCall(phone)}>
                  <Ionicons name="call-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize={14} color="$black" flex={1} ml={10} style={styles.textRegular}>
                    {phone}
                  </Text>
                  <Text fontSize={12} color="#27AE60" style={styles.textRegular}>
                    {t("store.call")}
                  </Text>
                </Pressable>
              ))}
            </VStack>

            {/* ── 风格标签 ── */}
            {store.style.length > 0 && (
              <VStack px="$md" mt="$md">
                <Text fontSize={11} color="$gray400" mb={8} letterSpacing={0.5} style={styles.textRegular}>
                  {t("store.storeStyle").toUpperCase()}
                </Text>
                <HStack flexWrap="wrap" gap={6}>
                  {store.style.map((s, idx) => (
                    <Box key={idx} style={styles.styleChip}>
                      <Text fontSize={12} color="$black" style={styles.textRegular}>{s}</Text>
                    </Box>
                  ))}
                </HStack>
              </VStack>
            )}

            {/* ── 品牌 ── */}
            {store.brands.length > 0 && (
              <VStack px="$md" mt="$md">
                <Text fontSize={11} color="$gray400" mb={8} letterSpacing={0.5} style={styles.textRegular}>
                  {t("store.mainBrands").toUpperCase()}
                </Text>
                <HStack flexWrap="wrap" gap={6}>
                  {store.brands.map((brand, idx) => (
                    <Box key={idx} style={styles.brandChip}>
                      <Text fontSize={12} color="$gray600" style={styles.textRegular}>{brand}</Text>
                    </Box>
                  ))}
                </HStack>
              </VStack>
            )}

            {/* ── 店铺介绍 ── */}
            {!!store.description && (
              <VStack px="$md" mt="$md">
                <Text fontSize={11} color="$gray400" mb={8} letterSpacing={0.5} style={styles.textRegular}>
                  {t("store.storeIntro").toUpperCase()}
                </Text>
                <Text fontSize={14} color="$black" lineHeight={22} style={styles.textRegular}>
                  {store.description}
                </Text>
              </VStack>
            )}

            {/* ── 店铺图片 ── */}
            {(store.images?.length ?? 0) > 0 && (
              <VStack mt="$md">
                <Text fontSize={11} color="$gray400" mb={8} px="$md" letterSpacing={0.5} style={styles.textRegular}>
                  {t("store.storeImages").toUpperCase()}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {store.images!.map((uri, idx) => (
                    <OptimizedImage
                      key={idx}
                      uri={uri}
                      size={ImageSize.MEDIUM}
                      style={styles.storeImage}
                      contentFit="cover"
                      lazy={true}
                    />
                  ))}
                </ScrollView>
              </VStack>
            )}

            {/* ── 商家入驻 ── */}
            {!merchantContent?.isMerchant && (
              <Pressable style={styles.merchantRow} onPress={openMerchantApplyModal}>
                <Ionicons name="storefront-outline" size={15} color={theme.colors.gray400} />
                <Text fontSize={13} color="$gray400" flex={1} ml={8} style={styles.textRegular}>
                  {t("store.iAmMerchant")}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={theme.colors.gray300} />
              </Pressable>
            )}

            {/* ==================== 商家内容区域 ==================== */}
            {merchantContent?.isMerchant && (
              <>
                {/* Banner 轮播 */}
                {merchantContent.banners.length > 0 && (
                  <Box mb="$md" mx="$md" mt="$sm">
                    <ScrollView
                      ref={bannerScrollRef}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(e) => {
                        const index = Math.round(e.nativeEvent.contentOffset.x / (e.nativeEvent.layoutMeasurement.width));
                        setCurrentBannerIndex(index);
                      }}
                    >
                      {merchantContent.banners.map((banner, index) => (
                        <Pressable
                          key={banner.id}
                          onPress={() => handleBannerClick(banner)}
                          style={styles.bannerItem}
                        >
                          <OptimizedImage
                            uri={banner.imageUrl}
                            size={ImageSize.LARGE}
                            style={styles.bannerImage}
                            contentFit="cover"
                            lazy={true}
                          />
                          {banner.title && (
                            <Box
                              position="absolute"
                              bottom={0}
                              left={0}
                              right={0}
                              bg="rgba(0,0,0,0.5)"
                              p="$sm"
                            >
                              <Text fontSize="$sm" color="$white" style={styles.textRegular}>
                                {banner.title}
                              </Text>
                            </Box>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                    {/* Banner 指示器 */}
                    {merchantContent.banners.length > 1 && (
                      <HStack justifyContent="center" gap="$xs" mt="$sm">
                        {merchantContent.banners.map((_, index) => (
                          <Box
                            key={index}
                            w={index === currentBannerIndex ? 16 : 6}
                            h={6}
                            rounded="$sm"
                            bg={index === currentBannerIndex ? "$black" : "$gray200"}
                          />
                        ))}
                      </HStack>
                    )}
                  </Box>
                )}

                {/* ── 公告 ── */}
                {merchantContent.announcements.length > 0 && (
                  <VStack px="$md" mt="$lg">
                    <Text fontSize={11} color="$gray400" mb={8} letterSpacing={0.5} style={styles.textRegular}>
                      {t("store.storeAnnouncement").toUpperCase()}
                    </Text>
                    <VStack gap={10}>
                      {merchantContent.announcements.map((announcement) => (
                        <VStack key={announcement.id}>
                          <HStack alignItems="center" gap={6} mb={2}>
                            {announcement.isPinned && (
                              <Box bg="$gray100" px={6} py={1} rounded="$xs">
                                <Text fontSize={10} color="$gray600" style={styles.textRegular}>
                                  {t("store.pinned")}
                                </Text>
                              </Box>
                            )}
                            <Text
                              fontSize={14}
                              fontWeight="$semibold"
                              color="$black"
                              flex={1}
                              numberOfLines={1}
                              style={styles.textBold}
                            >
                              {announcement.title}
                            </Text>
                          </HStack>
                          <Text fontSize={13} color="$gray600" lineHeight={20} numberOfLines={3} style={styles.textRegular}>
                            {announcement.content}
                          </Text>
                        </VStack>
                      ))}
                    </VStack>
                  </VStack>
                )}

                {/* ── 近期活动 ── */}
                {merchantContent.activities.length > 0 && (
                  <VStack mt="$lg">
                    <Text fontSize={11} color="$gray400" mb={8} px="$md" letterSpacing={0.5} style={styles.textRegular}>
                      {t("store.recentActivities").toUpperCase()}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                      {merchantContent.activities.map((activity) => (
                        <Pressable
                          key={activity.id}
                          style={styles.activityCard}
                          onPress={() => {
                            // 可以跳转到活动详情页
                          }}
                        >
                          {activity.coverImage && (
                            <OptimizedImage
                              uri={activity.coverImage}
                              size={ImageSize.MEDIUM}
                              style={styles.activityImage}
                              contentFit="cover"
                              lazy={true}
                            />
                          )}
                          <VStack mt={8}>
                            <Text
                              fontSize={13}
                              fontWeight="$semibold"
                              color="$black"
                              numberOfLines={1}
                              style={styles.textBold}
                            >
                              {activity.title}
                            </Text>
                            <HStack alignItems="center" gap={4} mt={4}>
                              <Ionicons name="time-outline" size={11} color={theme.colors.gray400} />
                              <Text fontSize={11} color="$gray400" style={styles.textRegular}>
                                {formatDate(activity.activityStartTime)} – {formatDate(activity.activityEndTime)}
                              </Text>
                            </HStack>
                            {activity.needRegistration && (
                              <Text fontSize={10} color="$gray400" mt={4} style={styles.textRegular}>
                                {t("store.needRegistration")}
                                {activity.registrationLimit ? ` · ${activity.registrationCount}/${activity.registrationLimit}` : ""}
                              </Text>
                            )}
                          </VStack>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </VStack>
                )}

                {/* ── 近期折扣 ── */}
                {merchantContent.discounts.length > 0 && (
                  <VStack px="$md" mt="$lg">
                    <Text fontSize={11} color="$gray400" mb={8} letterSpacing={0.5} style={styles.textRegular}>
                      {t("store.promotions").toUpperCase()}
                    </Text>
                    <VStack gap={10}>
                      {merchantContent.discounts.map((discount) => (
                        <Box key={discount.id} style={styles.discountRow}>
                          <HStack justifyContent="between" alignItems="flex-start" gap={10}>
                            <VStack flex={1}>
                              <Text fontSize={14} fontWeight="$semibold" color="$black" style={styles.textBold}>
                                {discount.title}
                              </Text>
                              {discount.discountValue && (
                                <Text fontSize={18} fontWeight="$bold" color="#E65100" mt={2} style={styles.textBold}>
                                  {discount.discountValue}
                                </Text>
                              )}
                              {discount.description && (
                                <Text fontSize={12} color="$gray600" mt={4} numberOfLines={2} style={styles.textRegular}>
                                  {discount.description}
                                </Text>
                              )}
                              <HStack alignItems="center" gap={4} mt={6}>
                                <Ionicons name="time-outline" size={11} color={theme.colors.gray400} />
                                <Text fontSize={11} color="$gray400" style={styles.textRegular}>
                                  {formatDate(discount.discountStartTime)} – {formatDate(discount.discountEndTime)}
                                </Text>
                              </HStack>
                            </VStack>
                            {discount.needCode && discount.discountCode && (
                              <Box style={styles.discountCode}>
                                <Text fontSize={11} color="#E65100" fontWeight="$semibold" style={styles.textBold}>
                                  {discount.discountCode}
                                </Text>
                              </Box>
                            )}
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  </VStack>
                )}
              </>
            )}

            {/* ── 单品列表 (preview) ── */}
            {/* 只在该店有上架商品时显示。卡片横向滚动 + "View All"
                跳到 StoreProductList；首屏 loading 静默，避免 detail 页
                因为这条 optional 区域闪一下骨架屏。 */}
            {products.length > 0 && (
              <VStack mt="$lg">
                {/* 整个标题行可点 —— "PRODUCTS · 6" + "View All" 指向同一个屏，
                    不管 total > preview 与否，用户都能进到完整列表 / 搜索 /
                    分类筛选界面（StoreProductListScreen mode=ALL）。
                    设计稿里那种"看似只有标签"的 header 容易让人觉得不能点，
                    所以右侧永远渲染 chevron 显示 affordance。 */}
                <Pressable onPress={handleOpenAllProducts}>
                  <HStack justifyContent="between" alignItems="center" px="$md" mb={8}>
                    <Text fontSize={11} color="$gray400" letterSpacing={0.5} style={styles.textRegular}>
                      {t("store.products").toUpperCase()}
                      {productsTotal > 0 ? ` · ${productsTotal}` : ""}
                    </Text>
                    <HStack alignItems="center">
                      <Text fontSize={12} color="$gray400" mr={2} style={styles.textRegular}>
                        {t("common.viewAll")}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={theme.colors.gray300} />
                    </HStack>
                  </HStack>
                </Pressable>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {products.map((product) => {
                    const cover = product.images?.[0];
                    const hasDiscount =
                      product.discountPriceCents != null &&
                      product.discountPriceCents < product.priceCents;
                    return (
                      <Pressable
                        key={product.id}
                        style={styles.productCard}
                        onPress={() => handleOpenProduct(product.id)}
                      >
                        <Box style={styles.productCover}>
                          {cover ? (
                            <OptimizedImage
                              uri={cover}
                              size={ImageSize.MEDIUM}
                              style={styles.productImage}
                              contentFit="cover"
                              lazy={true}
                            />
                          ) : (
                            <Box style={styles.productImagePlaceholder}>
                              <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
                            </Box>
                          )}
                          {product.isNew && !hasDiscount && (
                            <Box style={[styles.productBadge, styles.productBadgeNew]}>
                              <Text fontSize={9} fontWeight="$bold" color="$black" style={styles.textBold}>
                                NEW
                              </Text>
                            </Box>
                          )}
                          {hasDiscount && (
                            <Box style={[styles.productBadge, styles.productBadgeSale]}>
                              <Text fontSize={9} fontWeight="$bold" color="$white" style={styles.textBold}>
                                SALE
                              </Text>
                            </Box>
                          )}
                        </Box>
                        <VStack mt={6} gap={2}>
                          <Text
                            fontSize={12}
                            fontWeight="$semibold"
                            color="$black"
                            numberOfLines={2}
                            style={styles.textBold}
                          >
                            {product.title}
                          </Text>
                          {!!product.brand && (
                            <Text fontSize={10} color="$gray400" numberOfLines={1} style={styles.textRegular}>
                              {product.brand}
                            </Text>
                          )}
                          <HStack alignItems="baseline" gap={4} mt={2}>
                            <Text
                              fontSize={12}
                              fontWeight="$bold"
                              color={hasDiscount ? "#E65100" : "$black"}
                              style={styles.textBold}
                            >
                              {formatPrice(
                                hasDiscount
                                  ? (product.discountPriceCents as number)
                                  : product.priceCents,
                                product.currency
                              )}
                            </Text>
                            {hasDiscount && (
                              <Text
                                fontSize={10}
                                color="$gray300"
                                style={[styles.textRegular, styles.priceStrike]}
                              >
                                {formatPrice(product.priceCents, product.currency)}
                              </Text>
                            )}
                          </HStack>
                        </VStack>
                      </Pressable>
                    );
                  })}
                  {/* 横向滚动尾部的"查看全部"卡片：用户左滑到底自然引导到
                      完整列表屏。即便 total <= preview 也保留这张卡 —— 进入
                      列表屏可以做搜索 / 分类筛选，体验比横向滚动列表更完整。 */}
                  <Pressable
                    style={styles.productMoreCard}
                    onPress={handleOpenAllProducts}
                  >
                    <Box style={styles.productMoreIconWrap}>
                      <Ionicons name="arrow-forward" size={20} color={theme.colors.black} />
                    </Box>
                    <Text fontSize={12} color="$black" fontWeight="$semibold" mt={8} style={styles.textBold}>
                      {t("common.viewAll")}
                    </Text>
                    {productsTotal > 0 && (
                      <Text fontSize={10} color="$gray400" mt={2} style={styles.textRegular}>
                        {productsTotal}
                      </Text>
                    )}
                  </Pressable>
                </ScrollView>
              </VStack>
            )}

            {/* 评论区标题 */}
            <HStack
              justifyContent="between"
              alignItems="center"
              px="$md"
              pt="$lg"
              pb="$sm"
              mt="$md"
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$gray100"
            >
              <Text fontSize={12} color="$gray400" letterSpacing={0.5} style={styles.textRegular}>
                {t("store.userReviews").toUpperCase()} ({commentsTotal})
              </Text>
              <Pressable flexDirection="row" alignItems="center" onPress={() => openCommentInput()}>
                <Ionicons name="create-outline" size={15} color={theme.colors.gray400} />
                <Text fontSize={12} color="$gray400" ml={4} style={styles.textRegular}>
                  {t("store.writeReview")}
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        }
        ListEmptyComponent={
          <VStack alignItems="center" py="$xl" px="$md">
            <Ionicons name="chatbubble-outline" size={32} color={theme.colors.gray200} />
            <Text fontSize={13} color="$gray300" mt="$md" textAlign="center" style={styles.textRegular}>
              {t("store.noReviewsYet")}
            </Text>
          </VStack>
        }
        onEndReached={() => {
          if (comments.length < commentsTotal && !isLoadingComments) {
            loadComments(commentsPage + 1);
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingComments ? (
            <Box py="$md" alignItems="center">
              <ActivityIndicator color={theme.colors.black} />
            </Box>
          ) : null
        }
      />

      {/* 评分弹窗 */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="none"
        onRequestClose={closeRatingModal}
      >
        <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
          <TouchableWithoutFeedback onPress={closeRatingModal}>
            <Box flex={1} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: ratingModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Box w={40} h={4} bg="$gray200" rounded="$sm" alignSelf="center" mb="$lg" />
            <Text fontSize="$lg" fontWeight="$bold" color="$black" textAlign="center" mb="$md" style={styles.textBold}>
              {t("store.rateThisStore")}
            </Text>
            <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$lg" style={styles.textRegular}>
              {store.name}
            </Text>

            {/* 评分星星 */}
            <HStack justifyContent="center" mb="$lg">
              <HalfStarRating
                rating={selectedRating}
                size={40}
                interactive
                onRatingChange={setSelectedRating}
                color="#FFB800"
                inactiveColor={theme.colors.gray200}
                gap={8}
              />
            </HStack>

            <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$xl" style={styles.textRegular}>
              {selectedRating === 0
                ? t("store.tapToRate")
                : selectedRating >= 4.5
                  ? t("store.ratingExcellent")
                  : selectedRating >= 3.5
                    ? t("store.ratingGood")
                    : selectedRating >= 2.5
                      ? t("store.ratingOkay")
                      : selectedRating >= 1.5
                        ? t("store.ratingFair")
                        : t("store.ratingPoor")}
              {selectedRating > 0 && ` (${selectedRating % 1 === 0 ? `${selectedRating}.0` : selectedRating.toFixed(1)})`}
            </Text>

            <Pressable
              w="100%"
              py="$md"
              rounded="$sm"
              bg={selectedRating > 0 ? "$black" : "$gray200"}
              alignItems="center"
              onPress={handleSubmitRating}
              disabled={selectedRating === 0 || isSubmittingRating}
            >
              {isSubmittingRating ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text fontSize="$md" fontWeight="$bold" color="$white" style={styles.textBold}>
                  {t("store.submitRating")}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        </Box>
      </Modal>

      {/* 评论输入弹窗 */}
      <Modal
        visible={showCommentInput}
        transparent
        animationType="none"
        onRequestClose={closeCommentInput}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
            <TouchableWithoutFeedback onPress={closeCommentInput}>
              <Box flex={1} />
            </TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.commentInputContainer,
                {
                  transform: [
                    {
                      translateY: commentInputAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [400, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Box w={40} h={4} bg="$gray200" rounded="$sm" alignSelf="center" mb="$md" />

              {/* 回复提示 */}
              {replyTo && (
                <HStack
                  bg="$gray50"
                  rounded="$md"
                  px="$md"
                  py="$sm"
                  mb="$md"
                  alignItems="center"
                  justifyContent="between"
                >
                  <Text fontSize="$sm" color="$gray300" style={styles.textRegular}>
                    {t("store.reply")} <Text fontWeight="$medium" color="$black" style={styles.textRegular}>{replyTo.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.gray300} />
                  </Pressable>
                </HStack>
              )}

              {/* 评论建议 */}
              <Text fontSize="$sm" color="$gray300" mb="$sm" style={styles.textRegular}>
                {t("store.commentSuggestions")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: theme.spacing.md }}
              >
                {suggestions.map((suggestion, index) => (
                  <Pressable
                    key={index}
                    bg="$gray100"
                    rounded="$sm"
                    px="$md"
                    py="$sm"
                    mr="$sm"
                    onPress={() => useSuggestion(suggestion)}
                  >
                    <Text fontSize="$sm" color="$gray300" numberOfLines={1} style={styles.textRegular}>
                      {suggestion.length > 20 ? suggestion.slice(0, 20) + "..." : suggestion}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* 输入框 */}
              <Box
                bg="$gray50"
                rounded="$lg"
                p="$md"
                mb="$md"
                minH={100}
              >
                <TextInput
                  ref={inputRef}
                  style={styles.commentInput}
                  placeholder={t("store.commentPlaceholder")}
                  placeholderTextColor={theme.colors.gray200}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
              </Box>

              {/* 字数统计和发送按钮 */}
              <HStack justifyContent="between" alignItems="center">
                <Text fontSize="$xs" color="$gray200" style={styles.textRegular}>
                  {commentText.length}/500
                </Text>
                <Pressable
                  px="$xl"
                  py="$sm"
                  rounded="$sm"
                  bg={commentText.trim() ? "$black" : "$gray200"}
                  onPress={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      {t("store.publish")}
                    </Text>
                  )}
                </Pressable>
              </HStack>
            </Animated.View>
          </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* 底部操作栏 */}
      <HStack
        px="$xl"
        py="$lg"
        bg="$white"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$gray100"
        gap="$sm"
      >
        <Pressable style={styles.bottomBtnOutline} onPress={openRatingModal} flex={1}>
          <Ionicons name="star-outline" size={15} color={theme.colors.black} />
          <Text fontSize={13} color="$black" ml={6} style={styles.textRegular}>
            {store.userRating
              ? t("store.rated", { rating: store.userRating % 1 === 0 ? store.userRating : store.userRating.toFixed(1) })
              : t("store.rateStore")}
          </Text>
        </Pressable>

        <Pressable style={styles.bottomBtnFill} onPress={() => openCommentInput()} flex={1}>
          <Ionicons name="chatbubble-outline" size={15} color={theme.colors.white} />
          <Text fontSize={13} color="$white" ml={6} style={styles.textRegular}>
            {t("store.writeReview")}
          </Text>
        </Pressable>
      </HStack>
      {/* 商家申请弹窗 */}
      <Modal
        visible={showMerchantApplyModal}
        transparent
        animationType="none"
        onRequestClose={closeMerchantApplyModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
            <TouchableWithoutFeedback onPress={closeMerchantApplyModal}>
              <Box flex={1} />
            </TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.merchantApplyContainer,
                {
                  transform: [
                    {
                      translateY: merchantApplyAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [500, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Box w={40} h={4} bg="$gray200" rounded="$sm" alignSelf="center" mb="$md" />

              <Text fontSize="$lg" fontWeight="$bold" color="$black" textAlign="center" mb="$xs" style={styles.textBold}>
                {t("store.merchantApplyTitle")}
              </Text>
              <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$lg" style={styles.textRegular}>
                {t("store.applyToBeMerchant", { name: store.name })}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* 联系人姓名 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                    {t("store.contactNameLabel")}
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder={t("store.contactNameLabel")}
                    placeholderTextColor={theme.colors.gray200}
                    value={applyFormData.contactName}
                    onChangeText={(text) =>
                      setApplyFormData({ ...applyFormData, contactName: text })
                    }
                  />
                </VStack>

                {/* 联系电话 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                    {t("store.contactPhoneLabel")}
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder={t("store.contactPhoneLabel")}
                    placeholderTextColor={theme.colors.gray200}
                    value={applyFormData.contactPhone}
                    onChangeText={(text) =>
                      setApplyFormData({ ...applyFormData, contactPhone: text })
                    }
                    keyboardType="phone-pad"
                  />
                </VStack>

                {/* 联系邮箱 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                    {t("store.contactEmailLabel")}
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder={t("store.contactEmailLabel")}
                    placeholderTextColor={theme.colors.gray200}
                    value={applyFormData.contactEmail}
                    onChangeText={(text) =>
                      setApplyFormData({ ...applyFormData, contactEmail: text })
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </VStack>

                {/* 营业执照 */}
                <VStack mb="$lg">
                  <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                    {t("store.businessLicenseLabel")}
                  </Text>
                  <Pressable
                    h={120}
                    bg="$gray50"
                    rounded="$md"
                    justifyContent="center"
                    alignItems="center"
                    overflow="hidden"
                    borderWidth={1}
                    borderColor="$gray200"
                    borderStyle="dashed"
                    onPress={pickBusinessLicense}
                  >
                    {applyFormData.businessLicense ? (
                      <OptimizedImage
                        uri={applyFormData.businessLicense}
                        size={ImageSize.MEDIUM}
                        style={styles.licenseImage}
                        contentFit="cover"
                        lazy={true}
                      />
                    ) : (
                      <VStack alignItems="center">
                        <Ionicons name="cloud-upload-outline" size={32} color={theme.colors.gray300} />
                        <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                          {t("store.uploadProof")}
                        </Text>
                        <Text fontSize="$xs" color="$gray200" mt="$xs" style={styles.textRegular}>
                          {t("store.supportedDocs")}
                        </Text>
                      </VStack>
                    )}
                  </Pressable>
                </VStack>

                {/* 提示信息 */}
                <Box bg="$gray50" rounded="$md" p="$md" mb="$lg">
                  <HStack alignItems="start" gap="$sm">
                    <Ionicons name="information-circle-outline" size={18} color={theme.colors.gray300} />
                    <VStack flex={1}>
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        {t("store.applyNote")}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>

                {/* 提交按钮 */}
                <Pressable
                  py="$md"
                  rounded="$sm"
                  bg="$black"
                  alignItems="center"
                  onPress={handleSubmitMerchantApply}
                  disabled={isSubmittingApply}
                  mb="$lg"
                >
                  {isSubmittingApply ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$bold" color="$white" style={styles.textBold}>
                      {t("store.submitApply")}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </Animated.View>
          </Box>
        </KeyboardAvoidingView>
      </Modal>

      <ShareToChatModal
        visible={showShareToChat}
        store={store}
        onClose={() => setShowShareToChat(false)}
      />
    </SafeAreaView>
  );
};

// 字体常量
const FONT_REGULAR = "PlayfairDisplay-Regular";
const FONT_BOLD = "PlayfairDisplay-Bold";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  // follow button
  followBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.black,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  // info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  // style chip (outline)
  styleChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  // brand chip (light gray)
  brandChip: {
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  // merchant row
  merchantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
  },
  // bottom bar buttons
  bottomBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray200,
    borderRadius: 6,
  },
  bottomBtnFill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: theme.colors.black,
    borderRadius: 6,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 34,
  },
  commentInputContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 34,
    maxHeight: "70%",
  },
  commentInput: {
    fontSize: 15,
    color: theme.colors.black,
    minHeight: 80,
    fontFamily: FONT_REGULAR,
  },
  storeImage: {
    width: 160,
    height: 160,
    borderRadius: theme.borderRadius.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  commentAvatarImage: {
    width: 36,
    height: 36,
  },
  commentAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  // 商家内容样式
  bannerItem: {
    width: 340,
    height: 160,
    marginRight: theme.spacing.sm,
    borderRadius: 12,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  activityCard: {
    width: 180,
  },
  activityImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
  },
  // 单品 preview 卡片：宽 132（接近 1.5x activityCard 的紧凑感），
  // 封面正方形让多张图片在横向滚动时高度齐整。
  productCard: {
    width: 132,
  },
  productCover: {
    width: 132,
    height: 132,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
  },
  productBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  productBadgeNew: {
    backgroundColor: theme.colors.white,
  },
  productBadgeSale: {
    backgroundColor: "#E65100",
  },
  // 横向 product 列表的尾部 "查看全部" 卡片：尺寸严格对齐 productCover
  // 132×132 让滚动行高度齐整；用 dashed border 区别于真实商品卡片，
  // 避免用户误以为是另一件商品。
  productMoreCard: {
    width: 132,
    height: 132 + 50,
    alignItems: "center",
    justifyContent: "center",
  },
  productMoreIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.black,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  priceStrike: {
    textDecorationLine: "line-through",
  },
  discountRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFE082",
    borderRadius: 8,
    backgroundColor: "#FFFBF0",
  },
  discountCode: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E65100",
    borderRadius: 4,
    borderStyle: "dashed",
  },
  // 商家申请弹窗样式
  merchantApplyContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  applyInput: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.black,
    fontFamily: FONT_REGULAR,
  },
  licenseImage: {
    width: "100%",
    height: "100%",
  },
  // 文本样式
  textRegular: {
    fontFamily: FONT_REGULAR,
  },
  textBold: {
    fontFamily: FONT_BOLD,
  },
  textHero: {
    lineHeight: 24,
  },
});

export default StoreDetailScreen;
