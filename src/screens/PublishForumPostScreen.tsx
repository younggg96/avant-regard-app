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
  Image,
  Dimensions,
  Animated,
  View,
  ScrollView as RNScrollView,
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
  HStack,
  VStack,
  Input,
  Pressable,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import PublishButtons from "../components/PublishButtons";
import SingleImageUploader from "../components/SingleImageUploader";
import ImagePickerModal from "../components/ImagePickerModal";
import { postService } from "../services/postService";
import { getCommunities, Community } from "../services/communityService";
import { useAuthStore } from "../store/authStore";
import { Post } from "../components/PostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 内容块类型定义
type ContentBlockType = "text" | "image";

interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string; // 文本内容或图片 URI
}

// 路由参数类型
type PublishForumPostRouteParams = {
  editMode?: boolean;
  draftPost?: Post;
  communityId?: number;
};

// 生成唯一 ID
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const PublishForumPostScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: PublishForumPostRouteParams }, "params">>();
  const { user } = useAuthStore();
  const scrollViewRef = useRef<any>(null);

  // 获取编辑模式参数
  const editMode = route.params?.editMode || false;
  const draftPost = route.params?.draftPost;
  const initialCommunityId = route.params?.communityId;

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
      Alert.show("提示: 请填写标题");
      return false;
    }
    if (!selectedCommunity) {
      Alert.show("提示: 请选择发布的社区");
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
      let result;

      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        if (insertAfterBlockId) {
          insertBlockAfter(insertAfterBlockId, "image", imageUri);
          // 插入图片后，自动在图片下方添加一个空文本块
          setTimeout(() => {
            const blocks = contentBlocks;
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock.type === "image") {
              setContentBlocks((prev) => [
                ...prev,
                { id: generateId(), type: "text", content: "" },
              ]);
            }
          }, 100);
        }
        setInsertAfterBlockId(null);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
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
      Alert.show("请先登录");
      return;
    }

    setIsPublishing(true);
    try {
      const allImages = getAllImageUrls();
      const uploadedUrls: string[] = [];
      const imageMapping: Record<string, string> = {};

      // 上传所有本地图片
      for (let i = 0; i < allImages.length; i++) {
        const imageUri = allImages[i];
        if (isRemoteUrl(imageUri)) {
          uploadedUrls.push(imageUri);
          imageMapping[imageUri] = imageUri;
        } else {
          setUploadProgress(`上传图片 ${i + 1}/${allImages.length}...`);
          const uploadedUrl = await postService.uploadImage(imageUri);
          uploadedUrls.push(uploadedUrl);
          imageMapping[imageUri] = uploadedUrl;
        }
      }

      // 更新内容块中的图片 URL
      const updatedBlocks = contentBlocks.map((block) => {
        if (block.type === "image" && imageMapping[block.content]) {
          return { ...block, content: imageMapping[block.content] };
        }
        return block;
      });

      // 创建或更新帖子
      setUploadProgress("正在发布...");

      const contentText = JSON.stringify(updatedBlocks);
      const finalCoverImage = coverImage ? imageMapping[coverImage] || coverImage : null;

      if (editMode && draftPostId) {
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "ARTICLES",
          status: "PUBLISHED",
          title: title.trim(),
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          communityId: selectedCommunity?.id,
        });
      } else {
        await postService.createPost({
          userId: user.userId,
          postType: "ARTICLES",
          postStatus: "PUBLISHED",
          title: title.trim(),
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          communityId: selectedCommunity?.id,
        });
      }

      setUploadProgress(null);
      Alert.show("发布成功！", "", 1500);
      setTimeout(() => {
        resetForm();
        if (editMode) {
          navigation.goBack();
        } else {
          (navigation as any).reset({
            index: 0,
            routes: [{ name: "Main", params: { screen: "Home" } }],
          });
        }
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

    // 草稿至少需要有标题或内容
    const hasContent = contentBlocks.some(
      (block) => block.content.trim().length > 0
    );
    if (!title.trim() && !hasContent) {
      Alert.show("请至少填写标题或内容");
      return;
    }

    setIsSavingDraft(true);
    try {
      const allImages = getAllImageUrls();
      const uploadedUrls: string[] = [];
      const imageMapping: Record<string, string> = {};

      // 上传所有本地图片
      for (let i = 0; i < allImages.length; i++) {
        const imageUri = allImages[i];
        if (isRemoteUrl(imageUri)) {
          uploadedUrls.push(imageUri);
          imageMapping[imageUri] = imageUri;
        } else {
          setUploadProgress(`上传图片 ${i + 1}/${allImages.length}...`);
          const uploadedUrl = await postService.uploadImage(imageUri);
          uploadedUrls.push(uploadedUrl);
          imageMapping[imageUri] = uploadedUrl;
        }
      }

      // 更新内容块中的图片 URL
      const updatedBlocks = contentBlocks.map((block) => {
        if (block.type === "image" && imageMapping[block.content]) {
          return { ...block, content: imageMapping[block.content] };
        }
        return block;
      });

      setUploadProgress("正在保存...");

      const contentText = JSON.stringify(updatedBlocks);
      const finalCoverImage = coverImage ? imageMapping[coverImage] || coverImage : null;

      if (editMode && draftPostId) {
        await postService.updatePost(draftPostId, {
          userId: user.userId,
          postType: "ARTICLES",
          status: "DRAFT",
          title: title.trim() || "论坛草稿",
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          communityId: selectedCommunity?.id,
        });
      } else {
        await postService.createPost({
          userId: user.userId,
          postType: "ARTICLES",
          postStatus: "DRAFT",
          title: title.trim() || "论坛草稿",
          contentText,
          imageUrls: finalCoverImage ? [finalCoverImage] : [],
          communityId: selectedCommunity?.id,
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
          borderColor="$gray200"
          borderRadius="$md"
          overflow="hidden"
          bg="$white"
        >
          <TextInput
            value={block.content}
            onChangeText={(text) => updateBlockContent(block.id, text)}
            placeholder={isFirst ? "开始写下你的想法..." : "继续写..."}
            placeholderTextColor={theme.colors.gray400}
            multiline
            textAlignVertical="top"
            style={styles.textBlockInput}
          />

          {/* 文本块底部操作栏 */}
          <HStack
            borderTopWidth={1}
            borderTopColor="$gray100"
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
            <HStack gap="$md" p="$sm" bg="$gray50" w="100%" borderRadius="$md">
              <TouchableOpacity
                onPress={() => handleAddTextBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  bg="$white"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="$gray200"
                >
                  <Ionicons name="text" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" color="$gray600" mt="$xs">
                  文字
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
                  bg="$white"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="$gray200"
                >
                  <Ionicons name="image" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" color="$gray600" mt="$xs">
                  图片
                </Text>
              </TouchableOpacity>
            </HStack>
          </Animated.View>
        )}
      </Box>
    );
  };

  // 渲染图片块
  const renderImageBlock = (block: ContentBlock, index: number) => {
    return (
      <Box key={block.id} mx="$md" mb="$sm">
        <Box borderRadius="$md" overflow="hidden" bg="$gray100">
          <Image
            source={{ uri: block.content }}
            style={styles.imageBlock}
            resizeMode="cover"
          />

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
            <Text fontSize="$xs" color="$gray500" ml="$xs">
              添加内容
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
            <HStack gap="$md" p="$sm" bg="$gray50" borderRadius="$md" justifyContent="center">
              <TouchableOpacity
                onPress={() => handleAddTextBlock(block.id)}
                style={styles.addMenuItem}
              >
                <Box
                  w={44}
                  h={44}
                  borderRadius="$full"
                  bg="$white"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="$gray200"
                >
                  <Ionicons name="text" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" color="$gray600" mt="$xs">
                  文字
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
                  bg="$white"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="$gray200"
                >
                  <Ionicons name="image" size={20} color={theme.colors.accent} />
                </Box>
                <Text fontSize="$xs" color="$gray600" mt="$xs">
                  图片
                </Text>
              </TouchableOpacity>
            </HStack>
          </Animated.View>
        )}
      </Box>
    );
  };

  // 渲染内容块
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
            borderBottomColor="$gray100"
          >
            <Text fontSize="$lg" fontWeight="$semibold" color="$black">
              选择社区
            </Text>
            <Pressable onPress={() => setShowCommunityPicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.black} />
            </Pressable>
          </HStack>
          <RNScrollView style={styles.communityList}>
            {isLoadingCommunities ? (
              <Box py="$xl" alignItems="center" justifyContent="center">
                <Text color="$gray500" fontSize="$sm">加载中...</Text>
              </Box>
            ) : communities.length === 0 ? (
              <Box py="$xl" alignItems="center" justifyContent="center">
                <Text color="$gray500" fontSize="$sm">暂无社区</Text>
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
                        <Image
                          source={{ uri: community.iconUrl }}
                          style={styles.communityIconImage}
                        />
                      ) : (
                        <View style={styles.communityIconPlaceholder}>
                          <Text fontSize="$sm" fontWeight="$bold" color="$white">
                            {community.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <VStack flex={1}>
                      <Text fontSize="$sm" fontWeight="$medium" color="$black">
                        {community.name}
                      </Text>
                      <Text fontSize="$xs" color="$gray500">
                        {community.memberCount} 成员
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={editMode ? "编辑帖子" : "用户论坛"}
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

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* 社区选择 */}
          <Pressable
            onPress={() => setShowCommunityPicker(true)}
            mx="$md"
            mb="$md"
          >
            <Box
              borderWidth={1}
              borderColor="$gray200"
              borderRadius="$md"
              p="$sm"
            >
              <HStack alignItems="center" gap="$sm">
                {selectedCommunity ? (
                  <>
                    <View style={styles.communityIconSmall}>
                      {selectedCommunity.iconUrl ? (
                        <Image
                          source={{ uri: selectedCommunity.iconUrl }}
                          style={styles.communityIconImage}
                        />
                      ) : (
                        <View style={styles.communityIconPlaceholder}>
                          <Text fontSize="$sm" fontWeight="$bold" color="$white">
                            {selectedCommunity.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text fontSize="$sm" color="$black" flex={1}>
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
                    <Text fontSize="$sm" color="$gray400" flex={1}>
                      选择发布的社区
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
            placeholder="添加封面图（可选）"
            subtitle="建议尺寸 1:1"
            height={300}
            aspectRatio={[1, 1]}
          />

          {/* Title Input */}
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
              placeholder="帖子标题，支持长标题"
              placeholderTextColor={theme.colors.gray400}
              multiline
              variant="filled"
              sx={{
                fontSize: 20,
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
          <Box mx="$md" mb="$lg" p="$md" bg="$gray50" borderRadius="$md">
            <HStack alignItems="center" gap="$sm">
              <Ionicons name="bulb-outline" size={18} color={theme.colors.gray500} />
              <Text color="$gray500" fontSize="$xs" flex={1}>
                点击文本框下方的 + 按钮可以添加更多文字或图片
              </Text>
            </HStack>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Buttons */}
      <PublishButtons
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        publishDisabled={!canPublish() || isPublishing || isSavingDraft}
        draftDisabled={isPublishing || isSavingDraft}
        publishButtonText={isPublishing ? uploadProgress || "发布中..." : "发布"}
        draftButtonText={isSavingDraft ? uploadProgress || "保存中..." : "存草稿"}
      />

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => {
          setShowImagePicker(false);
          setInsertAfterBlockId(null);
        }}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
        title="添加图片"
      />

      {/* Community Picker */}
      {renderCommunityPicker()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
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
    backgroundColor: theme.colors.white,
    minHeight: 120,
    padding: 12,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.gray700,
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
  imageBlock: {
    width: "100%",
    height: 200,
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
    backgroundColor: theme.colors.gray100,
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
    backgroundColor: theme.colors.black,
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  communityPickerContainer: {
    backgroundColor: theme.colors.white,
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
    borderBottomColor: theme.colors.gray100,
  },
  communityItemSelected: {
    backgroundColor: theme.colors.gray50,
  },
});

export default PublishForumPostScreen;
