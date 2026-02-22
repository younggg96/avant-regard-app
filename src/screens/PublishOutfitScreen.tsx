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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
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
import ShowGridSelector, { SelectedShow } from "../components/ShowGridSelector";
import ShowSelectorModal, { Show } from "../components/ShowSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import BrandSelectorModal from "../components/BrandSelectorModal";
import BrandGridSelector, { SelectedBrand } from "../components/BrandGridSelector";
import { saveDraft } from "../services/draftService";
import { postService } from "../services/postService";
import { showService, Show as ShowFromApi } from "../services/showService";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { useAuthStore } from "../store/authStore";
import { Post } from "../components/PostCard";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PAGE_SIZE = 30;

// 路由参数类型
type PublishOutfitRouteParams = {
  editMode?: boolean;
  draftPost?: Post;
};

const PublishOutfitScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishOutfitRouteParams }, "params">>();
  const { user } = useAuthStore();

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;

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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 品牌相关状态
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrand[]>([]);
  const [showBrandSelector, setShowBrandSelector] = useState(false);
  const {
    brands: displayedBrands,
    searchQuery: brandSearchQuery,
    isLoading: isLoadingBrands,
    hasMore: hasMoreBrands,
    setSearchQuery: setBrandSearchQuery,
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

  // 处理搜索词变化（带 debounce）
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // 设置 debounce 延迟搜索
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      searchShowsFromApi(query);
    }, 300);
  }, [searchShowsFromApi]);

  // 清理搜索定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadShows(true);
  }, []);

  // 选择品牌
  const handleSelectBrand = (brand: Brand) => {
    if (selectedBrands.length >= MAX_BRANDS) {
      Alert.show("提示: 最多只能关联" + MAX_BRANDS + "个品牌");
      return;
    }

    // 检查是否已添加
    const isDuplicate = selectedBrands.some((item) => item.id === brand.id);
    if (isDuplicate) {
      Alert.show("提示: 该品牌已经添加过了");
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
    Alert.show("已关联品牌", "", 1500);
  };

  // 移除品牌
  const handleRemoveBrand = (index: number) => {
    const newBrands = selectedBrands.filter((_, i) => i !== index);
    setSelectedBrands(newBrands);
    Alert.show("已取消关联");
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

  // 获取显示的秀场列表：搜索模式返回搜索结果，否则返回分页数据
  const filteredShows = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    return allShows;
  }, [allShows, searchQuery, searchResults]);

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
      imageUrl: show.show_url,
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
      description.trim().length > 0 &&
      images.length > 0 &&
      selectedShows.length > 0
    );
  };

  // 判断是否为远程 URL（已上传的图片）
  const isRemoteUrl = (uri: string) => {
    return uri.startsWith("http://") || uri.startsWith("https://");
  };

  // 处理图片上传（区分新图片和已上传的图片）
  const processImages = async (imageList: string[]): Promise<string[]> => {
    const remoteUrls: string[] = [];
    const localUris: string[] = [];

    // 分离远程 URL 和本地 URI
    imageList.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        remoteUrls.push(uri);
      } else {
        localUris.push(uri);
      }
    });

    // 只上传本地图片
    let uploadedUrls: string[] = [];
    if (localUris.length > 0) {
      setUploadProgress(`上传图片 0/${localUris.length}`);
      uploadedUrls = await postService.uploadImages(
        localUris,
        (completed, total) => {
          setUploadProgress(`上传图片 ${completed}/${total}`);
        }
      );
    }

    // 合并远程 URL 和新上传的 URL（保持原有顺序）
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
      Alert.show("提示: 请完成所有必填项");
      return;
    }

    if (!user?.userId) {
      Alert.show("请先登录");
      return;
    }

    setIsPublishing(true);
    try {
      // 1. 处理图片（上传新图片，保留已有图片）
      const uploadedUrls = await processImages(images);

      // 2. 获取所有关联秀场的 showIds（支持整数和字符串 ID）
      const showIds = selectedShows
        .map((show) => show.showId)
        .filter((id): id is number | string => id !== undefined && id !== null);

      // 获取所有关联品牌的 brandIds
      const brandIds = selectedBrands.map((brand) => brand.id);

      // 3. 创建或更新帖子
      setUploadProgress("正在发布...");

      if (editMode && draftPostId) {
        // 编辑模式：更新帖子
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "DAILY_SHARE",
          status: "PUBLISHED",
          title: title.trim(),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          showIds: showIds,
          brandIds: brandIds,
        });
      } else {
        // 新建模式：创建帖子
        await postService.createPost({
          userId: user.userId,
          postType: "DAILY_SHARE",
          postStatus: "PUBLISHED",
          title: title.trim(),
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          showIds: showIds,
          brandIds: brandIds,
        });
      }

      setUploadProgress(null);
      Alert.show("发布成功！", "", 2000);
      setTimeout(() => {
        resetForm();
        if (editMode) {
          // 编辑模式：返回上一页（帖子详情页）
          navigation.goBack();
        } else {
          // 新建模式：导航到主页
          (navigation as any).reset({
            index: 0,
            routes: [{ name: "Main", params: { screen: "Home" } }],
          });
        }
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
      selectedShows.length === 0
    ) {
      Alert.show("提示: 请至少填写一些内容再保存草稿");
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

      // 保存草稿
      setUploadProgress("正在保存...");

      if (editMode && draftPostId) {
        // 编辑模式：更新草稿
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "DAILY_SHARE",
          status: "DRAFT",
          title: title.trim() || "搭配草稿",
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          showIds: showIds,
          brandIds: brandIds,
        });
      } else {
        // 新建模式：创建草稿
        await postService.createPost({
          userId: user.userId,
          postType: "DAILY_SHARE",
          postStatus: "DRAFT",
          title: title.trim() || "搭配草稿",
          contentText: description.trim(),
          imageUrls: uploadedUrls,
          showIds: showIds,
          brandIds: brandIds,
        });
      }

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
    setSelectedShows([]);
    setSelectedBrands([]);
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

  const handleRemoveShow = (index: number) => {
    const newShows = selectedShows.filter((_, i) => i !== index);
    setSelectedShows(newShows);
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
        title={editMode ? "编辑搭配" : "分享搭配"}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 编辑已发布帖子时显示提示 */}
      {isEditingPublishedPost && (
        <Box bg="$accent" px="$md" py="$sm">
          <HStack alignItems="center" gap="$sm">
            <Ionicons name="information-circle" size={20} color={theme.colors.white} />
            <Text color="$white" fontSize="$sm" flex={1}>
              编辑后帖子将重新进入审核状态
            </Text>
          </HStack>
        </Box>
      )}

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

        {/* 关联品牌 */}
        <BrandGridSelector
          selectedBrands={selectedBrands}
          onBrandPress={() => {}}
          onRemoveBrand={handleRemoveBrand}
          onAddBrand={() => setShowBrandSelector(true)}
          maxBrands={MAX_BRANDS}
          label="关联品牌"
          required={false}
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
    resizeMode: "cover",
  },
});

export default PublishOutfitScreen;
