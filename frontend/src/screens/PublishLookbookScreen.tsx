import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet,
  Image as RNImage,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  OptimizedImage,
  Input,
  HStack,
} from "../components/ui";
import { playfairFonts, theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageEditMenu from "../components/ImageEditMenu";
import ImageCropper from "../components/ImageCropper";
import BatchImageCropper from "../components/BatchImageCropper";
import ImageGallery from "../components/ImageGallery";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import ImagePreviewModal from "../components/ImagePreviewModal";
import BrandSelectorModal from "../components/BrandSelectorModal";
import BrandGridSelector, { SelectedBrand } from "../components/BrandGridSelector";
import ProductInfoSection, { ProductInfo } from "../components/ProductInfoSection";
import VideoPreviewModal from "../components/VideoPreviewModal";
import { postService, isVideoUrl } from "../services/postService";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { useAuthStore } from "../store/authStore";
import { useUploadStore } from "../store/uploadStore";
import { Post } from "../components/PostCard";
import { ImageSize } from "../utils/imageUtils";
import { getVideoThumbnail } from "../utils/videoThumbnail";
import { resolveCoverDimensions } from "../utils/useMediaAspectRatio";

const SCREEN_WIDTH = Dimensions.get("window").width;

import type { AIDraftPrefill } from "../services/aiPostService";

// 路由参数类型
type PublishLookbookRouteParams = {
  editMode?: boolean;
  draftPost?: Post;
  /** AI 发帖助手 (V3 #25.4): 见 PublishForumPostScreen 同名字段。 */
  aiDraft?: AIDraftPrefill;
  /**
   * V2 发布流程：从 `PublishV2TypeSelect` 跳进来时带过来的本地媒体 URI。
   * 进屏后自动灌入 `images` state，用户可继续追加 / 删除。与 `aiDraft`
   * 互斥（V2 不走 AI 路径），与 `editMode` 互斥（编辑用 draftPost 数据）。
   */
  prefilledMedia?: string[];
  /**
   * 买手店发帖模式（migration 055）：当 MerchantManageScreen 的 Posts tab
   * 点「新建帖子」/「编辑帖子」时透传, 表示这条 Lookbook 帖子要标记为该
   * store 的店铺帖子。后端会校验当前 user 是该 store 的 APPROVED 商家。
   *
   * - storeId: 必填, 落库到 posts.store_id;
   * - storeName: 仅做 header 显示提示, 不参与提交;
   * - merchantId: 当前商家 ID, 仅用于编辑完成后回到 MerchantManage 时
   *   带回路由参数, 让上游 refresh 列表。
   */
  storeMode?: {
    storeId: string;
    storeName?: string;
    merchantId?: number;
  };
};

const PublishLookbookScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishLookbookRouteParams }, "params">>();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;
  const aiDraft = route.params?.aiDraft;
  // 买手店发帖模式参数（migration 055）。优先以路由参数为准；编辑模式下
  // 如果 draftPost 自带 storeId（来自 PostCard / PostDetail 进入编辑时回填）,
  // 也保留它, 让"编辑店铺帖子"流程不会意外把店铺标记丢掉。
  const storeMode = route.params?.storeMode;
  const storeIdToPublish: string | undefined =
    storeMode?.storeId ||
    (draftPost as any)?.storeId ||
    undefined;
  const storeNameForHeader: string | undefined =
    storeMode?.storeName || (draftPost as any)?.storeName || undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // 编辑模式：保存草稿 ID 用于更新
  const [draftPostId, setDraftPostId] = useState<number | null>(
    editMode && draftPost?.id ? parseInt(String(draftPost.id), 10) : null
  );

  // 判断是否编辑已发布/审核中的帖子（需要重新审核）
  const isEditingPublishedPost = editMode && draftPost?.auditStatus;
  // 驳回笔记走红色 banner，措辞强调「修复违规、再次过审」。
  const isEditingRejectedPost = editMode && draftPost?.auditStatus === "REJECTED";

  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});

  // 品牌相关状态
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrand[]>([]);
  const [showBrandSelector, setShowBrandSelector] = useState(false);
  const [productInfo, setProductInfo] = useState<ProductInfo>({});
  const {
    brands: displayedBrands,
    searchQuery: brandSearchQuery,
    isLoading: isLoadingBrands,
    hasMore: hasMoreBrands,
    setSearchQuery: setBrandSearchQuery,
    search: searchBrands,
    loadMore: loadMoreBrands,
  } = useBrandSearch();

  const MAX_BRANDS = 6;

  // 选择品牌
  const handleSelectBrand = (brand: Brand) => {
    if (selectedBrands.length >= MAX_BRANDS) {
      Alert.show(t("publish.maxBrandsReached", { count: MAX_BRANDS }));
      return;
    }

    const isDuplicate = selectedBrands.some((item) => item.id === brand.id);
    if (isDuplicate) {
      Alert.show(t("publish.brandAlreadyAdded"));
      return;
    }

    const selectedBrand: SelectedBrand = {
      id: brand.id,
      name: brand.name,
      coverImage: brand.coverImage,
      category: brand.category,
      country: brand.country,
    };

    setSelectedBrands([...selectedBrands, selectedBrand]);
    setShowBrandSelector(false);
    Alert.show(t("publish.brandLinked"), "", 1500);
  };

  // 移除品牌
  const handleRemoveBrand = (index: number) => {
    const newBrands = selectedBrands.filter((_, i) => i !== index);
    setSelectedBrands(newBrands);
    Alert.show(t("publish.brandUnlinked"));
  };

  useEffect(() => {
    if (editMode && draftPost) {
      console.log("Initializing edit mode with draft:", draftPost);

      // 初始化标题
      if (draftPost.content?.title) {
        setTitle(draftPost.content.title);
      }

      // 初始化描述
      if (draftPost.content?.description) {
        setDescription(draftPost.content.description);
      }

      // 初始化图片（已上传的远程 URL）
      if (draftPost.content?.images && draftPost.content.images.length > 0) {
        setImages(draftPost.content.images);
        setCoverImage(draftPost.content.images[0]);
      }
    }
  }, [editMode, draftPost]);

  // AI 草稿预填 (V3 #25.4): 一次性把 AI 草稿灌入 lookbook state, 用户可继续编辑。
  // Lookbook 的核心是图片集合, AI 文字模式没图;图片+简述模式才有 imageUrls。
  const aiPrefilledRef = useRef(false);
  useEffect(() => {
    if (!aiDraft || aiPrefilledRef.current || editMode) return;
    aiPrefilledRef.current = true;
    if (aiDraft.title) setTitle(aiDraft.title);
    if (aiDraft.contentText) setDescription(aiDraft.contentText);
    if (aiDraft.imageUrls && aiDraft.imageUrls.length > 0) {
      setImages(aiDraft.imageUrls);
      setCoverImage(aiDraft.imageUrls[0]);
    }
  }, [aiDraft, editMode]);

  // V2 发布流程预填: 从 PublishV2TypeSelect 带过来的本地媒体一次性填入,
  // 用户仍可继续追加 / 删除。AI 草稿 / 编辑模式优先, 避免相互覆盖。
  const prefilledMedia = route.params?.prefilledMedia;
  const v2PrefilledRef = useRef(false);
  useEffect(() => {
    if (
      !prefilledMedia ||
      prefilledMedia.length === 0 ||
      v2PrefilledRef.current ||
      editMode ||
      aiDraft
    ) {
      return;
    }
    v2PrefilledRef.current = true;
    setImages(prefilledMedia);
    setCoverImage(prefilledMedia[0] ?? null);
  }, [prefilledMedia, editMode, aiDraft]);

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
  const [showBatchCropper, setShowBatchCropper] = useState(false);
  const [batchCropperUris, setBatchCropperUris] = useState<string[]>([]);

  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [videoPreviewUri, setVideoPreviewUri] = useState<string | null>(null);

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
      Alert.show(t("publish.needAtLeastOneImage"));
      return false;
    }
    if (!title.trim()) {
      Alert.show(t("publish.titleRequired"));
      return false;
    }
    if (!description.trim()) {
      Alert.show(t("publish.descriptionRequired"));
      return false;
    }
    return true;
  };

  // 判断是否为远程 URL（已上传的图片）
  const isRemoteUrl = (uri: string) => {
    return uri.startsWith("http://") || uri.startsWith("https://");
  };

  const processImages = async (imageList: string[]): Promise<string[]> => {
    const remoteUrls: string[] = [];
    const localUris: string[] = [];

    imageList.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        remoteUrls.push(uri);
      } else {
        localUris.push(uri);
      }
    });

    let uploadedUrls: string[] = [];
    if (localUris.length > 0) {
      setUploadProgress(t("publish.uploadingPercent", { percent: 0 }));
      uploadedUrls = await postService.uploadMediaFiles(
        localUris,
        undefined,
        (percent) => {
          setUploadProgress(t("publish.uploadingPercent", { percent }));
        }
      );
    }

    const finalUrls: string[] = [];
    let remoteIndex = 0;
    let uploadedIndex = 0;

    imageList.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        finalUrls.push(remoteUrls[remoteIndex++]);
      } else {
        finalUrls.push(uploadedUrls[uploadedIndex++]);
      }
    });

    return finalUrls;
  };

  const handlePublish = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.userId) {
      Alert.show(t("publish.loginRequired"));
      return;
    }

    const existingTask = useUploadStore.getState().currentTask;
    if (existingTask && (existingTask.status === "uploading" || existingTask.status === "publishing")) {
      Alert.show(t("publish.uploadInProgress"));
      return;
    }

    const imageMapping: Record<string, string> = {};
    const localUris: string[] = [];

    images.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        imageMapping[uri] = uri;
      } else {
        localUris.push(uri);
      }
    });

    const brandIds = selectedBrands.map((brand) => brand.id);
    const thumbnailUri = coverImage || images[0] || null;
    const coverDims = await resolveCoverDimensions(thumbnailUri, imageDimensions);

    useUploadStore.getState().startUpload({
      title: title.trim(),
      thumbnailUri,
      localMediaUris: localUris,
      imageMapping,
      allImages: [...images],
      createParams: {
        userId: user.userId,
        postType: "OUTFIT",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: description.trim(),
        imageUrls: [],
        ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
        brandIds,
        ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
        ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
        ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
        ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
        ...productInfo.itemColors && { itemColors: productInfo.itemColors },
        ...(storeIdToPublish && { storeId: storeIdToPublish }),
        ...(aiDraft && {
          generatedByAi: true,
          generationMetadata: aiDraft.generationMetadata,
        }),
      },
      updateParams: editMode && draftPostId
        ? {
            postId: draftPostId,
            params: {
              userId: user.userId,
              postType: "OUTFIT",
              status: "PUBLISHED",
              title: title.trim(),
              contentText: description.trim(),
              imageUrls: [],
              ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
              brandIds,
              ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
              ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
              ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
              ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
              ...productInfo.itemColors && { itemColors: productInfo.itemColors },
              ...(storeIdToPublish && { storeId: storeIdToPublish }),
            },
          }
        : undefined,
    });

    resetForm();
    if (editMode) {
      navigation.goBack();
    } else {
      (navigation as any).reset({
        index: 0,
        routes: [{ name: "Main", params: { screen: "Home" } }],
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.userId) {
      Alert.show(t("publish.loginRequired"));
      return;
    }

    if (images.length === 0 && !title.trim()) {
      Alert.show(t("publish.draftNeedsContent"));
      return;
    }

    setIsSavingDraft(true);
    try {
      // 处理图片
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        uploadedUrls = await processImages(images);
      }

      // 获取所有关联品牌的 brandIds
      const brandIds = selectedBrands.map((brand) => brand.id);

      // 保存草稿
      setUploadProgress(t("publish.saving"));

      // Measure the cover once (local dims already tracked from the picker)
      // so the backend stores cover_width/cover_height and the feed masonry
      // can render at the right aspect ratio without running Image.getSize
      // during scroll.
      const coverLocalUri = coverImage || images[0] || null;
      const coverDims = await resolveCoverDimensions(coverLocalUri, imageDimensions);

      if (editMode && draftPostId) {
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "OUTFIT",
          status: "DRAFT",
          title: title.trim() || t("publish.untitledDraft"),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          brandIds: brandIds,
          ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
          ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
          ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
          ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
          ...productInfo.itemColors && { itemColors: productInfo.itemColors },
          ...(storeIdToPublish && { storeId: storeIdToPublish }),
        });
      } else {
        await postService.createPost({
          userId: user.userId,
          postType: "OUTFIT",
          postStatus: "DRAFT",
          title: title.trim() || t("publish.untitledDraft"),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          brandIds: brandIds,
          ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
          ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
          ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
          ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
          ...productInfo.itemColors && { itemColors: productInfo.itemColors },
          ...(storeIdToPublish && { storeId: storeIdToPublish }),
          ...(aiDraft && {
            generatedByAi: true,
            generationMetadata: aiDraft.generationMetadata,
          }),
        });
      }

      setUploadProgress(null);
      Alert.show(t("publish.draftSaved"), "", 1500);
    } catch (error) {
      console.error("Save draft error:", error);
      Alert.show(error instanceof Error ? error.message : t("publish.saveFailed"));
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
    setSelectedBrands([]);
    setProductInfo({});
  };

  const handleAddImage = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_IMAGES }));
      return;
    }
    setShowImagePicker(true);
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.show(t("publish.cameraPermissionRequired")); return; }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.show(t("publish.galleryPermissionRequired")); return; }
      }

      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 1.0,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1.0,
        });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setCropperImageUri(imageUri);
        setShowImageCropper(true);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleMultiImageSelection = async () => {
    setShowImagePicker(false);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.show(t("publish.galleryPermissionRequired"));
        return;
      }

      const remaining = MAX_IMAGES - images.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUris = result.assets.map((asset) => asset.uri);
        setBatchCropperUris(selectedUris);
        setShowBatchCropper(true);
      }
    } catch (error) {
      console.error("Multi image selection error:", error);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleBatchCropDone = (croppedUris: string[]) => {
    setShowBatchCropper(false);
    setBatchCropperUris([]);

    const newImages = [...images, ...croppedUris];
    setImages(newImages);

    if (!coverImage && newImages.length > 0) {
      setCoverImage(newImages[0]);
    }

    Alert.show(t("publish.imagesAdded", { count: croppedUris.length }), "", 1500);
  };

  const handleBatchCropCancel = () => {
    setShowBatchCropper(false);
    setBatchCropperUris([]);
  };

  const handleVideoSelection = async () => {
    setShowImagePicker(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.show(t("publish.videoPermissionRequired")); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1.0,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoUri = result.assets[0].uri;
        const thumbnail = await getVideoThumbnail(videoUri);
        if (thumbnail) {
          setVideoThumbnails(prev => ({ ...prev, [videoUri]: thumbnail.uri }));
          // Key the natural size under BOTH the video URI and the thumbnail
          // URI: the gallery shows the thumbnail URI for videos (see
          // `previewImages`), but other places may reference the original
          // video URI. Keeping both in sync keeps the cover-driven preview
          // height correct either way. (DRY: single source of truth for the
          // dimensions, fanned out to both keys that may hit `imageDimensions`.)
          setImageDimensions((prev) => ({
            ...prev,
            [videoUri]: { width: thumbnail.width, height: thumbnail.height },
            [thumbnail.uri]: { width: thumbnail.width, height: thumbnail.height },
          }));
        }
        const newImages = [...images, videoUri];
        setImages(newImages);
        if (!coverImage) {
          setCoverImage(thumbnail?.uri ?? videoUri);
        }
        Alert.show(t("publish.videoAdded"), "", 1500);
      }
    } catch (error) {
      console.error("Video selection error:", error);
      Alert.show(t("publish.videoSelectionFailed"));
    }
  };

  // 点击图片/视频预览
  const handleImagePress = (index: number) => {
    const uri = images[index];
    if (isVideoUrl(uri)) {
      setVideoPreviewUri(uri);
    } else {
      setPreviewInitialIndex(index);
      setShowImagePreview(true);
    }
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
      const uriToCrop = isVideoUrl(selectedImageUri) && videoThumbnails[selectedImageUri]
        ? videoThumbnails[selectedImageUri]
        : selectedImageUri;
      setCropperImageUri(uriToCrop);
      setShowImageCropper(true);
    }
  };

  const handleSetCover = () => {
    setShowImageEditMenu(false);
    if (selectedImageUri && selectedImageIndex !== null) {
      if (isVideoUrl(selectedImageUri) && videoThumbnails[selectedImageUri]) {
        setCoverImage(videoThumbnails[selectedImageUri]);
      } else {
        setCoverImage(selectedImageUri);
      }

      if (selectedImageIndex !== 0) {
        const newImages = [...images];
        const [movedImage] = newImages.splice(selectedImageIndex, 1);
        newImages.unshift(movedImage);
        setImages(newImages);
      }

      Alert.show(t("publish.setCoverSuccess"));
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

      Alert.show(t("publish.imageDeleted"));
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
    Alert.show(t("publish.reorderHint"), "", 1500);
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

    Alert.show(t("publish.positionSwapped"), "", 1000);
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
          const originalUri = images[selectedImageIndex];

          if (isVideoUrl(originalUri)) {
            setVideoThumbnails(prev => ({ ...prev, [originalUri]: croppedUri }));
            if (coverImage && (coverImage === videoThumbnails[originalUri] || coverImage === originalUri)) {
              setCoverImage(croppedUri);
            }
          } else {
            const newImages = [...images];
            newImages[selectedImageIndex] = croppedUri;
            setImages(newImages);

            if (coverImage === selectedImageUri) {
              setCoverImage(croppedUri);
            }
          }

          Alert.show(t("publish.editSuccess"), "", 1500);
          setSelectedImageUri(null);
          setSelectedImageIndex(null);
        } else {
          const newImages = [...images, croppedUri];
          setImages(newImages);

          if (!coverImage) {
            setCoverImage(croppedUri);
          }
          Alert.show(t("publish.imageAdded"), "", 1500);
        }

        setCropperImageUri(null);
      },
      (error) => {
        console.error("Failed to get image size:", error);
        if (selectedImageIndex !== null) {
          const originalUri = images[selectedImageIndex];

          if (isVideoUrl(originalUri)) {
            setVideoThumbnails(prev => ({ ...prev, [originalUri]: croppedUri }));
            if (coverImage && (coverImage === videoThumbnails[originalUri] || coverImage === originalUri)) {
              setCoverImage(croppedUri);
            }
          } else {
            const newImages = [...images];
            newImages[selectedImageIndex] = croppedUri;
            setImages(newImages);
            if (coverImage === selectedImageUri) {
              setCoverImage(croppedUri);
            }
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
      return 240;
    }

    const { width, height } = imageDimensions[coverImage];
    const aspectRatio = width / height;
    const containerWidth = SCREEN_WIDTH - 32;
    const calculatedHeight = containerWidth / aspectRatio;

    return Math.min(Math.max(calculatedHeight, 160), 400);
  }, [coverImage, imageDimensions]);

  const previewImages = useMemo(() => {
    return images.map(img =>
      isVideoUrl(img) && videoThumbnails[img] ? videoThumbnails[img] : img
    );
  }, [images, videoThumbnails]);

  const renderPreviewSection = () => {
    if (images.length === 0) {
      return (
        <Box h={200} mx="$md" my="$md">
          <Pressable
            flex={1}
            rounded="$md"
            overflow="hidden"
            style={{ backgroundColor: theme.colors.gray100 }}
            alignItems="center"
            justifyContent="center"
            onPress={handleAddImage}
          >
            <Ionicons
              name="image-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text
              style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.gray500 }]}
              fontSize="$sm"
              mt="$sm"

            >
              {t("publish.tapToAddMedia")}
            </Text>
          </Pressable>
        </Box>
      );
    }

    return (
      <ImageGallery
        images={previewImages}
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
                style={{ borderColor: isSelected ? theme.colors.accent : theme.colors.black }}
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
                <OptimizedImage
                  uri={isVideoUrl(image) && videoThumbnails[image] ? videoThumbnails[image] : image}
                  size={ImageSize.MEDIUM}
                  style={styles.thumbnail}
                  contentFit="cover"
                  lazy={true}
                />

                {/* 视频标识 */}
                {isVideoUrl(image) && !isSelected && (
                  <Box style={styles.videoThumbOverlay}>
                    <Ionicons name="play-circle" size={24} color="white" />
                  </Box>
                )}

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
                    <Text style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.white }]} fontSize={10} fontWeight="$medium">
                      {t("publish.cover")}
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
              style={{ backgroundColor: theme.colors.gray100 }}
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
          style={[{ fontFamily: playfairFonts.regular }, { color: isReorderMode ? theme.colors.accent : theme.colors.gray400 }]}
          fontSize="$xs"
          textAlign="center"
          mt="$xs"
          fontWeight={isReorderMode ? "$medium" : "$normal"}

        >
          {isReorderMode
            ? t("publish.reorderModeHint")
            : t("publish.thumbnailHint")}
        </Text>
      )}
    </Box>
  );

  if (showBatchCropper && batchCropperUris.length > 0) {
    return (
      <BatchImageCropper
        sourceUris={batchCropperUris}
        aspect="free"
        onCancel={handleBatchCropCancel}
        onDone={handleBatchCropDone}
      />
    );
  }

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
    // 仅保留 top 安全区. bottom 由 PublishButtons 自己用 useSafeAreaInsets()
    // 处理. 否则 SafeAreaView 吃 bottom inset + KAV 又按完整键盘高度加 padding,
    // 在 iOS 上会双重抵扣 ~34px, 表现为键盘弹起时输入框错位 / 按钮被遮挡。
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={
          storeIdToPublish
            ? editMode
              ? t("merchant.editStorePost")
              : t("merchant.publishStorePost")
            : editMode
              ? t("publish.editLookbook")
              : t("publish.publishLookbook")
        }
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 买手店发帖模式（migration 055）— 显式提示当前是以买手店身份发布。
          不能误删, 否则商家可能被误以为是自己个人主页发布。 */}
      {storeIdToPublish && (
        <Box style={{ backgroundColor: theme.colors.gray100 }} px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="storefront" size={16} color={theme.colors.black} />
            <Text style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.black }]} fontSize="$sm" flex={1} numberOfLines={1}>
              {t("merchant.publishingAsStore", {
                store: storeNameForHeader || storeIdToPublish,
              })}
            </Text>
          </HStack>
        </Box>
      )}

      {/* 编辑已发布 / 驳回帖子时显示提示。驳回单独走红色 banner，强调修复违规。 */}
      {isEditingRejectedPost ? (
        <Box style={{ backgroundColor: "#FEF2F2" }} px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={{ color: "#7F1D1D", fontFamily: playfairFonts.regular }} fontSize="$sm" flex={1}>
              {t("publish.rejectedEditNotice")}
            </Text>
          </HStack>
        </Box>
      ) : isEditingPublishedPost ? (
        <Box style={{ backgroundColor: theme.colors.accent }} px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="information-circle" size={20} color={theme.colors.white} />
            <Text style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.white }]} fontSize="$sm" flex={1}>
              {t("publish.reAuditWarning")}
            </Text>
          </HStack>
        </Box>
      ) : null}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {renderPreviewSection()}
          {images.length > 0 && renderImageGallery()}

          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.gray600 }]} fontSize="$sm">
                {t("publish.titleLabel")}
              </Text>
              <Text style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.error }]} fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t("publish.lookbookTitlePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              multiline
              variant="filled"
              sx={{
                fontSize: 14,
                fontWeight: "500",
                fontFamily: playfairFonts.medium,
                color: theme.colors.black,
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
              <Text style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.gray600 }]} fontSize="$sm">
                {t("publish.descriptionLabel")}
              </Text>
              <Text style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.error }]} fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder={t("publish.lookbookDescPlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              multiline
              variant="filled"
              sx={{
                fontFamily: playfairFonts.regular,
                color: theme.colors.gray600,
                fontSize: 14,
                minHeight: 80,
                textAlignVertical: "top",
                borderWidth: 0,
                backgroundColor: "transparent",
                padding: 0,
              }}
            />
          </Box>

          {/* 关联品牌 */}
          <BrandGridSelector
            selectedBrands={selectedBrands}
            onBrandPress={() => { }}
            onRemoveBrand={handleRemoveBrand}
            onAddBrand={() => setShowBrandSelector(true)}
            maxBrands={MAX_BRANDS}
            label={t("publish.linkBrand")}
            required={false}
          />

          <ProductInfoSection value={productInfo} onChange={setProductInfo} />
        </ScrollView>

        {/* PublishButtons 必须在 KAV 内: 按钮自身是 position:absolute bottom:0,
            放到 KAV 外面时键盘弹起 KAV 上推内容、按钮原地不动 → 被键盘整个盖住,
            用户体感"返回 / 发布按键无响应". 放进 KAV 内, 键盘弹起 KAV 加 bottom
            padding, 绝对定位的按钮跟着上抬, 始终保持在键盘上方可点。 */}
        <PublishButtons
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          publishDisabled={!canPublish() || isPublishing || isSavingDraft}
          draftDisabled={isPublishing || isSavingDraft}
          publishButtonText={
            isPublishing ? uploadProgress || t("publish.publishing") : t("publish.title")
          }
          draftButtonText={
            isSavingDraft ? uploadProgress || t("publish.saving") : t("publish.saveDraft")
          }
        />
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
        onSelectMultipleGallery={handleMultiImageSelection}
        onSelectVideo={handleVideoSelection}
        showMultiSelectOption={images.length < MAX_IMAGES}
        showVideoOption={true}
        title={t("publish.addMedia")}
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
        imageUrls={previewImages}
        initialIndex={previewInitialIndex}
        title={title || t("publish.lookbookPreview")}
        onClose={() => setShowImagePreview(false)}
        onImagePress={(index) => {
          if (isVideoUrl(images[index])) {
            setShowImagePreview(false);
            setVideoPreviewUri(images[index]);
          }
        }}
      />

      {videoPreviewUri && (
        <VideoPreviewModal
          visible={true}
          uri={videoPreviewUri}
          onClose={() => setVideoPreviewUri(null)}
        />
      )}

      <BrandSelectorModal
        visible={showBrandSelector}
        brands={displayedBrands}
        searchQuery={brandSearchQuery}
        isLoading={isLoadingBrands}
        hasMore={hasMoreBrands}
        onSearchChange={setBrandSearchQuery}
        onSearch={searchBrands}
        onSelectBrand={handleSelectBrand}
        onClose={() => setShowBrandSelector(false)}
        onLoadMore={loadMoreBrands}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
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
    },
    videoOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.2)",
    } as any,
    videoThumbOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.3)",
    } as any,
  });

export default PublishLookbookScreen;
