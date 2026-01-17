import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Modal,
  Image as RNImage,
  Dimensions,
  FlatList,
  View,
} from "react-native";
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
  Image,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageEditMenu from "../components/ImageEditMenu";
import ImageCropper from "../components/ImageCropper";
import LookGridSelector, { SelectedLook } from "../components/LookGridSelector";
import ShowSelectorModal, { Show } from "../components/ShowSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import { saveDraft } from "../services/draftService";
import { postService } from "../services/postService";
import { showService, Show as ShowFromApi } from "../services/showService";
import { useAuthStore } from "../store/authStore";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PAGE_SIZE = 30;

const PublishOutfitScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedLooks, setSelectedLooks] = useState<SelectedLook[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageEditMenu, setShowImageEditMenu] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);

  const [showLookSelector, setShowLookSelector] = useState(false);
  const [showLookPreview, setShowLookPreview] = useState(false);
  const [previewLook, setPreviewLook] = useState<SelectedLook | null>(null);

  // 秀场数据和分页状态
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [showsPage, setShowsPage] = useState(1);
  const [hasMoreShows, setHasMoreShows] = useState(true);
  const [totalShows, setTotalShows] = useState(0);
  const isLoadingMoreRef = useRef(false);

  const previewFlatListRef = useRef<FlatList>(null);

  const MAX_IMAGES = 9;
  const MAX_LOOKS = 6;

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
    if (selectedLooks.length >= MAX_LOOKS) {
      Alert.show("提示: 最多只能关联" + MAX_LOOKS + "个秀场");
      return;
    }

    // 检查是否已经添加过相同的秀
    const isDuplicate = selectedLooks.some(
      (item) => item.brand === show.brand && item.season === show.season
    );

    if (isDuplicate) {
      Alert.show("提示: 该秀场已经添加过了");
      return;
    }

    // 将 Show 转换为 SelectedLook 格式
    const selectedLook: SelectedLook = {
      id: 0, // 本地数据没有数据库 ID，使用 0
      brand: show.brand,
      season: show.season,
      imageUrl: show.cover_image,
      showId: show.show_id, // 数据库秀场 ID，用于关联帖子
      showUrl: show.show_url, // 仅用于按钮点击跳转链接
    };

    setSelectedLooks([...selectedLooks, selectedLook]);
    setShowLookSelector(false);
    Alert.show("已关联秀场", "", 1500);
  };

  // 检查是否满足发布标准
  const canPublish = () => {
    return (
      title.trim().length > 0 &&
      description.trim().length > 0 &&
      images.length > 0 &&
      selectedLooks.length > 0
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
      const showIds = selectedLooks
        .map((look) => look.showId)
        .filter((id): id is number => id !== undefined);

      await postService.createPost({
        userId: user.userId,
        postType: "DAILY_SHARE",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: description.trim(),
        imageUrls: uploadedUrls,
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
      !description &&
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
      // 获取所有关联秀场的 showIds
      const showIds = selectedLooks
        .map((look) => look.showId)
        .filter((id): id is number => id !== undefined);

      await postService.createPost({
        userId: user.userId,
        postType: "DAILY_SHARE",
        postStatus: "DRAFT",
        title: title.trim() || "搭配草稿",
        contentText: description.trim(),
        imageUrls: uploadedUrls,
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
    setDescription("");
    setImages([]);
    setCoverImage(null);
    setSelectedTags([]);
    setSelectedLooks([]);
    setCurrentImageIndex(0);
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

  const handleImagePress = (index: number) => {
    setSelectedImageUri(images[index]);
    setSelectedImageIndex(index);
    setShowImageEditMenu(true);
  };

  const handleEditImage = async () => {
    setShowImageEditMenu(false);
    if (selectedImageIndex !== null && selectedImageUri) {
      setCropperImageUri(selectedImageUri);
      setShowImageCropper(true);
    }
  };

  const handleSetCover = () => {
    setShowImageEditMenu(false);
    if (selectedImageUri && selectedImageIndex !== null) {
      // 设置为封面
      setCoverImage(selectedImageUri);

      // 如果不是第一张，移动到第一位
      if (selectedImageIndex !== 0) {
        const newImages = [...images];
        const [movedImage] = newImages.splice(selectedImageIndex, 1);
        newImages.unshift(movedImage);
        setImages(newImages);
        setCurrentImageIndex(0);
      }

      Alert.show("设置成功: 已将此图片设为封面");
    }
  };

  const handleDeleteImage = () => {
    setShowImageEditMenu(false);

    if (selectedImageIndex !== null) {
      const imageToRemove = images[selectedImageIndex];
      const newImages = images.filter(
        (_, index) => index !== selectedImageIndex
      );
      setImages(newImages);

      if (coverImage === imageToRemove) {
        setCoverImage(newImages.length > 0 ? newImages[0] : null);
      }

      Alert.show("删除成功: 图片已删除");
    }

    setSelectedImageUri(null);
    setSelectedImageIndex(null);
  };

  const handleCloseEditMenu = () => {
    setShowImageEditMenu(false);
    setSelectedImageUri(null);
    setSelectedImageIndex(null);
  };

  const handleDragStart = (index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedIndex(null);
  };

  const handleCropDone = (croppedUri: string) => {
    setShowImageCropper(false);

    RNImage.getSize(
      croppedUri,
      (width, height) => {
        setImageDimensions((prev) => ({
          ...prev,
          [croppedUri]: { width, height },
        }));

        if (selectedImageIndex !== null) {
          const newImages = [...images];
          newImages[selectedImageIndex] = croppedUri;
          setImages(newImages);

          if (coverImage === selectedImageUri) {
            setCoverImage(croppedUri);
          }

          Alert.show("编辑成功", "", 1500);
          setSelectedImageUri(null);
          setSelectedImageIndex(null);
        } else {
          const newImages = [...images, croppedUri];
          setImages(newImages);

          if (!coverImage) {
            setCoverImage(croppedUri);
          }
          Alert.show("图片已添加", "", 1500);
        }

        setCropperImageUri(null);
      },
      (error) => {
        console.error("Failed to get image size:", error);
        if (selectedImageIndex !== null) {
          const newImages = [...images];
          newImages[selectedImageIndex] = croppedUri;
          setImages(newImages);
          if (coverImage === selectedImageUri) {
            setCoverImage(croppedUri);
          }
          setSelectedImageUri(null);
          setSelectedImageIndex(null);
        } else {
          const newImages = [...images, croppedUri];
          setImages(newImages);
          if (!coverImage) {
            setCoverImage(croppedUri);
          }
        }
        setCropperImageUri(null);
      }
    );
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    setCropperImageUri(null);
    setSelectedImageUri(null);
    setSelectedImageIndex(null);
  };

  const handleRemoveLook = (index: number) => {
    const newLooks = selectedLooks.filter((_, i) => i !== index);
    setSelectedLooks(newLooks);
    Alert.show("已取消关联");
  };

  const previewHeight = useMemo(() => {
    if (!coverImage || !imageDimensions[coverImage]) {
      return 300;
    }

    const { width, height } = imageDimensions[coverImage];
    const aspectRatio = width / height;
    const containerWidth = SCREEN_WIDTH - 32;
    const calculatedHeight = containerWidth / aspectRatio;

    return Math.min(Math.max(calculatedHeight, 200), 500);
  }, [coverImage, imageDimensions]);

  const renderPreviewSection = () => {
    if (images.length === 0) {
      return (
        <Box h={300} mx="$md" my="$md">
          <Pressable
            flex={1}
            rounded="$md"
            overflow="hidden"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            onPress={handleAddImage}
          >
            <Ionicons
              name="shirt-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text color="$gray500" mt="$sm">
              点击添加搭配图片
            </Text>
          </Pressable>
        </Box>
      );
    }

    return (
      <Box h={previewHeight} mx="$md" my="$md" position="relative">
        <FlatList
          ref={previewFlatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item}-${index}`}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32)
            );
            setCurrentImageIndex(index);
          }}
          renderItem={({ item }) => {
            return (
              <View
                style={{
                  width: SCREEN_WIDTH - 32,
                  height: previewHeight,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: "transparent",
                }}
              >
                <Image
                  source={{ uri: item }}
                  style={{
                    width: "100%",
                    height: "100%",
                    resizeMode: "cover",
                  }}
                />
              </View>
            );
          }}
        />

        {images.length > 1 && (
          <Box
            position="absolute"
            bottom={12}
            left={0}
            right={0}
            flexDirection="row"
            justifyContent="center"
            alignItems="center"
            gap="$xs"
          >
            {images.map((_, index) => (
              <Box
                key={index}
                w={currentImageIndex === index ? 20 : 6}
                h={6}
                rounded="$full"
                bg={
                  currentImageIndex === index
                    ? "$white"
                    : "rgba(255,255,255,0.5)"
                }
              />
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderImageGallery = () => (
    <Box mx="$md" mb="$md">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((image, index) => (
          <Pressable
            key={`${image}-${index}`}
            w={60}
            h={60}
            rounded="$sm"
            mr="$sm"
            overflow="hidden"
            borderWidth={coverImage === image ? 2 : 0}
            borderColor="$black"
            opacity={draggedIndex === index ? 0.5 : 1}
            onPress={() => handleImagePress(index)}
            onLongPress={() => handleDragStart(index)}
          >
            <Image source={{ uri: image }} style={styles.thumbnail} />
            {coverImage === image && (
              <Box
                position="absolute"
                bottom={2}
                left={2}
                right={2}
                bg="rgba(0,0,0,0.7)"
                rounded="$sm"
                py={2}
                alignItems="center"
              >
                <Text color="$white" fontSize={10} fontWeight="$medium">
                  封面
                </Text>
              </Box>
            )}
          </Pressable>
        ))}
        {images.length < MAX_IMAGES && (
          <Pressable
            w={60}
            h={60}
            rounded="$sm"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            mr="$sm"
            onPress={handleAddImage}
          >
            <Ionicons name="add" size={24} color={theme.colors.gray400} />
          </Pressable>
        )}
      </ScrollView>
      {images.length > 1 && (
        <Text color="$gray400" fontSize="$xs" textAlign="center" mt="$xs">
          点击图片进入编辑器，长按可拖拽调整顺序
        </Text>
      )}
    </Box>
  );

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
        title="分享搭配"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {renderPreviewSection()}
        {images.length > 0 && renderImageGallery()}

        <Box mx="$md" mb="$md">
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
            placeholder="分享您的搭配灵感和穿搭心得"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="outline"
            sx={{
              fontSize: 18,
              fontWeight: "500",
              minHeight: 50,
              textAlignVertical: "top",
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </Box>

        <Box mx="$md" mb="$md">
          <HStack mb="$sm" alignItems="center">
            <Text color="$gray600" fontSize="$sm">
              搭配详情
            </Text>
            <Text color="$red500" fontSize="$sm" ml="$xs">
              *
            </Text>
          </HStack>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="详细描述您的搭配..."
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="outline"
            sx={{
              color: theme.colors.gray600,
              minHeight: 80,
              textAlignVertical: "top",
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </Box>

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
        title={previewLook?.brand}
        subtitle={previewLook?.season}
        onClose={() => setShowLookPreview(false)}
      />

      <ShowSelectorModal
        visible={showLookSelector}
        shows={filteredShows}
        searchQuery={searchQuery}
        isLoading={isLoadingShows}
        hasMore={hasMoreShows && !searchQuery.trim()}
        onSearchChange={setSearchQuery}
        onSelectShow={handleSelectShow}
        onClose={() => setShowLookSelector(false)}
        onLoadMore={loadMoreShows}
      />

      {selectedImageUri && (
        <ImageEditMenu
          visible={showImageEditMenu}
          imageUri={selectedImageUri}
          isCover={selectedImageUri === coverImage}
          onClose={handleCloseEditMenu}
          onEdit={handleEditImage}
          onSetCover={handleSetCover}
          onDelete={handleDeleteImage}
        />
      )}
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
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});

export default PublishOutfitScreen;
