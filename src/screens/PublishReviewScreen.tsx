import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Modal, Platform, KeyboardAvoidingView } from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  HStack,
  Input,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageCropper from "../components/ImageCropper";
import ShowSelectorModal, { Show } from "../components/ShowSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import RatingSelector from "../components/RatingSelector";
import ImageGridSelector from "../components/ImageGridSelector";
import ShowGridSelector, { SelectedShow } from "../components/ShowGridSelector";
import PublishButtons from "../components/PublishButtons";
import ImagePickerModal from "../components/ImagePickerModal";
import { postService } from "../services/postService";
import { showService, Show as ShowFromApi } from "../services/showService";
import { useAuthStore } from "../store/authStore";

const PAGE_SIZE = 30;

const PublishReviewScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedShows, setSelectedShows] = useState<SelectedShow[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewShow, setPreviewShow] = useState<SelectedShow | null>(null);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);

  // 秀场数据和分页状态
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [showsPage, setShowsPage] = useState(1);
  const [hasMoreShows, setHasMoreShows] = useState(true);
  const [totalShows, setTotalShows] = useState(0);
  const isLoadingMoreRef = useRef(false);

  const MAX_IMAGES = 6;
  const MAX_SHOWS = 6;

  // 加载秀场数据（从 API）
  const loadShows = useCallback(async (reset: boolean = true) => {
    if (isLoadingMoreRef.current && !reset) return;

    try {
      if (reset) {
        setIsLoadingShows(true);
        setShowsPage(1);
        setHasMoreShows(true);
      }
      isLoadingMoreRef.current = true;

      const response = await showService.getShows({
        page: reset ? 1 : showsPage,
        pageSize: PAGE_SIZE,
      });

      const shows: Show[] = response.shows.map((show: ShowFromApi) => ({
        brand: show.brand || "",
        season: show.season,
        title: show.title || show.brand || "",
        cover_image: show.coverImage || "",
        show_url: show.showUrl || "",
        year: show.year || 0,
        category: show.category || "",
        show_id: show.id,
      }));

      if (reset) {
        setAllShows(shows);
        setShowsPage(1);
      } else {
        setAllShows((prev) => [...prev, ...shows]);
      }

      setTotalShows(response.total);
      setHasMoreShows(shows.length >= PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load shows:", error);
      if (reset) {
        Alert.show("加载秀场数据失败");
      }
    } finally {
      setIsLoadingShows(false);
      isLoadingMoreRef.current = false;
    }
  }, [showsPage]);

  // 加载更多秀场
  const loadMoreShows = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreShows || isLoadingShows || searchQuery.trim()) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingShows(true);

    try {
      const nextPage = showsPage + 1;
      const response = await showService.getShows({
        page: nextPage,
        pageSize: PAGE_SIZE,
      });

      const shows: Show[] = response.shows.map((show: ShowFromApi) => ({
        brand: show.brand || "",
        season: show.season,
        title: show.title || show.brand || "",
        cover_image: show.coverImage || "",
        show_url: show.showUrl || "",
        year: show.year || 0,
        category: show.category || "",
        show_id: show.id,
      }));

      if (shows.length > 0) {
        setAllShows((prev) => [...prev, ...shows]);
        setShowsPage(nextPage);
        setHasMoreShows(shows.length >= PAGE_SIZE);
      } else {
        setHasMoreShows(false);
      }
    } catch (error) {
      console.error("Failed to load more shows:", error);
    } finally {
      setIsLoadingShows(false);
      isLoadingMoreRef.current = false;
    }
  }, [showsPage, hasMoreShows, isLoadingShows, searchQuery]);

  useEffect(() => {
    loadShows(true);
  }, []);

  // 根据搜索词过滤秀场
  const filteredShows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allShows;
    }
    return allShows.filter(
      (show) =>
        show.brand.toLowerCase().includes(query) ||
        show.season.toLowerCase().includes(query) ||
        show.category.toLowerCase().includes(query)
    );
  }, [allShows, searchQuery]);

  // 选择秀场
  const handleSelectShow = (show: Show) => {
    if (selectedShows.length >= MAX_SHOWS) {
      Alert.show("提示: 最多只能关联" + MAX_SHOWS + "个秀场");
      return;
    }

    // 检查是否已经添加过相同的秀
    const isDuplicate = selectedShows.some(
      (item) => item.brand === show.brand && item.season === show.season
    );

    if (isDuplicate) {
      Alert.show("提示: 该秀场已经添加过了");
      return;
    }

    // 将 Show 转换为 SelectedShow 格式
    const selectedShow: SelectedShow = {
      id: 0, // 本地数据没有数据库 ID，使用 0
      brand: show.brand,
      season: show.season,
      imageUrl: show.cover_image,
      showId: show.show_id, // 数据库秀场 ID，用于关联帖子
      showUrl: show.show_url, // 仅用于按钮点击跳转链接
    };

    setSelectedShows([...selectedShows, selectedShow]);
    setShowSelector(false);
    Alert.show("已关联秀场", "", 1500);
  };

  // 检查是否满足发布标准
  const canPublish = () => {
    return (
      title.trim().length > 0 &&
      productName.trim().length > 0 &&
      rating > 0 &&
      images.length > 0 &&
      selectedShows.length > 0 &&
      reviewText.trim().length >= 10 &&
      reviewText.trim().length <= 500
    );
  };

  const handlePublish = async () => {
    if (!canPublish()) {
      Alert.show("提示: 请完成所有必填项");
      return;
    }

    if (!user?.userId) {
      Alert.show("请先登录");
      return;
    }

    setIsPublishing(true);
    try {
      // 1. 先上传所有图片
      setUploadProgress(`上传图片 0/${images.length}`);
      const uploadedUrls = await postService.uploadImages(
        images,
        (completed, total) => {
          setUploadProgress(`上传图片 ${completed}/${total}`);
        }
      );

      // 2. 创建帖子
      setUploadProgress("正在发布...");
      // 获取所有关联秀场的 showIds
      const showIds = selectedShows
        .map((show) => show.showId)
        .filter((id): id is number => id !== undefined);

      await postService.createPost({
        userId: user.userId,
        postType: "ITEM_REVIEW",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: reviewText.trim(),
        imageUrls: uploadedUrls,
        productName: productName.trim(),
        brandName: brand.trim(),
        rating: rating,
        showIds: showIds,
      });

      setUploadProgress(null);
      Alert.show("发布成功！", "", 2000);
      setTimeout(() => {
        resetForm();
        (navigation as any).reset({
          index: 0,
          routes: [{ name: "Main", params: { screen: "Home" } }],
        });
      }, 2000);
    } catch (error) {
      console.error("Publish error:", error);
      Alert.show(error instanceof Error ? error.message : "发布失败，请重试");
    } finally {
      setIsPublishing(false);
      setUploadProgress(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.userId) {
      Alert.show("请先登录");
      return;
    }

    // 验证是否有内容可以保存
    if (
      !title &&
      !productName &&
      images.length === 0 &&
      selectedShows.length === 0
    ) {
      Alert.show("提示: 请至少填写一些内容再保存草稿");
      return;
    }

    setIsSavingDraft(true);
    try {
      let uploadedUrls: string[] = [];

      // 如果有图片，先上传
      if (images.length > 0) {
        setUploadProgress(`上传图片 0/${images.length}`);
        uploadedUrls = await postService.uploadImages(
          images,
          (completed, total) => {
            setUploadProgress(`上传图片 ${completed}/${total}`);
          }
        );
      }

      // 保存草稿
      setUploadProgress("正在保存...");
      // 获取所有关联秀场的 showIds
      const showIds = selectedShows
        .map((show) => show.showId)
        .filter((id): id is number => id !== undefined);

      await postService.createPost({
        userId: user.userId,
        postType: "ITEM_REVIEW",
        postStatus: "DRAFT",
        title: title.trim() || "单品评价草稿",
        contentText: reviewText.trim(),
        imageUrls: uploadedUrls,
        productName: productName.trim(),
        brandName: brand.trim(),
        rating: rating,
        showIds: showIds,
      });

      setUploadProgress(null);
      Alert.show("草稿已保存", "", 1500);
    } catch (error) {
      console.error("Save draft error:", error);
      Alert.show(error instanceof Error ? error.message : "保存失败，请重试");
    } finally {
      setIsSavingDraft(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setTitle("");
    setProductName("");
    setBrand("");
    setRating(0);
    setReviewText("");
    setImages([]);
    setSelectedTags([]);
    setSelectedShows([]);
  };

  const handleAddImage = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.show("提示: 最多只能上传" + MAX_IMAGES + "张图片");
      return;
    }
    setShowImagePicker(true);
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      let result;

      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 1.0,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setCropperImageUri(imageUri);
        setShowImageCropper(true);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    Alert.show("图片已移除");
  };

  const handleCropDone = (croppedUri: string) => {
    setShowImageCropper(false);
    const newImages = [...images, croppedUri];
    setImages(newImages);
    Alert.show("图片已添加", "", 1500);
    setCropperImageUri(null);
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    setCropperImageUri(null);
  };

  const handleRemoveShow = (index: number) => {
    const newShows = selectedShows.filter((_, i) => i !== index);
    setSelectedShows(newShows);
    Alert.show("已取消关联");
  };

  // 图片裁剪组件
  if (showImageCropper && cropperImageUri) {
    return (
      <ImageCropper
        sourceUri={cropperImageUri}
        aspect="free"
        onCancel={handleCropCancel}
        onDone={handleCropDone}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="单品评价"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Box mx="$md" mb="$md" mt="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                标题
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="为这个单品写一个标题"
              placeholderTextColor={theme.colors.gray400}
              variant="outline"
              sx={{
                fontSize: 18,
                fontWeight: "500",
                minHeight: 50,
                borderWidth: 0,
                padding: 0,
              }}
            />
          </Box>

          {/* 产品图片 */}
          <ImageGridSelector
            images={images}
            onImagePress={(index) => {
              setPreviewImageIndex(index);
              setShowImagePreview(true);
            }}
            onRemoveImage={handleRemoveImage}
            onAddImage={handleAddImage}
            maxImages={MAX_IMAGES}
            label="产品图片"
            required
          />

          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                产品名称
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={productName}
              onChangeText={setProductName}
              placeholder="输入产品名称"
              placeholderTextColor={theme.colors.gray400}
              variant="outline"
              sx={{
                fontSize: 16,
                borderWidth: 0,
                padding: 0,
              }}
            />
          </Box>

          <Box mx="$md" mb="$md">
            <Text color="$gray600" fontSize="$sm" mb="$sm">
              品牌（可选）
            </Text>
            <Input
              value={brand}
              onChangeText={setBrand}
              placeholder="输入品牌名称"
              placeholderTextColor={theme.colors.gray400}
              variant="outline"
              sx={{
                fontSize: 16,
                borderWidth: 0,
                padding: 0,
              }}
            />
          </Box>

          <RatingSelector rating={rating} onRatingChange={setRating} required />

          {/* 关联秀场 */}
          <ShowGridSelector
            selectedShows={selectedShows}
            onShowPress={(show) => {
              setPreviewShow(show);
              setShowPreview(true);
            }}
            onRemoveShow={handleRemoveShow}
            onAddShow={() => setShowSelector(true)}
            maxShows={MAX_SHOWS}
            label="关联秀场"
            required
          />

          {/* 评价内容 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                评价内容
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="请输入评价内容（至少10字，最多500字）"
              placeholderTextColor={theme.colors.gray400}
              multiline
              variant="outline"
              sx={{
                color: theme.colors.gray600,
                minHeight: 120,
                textAlignVertical: "top",
                borderWidth: 0,
                backgroundColor: "transparent",
                padding: 0,
              }}
            />
            <Text
              color={
                reviewText.trim().length < 10
                  ? "$red500"
                  : reviewText.trim().length > 500
                    ? "$red500"
                    : "$gray400"
              }
              fontSize="$xs"
              mt="$xs"
              textAlign="right"
            >
              {reviewText.trim().length}/500
              {reviewText.trim().length > 0 && reviewText.trim().length < 10
                ? " (至少需要10字)"
                : ""}
            </Text>
          </Box>
        </ScrollView>

        <PublishButtons
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          publishDisabled={!canPublish() || isPublishing || isSavingDraft}
          draftDisabled={isPublishing || isSavingDraft}
          publishButtonText={
            isPublishing ? uploadProgress || "发布中..." : "发布"
          }
          draftButtonText={
            isSavingDraft ? uploadProgress || "保存中..." : "存草稿"
          }
        />
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
      />

      <ImagePreviewModal
        visible={showPreview}
        imageUrl={previewShow?.imageUrl || ""}
        title={previewShow?.brand}
        subtitle={previewShow?.season}
        onClose={() => setShowPreview(false)}
      />

      <ImagePreviewModal
        visible={showImagePreview}
        imageUrls={images}
        initialIndex={previewImageIndex}
        title=""
        onClose={() => setShowImagePreview(false)}
      />

      <ShowSelectorModal
        visible={showSelector}
        shows={filteredShows}
        searchQuery={searchQuery}
        isLoading={isLoadingShows}
        hasMore={hasMoreShows && !searchQuery.trim()}
        onSearchChange={setSearchQuery}
        onSelectShow={handleSelectShow}
        onClose={() => setShowSelector(false)}
        onLoadMore={loadMoreShows}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});

export default PublishReviewScreen;
