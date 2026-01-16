import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, Modal } from "react-native";
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
import LookGridSelector, { SelectedLook } from "../components/LookGridSelector";
import PublishButtons from "../components/PublishButtons";
import ImagePickerModal from "../components/ImagePickerModal";
import { postService } from "../services/postService";
import { useAuthStore } from "../store/authStore";
import showsData from "../data/shows.json";

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
  const [selectedLooks, setSelectedLooks] = useState<SelectedLook[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [showLookSelector, setShowLookSelector] = useState(false);
  const [showLookPreview, setShowLookPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewLook, setPreviewLook] = useState<SelectedLook | null>(null);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [displayCount, setDisplayCount] = useState(20); // 当前显示的秀数量

  const MAX_IMAGES = 6;
  const MAX_LOOKS = 6;

  // 加载秀场数据
  useEffect(() => {
    const shows: Show[] = (showsData as any[]).map((show) => ({
      designer: show.designer,
      season: show.season,
      title: show.title,
      cover_image: show.cover_image,
      show_url: show.show_url,
      year: show.year,
      category: show.category,
    }));
    setAllShows(shows);
  }, []);

  // 根据搜索词过滤秀场
  const filteredShows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allShows.slice(0, displayCount);
    }
    return allShows.filter(
      (show) =>
        show.designer.toLowerCase().includes(query) ||
        show.season.toLowerCase().includes(query) ||
        show.category.toLowerCase().includes(query)
    );
  }, [allShows, searchQuery, displayCount]);

  const hasMoreShows = !searchQuery.trim() && displayCount < allShows.length;

  // 加载更多秀场
  const handleLoadMoreShows = () => {
    if (searchQuery.trim() || isLoadingShows) {
      return;
    }
    if (displayCount >= allShows.length) {
      return;
    }
    setIsLoadingShows(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + 20, allShows.length));
      setIsLoadingShows(false);
    }, 300);
  };

  // 选择秀场
  const handleSelectShow = (show: Show) => {
    if (selectedLooks.length >= MAX_LOOKS) {
      Alert.show("提示: 最多只能关联" + MAX_LOOKS + "个秀场");
      return;
    }

    // 检查是否已经添加过相同的秀
    const isDuplicate = selectedLooks.some(
      (item) => item.designer === show.designer && item.season === show.season
    );

    if (isDuplicate) {
      Alert.show("提示: 该秀场已经添加过了");
      return;
    }

    // 将 Show 转换为 SelectedLook 格式
    const selectedLook: SelectedLook = {
      id: 0, // 秀场没有 id，使用 0
      designer: show.designer,
      season: show.season,
      imageUrl: show.cover_image,
    };

    setSelectedLooks([...selectedLooks, selectedLook]);
    setShowLookSelector(false);
    Alert.show("已关联秀场", "", 1500);
  };

  // 检查是否满足发布标准
  const canPublish = () => {
    return (
      title.trim().length > 0 &&
      productName.trim().length > 0 &&
      rating > 0 &&
      images.length > 0 &&
      selectedLooks.length > 0 &&
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
      // 过滤掉无效的 showImageIds (id 为 0 表示来自本地数据，没有数据库 ID)
      const showImageIds = selectedLooks
        .map((look) => look.id)
        .filter((id) => id > 0);
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
        showImageIds: showImageIds.length > 0 ? showImageIds : undefined,
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
      selectedLooks.length === 0
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
      // 过滤掉无效的 showImageIds (id 为 0 表示来自本地数据，没有数据库 ID)
      const showImageIds = selectedLooks
        .map((look) => look.id)
        .filter((id) => id > 0);
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
        showImageIds: showImageIds.length > 0 ? showImageIds : undefined,
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
    setSelectedLooks([]);
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

  const handleRemoveLook = (index: number) => {
    const newLooks = selectedLooks.filter((_, i) => i !== index);
    setSelectedLooks(newLooks);
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
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
        <LookGridSelector
          selectedLooks={selectedLooks}
          onLookPress={(look) => {
            setPreviewLook(look);
            setShowLookPreview(true);
          }}
          onRemoveLook={handleRemoveLook}
          onAddLook={() => setShowLookSelector(true)}
          maxLooks={MAX_LOOKS}
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

      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
      />

      <ImagePreviewModal
        visible={showLookPreview}
        imageUrl={previewLook?.imageUrl || ""}
        title={previewLook?.designer}
        subtitle={previewLook?.season}
        onClose={() => setShowLookPreview(false)}
      />

      <ImagePreviewModal
        visible={showImagePreview}
        imageUrls={images}
        initialIndex={previewImageIndex}
        title=""
        onClose={() => setShowImagePreview(false)}
      />

      <ShowSelectorModal
        visible={showLookSelector}
        shows={filteredShows}
        searchQuery={searchQuery}
        isLoading={isLoadingShows}
        hasMore={hasMoreShows}
        onSearchChange={setSearchQuery}
        onSelectShow={handleSelectShow}
        onClose={() => setShowLookSelector(false)}
        onLoadMore={handleLoadMoreShows}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});

export default PublishReviewScreen;
