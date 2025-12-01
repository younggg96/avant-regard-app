import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Image as RNImage,
  Dimensions,
  ActivityIndicator,
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
  Image,
  Input,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageEditMenu from "../components/ImageEditMenu";
import ImageCropper from "../components/ImageCropper";
import ImageGallery from "../components/ImageGallery";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { postService } from "../services/postService";
import { useAuthStore } from "../store/authStore";

const SCREEN_WIDTH = Dimensions.get("window").width;

const PublishLookbookScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
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
  // 移动模式：长按选中图片，点击另一张交换位置
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderFromIndex, setReorderFromIndex] = useState<number | null>(null);

  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);

  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

  const MAX_IMAGES = 9;

  // 检查表单是否完整（用于禁用发布按钮）
  const canPublish = (): boolean => {
    return (
      images.length > 0 &&
      title.trim().length > 0 &&
      description.trim().length > 0
    );
  };

  const validateForm = (): boolean => {
    if (images.length === 0) {
      Alert.show("提示: Lookbook需要至少上传一张图片");
      return false;
    }
    if (!title.trim()) {
      Alert.show("提示: 请填写Lookbook标题");
      return false;
    }
    if (!description.trim()) {
      Alert.show("提示: 请填写Lookbook简介");
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validateForm()) {
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
      await postService.createPost({
        userId: user.userId,
        postType: "OUTFIT",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: description.trim(),
        imageUrls: uploadedUrls,
      });

      setUploadProgress(null);
      Alert.show("发布成功！", "", 1500);
      setTimeout(() => {
        resetForm();
        // 跳转到 Discover 页面
        (navigation as any).reset({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "Discover" } }],
        });
      }, 1500);
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

    // 草稿至少需要有图片或标题
    if (images.length === 0 && !title.trim()) {
      Alert.show("请至少添加一张图片或填写标题");
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
      await postService.createPost({
        userId: user.userId,
        postType: "LOOKBOOK",
        postStatus: "DRAFT",
        title: title.trim() || "未命名草稿",
        contentText: description.trim(),
        imageUrls: uploadedUrls,
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

  // 点击图片预览
  const handleImagePress = (index: number) => {
    setPreviewInitialIndex(index);
    setShowImagePreview(true);
  };

  // 长按图片打开编辑菜单
  const handleImageLongPress = (index: number) => {
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

  // 长按进入移动模式
  const handleEnterReorderMode = (index: number) => {
    if (isReorderMode && reorderFromIndex === index) {
      // 再次长按同一张图片，退出移动模式
      handleExitReorderMode();
      return;
    }
    setIsReorderMode(true);
    setReorderFromIndex(index);
    Alert.show("已选中，点击其他图片交换位置", "", 1500);
  };

  // 退出移动模式
  const handleExitReorderMode = () => {
    setIsReorderMode(false);
    setReorderFromIndex(null);
  };

  // 处理移动模式下的点击（交换位置）
  const handleReorderTap = (toIndex: number) => {
    if (!isReorderMode || reorderFromIndex === null) return;

    if (reorderFromIndex === toIndex) {
      // 点击自己，打开编辑菜单
      handleExitReorderMode();
      handleImageLongPress(toIndex);
      return;
    }

    // 交换两张图片的位置
    const newImages = [...images];
    const temp = newImages[reorderFromIndex];
    newImages[reorderFromIndex] = newImages[toIndex];
    newImages[toIndex] = temp;
    setImages(newImages);

    // 更新封面（如果封面是被移动的图片）
    if (coverImage === images[reorderFromIndex]) {
      setCoverImage(newImages[toIndex]);
    } else if (coverImage === images[toIndex]) {
      setCoverImage(newImages[reorderFromIndex]);
    }

    Alert.show("位置已调换", "", 1000);
    handleExitReorderMode();
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
              name="image-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text color="$gray500" mt="$sm">
              点击添加图片
            </Text>
          </Pressable>
        </Box>
      );
    }

    return (
      <ImageGallery
        images={images}
        imageHeight={previewHeight}
        showThumbnails={false}
        showFullscreenOnPress={false}
        onImagePress={(index) => handleImagePress(index)}
      />
    );
  };

  const renderImageGallery = () => (
    <Box mx="$md" mb="$md" mt="$md">
      <Box h={60}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ alignItems: "center" }}
        >
          {images.map((image, index) => {
            const isSelected = isReorderMode && reorderFromIndex === index;
            const isCover = coverImage === image;

            return (
              <Pressable
                key={`thumbnail-${index}`}
                w={60}
                h={60}
                rounded="$sm"
                mr="$sm"
                overflow="hidden"
                borderWidth={isSelected ? 3 : isCover ? 2 : 0}
                borderColor={isSelected ? "$accent" : "$black"}
                opacity={isSelected ? 0.8 : 1}
                onPress={() => {
                  if (isReorderMode) {
                    handleReorderTap(index);
                  } else {
                    handleImageLongPress(index);
                  }
                }}
                onLongPress={() => handleEnterReorderMode(index)}
              >
                <Image source={{ uri: image }} style={styles.thumbnail} />

                {/* 选中状态指示器 */}
                {isSelected && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bg="rgba(0,0,0,0.3)"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons name="swap-horizontal" size={24} color="white" />
                  </Box>
                )}

                {/* 封面标签 */}
                {isCover && !isSelected && (
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
            );
          })}

          {/* 添加图片按钮 */}
          {images.length < MAX_IMAGES && (
            <Pressable
              w={60}
              h={60}
              rounded="$sm"
              bg="$gray100"
              alignItems="center"
              justifyContent="center"
              mr="$sm"
              onPress={() => {
                if (isReorderMode) {
                  handleExitReorderMode();
                }
                handleAddImage();
              }}
            >
              <Ionicons name="add" size={24} color={theme.colors.gray400} />
            </Pressable>
          )}
        </ScrollView>
      </Box>

      {/* 提示文字 */}
      {images.length > 1 && (
        <Text
          color={isReorderMode ? "$accent" : "$gray400"}
          fontSize="$xs"
          textAlign="center"
          mt="$xs"
          fontWeight={isReorderMode ? "$medium" : "$normal"}
        >
          {isReorderMode
            ? "点击其他图片交换位置，或点击 + 取消"
            : "点击缩略图编辑，长按调整顺序"}
        </Text>
      )}
    </Box>
  );

  if (showImageCropper && cropperImageUri) {
    return (
      <ImageCropper
        sourceUri={cropperImageUri}
        aspect="1:1"
        onCancel={handleCropCancel}
        onDone={handleCropDone}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="发布Lookbook"
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
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="请输入您的 Lookbook 标题（例：2025 我的春夏穿搭合集）"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="filled"
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
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="请简单介绍您的 Lookbook 灵感或主题"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="filled"
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

      <ImagePreviewModal
        visible={showImagePreview}
        imageUrls={images}
        initialIndex={previewInitialIndex}
        title={title || "Lookbook 预览"}
        onClose={() => setShowImagePreview(false)}
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
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});

export default PublishLookbookScreen;
