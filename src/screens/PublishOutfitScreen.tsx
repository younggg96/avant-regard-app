import React, { useState, useMemo, useRef, useEffect } from "react";
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
import LookSelectorModal from "../components/LookSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import { saveDraft } from "../services/draftService";
import { postService } from "../services/postService";
import { useAuthStore } from "../store/authStore";
import {
  designerService,
  DesignerDetailDto,
} from "../services/designerService";
import localDesignersData from "../data/designers.json";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
  const [allLooks, setAllLooks] = useState<
    Array<{ id: number; designer: string; season: string; imageUrl: string }>
  >([]);
  const [designers, setDesigners] = useState<DesignerDetailDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingLooks, setIsLoadingLooks] = useState(false);
  const [loadedDesignerCount, setLoadedDesignerCount] = useState(3); // 追踪已加载的设计师数量

  const previewFlatListRef = useRef<FlatList>(null);

  const MAX_IMAGES = 9;
  const MAX_LOOKS = 6;

  // 加载设计师列表
  useEffect(() => {
    const loadDesigners = async () => {
      try {
        const data = await designerService.getAllDesignerDetails();
        if (data && data.length > 0) {
          setDesigners(data);
        } else {
          // API 返回空数据时，使用本地数据作为 fallback
          console.log("API 返回空数据，使用本地设计师数据");
          const localDesigners: DesignerDetailDto[] = localDesignersData.map(
            (d, index) => ({
              id: index + 1,
              name: d.designer,
              slug: d.designer.toLowerCase().replace(/\s+/g, "-"),
              designerUrl: d.designer_url,
              showCount: d.collections?.length || 0,
              totalImages:
                d.collections?.reduce(
                  (acc, c) => acc + (c.looks_count || 0),
                  0
                ) || 0,
              latestSeason: d.collections?.[0]?.season || "",
              followerCount: 0,
              following: false,
            })
          );
          setDesigners(localDesigners);
        }
      } catch (error) {
        console.error("Failed to load designers:", error);
        // 出错时也使用本地数据
        const localDesigners: DesignerDetailDto[] = localDesignersData.map(
          (d, index) => ({
            id: index + 1,
            name: d.designer,
            slug: d.designer.toLowerCase().replace(/\s+/g, "-"),
            designerUrl: d.designer_url,
            showCount: d.collections?.length || 0,
            totalImages:
              d.collections?.reduce(
                (acc, c) => acc + (c.looks_count || 0),
                0
              ) || 0,
            latestSeason: d.collections?.[0]?.season || "",
            followerCount: 0,
            following: false,
          })
        );
        setDesigners(localDesigners);
      }
    };

    loadDesigners();
  }, []);

  // 当搜索时加载对应设计师的造型
  useEffect(() => {
    const loadLooksForDesigner = async () => {
      // 如果没有设计师数据，先等待
      if (designers.length === 0) {
        return;
      }

      setIsLoadingLooks(true);
      try {
        if (!searchQuery.trim()) {
          // 没有搜索词时，默认加载前3个设计师的造型
          setLoadedDesignerCount(3);
          const targetDesigners = designers.slice(0, 3);
          const allLooksData = await Promise.all(
            targetDesigners.map(async (designer) => {
              try {
                const designerData =
                  await designerService.getDesignerShowAndImages(designer.id);
                return designerData.images.map((img) => ({
                  id: img.id,
                  designer: designerData.name,
                  season: designerData.shows[0]?.season || "",
                  imageUrl: img.imageUrl,
                }));
              } catch (error) {
                console.error(
                  `Failed to load looks for designer ${designer.name}:`,
                  error
                );
                return [];
              }
            })
          );
          // 合并所有造型数据
          setAllLooks(allLooksData.flat());
        } else {
          // 找到匹配的设计师
          const targetDesigner = designers.find(
            (d) =>
              d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              searchQuery.toLowerCase().includes(d.name.toLowerCase())
          );

          if (!targetDesigner) {
            setAllLooks([]);
            return;
          }

          const designerData = await designerService.getDesignerShowAndImages(
            targetDesigner.id
          );
          const looks = designerData.images.map((img) => ({
            id: img.id,
            designer: designerData.name,
            season: designerData.shows[0]?.season || "",
            imageUrl: img.imageUrl,
          }));
          setAllLooks(looks);
        }
      } catch (error) {
        console.error("Failed to load looks:", error);
        setAllLooks([]);
      } finally {
        setIsLoadingLooks(false);
      }
    };

    // 防抖处理
    const timer = setTimeout(loadLooksForDesigner, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, designers]);

  // 加载更多设计师的造型
  const handleLoadMoreLooks = async () => {
    // 如果正在搜索，不触发加载更多
    if (searchQuery.trim() || isLoadingLooks) {
      return;
    }

    // 检查是否还有更多设计师可以加载
    if (loadedDesignerCount >= designers.length) {
      return;
    }

    setIsLoadingLooks(true);
    try {
      // 加载下一个设计师
      const nextDesigner = designers[loadedDesignerCount];
      if (nextDesigner) {
        const designerData = await designerService.getDesignerShowAndImages(
          nextDesigner.id
        );
        const newLooks = designerData.images.map((img) => ({
          id: img.id,
          designer: designerData.name,
          season: designerData.shows[0]?.season || "",
          imageUrl: img.imageUrl,
        }));

        // 追加新的造型到现有列表
        setAllLooks((prevLooks) => [...prevLooks, ...newLooks]);
        setLoadedDesignerCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to load more looks:", error);
    } finally {
      setIsLoadingLooks(false);
    }
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
      const showImageIds = selectedLooks.map((look) => look.id);
      await postService.createPost({
        userId: user.userId,
        postType: "DAILY_SHARE",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: description.trim(),
        imageUrls: uploadedUrls,
        showImageIds: showImageIds,
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
      const showImageIds = selectedLooks.map((look) => look.id);
      await postService.createPost({
        userId: user.userId,
        postType: "DAILY_SHARE",
        postStatus: "DRAFT",
        title: title.trim() || "搭配草稿",
        contentText: description.trim(),
        imageUrls: uploadedUrls,
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

  const handleSelectLook = (look: SelectedLook) => {
    if (selectedLooks.length >= MAX_LOOKS) {
      Alert.show("提示: 最多只能关联" + MAX_LOOKS + "个造型");
      return;
    }

    // 检查是否已经添加过相同的 look（通过 id 判断）
    const isDuplicate = selectedLooks.some((item) => item.id === look.id);

    if (isDuplicate) {
      Alert.show("提示: 该造型已经添加过了");
      return;
    }

    setSelectedLooks([...selectedLooks, look]);
    setShowLookSelector(false);
    Alert.show("已关联造型", "", 1500);
  };

  const handleRemoveLook = (index: number) => {
    const newLooks = selectedLooks.filter((_, i) => i !== index);
    setSelectedLooks(newLooks);
    Alert.show("已取消关联");
  };

  // 造型已在搜索时过滤，直接使用
  const filteredLooks = allLooks;

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

        {/* 关联造型 */}
        <LookGridSelector
          selectedLooks={selectedLooks}
          onLookPress={(look) => {
            setPreviewLook(look);
            setShowLookPreview(true);
          }}
          onRemoveLook={handleRemoveLook}
          onAddLook={() => setShowLookSelector(true)}
          maxLooks={MAX_LOOKS}
          label="关联造型"
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
        title={previewLook?.designer}
        subtitle={previewLook?.season}
        onClose={() => setShowLookPreview(false)}
      />

      <LookSelectorModal
        visible={showLookSelector}
        looks={filteredLooks}
        searchQuery={searchQuery}
        isLoading={isLoadingLooks}
        hasMore={!searchQuery.trim() && loadedDesignerCount < designers.length}
        onSearchChange={setSearchQuery}
        onSelectLook={handleSelectLook}
        onClose={() => setShowLookSelector(false)}
        onLoadMore={handleLoadMoreLooks}
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
