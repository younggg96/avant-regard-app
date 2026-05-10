import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Modal,
  Image as RNImage,
  Dimensions,
  FlatList,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { VideoThumbnailView } from "../components/VideoThumbnailView";
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
  HStack,
  Input,
  OptimizedImage,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageEditMenu from "../components/ImageEditMenu";
import ImageCropper from "../components/ImageCropper";
import BatchImageCropper from "../components/BatchImageCropper";
import ShowGridSelector, { SelectedShow } from "../components/ShowGridSelector";
import ShowSelectorModal, { Show } from "../components/ShowSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import BrandSelectorModal from "../components/BrandSelectorModal";
import BrandGridSelector, { SelectedBrand } from "../components/BrandGridSelector";
import ProductInfoSection, { ProductInfo } from "../components/ProductInfoSection";
import VideoPreviewModal from "../components/VideoPreviewModal";
import { saveDraft } from "../services/draftService";
import { postService, isVideoUrl } from "../services/postService";
import { showService, Show as ShowFromApi } from "../services/showService";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { useAuthStore } from "../store/authStore";
import { useUploadStore } from "../store/uploadStore";
import { Post } from "../components/PostCard";
import { ImageSize } from "../utils/imageUtils";
import { getVideoThumbnail } from "../utils/videoThumbnail";
import { resolveCoverDimensions } from "../utils/useMediaAspectRatio";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PAGE_SIZE = 30;

import type { AIDraftPrefill } from "../services/aiPostService";

// 路由参数类型
type PublishOutfitRouteParams = {
  editMode?: boolean;
  draftPost?: Post;
  /** AI 发帖助手 (V3 #25.4): 见 PublishForumPostScreen 同名字段。 */
  aiDraft?: AIDraftPrefill;
  /**
   * V2 发布流程：见 `PublishLookbookScreen` 同名字段。从
   * `PublishV2TypeSelect` 带过来的本地媒体，进屏后一次性预填到 `images`。
   */
  prefilledMedia?: string[];
};

const PublishOutfitScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishOutfitRouteParams }, "params">>();
  const { user } = useAuthStore();

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;
  const aiDraft = route.params?.aiDraft;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedShows, setSelectedShows] = useState<SelectedShow[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // 编辑模式：保存草稿 ID 用于更新
  const [draftPostId, setDraftPostId] = useState<number | null>(
    editMode && draftPost?.id ? parseInt(String(draftPost.id), 10) : null
  );

  // 判断是否编辑已发布/审核中的帖子（需要重新审核）
  const isEditingPublishedPost = editMode && draftPost?.auditStatus;

  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});

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
  const [showBatchCropper, setShowBatchCropper] = useState(false);
  const [batchCropperUris, setBatchCropperUris] = useState<string[]>([]);
  const [videoPreviewUri, setVideoPreviewUri] = useState<string | null>(null);

  const [showSelector, setShowSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewShow, setPreviewShow] = useState<SelectedShow | null>(null);

  // 秀场数据和分页状态
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Show[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [showsPage, setShowsPage] = useState(1);
  const [hasMoreShows, setHasMoreShows] = useState(true);
  const [totalShows, setTotalShows] = useState(0);
  const isLoadingMoreRef = useRef(false);

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

  const previewFlatListRef = useRef<FlatList>(null);

  const MAX_IMAGES = 9;
  const MAX_SHOWS = 6;
  const MAX_BRANDS = 6;

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
        show_id: show.id as number,
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
        Alert.show(t("publish.loadShowsFailed"));
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
        show_id: show.id as number,
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

  // 搜索秀场（通过 API）
  const searchShowsFromApi = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await showService.searchShows(keyword.trim(), 50);
      const shows: Show[] = results.map((show: ShowFromApi) => ({
        brand: show.brand || "",
        season: show.season,
        title: show.title || show.brand || "",
        cover_image: show.coverImage || "",
        show_url: show.showUrl || "",
        year: show.year || 0,
        category: show.category || "",
        show_id: show.id as number,
      }));
      setSearchResults(shows);
    } catch (error) {
      console.error("Failed to search shows:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, []);

  const handleSearchSubmit = useCallback(() => {
    searchShowsFromApi(searchQuery);
  }, [searchQuery, searchShowsFromApi]);

  useEffect(() => {
    loadShows(true);
  }, []);

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

  const handleRemoveBrand = (index: number) => {
    const newBrands = selectedBrands.filter((_, i) => i !== index);
    setSelectedBrands(newBrands);
    Alert.show(t("publish.brandUnlinked"));
  };

  // 编辑模式：初始化草稿数据
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

      // 初始化关联秀场
      if (draftPost.shows && draftPost.shows.length > 0) {
        const mappedShows: SelectedShow[] = draftPost.shows.map((show) => ({
          id: show.id || 0,
          brand: show.brand || "",
          season: show.season || "",
          imageUrl: show.coverImage || "",
          showId: show.id,
          showUrl: show.showUrl || "",
        }));
        setSelectedShows(mappedShows);
      }
    }
  }, [editMode, draftPost]);

  // AI 草稿预填 (V3 #25.4): 把 AI 生成好的标题 / 正文 / 图片灌入 outfit state。
  // 一次性, 之后用户修改不再被覆盖。AI 不掌握穿搭独有的 selectedShows / selectedBrands /
  // productInfo, 这些字段留给用户自己补完。
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

  // V2 发布流程预填：与 Lookbook 同套机制，AI / editMode 优先。
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

  // 获取显示的秀场列表：搜索模式返回搜索结果，否则返回分页数据
  const filteredShows = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    return allShows;
  }, [allShows, searchQuery, searchResults]);

  const handleSelectShow = (show: Show) => {
    if (selectedShows.length >= MAX_SHOWS) {
      Alert.show(t("publish.maxShowsReached", { count: MAX_SHOWS }));
      return;
    }

    const isDuplicate = selectedShows.some(
      (item) => item.brand === show.brand && item.season === show.season
    );

    if (isDuplicate) {
      Alert.show(t("publish.showAlreadyAdded"));
      return;
    }

    const selectedShow: SelectedShow = {
      id: 0,
      brand: show.brand,
      season: show.season,
      imageUrl: show.cover_image,
      showId: show.show_id,
      showUrl: show.cover_image,
    };

    setSelectedShows([...selectedShows, selectedShow]);
    setShowSelector(false);
    Alert.show(t("publish.showLinked"), "", 1500);
  };

  // 检查是否满足发布标准
  const canPublish = () => {
    return (
      title.trim().length > 0 &&
      description.trim().length > 0 &&
      images.length > 0 &&
      selectedShows.length > 0
    );
  };

  // 判断是否为远程 URL（已上传的图片）
  const isRemoteUrl = (uri: string) => {
    return uri.startsWith("http://") || uri.startsWith("https://");
  };

  const processImages = async (imageList: string[]): Promise<string[]> => {
    const localUris: string[] = [];

    imageList.forEach((uri) => {
      if (!isRemoteUrl(uri)) {
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
    let uploadedIndex = 0;

    imageList.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        finalUrls.push(uri);
      } else {
        finalUrls.push(uploadedUrls[uploadedIndex++]);
      }
    });

    return finalUrls;
  };

  const handlePublish = async () => {
    if (!canPublish()) {
      Alert.show(t("publish.completeRequiredFields"));
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

    const showIds = selectedShows
      .map((show) => show.showId)
      .filter((id): id is number | string => id !== undefined && id !== null);
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
        postType: "DAILY_SHARE",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: description.trim(),
        imageUrls: [],
        ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
        showIds,
        brandIds,
        ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
        ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
        ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
        ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
        ...productInfo.itemColors && { itemColors: productInfo.itemColors },
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
              postType: "DAILY_SHARE",
              status: "PUBLISHED",
              title: title.trim(),
              contentText: description.trim(),
              imageUrls: [],
              ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
              showIds,
              brandIds,
              ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
              ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
              ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
              ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
              ...productInfo.itemColors && { itemColors: productInfo.itemColors },
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

    if (
      !title &&
      !description &&
      images.length === 0 &&
      selectedShows.length === 0
    ) {
      Alert.show(t("publish.draftNeedsContent"));
      return;
    }

    setIsSavingDraft(true);
    try {
      // 处理图片（上传新图片，保留已有图片）
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        uploadedUrls = await processImages(images);
      }

      // 获取所有关联秀场的 showIds（支持整数和字符串 ID）
      const showIds = selectedShows
        .map((show) => show.showId)
        .filter((id): id is number | string => id !== undefined && id !== null);

      // 获取所有关联品牌的 brandIds
      const brandIds = selectedBrands.map((brand) => brand.id);

      setUploadProgress(t("publish.saving"));

      const coverLocalUri = coverImage || images[0] || null;
      const coverDims = await resolveCoverDimensions(coverLocalUri, imageDimensions);

      if (editMode && draftPostId) {
        // 编辑模式：更新草稿
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "DAILY_SHARE",
          status: "DRAFT",
          title: title.trim() || t("publish.outfitDraft"),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          showIds: showIds,
          brandIds: brandIds,
          ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
          ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
          ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
          ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
          ...productInfo.itemColors && { itemColors: productInfo.itemColors },
        });
      } else {
        // 新建模式：创建草稿
        await postService.createPost({
          userId: user.userId,
          postType: "DAILY_SHARE",
          postStatus: "DRAFT",
          title: title.trim() || t("publish.outfitDraft"),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          showIds: showIds,
          brandIds: brandIds,
          ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
          ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
          ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
          ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
          ...productInfo.itemColors && { itemColors: productInfo.itemColors },
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
    setSelectedTags([]);
    setSelectedShows([]);
    setSelectedBrands([]);
    setProductInfo({});
    setCurrentImageIndex(0);
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
          // Track the natural size of the selected video so the preview
          // height (keyed on the cover URI) adapts to its real aspect ratio
          // instead of the 300px fallback.
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

  const handleRemoveShow = (index: number) => {
    const newShows = selectedShows.filter((_, i) => i !== index);
    setSelectedShows(newShows);
    Alert.show(t("publish.showUnlinked"));
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
              {t("publish.tapToAddMedia")}
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
            const isVideo = isVideoUrl(item);
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
                {isVideo ? (
                  <Pressable
                    style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
                    onPress={() => setVideoPreviewUri(item)}
                  >
                    <VideoThumbnailView
                      uri={item}
                      style={{ width: "100%", height: "100%" }}
                    />
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
                    </View>
                  </Pressable>
                ) : (
                  <OptimizedImage
                    uri={item}
                    size={ImageSize.LARGE}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    lazy={true}
                  />
                )}
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
                rounded="$sm"
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
        {images.map((image, index) => {
          const isVideo = isVideoUrl(image);
          return (
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
              {isVideo ? (
                <View style={{ width: "100%", height: "100%", backgroundColor: "#000" }}>
                  <VideoThumbnailView
                    uri={image}
                    style={{ width: "100%", height: "100%" }}
                    imageStyle={styles.thumbnail}
                  />
                  <View style={styles.videoThumbOverlay}>
                    <Ionicons name="videocam" size={16} color="#fff" />
                  </View>
                </View>
              ) : (
                <OptimizedImage
                  uri={image}
                  size={ImageSize.MEDIUM}
                  style={styles.thumbnail}
                  contentFit="cover"
                  lazy={true}
                />
              )}
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
                    {t("publish.cover")}
                  </Text>
                </Box>
              )}
            </Pressable>
          );
        })}
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
          {t("publish.thumbnailHint")}
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={editMode ? t("publish.editOutfit") : t("publish.shareOutfit")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 编辑已发布帖子时显示提示 */}
      {isEditingPublishedPost && (
        <Box bg="$accent" px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="information-circle" size={20} color={theme.colors.white} />
            <Text color="$white" fontSize="$sm" flex={1}>
              {t("publish.reAuditWarning")}
            </Text>
          </HStack>
        </Box>
      )}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
              <Text color="$gray600" fontSize="$sm">
                {t("publish.titleLabel")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t("publish.outfitTitlePlaceholder")}
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
                {t("publish.outfitDetailsLabel")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder={t("publish.outfitDescPlaceholder")}
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
          <ShowGridSelector
            selectedShows={selectedShows}
            onShowPress={(show) => {
              setPreviewShow(show);
              setShowPreview(true);
            }}
            onRemoveShow={handleRemoveShow}
            onAddShow={() => setShowSelector(true)}
            maxShows={MAX_SHOWS}
            label={t("publish.linkShow")}
            required
          />

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
      </KeyboardAvoidingView>

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

      {videoPreviewUri && (
        <VideoPreviewModal
          visible={true}
          uri={videoPreviewUri}
          onClose={() => setVideoPreviewUri(null)}
        />
      )}

      <ImagePreviewModal
        visible={showPreview}
        imageUrl={previewShow?.imageUrl || ""}
        title={previewShow?.brand}
        subtitle={previewShow?.season}
        onClose={() => setShowPreview(false)}
      />

      <ShowSelectorModal
        visible={showSelector}
        shows={filteredShows}
        searchQuery={searchQuery}
        isLoading={isLoadingShows || isSearching}
        hasMore={hasMoreShows && !searchQuery.trim()}
        onSearchChange={handleSearchChange}
        onSearch={handleSearchSubmit}
        onSelectShow={handleSelectShow}
        onClose={() => setShowSelector(false)}
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
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  videoThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});

export default PublishOutfitScreen;
