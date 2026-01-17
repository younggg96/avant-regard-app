import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  StatusBar,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { showImageService, ImageReview } from "../services/showImageService";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";

const { width: screenWidth } = Dimensions.get("window");

interface Look {
  id: string;
  image: string;
  title: string;
  description: string;
  likes: number;
  isLiked: boolean;
  imageType?: string;
  imageId?: number; // API 图片 ID
}

interface LookDetailParams {
  look: Look;
  brandName?: string;
  collectionTitle?: string;
  imageId?: number; // API 图片 ID
}

const LookDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const params = route.params as LookDetailParams;
  const { look, brandName, collectionTitle, imageId: paramImageId } = params || {};

  const [currentLook, setCurrentLook] = useState<Look | undefined>(look);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);

  // 评论相关状态
  const [reviews, setReviews] = useState<ImageReview[]>([]);
  const [userReview, setUserReview] = useState<ImageReview | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myContent, setMyContent] = useState("");
  const [showReviewInput, setShowReviewInput] = useState(false);

  // 获取图片 ID
  const imageId = paramImageId || look?.imageId;

  // 如果没有 look 数据，显示错误状态并返回
  if (!look || !currentLook) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.errorContainer}>
          <View style={styles.errorHeader}>
            <TouchableOpacity
              style={styles.errorBackButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
            </TouchableOpacity>
          </View>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.colors.gray300} />
            <Text style={styles.errorText}>无法加载造型信息</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.errorButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 加载评论
  useEffect(() => {
    const loadReviews = async () => {
      if (!imageId) return;

      setReviewsLoading(true);
      try {
        const data = await showImageService.getImageReviews(imageId);
        setReviews(data);

        // 查找当前用户的评论
        if (user?.userId) {
          const myReview = data.find((r) => r.userId === user.userId);
          if (myReview) {
            setUserReview(myReview);
            setMyRating(myReview.rating);
            setMyContent(myReview.content);
          }
        }
      } catch (error) {
        console.error("Failed to load reviews:", error);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [imageId, user?.userId]);

  // 提交评论
  const handleSubmitReview = async () => {
    if (!user?.userId) {
      Alert.show("请先登录");
      return;
    }

    if (!imageId) {
      Alert.show("无法获取造型信息");
      return;
    }

    if (myRating === 0) {
      Alert.show("请选择评分");
      return;
    }

    if (myContent.trim().length < 5) {
      Alert.show("评论内容至少5个字");
      return;
    }

    setSubmitLoading(true);
    try {
      const newReview = await showImageService.createImageReview(imageId, {
        userId: user.userId,
        rating: myRating,
        content: myContent.trim(),
      });

      // 更新评论列表
      if (userReview) {
        // 更新已有评论
        setReviews((prev) =>
          prev.map((r) => (r.id === userReview.id ? newReview : r))
        );
      } else {
        // 添加新评论
        setReviews((prev) => [newReview, ...prev]);
      }

      setUserReview(newReview);
      setShowReviewInput(false);
      Alert.show(userReview ? "评论已更新" : "评论成功", "", 1500);
    } catch (error) {
      console.error("Submit review error:", error);
      Alert.show(error instanceof Error ? error.message : "提交失败，请重试");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 删除评论
  const handleDeleteReview = async () => {
    if (!userReview) return;

    setSubmitLoading(true);
    try {
      await showImageService.deleteImageReview(userReview.id);
      setReviews((prev) => prev.filter((r) => r.id !== userReview.id));
      setUserReview(null);
      setMyRating(0);
      setMyContent("");
      Alert.show("评论已删除", "", 1500);
    } catch (error) {
      console.error("Delete review error:", error);
      Alert.show(error instanceof Error ? error.message : "删除失败，请重试");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleImagePress = useCallback(() => {
    console.log("Image pressed - opening modal");
    setIsImageModalVisible(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setIsImageModalVisible(false);
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderImage = () => (
    <TouchableOpacity
      onPress={handleImagePress}
      activeOpacity={0.9}
      style={styles.imageContainer}
    >
      <Image
        source={{ uri: currentLook.image }}
        style={styles.mainImage}
        resizeMode="cover"
      />
      <View style={styles.imageOverlay} pointerEvents="box-none">
        {renderHeader()}
      </View>
    </TouchableOpacity>
  );

  const renderLookInfo = () => (
    <View style={styles.infoContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>{currentLook.title}</Text>
        {brandName && <Text style={styles.brand}>by {brandName}</Text>}
        {collectionTitle && (
          <Text style={styles.collection}>来自 {collectionTitle}</Text>
        )}
      </View>
    </View>
  );

  // 渲染评分选择器
  const renderRatingSelector = () => (
    <View style={styles.ratingSelector}>
      <Text style={styles.ratingSelectorLabel}>我的评分</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setMyRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= myRating ? "star" : "star-outline"}
              size={28}
              color={star <= myRating ? "#FFD700" : theme.colors.gray300}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // 渲染评论输入区域
  const renderReviewInput = () => {
    if (!imageId) {
      return null;
    }

    if (!showReviewInput && !userReview) {
      return (
        <View style={styles.reviewSection}>
          <TouchableOpacity
            style={styles.addReviewButton}
            onPress={() => {
              if (!user?.userId) {
                Alert.show("请先登录");
                return;
              }
              setShowReviewInput(true);
            }}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={theme.colors.black}
            />
            <Text style={styles.addReviewButtonText}>写评论</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (userReview && !showReviewInput) {
      // 显示用户已有的评论
      return (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>我的评论</Text>
          <View style={styles.myReviewCard}>
            <View style={styles.myReviewHeader}>
              <View style={styles.myReviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= userReview.rating ? "star" : "star-outline"}
                    size={16}
                    color={
                      star <= userReview.rating
                        ? "#FFD700"
                        : theme.colors.gray300
                    }
                  />
                ))}
              </View>
              <Text style={styles.myReviewDate}>
                {new Date(userReview.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.myReviewContent}>{userReview.content}</Text>
            <View style={styles.myReviewActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowReviewInput(true)}
              >
                <Text style={styles.editButtonText}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteReview}
                disabled={submitLoading}
              >
                <Text style={styles.deleteButtonText}>
                  {submitLoading ? "删除中..." : "删除"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // 显示评论输入表单
    return (
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>
          {userReview ? "编辑评论" : "发表评论"}
        </Text>
        {renderRatingSelector()}
        <TextInput
          style={styles.reviewInput}
          placeholder="分享你对这个造型的看法..."
          placeholderTextColor={theme.colors.gray400}
          value={myContent}
          onChangeText={setMyContent}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{myContent.length}/500</Text>
        <View style={styles.reviewInputActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowReviewInput(false);
              if (userReview) {
                setMyRating(userReview.rating);
                setMyContent(userReview.content);
              } else {
                setMyRating(0);
                setMyContent("");
              }
            }}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (myRating === 0 ||
                myContent.trim().length < 5 ||
                submitLoading) &&
              styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitReview}
            disabled={
              myRating === 0 || myContent.trim().length < 5 || submitLoading
            }
          >
            <Text style={styles.submitButtonText}>
              {submitLoading ? "提交中..." : "提交"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染评论列表
  const renderReviewsList = () => {
    if (!imageId) {
      return null;
    }

    const otherReviews = reviews.filter((r) => r.userId !== user?.userId);

    if (reviewsLoading) {
      return (
        <View style={styles.reviewsLoading}>
          <ActivityIndicator size="small" color={theme.colors.gray400} />
          <Text style={styles.reviewsLoadingText}>加载评论中...</Text>
        </View>
      );
    }

    if (otherReviews.length === 0) {
      return (
        <View style={styles.noReviews}>
          <Ionicons
            name="chatbubble-outline"
            size={32}
            color={theme.colors.gray300}
          />
          <Text style={styles.noReviewsText}>暂无其他评论</Text>
          <Text style={styles.noReviewsSubtext}>成为第一个评论的人吧</Text>
        </View>
      );
    }

    return (
      <View style={styles.reviewsList}>
        <Text style={styles.reviewsListTitle}>
          全部评论 ({otherReviews.length})
        </Text>
        {otherReviews.map((review) => (
          <View key={review.id} style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewUser}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>
                    {review.username?.charAt(0)?.toUpperCase() || "U"}
                  </Text>
                </View>
                <Text style={styles.reviewUsername}>{review.username}</Text>
              </View>
              <View style={styles.reviewRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= review.rating ? "star" : "star-outline"}
                    size={12}
                    color={
                      star <= review.rating ? "#FFD700" : theme.colors.gray300
                    }
                  />
                ))}
              </View>
            </View>
            <Text style={styles.reviewContent}>{review.content}</Text>
            <Text style={styles.reviewDate}>
              {new Date(review.createdAt).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRelatedSection = () => (
    <View style={styles.relatedSection}>
      <Text style={styles.relatedTitle}>相关推荐</Text>
      <Text style={styles.relatedSubtitle}>探索更多精彩造型</Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.exploreButtonText}>返回浏览更多</Text>
        <Ionicons name="arrow-forward" size={16} color={theme.colors.gray600} />
      </TouchableOpacity>
    </View>
  );

  const renderImageModal = () => (
    <Modal
      visible={isImageModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseImageModal}
    >
      <StatusBar hidden={true} />
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={handleCloseImageModal}
          activeOpacity={1}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseImageModal}
            >
              <Ionicons name="close" size={28} color={theme.colors.white} />
            </TouchableOpacity>
            <Image
              source={{ uri: currentLook.image }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderImage()}
          {renderLookInfo()}
        </ScrollView>
      </KeyboardAvoidingView>
      {renderImageModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  errorContainer: {
    flex: 1,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBackButton: {
    padding: 8,
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray500,
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.black,
    borderRadius: 8,
  },
  errorButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: "relative",
    height: screenWidth * 1.5, // Increased height for bigger image impact
    width: screenWidth,
  },
  mainImage: {
    width: screenWidth,
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
  },
  shareButton: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
  },
  imageActions: {
    position: "absolute",
    bottom: 20,
    right: 20,
    display: "none", // Hide image actions
  },
  likeButton: {
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 25,
  },
  infoContainer: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 4,
  },
  brand: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  collection: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
  },
  statsSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.gray100,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  likeActionButton: {
    borderColor: theme.colors.gray600,
    backgroundColor: theme.colors.white,
  },
  likedActionButton: {
    backgroundColor: "#ff4757",
    borderColor: "#ff4757",
  },
  shareActionButton: {
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  likedActionButtonText: {
    color: theme.colors.white,
  },
  shareActionButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  relatedSection: {
    padding: 20,
    backgroundColor: theme.colors.gray500,
    alignItems: "center",
  },
  relatedTitle: {
    fontSize: 20,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 4,
  },
  relatedSubtitle: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginBottom: 16,
  },
  exploreButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray600,
  },
  exploreButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  // 评论相关样式
  reviewSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 16,
  },
  addReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: theme.colors.gray100,
    borderRadius: 8,
    gap: 8,
  },
  addReviewButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  ratingSelector: {
    marginBottom: 16,
  },
  ratingSelectorLabel: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
    textAlign: "right",
    marginTop: 4,
  },
  reviewInputActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  submitButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  // 我的评论卡片
  myReviewCard: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    padding: 16,
  },
  myReviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  myReviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  myReviewDate: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
  },
  myReviewContent: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 20,
    marginBottom: 12,
  },
  myReviewActions: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.gray200,
  },
  editButtonText: {
    fontSize: 13,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    fontSize: 13,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: "#ff4757",
  },
  // 评论列表
  reviewsLoading: {
    padding: 20,
    alignItems: "center",
  },
  reviewsLoadingText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
    marginTop: 8,
  },
  noReviews: {
    padding: 40,
    alignItems: "center",
  },
  noReviewsText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray400,
    marginTop: 12,
  },
  noReviewsSubtext: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray300,
    marginTop: 4,
  },
  reviewsList: {
    padding: 20,
    paddingTop: 0,
  },
  reviewsListTitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 16,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAvatarText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Bold",
    color: theme.colors.gray600,
  },
  reviewUsername: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  reviewRating: {
    flexDirection: "row",
    gap: 2,
  },
  reviewContent: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
  },
});

export default LookDetailScreen;
