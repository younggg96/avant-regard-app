import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Modal, Platform, KeyboardAvoidingView } from "react-native";
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
  VStack,
  Input,
} from "../components/ui";
import { TouchableOpacity } from "react-native";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageCropper from "../components/ImageCropper";
import BatchImageCropper from "../components/BatchImageCropper";
import ShowSelectorModal, { Show } from "../components/ShowSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import RatingSelector from "../components/RatingSelector";
import ImageGridSelector from "../components/ImageGridSelector";
import ShowGridSelector, { SelectedShow } from "../components/ShowGridSelector";
import BrandSelectorModal from "../components/BrandSelectorModal";
import BrandGridSelector, { SelectedBrand } from "../components/BrandGridSelector";
import PublishButtons from "../components/PublishButtons";
import ImagePickerModal from "../components/ImagePickerModal";
import ProductInfoSection, { ProductInfo } from "../components/ProductInfoSection";
import { postService, isVideoUrl } from "../services/postService";
import { showService, Show as ShowFromApi } from "../services/showService";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { useAuthStore } from "../store/authStore";
import { useUploadStore } from "../store/uploadStore";
import { Post } from "../components/PostCard";
import { resolveCoverDimensions } from "../utils/useMediaAspectRatio";

const PAGE_SIZE = 30;

import type { AIDraftPrefill } from "../services/aiPostService";

