/**
 * 发布论坛帖子页面 - 与文章发布保持一致的形式
 */
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Animated,
  View,
  ScrollView as RNScrollView,
} from "react-native";
import { Alert } from "../utils/Alert";
import { VideoThumbnailView } from "../components/VideoThumbnailView";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import {
  Box,
  Text,
  ScrollView,
  HStack,
  VStack,
  Input,
  Pressable,
} from "../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import PublishButtons from "../components/PublishButtons";
import SingleImageUploader from "../components/SingleImageUploader";
import ImagePickerModal from "../components/ImagePickerModal";
import { postService, isVideoUrl } from "../services/postService";
import { getCommunities, Community } from "../services/communityService";
import { useAuthStore } from "../store/authStore";
import { useUploadStore } from "../store/uploadStore";
import { Post } from "../components/PostCard";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { getVideoThumbnail } from "../utils/videoThumbnail";
import { useMediaAspectRatio, resolveCoverDimensions } from "../utils/useMediaAspectRatio";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 内容块类型定义
type ContentBlockType = "text" | "image";

interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string; // 文本内容或图片 URI
}

import type { AIDraftPrefill } from "../services/aiPostService";

// 路由参数类型
type PublishForumPostRouteParams = {
  editMode?: boolean;
  draftPost?: Post;
  communityId?: number;
  /**
   * AI 发帖助手 (V3 #25.4) 的草稿预填载荷。存在时:
   *   - 进入页面后自动 setTitle / setContentBlocks / setCommunity
   *   - createPost 时透传 generatedByAi=true + generationMetadata
   * 与 editMode 互斥: AI 草稿走 create, 不进 update 路径。
   */
  aiDraft?: AIDraftPrefill;
  /**
   * V2 发布流程：从 `PublishV2TypeSelect` 选择「论坛帖子」时带过来。
   * 论坛屏只有单张封面 + 内容块，因此首张作为 `coverImage`，其余每张
   * 都生成一个 image 内容块（与现有 ImagePicker 多选追加图片块的语义
   * 一致）。
   */
  prefilledMedia?: string[];
};

// 生成唯一 ID
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Forum post content block preview — renders an image or a video thumbnail at
 * the media's natural aspect ratio so composition preview matches the final
 * post detail view (no 200px fixed-height cover-crop anymore).
 */
// Module-level static style: not theme-aware (overlay color is intentional).
const videoOverlayStyle = {
  ...StyleSheet.absoluteFillObject,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  backgroundColor: "rgba(0,0,0,0.2)",
};

const MediaBlockPreview: React.FC<{ uri: string }> = ({ uri }) => {
  const ratio = useMediaAspectRatio(uri, 16 / 9);
  const size = { width: "100%" as const, aspectRatio: ratio };
  if (isVideoUrl(uri)) {
    return (
      <View style={size}>
        <VideoThumbnailView uri={uri} style={StyleSheet.absoluteFill} />
        <View style={videoOverlayStyle}>
          <Ionicons name="play-circle" size={48} color="white" />
        </View>
      </View>
    );
  }
  return (
    <OptimizedImage
      uri={uri}
      size={ImageSize.MEDIUM}
      style={size}
      contentFit="contain"
      lazy={true}
    />
  );
};

const PublishForumPostScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishForumPostRouteParams }, "params">>();
  const { user } = useAuthStore();
  const scrollViewRef = useRef<any>(null);
  const styles = useThemedStyles(makeStyles);

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;
  const initialCommunityId = route.params?.communityId;
  // AI 草稿预填载荷 (V3 #25.4): 与 editMode 互斥, 触发时走 create + generatedByAi
  const aiDraft = route.params?.aiDraft;

  const [title, setTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
    { id: generateId(), type: "text", content: "" },
  ]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null);

  // 社区相关
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);

  // 动画
  const addMenuAnim = useRef(new Animated.Value(0)).current;

  // 编辑模式：保存草稿 ID 用于更新
  const [draftPostId] = useState<number | null>(
    editMode && draftPost?.id ? parseInt(String(draftPost.id), 10) : null
  );

  // 判断是否编辑已发布/审核中的帖子（需要重新审核）
  const isEditingPublishedPost = editMode && draftPost?.auditStatus;
  // 驳回笔记走红色 banner，措辞强调「修复违规、再次过审」。
  const isEditingRejectedPost = editMode && draftPost?.auditStatus === "REJECTED";

  // 加载社区列表
  useEffect(() => {
    const loadCommunities = async () => {
      setIsLoadingCommunities(true);
      try {
        const data = await getCommunities();
        setCommunities(data.all);

        // 如果有初始社区 ID，设置选中的社区
        if (initialCommunityId) {
          const community = data.all.find((c) => c.id === initialCommunityId);
          if (community) {
            setSelectedCommunity(community);
          }
        }
      } catch (err) {
        console.error("加载社区列表失败:", err);
      } finally {
        setIsLoadingCommunities(false);
      }
    };
    loadCommunities();
  }, [initialCommunityId]);

  // AI 草稿预填: 进入页面时一次性把 AI 写好的标题 / 正文 / 封面 / 推荐社区灌进 state。
  // 故意只跑一次 (依赖 [] + ref-style guard) 避免后续用户编辑被覆盖。
  const aiPrefilledRef = useRef(false);
  useEffect(() => {
    if (!aiDraft || aiPrefilledRef.current || editMode) return;
    aiPrefilledRef.current = true;
    if (aiDraft.title) setTitle(aiDraft.title);
    if (aiDraft.contentText) {
      setContentBlocks([
        { id: generateId(), type: "text", content: aiDraft.contentText },
      ]);
    }
    if (aiDraft.imageUrls && aiDraft.imageUrls.length > 0) {
      setCoverImage(aiDraft.imageUrls[0]);
    }
  }, [aiDraft, editMode]);

  // AI 推荐的社区: 等社区列表加载完才能匹配, 单独一个 effect。
  useEffect(() => {
    if (!aiDraft?.suggestedCommunityId || communities.length === 0) return;
    if (selectedCommunity) return;
    const matched = communities.find(
      (c) => c.id === aiDraft.suggestedCommunityId,
    );
    if (matched) setSelectedCommunity(matched);
  }, [aiDraft, communities, selectedCommunity]);

  // V2 发布流程预填：把首张作为封面，其余每张作为 image 内容块。
  // AI / editMode 优先，避免被覆盖。
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
    setCoverImage(prefilledMedia[0] ?? null);
    if (prefilledMedia.length > 1) {
      setContentBlocks((prev) => {
        const text = prev.find((b) => b.type === "text" && b.content) ??
          { id: generateId(), type: "text", content: "" };
        const imageBlocks = prefilledMedia.slice(1).map((uri) => ({
          id: generateId(),
          type: "image" as const,
          content: uri,
        }));
        return [text, ...imageBlocks];
      });
    }
  }, [prefilledMedia, editMode, aiDraft]);

  // 编辑模式：初始化草稿数据
  useEffect(() => {
    if (editMode && draftPost) {
      console.log("Initializing edit mode with draft:", draftPost);

      // 初始化标题
      if (draftPost.content?.title) {
        setTitle(draftPost.content.title);
      }

      // 初始化封面图片
      if (draftPost.content?.images && draftPost.content.images.length > 0) {
        setCoverImage(draftPost.content.images[0]);
      }

      // 尝试解析内容块
      if (draftPost.content?.description) {
        try {
          const parsed = JSON.parse(draftPost.content.description);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContentBlocks(parsed);
            return;
          }
        } catch {
          // 如果不是 JSON，作为纯文本处理
          setContentBlocks([
            { id: generateId(), type: "text", content: draftPost.content.description },
          ]);
        }
      }
    }
  }, [editMode, draftPost]);

  // 显示/隐藏添加菜单动画
  useEffect(() => {
    Animated.timing(addMenuAnim, {
      toValue: showAddMenu ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showAddMenu]);

  // 检查表单是否完整（用于禁用发布按钮）
  const canPublish = (): boolean => {
    const hasTitle = title.trim().length > 0;
    const hasCommunity = selectedCommunity !== null;
    return hasTitle && hasCommunity;
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.show(t("publish.titleRequired"));
      return false;
    }
    if (!selectedCommunity) {
      Alert.show(t("publish.communityRequired"));
      return false;
    }
    return true;
  };

  // 判断是否为远程 URL（已上传的图片）
  const isRemoteUrl = (uri: string) => {
    return uri.startsWith("http://") || uri.startsWith("https://");
  };

  // 更新内容块
  const updateBlockContent = (blockId: string, content: string) => {
    setContentBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId ? { ...block, content } : block
      )
    );
  };

  // 删除内容块
  const deleteBlock = (blockId: string) => {
    setContentBlocks((prev) => {
      const filtered = prev.filter((block) => block.id !== blockId);
      // 确保至少有一个文本块
      if (filtered.length === 0) {
        return [{ id: generateId(), type: "text", content: "" }];
      }
      return filtered;
    });
  };

  // 在指定块后插入新块
  const insertBlockAfter = (afterBlockId: string, type: ContentBlockType, content: string = "") => {
    const newBlock: ContentBlock = { id: generateId(), type, content };
    setContentBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === afterBlockId);
      if (index === -1) {
        return [...prev, newBlock];
      }
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newBlock);
      return newBlocks;
    });
    setShowAddMenu(null);
  };

  // 添加文本块
  const handleAddTextBlock = (afterBlockId: string) => {
    insertBlockAfter(afterBlockId, "text", "");
  };

  // 添加图片块
  const handleAddImageBlock = (afterBlockId: string) => {
    setInsertAfterBlockId(afterBlockId);
    setShowAddMenu(null);
    setShowImagePicker(true);
  };

  // 处理图片选择
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
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        if (insertAfterBlockId) {
          // 插入图片块 + 在其后追加一个空文本块, 一次 setState 完成。
          // 历史这里走 insertBlockAfter + setTimeout 100ms 再读 contentBlocks,
          // 但 setTimeout 闭包里读到的是旧 state, 判断 lastBlock.type 永远不
          // 等于 "image" → 末尾插图后没有文字输入框, 用户无法继续打字。
          const targetId = insertAfterBlockId;
          setContentBlocks((prev) => {
            const idx = prev.findIndex((b) => b.id === targetId);
            const imageBlock: ContentBlock = {
              id: generateId(),
              type: "image",
              content: imageUri,
            };
            const textBlock: ContentBlock = {
              id: generateId(),
              type: "text",
              content: "",
            };
            const next = [...prev];
            const insertAt = idx === -1 ? next.length : idx + 1;
            next.splice(insertAt, 0, imageBlock);
            // 仅当图片后没有可编辑文本块时才追加, 避免重复空块。
            const after = next[insertAt + 1];
            if (!after || after.type !== "text") {
              next.splice(insertAt + 1, 0, textBlock);
            }
            return next;
          });
          setShowAddMenu(null);
        }
        setInsertAfterBlockId(null);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show(t("publish.imageSelectionFailed"));
    }
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
        if (insertAfterBlockId) {
          const targetId = insertAfterBlockId;
          setContentBlocks((prev) => {
            const idx = prev.findIndex((b) => b.id === targetId);
            const videoBlock: ContentBlock = {
              id: generateId(),
              type: "image",
              content: videoUri,
            };
            const textBlock: ContentBlock = {
              id: generateId(),
              type: "text",
              content: "",
            };
            const next = [...prev];
            const insertAt = idx === -1 ? next.length : idx + 1;
            next.splice(insertAt, 0, videoBlock);
            const after = next[insertAt + 1];
            if (!after || after.type !== "text") {
              next.splice(insertAt + 1, 0, textBlock);
            }
            return next;
          });
          setShowAddMenu(null);
        }
        setInsertAfterBlockId(null);

        if (!coverImage) {
          const thumbnail = await getVideoThumbnail(videoUri);
          if (thumbnail) {
            setCoverImage(thumbnail.uri);
          }
        }

        Alert.show(t("publish.videoAdded"), "", 1500);
      }
    } catch (error) {
      console.error("Video selection error:", error);
      Alert.show(t("publish.videoSelectionFailed"));
    }
  };

  // 序列化内容块为 JSON
  const serializeContent = (): string => {
    return JSON.stringify(contentBlocks);
  };

  // 获取所有图片 URL（封面图 + 内容中的图片）
  const getAllImageUrls = (): string[] => {
    const contentImages = contentBlocks
      .filter((block) => block.type === "image" && block.content)
      .map((block) => block.content);

    if (coverImage) {
      return [coverImage, ...contentImages];
    }
    return contentImages;
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

    const allImages = getAllImageUrls();
    const imageMapping: Record<string, string> = {};
    const localUris: string[] = [];

    allImages.forEach((uri) => {
      if (isRemoteUrl(uri)) {
        imageMapping[uri] = uri;
      } else {
        localUris.push(uri);
      }
    });

    const thumbnailUri = coverImage || allImages[0] || null;
    const coverDims = await resolveCoverDimensions(thumbnailUri);

    useUploadStore.getState().startUpload({
      title: title.trim(),
      thumbnailUri,
      localMediaUris: localUris,
      imageMapping,
      allImages,
      contentBlocks: [...contentBlocks],
      coverImageKey: coverImage,
      createParams: {
        userId: user.userId,
        postType: "ARTICLES",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: "",
        imageUrls: [],
        ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
        communityId: selectedCommunity?.id,
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
              postType: "ARTICLES",
              status: "PUBLISHED",
              title: title.trim(),
              contentText: "",
              imageUrls: [],
              ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
              communityId: selectedCommunity?.id,
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

    const hasContent = contentBlocks.some(
      (block) => block.content.trim().length > 0
    );
    if (!title.trim() && !hasContent) {
      Alert.show(t("publish.draftNeedsContent"));
      return;
    }

    setIsSavingDraft(true);
    try {
      const allImages = getAllImageUrls();
      const uploadedUrls: string[] = [];
      const imageMapping: Record<string, string> = {};
      const localUris = allImages.filter((uri) => !isRemoteUrl(uri));
      const totalLocal = localUris.length;

      for (let i = 0; i < allImages.length; i++) {
        const imageUri = allImages[i];
        if (isRemoteUrl(imageUri)) {
          uploadedUrls.push(imageUri);
          imageMapping[imageUri] = imageUri;
        } else {
          const localIndex = localUris.indexOf(imageUri);
          const uploadedUrl = await postService.uploadMedia(imageUri, (filePercent) => {
            const overall = Math.round(((localIndex * 100 + filePercent) / totalLocal));
            setUploadProgress(t("publish.uploadingPercent", { percent: Math.min(overall, 99) }));
          });
          uploadedUrls.push(uploadedUrl);
          imageMapping[imageUri] = uploadedUrl;
        }
      }

      const updatedBlocks = contentBlocks.map((block) => {
        if (block.type === "image" && imageMapping[block.content]) {
          return { ...block, content: imageMapping[block.content] };
        }
        return block;
      });

      setUploadProgress(t("publish.saving"));

      const contentText = JSON.stringify(updatedBlocks);
      const finalCoverImage = coverImage ? imageMapping[coverImage] || coverImage : null;
      const coverDims = await resolveCoverDimensions(finalCoverImage);

      if (editMode && draftPostId) {
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "ARTICLES",
          status: "DRAFT",
          title: title.trim() || t("publish.forumDraft"),
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          communityId: selectedCommunity?.id,
        });
      } else {
        await postService.createPost({
          userId: user.userId,
          postType: "ARTICLES",
          postStatus: "DRAFT",
          title: title.trim() || t("publish.forumDraft"),
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          ...(coverDims && { coverWidth: coverDims.width, coverHeight: coverDims.height }),
          communityId: selectedCommunity?.id,
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
    setCoverImage(null);
    setContentBlocks([{ id: generateId(), type: "text", content: "" }]);
    setSelectedCommunity(null);
  };

  // 渲染文本块
  const renderTextBlock = (block: ContentBlock, index: number) => {
    const isFirst = index === 0;
    const isLast = index === contentBlocks.length - 1;
    const canDelete = contentBlocks.length > 1 || block.content.trim().length > 0;

    return (
      <Box key={block.id} mx="$md" mb="$sm">
        <Box
          borderWidth={1}
          style={[{ borderColor: theme.colors.gray200 }, { backgroundColor: theme.colors.white }]}
          borderRadius="$md"
          overflow="hidden"

        >
          <TextInput
            value={block.content}
            onChangeText={(text) => updateBlockContent(block.id, text)}
            placeholder={isFirst ? t("publish.forumStartWriting") : t("publish.forumContinueWriting")}
            placeholderTextColor={theme.colors.gray400}
            multiline
            textAlignVertical="top"
            style={styles.textBlockInput}
          />

          {/* 文本块底部操作栏 */}
          <HStack
            borderTopWidth={1}
            style={{ borderTopColor: theme.colors.gray100 }}
            px="$sm"
            py="$xs"
            alignItems="center"
            justifyContent="space-between"
          >
            <HStack gap="$sm">
              <TouchableOpacity
                onPress={() => setShowAddMenu(showAddMenu === block.id ? null : block.id)}
                style={styles.blockActionButton}
              >
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.gray500} />
              </TouchableOpacity>
            </HStack>

            {canDelete && (
              <TouchableOpacity
                onPress={() => deleteBlock(block.id)}
                style={styles.blockActionButton}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.gray400} />
              </TouchableOpacity>
            )}
          </HStack>
        </Box>

        {/* 添加内容菜单 */}
        {showAddMenu === block.id && (
          <Animated.View
            style={[
              styles.addMenuContainer,
              {
                opacity: addMenuAnim,
                transform: [
                  {
                    translateY: addMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <HStack gap="$md" p="$sm" style={{ backgroundColor: theme.colors.gray50 }} w="100%" borderRadius="$md">
              <TouchableOpacity
                onPress={() => handleAddTextBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray200 }]}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}

                >
                  <Ionicons name="text" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" style={{ color: theme.colors.gray600 }} mt="$xs">
                  {t("publish.blockText")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleAddImageBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray200 }]}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}

                >
                  <Ionicons name="image" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" style={{ color: theme.colors.gray600 }} mt="$xs">
                  {t("publish.blockImage")}
                </Text>
              </TouchableOpacity>
            </HStack>
          </Animated.View>
        )}
      </Box>
    );
  };

  const renderImageBlock = (block: ContentBlock, index: number) => {
    return (
      <Box key={block.id} mx="$md" mb="$sm">
        <Box borderRadius="$md" overflow="hidden" style={{ backgroundColor: theme.colors.gray100 }}>
          <MediaBlockPreview uri={block.content} />

          {/* 图片块操作栏 */}
          <HStack
            position="absolute"
            top={8}
            right={8}
            gap="$xs"
          >
            <TouchableOpacity
              onPress={() => deleteBlock(block.id)}
              style={styles.imageActionButton}
            >
              <Ionicons name="close" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </HStack>
        </Box>

        {/* 图片下方添加内容按钮 */}
        <HStack justifyContent="center" mt="$sm">
          <TouchableOpacity
            onPress={() => setShowAddMenu(showAddMenu === block.id ? null : block.id)}
            style={styles.addBetweenButton}
          >
            <Ionicons name="add" size={16} color={theme.colors.gray500} />
            <Text fontSize="$xs" style={{ color: theme.colors.gray500 }} ml="$xs">
              {t("publish.addContent")}
            </Text>
          </TouchableOpacity>
        </HStack>

        {/* 添加内容菜单 */}
        {showAddMenu === block.id && (
          <Animated.View
            style={[
              styles.addMenuContainer,
              {
                opacity: addMenuAnim,
                transform: [
                  {
                    translateY: addMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <HStack gap="$md" p="$sm" style={{ backgroundColor: theme.colors.gray50 }} borderRadius="$md" justifyContent="center">
              <TouchableOpacity
                onPress={() => handleAddTextBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray200 }]}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}

                >
                  <Ionicons name="text" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" style={{ color: theme.colors.gray600 }} mt="$xs">
                  {t("publish.blockText")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleAddImageBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray200 }]}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}

                >
                  <Ionicons name="image" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" style={{ color: theme.colors.gray600 }} mt="$xs">
                  {t("publish.blockImage")}
                </Text>
              </TouchableOpacity>
            </HStack>
          </Animated.View>
        )}
      </Box>
    );
  };

  const renderContentBlock = (block: ContentBlock, index: number) => {
    if (block.type === "text") {
      return renderTextBlock(block, index);
    }
    return renderImageBlock(block, index);
  };

  // 渲染社区选择器
  const renderCommunityPicker = () => {
    if (!showCommunityPicker) return null;

    return (
      <View style={styles.communityPickerOverlay}>
        <Pressable
          style={styles.communityPickerBackdrop}
          onPress={() => setShowCommunityPicker(false)}
        />
        <View style={styles.communityPickerContainer}>
          <HStack
            justifyContent="space-between"
            alignItems="center"
            p="$md"
            borderBottomWidth={1}
            style={{ borderBottomColor: theme.colors.gray100 }}
          >
            <Text fontSize="$lg" fontWeight="$semibold" style={{ color: theme.colors.black }}>
              {t("publish.selectCommunity")}
            </Text>
            <Pressable onPress={() => setShowCommunityPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.black} />
            </Pressable>
          </HStack>
          <RNScrollView style={styles.communityList}>
            {isLoadingCommunities ? (
              <Box py="$xl" alignItems="center" justifyContent="center">
                <Text style={{ color: theme.colors.gray500 }} fontSize="$sm">{t("publish.loading")}</Text>
              </Box>
            ) : communities.length === 0 ? (
              <Box py="$xl" alignItems="center" justifyContent="center">
                <Text style={{ color: theme.colors.gray500 }} fontSize="$sm">{t("publish.noCommunities")}</Text>
              </Box>
            ) : (
              communities.map((community) => (
                <Pressable
                  key={community.id}
                  onPress={() => {
                    setSelectedCommunity(community);
                    setShowCommunityPicker(false);
                  }}
                  style={[
                    styles.communityItem,
                    selectedCommunity?.id === community.id &&
                    styles.communityItemSelected,
                  ]}
                >
                  <HStack alignItems="center" gap="$sm">
                    <View style={styles.communityIconSmall}>
                      {community.iconUrl ? (
                        <OptimizedImage
                          uri={community.iconUrl}
                          size={ImageSize.THUMBNAIL}
                          style={styles.communityIconImage}
                          contentFit="cover"
                          lazy={true}
                        />
                      ) : (
                        <View style={styles.communityIconPlaceholder}>
                          <Text fontSize="$sm" fontWeight="$bold" style={{ color: theme.colors.white }}>
                            {community.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <VStack flex={1}>
                      <Text fontSize="$sm" fontWeight="$medium" style={{ color: theme.colors.black }}>
                        {community.name}
                      </Text>
                      <Text fontSize="$xs" style={{ color: theme.colors.gray500 }}>
                        {community.memberCount} {t("publish.members")}
                      </Text>
                    </VStack>
                    {selectedCommunity?.id === community.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.black}
                      />
                    )}
                  </HStack>
                </Pressable>
              ))
            )}
          </RNScrollView>
        </View>
      </View>
    );
  };

  return (
    // 仅保留 top 安全区. bottom 由内部的 PublishButtons 自己用
    // useSafeAreaInsets() 处理 — 否则 SafeAreaView 吃 bottom inset + KAV 又
    // 按完整键盘高度加 padding, 在 iOS 上会双重抵扣 ~34px, 表现为键盘弹起时
    // 输入框被错误顶到屏幕外 / 按钮被遮挡。
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={editMode ? t("publish.editPost") : t("publish.typeForumTitle")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* 编辑已发布 / 驳回帖子时显示提示。驳回单独走红色 banner，强调修复违规。 */}
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
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* 社区选择 */}
          <Pressable
            onPress={() => setShowCommunityPicker(true)}
            mx="$md"
            mb="$md"
          >
            <Box
              borderWidth={1}
              style={{ borderColor: theme.colors.gray200 }}
              borderRadius="$md"
              p="$sm"
            >
              <HStack alignItems="center" gap="$sm">
                {selectedCommunity ? (
                  <>
                    <View style={styles.communityIconSmall}>
                      {selectedCommunity.iconUrl ? (
                        <OptimizedImage
                          uri={selectedCommunity.iconUrl}
                          size={ImageSize.THUMBNAIL}
                          style={styles.communityIconImage}
                          contentFit="cover"
                          lazy={true}
                        />
                      ) : (
                        <View style={styles.communityIconPlaceholder}>
                          <Text fontSize="$sm" fontWeight="$bold" style={{ color: theme.colors.white }}>
                            {selectedCommunity.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text fontSize="$sm" style={{ color: theme.colors.black }} flex={1}>
                      {selectedCommunity.name}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={theme.colors.gray400}
                    />
                    <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} flex={1}>
                      {t("publish.selectCommunityPlaceholder")}
                    </Text>
                  </>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.gray400}
                />
              </HStack>
            </Box>
          </Pressable>

          {/* Cover Image */}
          <SingleImageUploader
            imageUri={coverImage}
            onImageSelected={setCoverImage}
            onImageRemoved={() => setCoverImage(null)}
            placeholder={t("publish.coverImagePlaceholder")}
            subtitle={t("publish.coverImageSubtitle")}
            height={300}
            enableCropper={true}
            defaultCropAspect="free"
          />

          {/* Title Input */}
          <Box mx="$md" mb="$md">
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
              placeholder={t("publish.forumTitlePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              multiline
              variant="filled"
              sx={{
                fontSize: 14,
                fontWeight: "600",
                minHeight: 50,
                textAlignVertical: "top",
                borderWidth: 0,
                backgroundColor: "transparent",
                padding: 0,
              }}
            />
          </Box>

          {/* 内容块列表 */}
          {contentBlocks.map((block, index) => renderContentBlock(block, index))}


          {/* 提示信息 */}
          <Box mx="$md" mb="$lg" p="$md" style={{ backgroundColor: theme.colors.gray50 }} borderRadius="$md">
            <HStack alignItems="center" gap="$sm">
              <Ionicons name="bulb-outline" size={18} color={theme.colors.gray500} />
              <Text style={{ color: theme.colors.gray500 }} fontSize="$xs" flex={1}>
                {t("publish.forumAddHint")}
              </Text>
            </HStack>
          </Box>
        </ScrollView>

        {/* PublishButtons 必须放在 KAV 内. 按钮自身是 position:absolute bottom:0,
            放到 KAV 外面时键盘弹起 KAV 上推内容、按钮原地不动 → 被键盘整个盖住,
            用户体感"返回 / 发布按键无响应". 放进 KAV 后, 键盘弹起 KAV 加 bottom
            padding, 绝对定位的按钮跟着上抬, 始终保持在键盘上方可点。 */}
        <PublishButtons
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          publishDisabled={!canPublish() || isPublishing || isSavingDraft}
          draftDisabled={isPublishing || isSavingDraft}
          publishButtonText={isPublishing ? uploadProgress || t("publish.publishing") : t("publish.title")}
          draftButtonText={isSavingDraft ? uploadProgress || t("publish.saving") : t("publish.saveDraft")}
        />
      </KeyboardAvoidingView>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => {
          setShowImagePicker(false);
          setInsertAfterBlockId(null);
        }}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
        onSelectVideo={handleVideoSelection}
        showVideoOption={true}
        title={t("publish.addMedia")}
      />

      {/* Community Picker */}
      {renderCommunityPicker()}
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
    textBlockInput: {
      backgroundColor: t.colors.card,
      minHeight: 120,
      padding: 12,
      fontSize: 14,
      lineHeight: 22,
      color: t.colors.text,
      textAlignVertical: "top",
    },
    blockActionButton: {
      padding: 6,
    },
    addMenuContainer: {
      marginTop: 8,
      alignItems: "center",
    },
    addMenuItem: {
      alignItems: "center",
      paddingHorizontal: 8,
    },
    imageActionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    addBetweenButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: t.colors.gray100,
      borderRadius: 16,
    },
    // 社区选择器样式
    communityIconSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
      overflow: "hidden",
    },
    communityIconImage: {
      width: "100%",
      height: "100%",
    },
    communityIconPlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: t.colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    communityPickerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "flex-end",
    },
    communityPickerBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.overlay,
    },
    communityPickerContainer: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "70%",
    },
    communityList: {
      maxHeight: 400,
    },
    communityItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    communityItemSelected: {
      backgroundColor: t.colors.gray50,
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

export default PublishForumPostScreen;
