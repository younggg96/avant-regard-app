/**
 * V2 发布流程 · 统一 Composer 屏
 * ------------------------------------------------------------------
 * 单屏整合了原 V2 三步流程（图片选择 → 类型选择 → 跳到对应 V1 表单），
 * 用户在一屏内完成「选媒体 → 选类型（默认 Lookbook）→ 填写所需字段」。
 *
 * 只覆盖三种「图片优先」类型：Lookbook / 穿搭分享 / 单品测评。
 *   - 论坛帖子保留独立路径（论坛 Tab 走 PublishV2ForumMode）。
 *   - AI 草稿 / 编辑既有帖 / 买手店发帖等高级场景仍走 V1 屏，与本屏互不影响。
 *
 * 字段映射：
 *   Lookbook (OUTFIT)        → title, description, brands, productInfo
 *   穿搭分享 (DAILY_SHARE)    → title, description, shows, brands, productInfo
 *   单品测评 (ITEM_REVIEW)    → title, productName, rating, reviewText, brands, shows, productInfo
 *
 * 与 V1 共用了：BrandGridSelector / BrandSelectorModal / ShowGridSelector /
 * ShowSelectorModal / RatingSelector / ProductInfoSection / PublishButtons /
 * ImagePickerModal / ImageCropper / BatchImageCropper，以及 useBrandSearch hook
 * 与 useUploadStore 的发布管线，做到行为与 V1 完全等价（除暂未透传的
 * tags / store 等不太相关字段）。
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import {
  Box,
  Text,
  ScrollView,
  HStack,
  VStack,
  Pressable,
  Input,
  OptimizedImage,
} from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import ImagePickerModal from "../../components/ImagePickerModal";
import ImageCropper from "../../components/ImageCropper";
import BatchImageCropper from "../../components/BatchImageCropper";
import { VideoThumbnailView } from "../../components/VideoThumbnailView";
import PublishButtons from "../../components/PublishButtons";
import RatingSelector from "../../components/RatingSelector";
import BrandGridSelector, {
  SelectedBrand,
} from "../../components/BrandGridSelector";
import BrandSelectorModal from "../../components/BrandSelectorModal";
import ShowGridSelector, {
  SelectedShow,
} from "../../components/ShowGridSelector";
import ShowSelectorModal, { Show } from "../../components/ShowSelectorModal";
import ProductInfoSection, {
  ProductInfo,
} from "../../components/ProductInfoSection";
import { Alert } from "../../utils/Alert";
import { isVideoUrl, postService } from "../../services/postService";
import { Brand } from "../../services/brandService";
import { showService, Show as ShowFromApi } from "../../services/showService";
import { useBrandSearch } from "../../hooks/useBrandSearch";
import { useAuthStore } from "../../store/authStore";
import { useUploadStore } from "../../store/uploadStore";
import { ImageSize } from "../../utils/imageUtils";
import { resolveCoverDimensions } from "../../utils/useMediaAspectRatio";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 8;
const GRID_COLUMNS = 4;
const GRID_HORIZONTAL_PADDING = 16;
const TILE_SIZE =
  (SCREEN_WIDTH -
    GRID_HORIZONTAL_PADDING * 2 -
    GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;
const MAX_MEDIA = 9;
const MAX_BRANDS = 6;
const MAX_SHOWS = 6;
const REVIEW_MIN_CHARS = 10;
const REVIEW_MAX_CHARS = 500;
const SHOWS_PAGE_SIZE = 50;

type V2ComposerType = "lookbook" | "outfit" | "review";

const POST_TYPE_BY_V2: Record<V2ComposerType, "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW"> = {
  lookbook: "OUTFIT",
  outfit: "DAILY_SHARE",
  review: "ITEM_REVIEW",
};

const TYPE_NEEDS_DESCRIPTION: Record<V2ComposerType, boolean> = {
  lookbook: true,
  outfit: true,
  review: false,
};

const TYPE_NEEDS_SHOWS: Record<V2ComposerType, boolean> = {
  lookbook: false,
  outfit: true,
  review: true,
};

const PublishV2ComposerScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  // ==================== 媒体相关 ====================
  const [media, setMedia] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  // 图片选择 / 裁切流程
  const [pickerVisible, setPickerVisible] = useState(false);
  const [singleCropperUri, setSingleCropperUri] = useState<string | null>(null);
  const [batchCropperUris, setBatchCropperUris] = useState<string[]>([]);
  const autoOpenedRef = useRef(false);

  // 进入屏后自动弹一次媒体选择，引导用户先挑图。
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const timer = setTimeout(() => setPickerVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // ==================== 共用字段 ====================
  const [selectedType, setSelectedType] = useState<V2ComposerType>("lookbook");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // 单品测评特有
  const [productName, setProductName] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  // 品牌（三种类型共用）
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrand[]>([]);
  const [brandSelectorVisible, setBrandSelectorVisible] = useState(false);
  const {
    brands: displayedBrands,
    searchQuery: brandSearchQuery,
    isLoading: isLoadingBrands,
    hasMore: hasMoreBrands,
    setSearchQuery: setBrandSearchQuery,
    search: searchBrands,
    loadMore: loadMoreBrands,
  } = useBrandSearch();

  // 秀场（穿搭分享 / 单品测评）
  const [selectedShows, setSelectedShows] = useState<SelectedShow[]>([]);
  const [showSelectorVisible, setShowSelectorVisible] = useState(false);
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [showSearchQuery, setShowSearchQuery] = useState("");

  // 商品信息（三种类型共用）
  const [productInfo, setProductInfo] = useState<ProductInfo>({});

  // 提交状态
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // 加载秀场（用户首次切到「需要秀场」类型时按需加载，避免无谓请求）
  const showsLoadedRef = useRef(false);
  const ensureShowsLoaded = useCallback(async () => {
    if (showsLoadedRef.current) return;
    showsLoadedRef.current = true;
    setIsLoadingShows(true);
    try {
      const response = await showService.getShows({
        page: 1,
        pageSize: SHOWS_PAGE_SIZE,
      });
      const shows: Show[] = response.shows.map((s: ShowFromApi) => ({
        brand: s.brand || "",
        season: s.season,
        title: s.title || s.brand || "",
        cover_image: s.coverImage || "",
        show_url: s.showUrl || "",
        year: s.year || 0,
        category: s.category || "",
        show_id: s.id as number,
      }));
      setAllShows(shows);
    } catch (err) {
      console.warn("V2 composer load shows failed", err);
    } finally {
      setIsLoadingShows(false);
    }
  }, []);

  useEffect(() => {
    if (TYPE_NEEDS_SHOWS[selectedType]) {
      void ensureShowsLoaded();
    }
  }, [selectedType, ensureShowsLoaded]);

  // ============== 图片选择处理 ==============
  const remainingSlots = Math.max(0, MAX_MEDIA - media.length);

  const requireGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("publish.galleryPermissionRequired"));
      return false;
    }
    return true;
  };

  const requireCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("publish.cameraPermissionRequired"));
      return false;
    }
    return true;
  };

  const handleSelectGalleryMulti = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      setBatchCropperUris(
        result.assets.map((a) => a.uri).slice(0, remainingSlots)
      );
    } catch (err) {
      console.warn("V2 composer multi gallery failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectGallerySingle = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      setSingleCropperUri(result.assets[0].uri);
    } catch (err) {
      console.warn("V2 composer single gallery failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectCamera = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      setSingleCropperUri(result.assets[0].uri);
    } catch (err) {
      console.warn("V2 composer camera failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectVideo = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) {
      Alert.show(t("publish.videoPermissionRequired"));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;
      appendMedia([uri]);
      Alert.show(t("publish.videoAdded"), "", 1000);
    } catch (err) {
      console.warn("V2 composer video failed", err);
      Alert.show(t("publish.videoSelectionFailed"));
    }
  };

  const appendMedia = useCallback((uris: string[]) => {
    if (uris.length === 0) return;
    setMedia((prev) => {
      const next = [...prev, ...uris];
      return next;
    });
    setCoverImage((prev) => prev ?? uris[0] ?? null);
  }, []);

  const handleSingleCropDone = (uri: string) => {
    setSingleCropperUri(null);
    appendMedia([uri]);
    Alert.show(t("publish.imageAdded"), "", 1000);
  };

  const handleSingleCropCancel = () => setSingleCropperUri(null);

  const handleBatchCropDone = (uris: string[]) => {
    setBatchCropperUris([]);
    if (uris.length === 0) return;
    const truncated = uris.slice(0, remainingSlots);
    appendMedia(truncated);
    Alert.show(t("publish.imagesAdded", { count: truncated.length }), "", 1200);
  };

  const handleBatchCropCancel = () => setBatchCropperUris([]);

  const handleRemoveMedia = (index: number) => {
    setMedia((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      // 若被删的是封面，回退到第一张；若没图了则清空封面。
      if (removed === coverImage) {
        setCoverImage(next[0] ?? null);
      }
      return next;
    });
  };

  // ============== 品牌处理 ==============
  const handleAddBrand = () => {
    if (selectedBrands.length >= MAX_BRANDS) {
      Alert.show(t("publish.maxBrandsReached", { count: MAX_BRANDS }));
      return;
    }
    setBrandSelectorVisible(true);
  };

  const handleSelectBrand = (brand: Brand) => {
    if (selectedBrands.length >= MAX_BRANDS) {
      Alert.show(t("publish.maxBrandsReached", { count: MAX_BRANDS }));
      return;
    }
    if (selectedBrands.some((b) => b.id === brand.id)) {
      Alert.show(t("publish.brandAlreadyAdded"));
      return;
    }
    const sb: SelectedBrand = {
      id: brand.id,
      name: brand.name,
      coverImage: brand.coverImage,
      category: brand.category,
      country: brand.country,
    };
    setSelectedBrands((prev) => [...prev, sb]);
    setBrandSelectorVisible(false);
    Alert.show(t("publish.brandLinked"), "", 1500);
  };

  const handleRemoveBrand = (index: number) => {
    setSelectedBrands((prev) => prev.filter((_, i) => i !== index));
    Alert.show(t("publish.brandUnlinked"));
  };

  // ============== 秀场处理 ==============
  const handleAddShow = () => {
    if (selectedShows.length >= MAX_SHOWS) {
      Alert.show(t("publish.maxShowsReached", { count: MAX_SHOWS }));
      return;
    }
    void ensureShowsLoaded();
    setShowSelectorVisible(true);
  };

  const handleSelectShow = (show: Show) => {
    if (selectedShows.length >= MAX_SHOWS) {
      Alert.show(t("publish.maxShowsReached", { count: MAX_SHOWS }));
      return;
    }
    const showIdAny = (show as any).show_id ?? (show as any).id;
    if (
      selectedShows.some(
        (s) => (s.showId ?? s.id) === showIdAny && showIdAny !== undefined
      )
    ) {
      Alert.show(t("publish.showAlreadyAdded"));
      return;
    }
    const sel: SelectedShow = {
      id: showIdAny,
      brand: show.brand,
      season: show.season,
      imageUrl: show.cover_image,
      showId: showIdAny,
      showUrl: show.show_url,
    };
    setSelectedShows((prev) => [...prev, sel]);
    setShowSelectorVisible(false);
    Alert.show(t("publish.showLinked"), "", 1500);
  };

  const handleRemoveShow = (index: number) => {
    setSelectedShows((prev) => prev.filter((_, i) => i !== index));
    Alert.show(t("publish.showUnlinked"));
  };

  const filteredShows = showSearchQuery.trim()
    ? allShows.filter(
        (s) =>
          s.brand.toLowerCase().includes(showSearchQuery.toLowerCase()) ||
          (s.title ?? "").toLowerCase().includes(showSearchQuery.toLowerCase())
      )
    : allShows;

  // ============== 验证 ==============
  const validate = (): boolean => {
    if (media.length === 0) {
      Alert.show(t("publish.needAtLeastOneImage"));
      return false;
    }
    if (!title.trim()) {
      Alert.show(t("publish.titleRequired"));
      return false;
    }
    if (selectedType === "lookbook" || selectedType === "outfit") {
      if (!description.trim()) {
        Alert.show(t("publish.descriptionRequired"));
        return false;
      }
    }
    if (selectedType === "review") {
      if (!productName.trim()) {
        Alert.show(t("publish.completeRequiredFields"));
        return false;
      }
      if (rating <= 0) {
        Alert.show(t("publish.completeRequiredFields"));
        return false;
      }
      if (
        reviewText.trim().length < REVIEW_MIN_CHARS ||
        reviewText.trim().length > REVIEW_MAX_CHARS
      ) {
        Alert.show(
          t("publish.minCharsRequired", { count: REVIEW_MIN_CHARS })
        );
        return false;
      }
    }
    return true;
  };

  const canPublish = (): boolean => {
    if (media.length === 0) return false;
    if (!title.trim()) return false;
    if (selectedType === "lookbook" || selectedType === "outfit") {
      if (!description.trim()) return false;
    }
    if (selectedType === "review") {
      if (!productName.trim()) return false;
      if (rating <= 0) return false;
      const len = reviewText.trim().length;
      if (len < REVIEW_MIN_CHARS || len > REVIEW_MAX_CHARS) return false;
    }
    return true;
  };

  // ============== 发布 / 草稿 ==============
  const isRemoteUrl = (uri: string) =>
    uri.startsWith("http://") || uri.startsWith("https://");

  const buildContentText = (): string => {
    if (selectedType === "review") return reviewText.trim();
    return description.trim();
  };

  const buildExtraParams = () => {
    const brandIds = selectedBrands.map((b) => b.id);
    const showIds = TYPE_NEEDS_SHOWS[selectedType]
      ? selectedShows
          .map((s) => s.showId ?? s.id)
          .filter((id): id is number | string => id !== undefined && id !== null)
      : undefined;

    const reviewExtras =
      selectedType === "review"
        ? {
            productName: productName.trim(),
            rating,
          }
        : {};

    return {
      brandIds,
      ...(showIds && showIds.length > 0 ? { showIds } : {}),
      ...reviewExtras,
      ...(productInfo.itemBrand && { itemBrand: productInfo.itemBrand }),
      ...(productInfo.itemBrandId && { itemBrandId: productInfo.itemBrandId }),
      ...(productInfo.itemCategory && {
        itemCategory: productInfo.itemCategory,
      }),
      ...(productInfo.itemSizes && { itemSizes: productInfo.itemSizes }),
      ...(productInfo.itemColors && { itemColors: productInfo.itemColors }),
    };
  };

  const handlePublish = async () => {
    if (!validate()) return;
    if (!user?.userId) {
      Alert.show(t("publish.loginRequired"));
      return;
    }

    const existingTask = useUploadStore.getState().currentTask;
    if (
      existingTask &&
      (existingTask.status === "uploading" ||
        existingTask.status === "publishing")
    ) {
      Alert.show(t("publish.uploadInProgress"));
      return;
    }

    setIsPublishing(true);

    const imageMapping: Record<string, string> = {};
    const localUris: string[] = [];
    media.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        imageMapping[uri] = uri;
      } else {
        localUris.push(uri);
      }
    });

    const thumbnailUri = coverImage || media[0] || null;
    const coverDims = await resolveCoverDimensions(
      thumbnailUri,
      imageDimensions
    );

    useUploadStore.getState().startUpload({
      title: title.trim(),
      thumbnailUri,
      localMediaUris: localUris,
      imageMapping,
      allImages: [...media],
      createParams: {
        userId: user.userId,
        postType: POST_TYPE_BY_V2[selectedType],
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: buildContentText(),
        imageUrls: [],
        ...(coverDims && {
          coverWidth: coverDims.width,
          coverHeight: coverDims.height,
        }),
        ...buildExtraParams(),
      },
    });

    resetForm();
    setIsPublishing(false);
    (navigation as any).reset({
      index: 0,
      routes: [{ name: "Main", params: { screen: "Home" } }],
    });
  };

  const handleSaveDraft = async () => {
    if (!user?.userId) {
      Alert.show(t("publish.loginRequired"));
      return;
    }
    if (media.length === 0 && !title.trim()) {
      Alert.show(t("publish.draftNeedsContent"));
      return;
    }

    setIsSavingDraft(true);
    try {
      // 先上传本地媒体，再 createPost(DRAFT)。批量等同 V1。
      let uploadedUrls: string[] = [];
      if (media.length > 0) {
        const remoteUrls: string[] = [];
        const localUris: string[] = [];
        media.forEach((uri) => {
          if (isRemoteUrl(uri)) remoteUrls.push(uri);
          else localUris.push(uri);
        });

        let uploadedLocal: string[] = [];
        if (localUris.length > 0) {
          uploadedLocal = await postService.uploadMediaFiles(
            localUris,
            undefined
          );
        }
        let remoteIdx = 0;
        let uploadedIdx = 0;
        media.forEach((uri) => {
          if (isRemoteUrl(uri)) uploadedUrls.push(remoteUrls[remoteIdx++]);
          else uploadedUrls.push(uploadedLocal[uploadedIdx++]);
        });
      }

      const coverLocalUri = coverImage || media[0] || null;
      const coverDims = await resolveCoverDimensions(
        coverLocalUri,
        imageDimensions
      );

      await postService.createPost({
        userId: user.userId,
        postType: POST_TYPE_BY_V2[selectedType],
        postStatus: "DRAFT",
        title: title.trim() || t("publish.untitledDraft"),
        contentText: buildContentText(),
        imageUrls: uploadedUrls,
        ...(coverDims && {
          coverWidth: coverDims.width,
          coverHeight: coverDims.height,
        }),
        ...buildExtraParams(),
      });

      Alert.show(t("publish.draftSaved"), "", 1500);
    } catch (err) {
      console.error("V2 composer save draft error:", err);
      Alert.show(err instanceof Error ? err.message : t("publish.saveFailed"));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const resetForm = () => {
    setMedia([]);
    setCoverImage(null);
    setImageDimensions({});
    setTitle("");
    setDescription("");
    setProductName("");
    setRating(0);
    setReviewText("");
    setSelectedBrands([]);
    setSelectedShows([]);
    setProductInfo({});
  };

  // ============== 类型切换 ==============
  const TYPE_CHIPS: { id: V2ComposerType; label: string }[] = [
    { id: "lookbook", label: t("publish.typeLookbookTitle") },
    { id: "outfit", label: t("publish.typeOutfitTitle") },
    { id: "review", label: t("publish.typeReviewTitle") },
  ];

  // ============== 裁切屏分支 ==============
  if (batchCropperUris.length > 0) {
    return (
      <BatchImageCropper
        sourceUris={batchCropperUris}
        aspect="free"
        onCancel={handleBatchCropCancel}
        onDone={handleBatchCropDone}
      />
    );
  }
  if (singleCropperUri) {
    return (
      <ImageCropper
        sourceUri={singleCropperUri}
        aspect="free"
        onCancel={handleSingleCropCancel}
        onDone={handleSingleCropDone}
      />
    );
  }

  // ============== 渲染 ==============
  const renderMediaTile = (uri: string, index: number) => {
    const isVideo = isVideoUrl(uri);
    const isCover = uri === coverImage;
    return (
      <View
        key={`${uri}-${index}`}
        style={[
          styles.tile,
          {
            width: TILE_SIZE,
            height: TILE_SIZE,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          },
        ]}
      >
        {isVideo ? (
          <VideoThumbnailView uri={uri} style={StyleSheet.absoluteFill} />
        ) : (
          <OptimizedImage
            uri={uri}
            size={ImageSize.MEDIUM}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            lazy={false}
          />
        )}
        {isVideo ? (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={14} color={theme.colors.white} />
          </View>
        ) : null}
        {isCover && !isVideo ? (
          <View style={styles.coverBadge}>
            <Text fontSize="$2xs" color="$white" fontWeight="$medium">
              {t("publish.cover")}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveMedia(index)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="close" size={12} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderAddTile = () => {
    if (media.length >= MAX_MEDIA) return null;
    const index = media.length;
    return (
      <TouchableOpacity
        key="add-tile"
        style={[
          styles.tile,
          styles.addTile,
          {
            width: TILE_SIZE,
            height: TILE_SIZE,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          },
        ]}
        onPress={() => setPickerVisible(true)}
      >
        <Ionicons name="add" size={28} color={theme.colors.gray400} />
      </TouchableOpacity>
    );
  };

  const renderTypeSpecificForm = () => {
    if (selectedType === "review") {
      return (
        <VStack gap="$lg">
          {/* 标题 */}
          <Box>
            <Text fontSize="$sm" color="$gray600" mb="$xs">
              {t("publish.titleLabel")}
              <Text color="$red500"> *</Text>
            </Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t("publish.reviewTitlePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="underlined"
              size="lg"
            />
          </Box>

          {/* 产品名称 */}
          <Box>
            <Text fontSize="$sm" color="$gray600" mb="$xs">
              {t("publish.productNameLabel")}
              <Text color="$red500"> *</Text>
            </Text>
            <Input
              value={productName}
              onChangeText={setProductName}
              placeholder={t("publish.productNamePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="underlined"
              size="md"
            />
          </Box>

          {/* 评分 */}
          <RatingSelector rating={rating} onRatingChange={setRating} required />

          {/* 评价正文 */}
          <Box>
            <HStack alignItems="center" mb="$xs">
              <Text fontSize="$sm" color="$gray600">
                {t("publish.reviewContentLabel")}
              </Text>
              <Text color="$red500"> *</Text>
            </HStack>
            <View style={styles.textArea}>
              <TextInput
                style={styles.textAreaInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder={t("publish.reviewContentPlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                multiline
                textAlignVertical="top"
                maxLength={REVIEW_MAX_CHARS + 50}
              />
            </View>
            <Text
              fontSize="$xs"
              color={
                reviewText.trim().length > 0 &&
                (reviewText.trim().length < REVIEW_MIN_CHARS ||
                  reviewText.trim().length > REVIEW_MAX_CHARS)
                  ? "$red500"
                  : "$gray400"
              }
              textAlign="right"
              mt="$xs"
            >
              {reviewText.trim().length}/{REVIEW_MAX_CHARS}
              {reviewText.trim().length > 0 &&
              reviewText.trim().length < REVIEW_MIN_CHARS
                ? ` · ${t("publish.minCharsRequired", { count: REVIEW_MIN_CHARS })}`
                : ""}
            </Text>
          </Box>
        </VStack>
      );
    }

    // Lookbook / Outfit 共享标题 + 描述
    return (
      <VStack gap="$lg">
        <Box>
          <Text fontSize="$sm" color="$gray600" mb="$xs">
            {t("publish.titleLabel")}
            <Text color="$red500"> *</Text>
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={
              selectedType === "lookbook"
                ? t("publish.lookbookTitlePlaceholder")
                : t("publish.outfitTitlePlaceholder")
            }
            placeholderTextColor={theme.colors.gray400}
            variant="underlined"
            size="lg"
          />
        </Box>

        <Box>
          <Text fontSize="$sm" color="$gray600" mb="$xs">
            {t(
              selectedType === "lookbook"
                ? "publish.descriptionLabel"
                : "publish.outfitDetailsLabel"
            )}
            <Text color="$red500"> *</Text>
          </Text>
          <View style={styles.textArea}>
            <TextInput
              style={styles.textAreaInput}
              value={description}
              onChangeText={setDescription}
              placeholder={
                selectedType === "lookbook"
                  ? t("publish.lookbookDescPlaceholder")
                  : t("publish.outfitDescPlaceholder")
              }
              placeholderTextColor={theme.colors.gray400}
              multiline
              textAlignVertical="top"
            />
          </View>
        </Box>
      </VStack>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("publishV2.composer.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* —— 媒体网格 —— */}
          <Box px="$lg" pt="$md">
            <Text fontSize="$sm" color="$gray500" mb="$sm">
              {media.length > 0
                ? t("publishV2.composer.mediaCount", {
                    count: media.length,
                    max: MAX_MEDIA,
                  })
                : t("publishV2.composer.mediaHint")}
            </Text>
            <HStack flexWrap="wrap">
              {media.map((uri, idx) => renderMediaTile(uri, idx))}
              {renderAddTile()}
            </HStack>
          </Box>

          {/* —— 类型切换 —— */}
          <Box px="$lg" pt="$md">
            <Text fontSize="$sm" color="$gray500" mb="$sm">
              {t("publishV2.composer.typeLabel")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <HStack gap="$sm">
                {TYPE_CHIPS.map((chip) => {
                  const active = chip.id === selectedType;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setSelectedType(chip.id)}
                      px="$md"
                      py="$sm"
                      rounded="$sm"
                      bg={active ? "$black" : "$gray100"}
                      borderWidth={1}
                      borderColor={active ? "$black" : "$gray200"}
                    >
                      <HStack alignItems="center" gap="$xs">
                        <Text
                          fontSize="$sm"
                          fontWeight="$medium"
                          color={active ? "$white" : "$black"}
                        >
                          {chip.label}
                        </Text>
                        {chip.id === "lookbook" ? (
                          <Text
                            fontSize="$2xs"
                            color={active ? "$white" : "$gray500"}
                          >
                            · {t("publishV2.composer.defaultBadge")}
                          </Text>
                        ) : null}
                      </HStack>
                    </Pressable>
                  );
                })}
              </HStack>
            </ScrollView>
          </Box>

          {/* —— 类型对应表单 —— */}
          <Box px="$lg" pt="$lg">
            {renderTypeSpecificForm()}
          </Box>

          {/* —— 秀场（穿搭分享 / 单品测评）—— */}
          {TYPE_NEEDS_SHOWS[selectedType] ? (
            <Box mt="$lg">
              <ShowGridSelector
                selectedShows={selectedShows}
                onShowPress={() => {}}
                onRemoveShow={handleRemoveShow}
                onAddShow={handleAddShow}
                maxShows={MAX_SHOWS}
              />
            </Box>
          ) : null}

          {/* —— 品牌（三种类型共用）—— */}
          <Box mt="$lg">
            <BrandGridSelector
              selectedBrands={selectedBrands}
              onBrandPress={() => {}}
              onRemoveBrand={handleRemoveBrand}
              onAddBrand={handleAddBrand}
              maxBrands={MAX_BRANDS}
            />
          </Box>

          {/* —— 商品信息 —— */}
          <Box mt="$lg">
            <ProductInfoSection value={productInfo} onChange={setProductInfo} />
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      <PublishButtons
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        publishDisabled={!canPublish() || isPublishing || isSavingDraft}
        draftDisabled={isPublishing || isSavingDraft}
      />

      {/* 模态：选媒体 */}
      <ImagePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectCamera={handleSelectCamera}
        onSelectGallery={handleSelectGallerySingle}
        onSelectMultipleGallery={handleSelectGalleryMulti}
        onSelectVideo={handleSelectVideo}
        title={t("publishV2.composer.pickerTitle")}
        showVideoOption
        showMultiSelectOption
      />

      {/* 模态：品牌 */}
      <BrandSelectorModal
        visible={brandSelectorVisible}
        brands={displayedBrands}
        searchQuery={brandSearchQuery}
        isLoading={isLoadingBrands}
        hasMore={hasMoreBrands}
        onSearchChange={setBrandSearchQuery}
        onSearch={() => searchBrands()}
        onSelectBrand={handleSelectBrand}
        onClose={() => setBrandSelectorVisible(false)}
        onLoadMore={loadMoreBrands}
      />

      {/* 模态：秀场 */}
      <ShowSelectorModal
        visible={showSelectorVisible}
        shows={filteredShows}
        searchQuery={showSearchQuery}
        isLoading={isLoadingShows}
        onSearchChange={setShowSearchQuery}
        onSearch={() => {
          /* V2 内本地过滤即可，不再触发远端搜索；保留 prop 以兼容 modal API */
        }}
        onSelectShow={handleSelectShow}
        onClose={() => setShowSelectorVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  tile: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
  },
  textAreaInput: {
    fontSize: 14,
    color: theme.colors.black,
    minHeight: 90,
    textAlignVertical: "top",
  },
});

export default PublishV2ComposerScreen;