// 路由参数类型
type PublishReviewRouteParams = {
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

const PublishReviewScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishReviewRouteParams }, "params">>();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;
  const aiDraft = route.params?.aiDraft;

  const [title, setTitle] = useState("");
  // 单品测评 productName 后端只是单字符串字段, 多个单品我们用 \n 分隔后透传;
  // 渲染端 (PostContentSection / WantPopup) 自行解析。
  const [productNames, setProductNames] = useState<string[]>([""]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
  // 编辑驳回笔记走不同提示：红色横幅 + 「修改后重新提交」措辞，
  // 让用户清楚知道当前任务是「修复违规、再次过审」，而不是「随便改改」。
  const isEditingRejectedPost = editMode && draftPost?.auditStatus === "REJECTED";

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [showBatchCropper, setShowBatchCropper] = useState(false);
  const [batchCropperUris, setBatchCropperUris] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewShow, setPreviewShow] = useState<SelectedShow | null>(null);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);

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

  const MAX_IMAGES = 6;
  const MAX_SHOWS = 6;
  const MAX_BRANDS = 6;
  const MAX_PRODUCTS = 6;
  const REVIEW_MIN_CHARS = 10;
  const REVIEW_MAX_CHARS = 1000;

  const cleanedProductNames = productNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const joinedProductName = cleanedProductNames.join("\n");

  const updateProductNameAt = (index: number, value: string) => {
    setProductNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddProductName = () => {
    setProductNames((prev) => {
      if (prev.length >= MAX_PRODUCTS) {
        Alert.show(t("publish.maxProductsReached", { count: MAX_PRODUCTS }));
        return prev;
      }
      return [...prev, ""];
    });
  };

  const handleRemoveProductName = (index: number) => {
    setProductNames((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

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

      // 初始化评价内容
      if (draftPost.content?.description) {
        setReviewText(draftPost.content.description);
      }

      // 初始化图片（已上传的远程 URL）
      if (draftPost.content?.images && draftPost.content.images.length > 0) {
        setImages(draftPost.content.images);
      }

      // 初始化产品名称 (草稿里以 \n 分隔多个单品)
      if (draftPost.productName) {
        const parts = draftPost.productName
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        setProductNames(parts.length > 0 ? parts : [""]);
      }

      // 初始化评分
      if (draftPost.rating) {
        setRating(draftPost.rating);
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

  // AI 草稿预填 (V3 #25.4): AI 不掌握 productName / rating / brand, 这些必填字段
  // 用户进来后还得自己填; 标题、reviewText、图片可以直接灌进去。
  const aiPrefilledRef = useRef(false);
  useEffect(() => {
    if (!aiDraft || aiPrefilledRef.current || editMode) return;
    aiPrefilledRef.current = true;
    if (aiDraft.title) setTitle(aiDraft.title);
    if (aiDraft.contentText) setReviewText(aiDraft.contentText);
    if (aiDraft.imageUrls && aiDraft.imageUrls.length > 0) {
      setImages(aiDraft.imageUrls);
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
      cleanedProductNames.length > 0 &&
      rating > 0 &&
      images.length > 0 &&
      reviewText.trim().length >= REVIEW_MIN_CHARS &&
      reviewText.trim().length <= REVIEW_MAX_CHARS
    );
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
    const thumbnailUri = images[0] || null;
    const coverDims = await resolveCoverDimensions(thumbnailUri);

    useUploadStore.getState().startUpload({
      title: title.trim(),
      thumbnailUri,
      localMediaUris: localUris,
      imageMapping,
      allImages: [...images],
      createParams: {
        userId: user.userId,
        postType: "ITEM_REVIEW",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: reviewText.trim(),
        imageUrls: [],
        ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
        productName: joinedProductName,
        rating,
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
              postType: "ITEM_REVIEW",
              status: "PUBLISHED",
              title: title.trim(),
              contentText: reviewText.trim(),
              imageUrls: [],
              ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
              productName: joinedProductName,
              rating,
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
      cleanedProductNames.length === 0 &&
      images.length === 0 &&
      selectedShows.length === 0
    ) {
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

      // 获取所有关联秀场的 showIds（支持整数和字符串 ID）
      const showIds = selectedShows
        .map((show) => show.showId)
        .filter((id): id is number | string => id !== undefined && id !== null);

      // 获取所有关联品牌的 brandIds
      const brandIds = selectedBrands.map((brand) => brand.id);

      setUploadProgress(t("publish.saving"));

      const coverDims = await resolveCoverDimensions(images[0] || null);

      if (editMode && draftPostId) {
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "ITEM_REVIEW",
          status: "DRAFT",
          title: title.trim() || t("publish.reviewDraft"),
          contentText: reviewText.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          productName: joinedProductName,
          rating: rating,
          showIds: showIds,
          brandIds: brandIds,
          ...productInfo.itemBrand && { itemBrand: productInfo.itemBrand },
          ...productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId },
          ...productInfo.itemCategory && { itemCategory: productInfo.itemCategory },
          ...productInfo.itemSizes && { itemSizes: productInfo.itemSizes },
          ...productInfo.itemColors && { itemColors: productInfo.itemColors },
        });
      } else {
        await postService.createPost({
          userId: user.userId,
          postType: "ITEM_REVIEW",
          postStatus: "DRAFT",
          title: title.trim() || t("publish.reviewDraft"),
          contentText: reviewText.trim(),
          imageUrls: uploadedUrls,
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          productName: joinedProductName,
          rating: rating,
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
    setProductNames([""]);
    setRating(0);
    setReviewText("");
    setImages([]);
    setSelectedTags([]);
    setSelectedShows([]);
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

    Alert.show(t("publish.imagesAdded", { count: croppedUris.length }), "", 1500);
  };

  const handleBatchCropCancel = () => {
    setShowBatchCropper(false);
    setBatchCropperUris([]);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    Alert.show(t("publish.imageRemoved"));
  };

  const handleCropDone = (croppedUri: string) => {
    setShowImageCropper(false);
    const newImages = [...images, croppedUri];
    setImages(newImages);
    Alert.show(t("publish.imageAdded"), "", 1500);
    setCropperImageUri(null);
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    setCropperImageUri(null);
  };

  const handleRemoveShow = (index: number) => {
    const newShows = selectedShows.filter((_, i) => i !== index);
    setSelectedShows(newShows);
    Alert.show(t("publish.showUnlinked"));
  };

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
        title={editMode ? t("publish.editReview") : t("publish.typeReviewTitle")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 编辑已发布 / 驳回帖子时显示提示。驳回单独走红色 banner，
          其它（PENDING / APPROVED）走原有橙色「会重新进审核」提示。 */}
      {isEditingRejectedPost ? (
        <Box style={{ backgroundColor: "#FEF2F2" }} px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={{ color: "#7F1D1D" }} fontSize="$sm" flex={1}>
              {t("publish.rejectedEditNotice")}
            </Text>
          </HStack>
        </Box>
      ) : isEditingPublishedPost ? (
        <Box style={{ backgroundColor: theme.colors.accent }} px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="information-circle" size={20} color={theme.colors.white} />
            <Text style={{ color: theme.colors.white }} fontSize="$sm" flex={1}>
              {t("publish.reAuditWarning")}
            </Text>
          </HStack>
        </Box>
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Box mx="$md" mb="$md" mt="$md">
            <HStack mb="$sm" alignItems="center">
              <Text style={{ color: theme.colors.gray600 }} fontSize="$sm">
                {t("publish.titleLabel")}
              </Text>
              <Text style={{ color: theme.colors.error }} fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t("publish.reviewTitlePlaceholder")}
              variant="outline"
              sx={{
                fontSize: 14,
                fontWeight: "500",
                minHeight: 50,
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
            label={t("publish.productImages")}
            required
          />

          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text style={{ color: theme.colors.gray600 }} fontSize="$sm">
                {t("publish.productNameLabel")}
              </Text>
              <Text style={{ color: theme.colors.error }} fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <VStack space="sm">
              {productNames.map((name, idx) => {
                const isLast = idx === productNames.length - 1;
                const canAdd = isLast && productNames.length < MAX_PRODUCTS;
                const canRemove = productNames.length > 1;
                return (
                  <HStack
                    key={`product-name-${idx}`}
                    alignItems="center"
                    space="sm"
                  >
                    <Box flex={1}>
                      <Input
                        value={name}
                        onChangeText={(v) => updateProductNameAt(idx, v)}
                        placeholder={t("publish.productNamePlaceholder")}
                        variant="outline"
                        sx={{
                          fontSize: 14,
                          padding: 0,
                        }}
                      />
                    </Box>
                    {canRemove ? (
                      <TouchableOpacity
                        onPress={() => handleRemoveProductName(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.productActionBtn}
                        accessibilityLabel={t("publish.removeProduct")}
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    ) : null}
                    {canAdd ? (
                      <TouchableOpacity
                        onPress={handleAddProductName}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[
                          styles.productActionBtn,
                          { borderColor: theme.colors.gray300 },
                        ]}
                        accessibilityLabel={t("publish.addProduct")}
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={theme.colors.gray700}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </HStack>
                );
              })}
            </VStack>
          </Box>

          <RatingSelector rating={rating} onRatingChange={setRating} required />

          {/* 关联品牌 */}
          <BrandGridSelector
            selectedBrands={selectedBrands}
            onBrandPress={() => { }}
            onRemoveBrand={handleRemoveBrand}
            onAddBrand={() => setShowBrandSelector(true)}
            maxBrands={MAX_BRANDS}
            label={t("publish.linkBrand")}
          />

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
          />

          <ProductInfoSection value={productInfo} onChange={setProductInfo} />

          {/* 评价内容 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text style={{ color: theme.colors.gray600 }} fontSize="$sm">
                {t("publish.reviewContentLabel")}
              </Text>
              <Text style={{ color: theme.colors.error }} fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={reviewText}
              onChangeText={setReviewText}
              placeholder={t("publish.reviewContentPlaceholder")}
              multiline
              variant="outline"
              sx={{
                fontSize: 14,
                minHeight: 120,
                textAlignVertical: "top",
                padding: 0,
              }}
            />
            <Text
              style={{ color: reviewText.trim().length < REVIEW_MIN_CHARS
                  ? theme.colors.error
                  : reviewText.trim().length > REVIEW_MAX_CHARS
                    ? theme.colors.error
                    : theme.colors.gray400 }}
              fontSize="$sm"
              mt="$xs"
              textAlign="right"
            >
              {reviewText.trim().length}/{REVIEW_MAX_CHARS}
              {reviewText.trim().length > 0 && reviewText.trim().length < REVIEW_MIN_CHARS
                ? ` (${t("publish.minCharsRequired", { count: REVIEW_MIN_CHARS })})`
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
        showMultiSelectOption={images.length < MAX_IMAGES}
        showVideoOption={false}
        title={t("publish.addImages")}
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
        isLoading={isLoadingShows || isSearching}
        hasMore={hasMoreShows && !searchQuery.trim()}
        onSearchChange={handleSearchChange}
        onSearch={handleSearchSubmit}
        onSelectShow={handleSelectShow}
        onClose={() => setShowSelector(false)}
        onLoadMore={loadMoreShows}
      />

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
    keyboardAvoidingView: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 100,
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
    productActionBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default PublishReviewScreen;
