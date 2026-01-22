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
  FlatList,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
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
import { useAuthStore } from "../store/authStore";
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
import * as ImagePicker from "expo-image-picker";

type RouteParams = {
  StoreDetail: {
    storeId: string;
  };
};

// 评论提示建议
const DEFAULT_SUGGESTIONS = [
  "这家店最近在打折，折扣力度很大，值得一去！",
  "这家店最近暂时关门/装修中，去之前建议先确认营业时间",
  "店员服务态度很好，会耐心推荐适合的款式",
  "店内货品已经换新了，有很多新到的单品值得看看",
  "这家店的 XX 品牌货最全/价格最实惠",
];

const StoreDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "StoreDetail">>();
  const { storeId } = route.params;
  const { user } = useAuthStore();

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
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
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
      if (detail.userRating) {
        setSelectedRating(detail.userRating);
      }
    } catch (error: any) {
      Alert.alert("加载失败", error.message || "请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [storeId, user?.id]);

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

  useEffect(() => {
    loadStoreDetail();
    loadComments();
    loadSuggestions();
    loadMerchantContent();
  }, [loadStoreDetail, loadComments, loadSuggestions, loadMerchantContent]);

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
    await Promise.all([loadStoreDetail(), loadComments(1), loadMerchantContent()]);
    setIsRefreshing(false);
  };

  // Banner 点击处理
  const handleBannerClick = async (banner: StoreBanner) => {
    try {
      await recordBannerClick(banner.id);
      if (banner.linkUrl) {
        Linking.openURL(banner.linkUrl);
      }
    } catch (error) {
      console.error("Banner click error:", error);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
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
      Alert.alert("提示", "请先登录");
      return;
    }
    // 如果已有认证商家，提示
    if (merchantContent?.isMerchant) {
      Alert.alert("提示", "该店铺已有认证商家");
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
      Alert.alert("提示", "请填写联系人姓名");
      return;
    }
    if (!applyFormData.contactPhone.trim()) {
      Alert.alert("提示", "请填写联系电话");
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
      Alert.alert("申请成功", "您的商家入驻申请已提交，请等待审核");
      checkMerchantStatus();
    } catch (error: any) {
      Alert.alert("申请失败", error.message || "请稍后重试");
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // 收藏/取消收藏
  const handleToggleFavorite = async () => {
    if (!user) {
      Alert.alert("提示", "请先登录");
      return;
    }
    if (!store) return;

    try {
      if (store.isFavorited) {
        await unfavoriteStore(storeId, Number(user.id));
        setStore((prev) =>
          prev
            ? { ...prev, isFavorited: false, favoriteCount: prev.favoriteCount - 1 }
            : null
        );
      } else {
        await favoriteStore(storeId, Number(user.id));
        setStore((prev) =>
          prev
            ? { ...prev, isFavorited: true, favoriteCount: prev.favoriteCount + 1 }
            : null
        );
      }
    } catch (error: any) {
      Alert.alert("操作失败", error.message || "请稍后重试");
    }
  };

  // 打开评分弹窗
  const openRatingModal = () => {
    if (!user) {
      Alert.alert("提示", "请先登录");
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
      Alert.alert("评分成功", "感谢您的评价！");
    } catch (error: any) {
      Alert.alert("评分失败", error.message || "请稍后重试");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // 打开评论输入
  const openCommentInput = (replyToComment?: { id: number; username: string }) => {
    if (!user) {
      Alert.alert("提示", "请先登录");
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
      Alert.alert("评论失败", error.message || "请稍后重试");
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

    Alert.alert("删除评论", "确定要删除这条评论吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStoreComment(commentId, Number(user.id));
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setStore((prev) =>
              prev ? { ...prev, commentCount: prev.commentCount - 1 } : null
            );
          } catch (error: any) {
            Alert.alert("删除失败", error.message || "请稍后重试");
          }
        },
      },
    ]);
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

  // 渲染评分星星
  const renderStars = (rating: number, size: number = 16, interactive: boolean = false) => {
    return (
      <HStack gap="$xs">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={interactive ? () => setSelectedRating(star) : undefined}
            disabled={!interactive}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={size}
              color={star <= rating ? "#FFB800" : theme.colors.gray200}
            />
          </Pressable>
        ))}
      </HStack>
    );
  };

  // 渲染评论项
  const renderCommentItem = ({ item }: { item: StoreComment }) => (
    <Box mb="$md" pb="$md" borderBottomWidth={1} borderBottomColor="$gray100">
      <HStack alignItems="start" mb="$sm">
        <Box
          w={40}
          h={40}
          rounded="$sm"
          bg="$gray100"
          justifyContent="center"
          alignItems="center"
          mr="$sm"
        >
          {item.userAvatar ? (
            <Image
              source={{ uri: item.userAvatar }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <Ionicons name="person" size={20} color={theme.colors.gray300} />
          )}
        </Box>
        <VStack flex={1}>
          <HStack justifyContent="between" alignItems="center">
            <Text fontSize="$sm" fontWeight="$semibold" color="$black" style={styles.textBold}>
              {item.username}
            </Text>
            <Text fontSize="$xs" color="$gray200" style={styles.textRegular}>
              {new Date(item.createdAt).toLocaleDateString("zh-CN")}
            </Text>
          </HStack>
          <Text fontSize="$md" color="$black" mt="$xs" lineHeight={22} style={styles.textRegular}>
            {item.content}
          </Text>
          <HStack mt="$sm" gap="$lg">
            <Pressable
              flexDirection="row"
              alignItems="center"
              onPress={() => openCommentInput({ id: item.id, username: item.username })}
            >
              <Ionicons
                name="chatbubble-outline"
                size={14}
                color={theme.colors.gray300}
              />
              <Text fontSize="$xs" color="$gray300" ml="$xs" style={styles.textRegular}>
                回复{item.replyCount > 0 ? ` ${item.replyCount}` : ""}
              </Text>
            </Pressable>
            <HStack alignItems="center">
              <Ionicons name="heart-outline" size={14} color={theme.colors.gray300} />
              <Text fontSize="$xs" color="$gray300" ml="$xs" style={styles.textRegular}>
                {item.likeCount > 0 ? item.likeCount : ""}
              </Text>
            </HStack>
            {user && item.userId === Number(user.id) && (
              <Pressable onPress={() => handleDeleteComment(item.id)}>
                <Text fontSize="$xs" color="$error" style={styles.textRegular}>
                  删除
                </Text>
              </Pressable>
            )}
          </HStack>
        </VStack>
      </HStack>

      {/* 回复列表 */}
      {item.replies.length > 0 && (
        <Box ml={48} mt="$sm" bg="$gray50" rounded="$md" p="$sm">
          {item.replies.map((reply) => (
            <Box
              key={reply.id}
              mb={reply === item.replies[item.replies.length - 1] ? 0 : "$sm"}
            >
              <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                <Text fontWeight="$semibold" style={styles.textBold}>{reply.username}</Text>
                {reply.replyToUsername && (
                  <Text color="$gray300" style={styles.textRegular}>
                    {" "}回复 <Text fontWeight="$medium" style={styles.textRegular}>{reply.replyToUsername}</Text>
                  </Text>
                )}
                : {reply.content}
              </Text>
            </Box>
          ))}
          {item.replyCount > item.replies.length && (
            <Pressable mt="$xs">
              <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                查看全部 {item.replyCount} 条回复
              </Text>
            </Pressable>
          )}
        </Box>
      )}
    </Box>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="店铺详情"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            加载中...
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="店铺详情"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Ionicons name="storefront-outline" size={64} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            店铺不存在
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
        rightComponent={
          <HStack gap="$md" alignItems="center">
            <Pressable onPress={handleToggleFavorite}>
              <Ionicons
                name={store.isFavorited ? "heart" : "heart-outline"}
                size={24}
                color={store.isFavorited ? theme.colors.error : theme.colors.black}
              />
            </Pressable>
          </HStack>
        }
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
            {/* 店铺信息卡片 */}
            <Box bg="$white" mb="$md">
              {/* 店铺名称和状态 */}
              <HStack justifyContent="between" alignItems="start" mb="$sm">
                <VStack flex={1}>
                  <Text fontSize="$xl" fontWeight="$bold" color="$black" style={styles.textBold}>
                    {store.name}
                  </Text>
                  <Text fontSize="$sm" color="$gray300" mt="$xs" style={styles.textRegular}>
                    {store.city}, {store.country}
                  </Text>
                </VStack>
                <Box
                  px="$sm"
                  py="$xs"
                  rounded="$sm"
                  bg={store.isOpen ? "#E8F5E9" : "$gray100"}
                >
                  <Text
                    fontSize="$xs"
                    fontWeight="$bold"
                    color={store.isOpen ? "#27AE60" : "$gray300"}
                    style={styles.textBold}
                  >
                    {store.isOpen ? "营业中" : "休息"}
                  </Text>
                </Box>
              </HStack>

              {/* 评分和统计 */}
              <HStack
                bg="$gray50"
                rounded="$sm"
                p="$md"
                justifyContent="space-around"
                mb="$md"
              >
                <Pressable alignItems="center" onPress={openRatingModal}>
                  <HStack alignItems="center" justifyContent="center" mb="$xs">
                    {renderStars(Math.round(store.averageRating || 0))}
                    <Text fontSize="$lg" fontWeight="$bold" color="$gray300" style={styles.textBold}>
                      ｜ {store.averageRating?.toFixed(1) || "-"}
                    </Text>
                  </HStack>
                  <Text fontSize="$xs" color="$black" style={styles.textRegular}>
                    {store.ratingCount} 人评分
                  </Text>
                </Pressable>

                <Box w={1} h="80%" bg="$gray200" />

                <Pressable alignItems="center" onPress={() => openCommentInput()}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={24}
                    color={theme.colors.black}
                  />
                  <Text fontSize="$xs" fontWeight="$bold" color="$black" mt="$xs" style={styles.textBold}>
                    {store.commentCount} 条评价
                  </Text>
                </Pressable>

                <Box w={1} h="80%" bg="$gray200" />

                <Pressable alignItems="center" onPress={handleToggleFavorite}>
                  <Ionicons
                    name={store.isFavorited ? "heart" : "heart-outline"}
                    size={24}
                    color={store.isFavorited ? theme.colors.error : theme.colors.black}
                  />
                  <Text fontSize="$xs" fontWeight="$bold" color="$black" mt="$xs" style={styles.textBold}>
                    {store.favoriteCount}人点赞
                  </Text>
                </Pressable>
              </HStack>

              {/* 地址 */}
              <Pressable
                bg="$gray50"
                rounded="$sm"
                p="$md"
                mb="$sm"
                onPress={handleNavigate}
              >
                <HStack alignItems="center" gap="$md">
                  <Ionicons name="location-outline" size={20} color={theme.colors.black} />
                  <Text fontSize="$md" color="$black" ml="$sm" flex={1} style={styles.textRegular}>
                    {store.address}
                  </Text>
                  <Ionicons name="navigate-outline" size={18} color={theme.colors.gray300} />
                </HStack>
              </Pressable>

              {/* 营业时间 */}
              {store.hours && (
                <Box bg="$gray50" rounded="$sm" p="$md" mb="$sm">
                  <HStack alignItems="center" gap="$md">
                    <Ionicons name="time-outline" size={20} color={theme.colors.black} />
                    <Text fontSize="$md" color="$black" ml="$sm" flex={1} style={styles.textRegular}>
                      {store.hours}
                    </Text>
                  </HStack>
                </Box>
              )}

              {/* 电话 */}
              {store.phone && store.phone.length > 0 && (
                <Box bg="$gray50" rounded="$sm" p="$md" mb="$sm">
                  {store.phone.map((phone, idx) => (
                    <Pressable
                      key={idx}
                      flexDirection="row"
                      alignItems="center"
                      gap="$md"
                      mt={idx > 0 ? "$sm" : 0}
                      onPress={() => handleCall(phone)}
                    >
                      <Ionicons name="call-outline" size={20} color={theme.colors.black} />
                      <Text fontSize="$md" color="$black" ml="$sm" flex={1} style={styles.textRegular}>
                        {phone}
                      </Text>
                      <Box bg="#E8F5E9" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$xs" color="#27AE60" fontWeight="$semibold" style={styles.textBold}>
                          拨打
                        </Text>
                      </Box>
                    </Pressable>
                  ))}
                </Box>
              )}

              {/* 风格标签 */}
              {store.style.length > 0 && (
                <VStack mb="$md">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm" style={styles.textBold}>
                    店铺风格
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {store.style.map((s, idx) => (
                      <Box key={idx} bg="$black" px="$md" py="$sm" rounded="$sm">
                        <Text fontSize="$sm" color="$white" fontWeight="$medium" style={styles.textRegular}>
                          {s}
                        </Text>
                      </Box>
                    ))}
                  </HStack>
                </VStack>
              )}

              {/* 品牌 */}
              {store.brands.length > 0 && (
                <VStack mb="$md">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm" style={styles.textBold}>
                    主营品牌
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {store.brands.map((brand, idx) => (
                      <Box key={idx} bg="$gray100" px="$md" py="$sm" rounded="$sm">
                        <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                          {brand}
                        </Text>
                      </Box>
                    ))}
                  </HStack>
                </VStack>
              )}
              {/* 商家入驻入口 - 如果还没有认证商家 */}
              <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm" style={styles.textBold}>
                商家信息
              </Text>
              {!merchantContent?.isMerchant && (
                <Pressable
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="space-between"
                  bg="$gray50"
                  rounded="$md"
                  p="$md"
                  mb="$md"
                  onPress={openMerchantApplyModal}
                >
                  <HStack alignItems="center" gap="$sm">
                    <Box
                      w={36}
                      h={36}
                      rounded="$sm"
                      bg="$white"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Ionicons name="storefront" size={18} color="$black" />
                    </Box>
                    <VStack>
                      <Text fontSize="$sm" fontWeight="$semibold" color="$black" style={styles.textBold}>
                        我是店铺商家
                      </Text>
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        申请入驻管理此店铺
                      </Text>
                    </VStack>
                  </HStack>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.gray300} />
                </Pressable>
              )}
            </Box>

            {/* ==================== 商家内容区域 ==================== */}
            {merchantContent?.isMerchant && (
              <>
                {/* Banner 轮播 */}
                {merchantContent.banners.length > 0 && (
                  <Box mb="$md">
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
                          <Image
                            source={{ uri: banner.imageUrl }}
                            style={styles.bannerImage}
                            resizeMode="cover"
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

                {/* 公告 */}
                {merchantContent.announcements.length > 0 && (
                  <Box bg="$white" p="$md" mb="$md" rounded="$md">
                    <HStack alignItems="center" gap="$sm" mb="$sm">
                      <Ionicons name="megaphone" size={18} color={theme.colors.error} />
                      <Text fontSize="$md" fontWeight="$bold" color="$black" style={styles.textBold}>
                        店铺公告
                      </Text>
                    </HStack>
                    {merchantContent.announcements.slice(0, 2).map((announcement) => (
                      <Box
                        key={announcement.id}
                        bg="$gray50"
                        p="$sm"
                        rounded="$sm"
                        mb="$xs"
                      >
                        <HStack alignItems="center" gap="$xs" mb="$xs">
                          {announcement.isPinned && (
                            <Box bg="$error" px="$xs" py={2} rounded="$xs">
                              <Text fontSize={10} color="$white" style={styles.textBold}>
                                置顶
                              </Text>
                            </Box>
                          )}
                          <Text
                            fontSize="$sm"
                            fontWeight="$semibold"
                            color="$black"
                            flex={1}
                            numberOfLines={1}
                            style={styles.textBold}
                          >
                            {announcement.title}
                          </Text>
                        </HStack>
                        <Text
                          fontSize="$sm"
                          color="$gray300"
                          numberOfLines={2}
                          style={styles.textRegular}
                        >
                          {announcement.content}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 近期活动 */}
                {merchantContent.activities.length > 0 && (
                  <Box bg="$white" p="$md" mb="$md" rounded="$md">
                    <HStack alignItems="center" gap="$sm" mb="$sm">
                      <Ionicons name="calendar" size={18} color="#1976D2" />
                      <Text fontSize="$md" fontWeight="$bold" color="$black" style={styles.textBold}>
                        近期活动
                      </Text>
                    </HStack>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {merchantContent.activities.map((activity) => (
                        <Pressable
                          key={activity.id}
                          style={styles.activityCard}
                          onPress={() => {
                            // 可以跳转到活动详情页
                          }}
                        >
                          {activity.coverImage && (
                            <Image
                              source={{ uri: activity.coverImage }}
                              style={styles.activityImage}
                              resizeMode="cover"
                            />
                          )}
                          <VStack p="$sm">
                            <Text
                              fontSize="$sm"
                              fontWeight="$semibold"
                              color="$black"
                              numberOfLines={1}
                              style={styles.textBold}
                            >
                              {activity.title}
                            </Text>
                            <HStack alignItems="center" gap="$xs" mt="$xs">
                              <Ionicons name="time-outline" size={12} color={theme.colors.gray300} />
                              <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                                {formatDate(activity.activityStartTime)} - {formatDate(activity.activityEndTime)}
                              </Text>
                            </HStack>
                            {activity.needRegistration && (
                              <Box bg="#E3F2FD" px="$xs" py={2} rounded="$xs" alignSelf="flex-start" mt="$xs">
                                <Text fontSize={10} color="#1976D2" style={styles.textRegular}>
                                  需报名 {activity.registrationLimit ? `(${activity.registrationCount}/${activity.registrationLimit})` : ""}
                                </Text>
                              </Box>
                            )}
                          </VStack>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </Box>
                )}

                {/* 近期折扣 */}
                {merchantContent.discounts.length > 0 && (
                  <Box bg="$white" p="$md" mb="$md" rounded="$md">
                    <HStack alignItems="center" gap="$sm" mb="$sm">
                      <Ionicons name="pricetag" size={18} color="#E65100" />
                      <Text fontSize="$md" fontWeight="$bold" color="$black" style={styles.textBold}>
                        优惠活动
                      </Text>
                    </HStack>
                    {merchantContent.discounts.map((discount) => (
                      <Box
                        key={discount.id}
                        bg="linear-gradient(135deg, #FFF3E0 0%, #FFECB3 100%)"
                        p="$md"
                        rounded="$md"
                        mb="$sm"
                        borderWidth={1}
                        borderColor="#FFE082"
                      >
                        <HStack justifyContent="between" alignItems="start">
                          <VStack flex={1}>
                            <Text
                              fontSize="$md"
                              fontWeight="$bold"
                              color="$black"
                              style={styles.textBold}
                            >
                              {discount.title}
                            </Text>
                            {discount.discountValue && (
                              <Text
                                fontSize="$xl"
                                fontWeight="$bold"
                                color="#E65100"
                                mt="$xs"
                                style={styles.textBold}
                              >
                                {discount.discountValue}
                              </Text>
                            )}
                            {discount.description && (
                              <Text
                                fontSize="$xs"
                                color="$gray300"
                                mt="$xs"
                                numberOfLines={2}
                                style={styles.textRegular}
                              >
                                {discount.description}
                              </Text>
                            )}
                            <HStack alignItems="center" gap="$xs" mt="$sm">
                              <Ionicons name="time-outline" size={12} color={theme.colors.gray300} />
                              <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                                {formatDate(discount.discountStartTime)} - {formatDate(discount.discountEndTime)}
                              </Text>
                            </HStack>
                          </VStack>
                          {discount.needCode && discount.discountCode && (
                            <Box bg="$white" px="$sm" py="$xs" rounded="$sm" borderWidth={1} borderColor="#E65100" borderStyle="dashed">
                              <Text fontSize="$xs" color="#E65100" style={styles.textBold}>
                                码: {discount.discountCode}
                              </Text>
                            </Box>
                          )}
                        </HStack>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}

            {/* 评论区标题 */}
            <HStack
              justifyContent="between"
              alignItems="center"
              mb="$md"
              pt="$md"
              borderTopWidth={1}
              borderTopColor="$gray50"
            >
              <Text fontSize="$lg" fontWeight="$bold" color="$black" style={styles.textBold}>
                用户评价 ({commentsTotal})
              </Text>
              <Pressable
                flexDirection="row"
                alignItems="center"
                onPress={() => openCommentInput()}
              >
                <Ionicons name="create-outline" size={18} color={theme.colors.black} />
                <Text fontSize="$sm" color="$black" fontWeight="$medium" ml="$xs" style={styles.textRegular}>
                  写评价
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        }
        ListEmptyComponent={
          <VStack alignItems="center" py="$xl">
            <Ionicons
              name="chatbubble-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text color="$gray300" mt="$md" style={styles.textRegular}>
              暂无评价，快来写下第一条吧！
            </Text>
            <Pressable
              mt="$md"
              px="$lg"
              py="$sm"
              bg="$black"
              rounded="$sm"
              onPress={() => openCommentInput()}
            >
              <Text color="$white" fontWeight="$medium" style={styles.textRegular}>
                写评价
              </Text>
            </Pressable>
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
              <ActivityIndicator size="small" color={theme.colors.black} />
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
              为这家店打分
            </Text>
            <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$lg" style={styles.textRegular}>
              {store.name}
            </Text>

            {/* 评分星星 */}
            <HStack justifyContent="center" mb="$lg">
              {renderStars(selectedRating, 40, true)}
            </HStack>

            <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$xl" style={styles.textRegular}>
              {selectedRating === 0
                ? "点击星星进行评分"
                : selectedRating === 5
                  ? "太棒了！"
                  : selectedRating >= 4
                    ? "很不错"
                    : selectedRating >= 3
                      ? "还可以"
                      : selectedRating >= 2
                        ? "一般般"
                        : "不太满意"}
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
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text fontSize="$md" fontWeight="$bold" color="$white" style={styles.textBold}>
                  提交评分
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
                    回复 <Text fontWeight="$medium" color="$black" style={styles.textRegular}>{replyTo.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.gray300} />
                  </Pressable>
                </HStack>
              )}

              {/* 评论建议 */}
              <Text fontSize="$sm" color="$gray300" mb="$sm" style={styles.textRegular}>
                评论建议
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
                  placeholder="分享你对这家店的评价..."
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
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      发布
                    </Text>
                  )}
                </Pressable>
              </HStack>
            </Animated.View>
          </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* 底部操作栏 */}
      <Box
        px="$lg"
        py="$md"
        bg="$white"
        borderTopWidth={1}
        borderTopColor="$gray100"
      >
        <HStack gap="$sm">
          <Pressable
            flex={1}
            flexDirection="row"
            py="$md"
            rounded="$sm"
            borderWidth={1}
            borderColor="$gray200"
            alignItems="center"
            justifyContent="center"
            onPress={openRatingModal}
          >
            <Ionicons name="star-outline" size={18} color={theme.colors.black} />
            <Text fontSize="$md" fontWeight="$semibold" color="$black" ml="$sm" style={styles.textBold}>
              {store.userRating ? `已评 ${store.userRating} 星` : "评分"}
            </Text>
          </Pressable>

          <Pressable
            flex={1}
            flexDirection="row"
            py="$md"
            rounded="$sm"
            bg="$black"
            alignItems="center"
            justifyContent="center"
            onPress={() => openCommentInput()}
          >
            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.white} />
            <Text fontSize="$md" fontWeight="$semibold" color="$white" ml="$sm" style={styles.textBold}>
              写评价
            </Text>
          </Pressable>
        </HStack>
      </Box>
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
                商家入驻申请
              </Text>
              <Text fontSize="$sm" color="$gray300" textAlign="center" mb="$lg" style={styles.textRegular}>
                申请成为 "{store.name}" 的认证商家
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* 联系人姓名 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                    联系人姓名 *
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder="请输入联系人姓名"
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
                    联系电话 *
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder="请输入联系电话"
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
                    联系邮箱
                  </Text>
                  <TextInput
                    style={styles.applyInput}
                    placeholder="请输入联系邮箱（选填）"
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
                    营业执照 / 证明材料
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
                      <Image
                        source={{ uri: applyFormData.businessLicense }}
                        style={styles.licenseImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <VStack alignItems="center">
                        <Ionicons name="cloud-upload-outline" size={32} color={theme.colors.gray300} />
                        <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                          点击上传证明材料
                        </Text>
                        <Text fontSize="$xs" color="$gray200" mt="$xs" style={styles.textRegular}>
                          支持营业执照、授权书等
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
                        提交申请后，我们将在 1-3 个工作日内审核您的资料。
                        审核通过后，您将可以管理店铺的公告、活动、折扣等信息。
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
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$bold" color="$white" style={styles.textBold}>
                      提交申请
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </Animated.View>
          </Box>
        </KeyboardAvoidingView>
      </Modal>
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
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
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
  activityCard: {
    width: 200,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: 12,
    overflow: "hidden",
  },
  activityImage: {
    width: "100%",
    height: 100,
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
});

export default StoreDetailScreen;
