/**
 * 发布论坛帖子页面
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { createPost, uploadImage } from "../services/postService";
import { getCommunities, Community } from "../services/communityService";
import { useAuthStore } from "../store/authStore";
import { saveDraft, getDraft, clearDraft } from "../services/draftService";

type RouteParams = {
  PublishForumPost: {
    communityId?: number;
  };
};

const MAX_IMAGES = 9;

const PublishForumPostScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "PublishForumPost">>();
  const initialCommunityId = route.params?.communityId;

  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 加载社区列表
  useEffect(() => {
    const loadCommunities = async () => {
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
      }
    };
    loadCommunities();
  }, [initialCommunityId]);

  // 加载草稿
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft("forum");
      if (draft) {
        setTitle(draft.title || "");
        setContent(draft.content || "");
        setImages(draft.images || []);
      }
    };
    loadDraft();
  }, []);

  // 自动保存草稿
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || content || images.length > 0) {
        saveDraft("forum", {
          title,
          content,
          images,
          communityId: selectedCommunity?.id,
        });
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, content, images, selectedCommunity]);

  // 处理图片压缩
  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return result.uri;
    } catch (error) {
      console.error("图片压缩失败:", error);
      return uri;
    }
  };

  // 选择图片
  const handlePickImages = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      Alert.alert("提示", `最多只能添加 ${MAX_IMAGES} 张图片`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("提示", "需要相册权限才能选择图片");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const compressedImages = await Promise.all(
        result.assets.map((asset) => compressImage(asset.uri))
      );
      setImages((prev) => [...prev, ...compressedImages]);
    }
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 发布帖子
  const handleSubmit = async (isDraft: boolean = false) => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入标题");
      return;
    }

    if (!selectedCommunity) {
      Alert.alert("提示", "请选择发布的社区");
      return;
    }

    if (!user?.userId) {
      Alert.alert("提示", "请先登录");
      return;
    }

    setIsSubmitting(true);

    try {
      // 上传图片
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        setUploadProgress(0);
        for (let i = 0; i < images.length; i++) {
          const url = await uploadImage(images[i]);
          uploadedUrls.push(url);
          setUploadProgress(((i + 1) / images.length) * 100);
        }
      }

      // 创建帖子
      await createPost({
        userId: user.userId,
        postType: "FORUM",
        postStatus: isDraft ? "DRAFT" : "PUBLISHED",
        title: title.trim(),
        contentText: content.trim(),
        imageUrls: uploadedUrls,
        communityId: selectedCommunity.id,
      });

      // 清除草稿
      await clearDraft("forum");

      Alert.alert(
        "成功",
        isDraft ? "草稿已保存" : "帖子发布成功，等待审核",
        [
          {
            text: "确定",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.error("发布失败:", err);
      Alert.alert("错误", err instanceof Error ? err.message : "发布失败");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
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
          <ScrollView style={styles.communityList}>
            {communities.map((community) => (
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
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="发布帖子"
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <HStack gap="$sm">
            <Pressable
              onPress={() => handleSubmit(true)}
              px="$sm"
              py="$xs"
              disabled={isSubmitting}
            >
              <Text color="$gray500" fontSize="$sm">
                存草稿
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleSubmit(false)}
              px="$md"
              py="$xs"
              bg="$black"
              rounded="$md"
              disabled={isSubmitting || !title.trim() || !selectedCommunity}
              opacity={isSubmitting || !title.trim() || !selectedCommunity ? 0.5 : 1}
            >
              <Text color="$white" fontSize="$sm" fontWeight="$medium">
                发布
              </Text>
            </Pressable>
          </HStack>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 选择社区 */}
          <Pressable
            onPress={() => setShowCommunityPicker(true)}
            style={styles.communitySelector}
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
                  <Text fontSize="$sm" color="$black">
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
                  <Text fontSize="$sm" color="$gray400">
                    选择发布的社区
                  </Text>
                </>
              )}
              <Box flex={1} />
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray400}
              />
            </HStack>
          </Pressable>

          {/* 标题输入 */}
          <TextInput
            style={styles.titleInput}
            placeholder="添加标题"
            placeholderTextColor={theme.colors.gray400}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* 内容输入 */}
          <TextInput
            style={styles.contentInput}
            placeholder="分享你的想法..."
            placeholderTextColor={theme.colors.gray400}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          {/* 图片预览 */}
          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handlePickImages}
                >
                  <Ionicons
                    name="add"
                    size={32}
                    color={theme.colors.gray400}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 添加图片按钮 */}
          {images.length === 0 && (
            <TouchableOpacity
              style={styles.addFirstImageButton}
              onPress={handlePickImages}
            >
              <Ionicons
                name="image-outline"
                size={24}
                color={theme.colors.gray400}
              />
              <Text color="$gray400" fontSize="$sm" ml="$sm">
                添加图片（最多 {MAX_IMAGES} 张）
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 上传进度 */}
      {isSubmitting && uploadProgress > 0 && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text color="$black" fontSize="$sm" mt="$sm">
              上传图片 {Math.round(uploadProgress)}%
            </Text>
          </View>
        </View>
      )}

      {/* 社区选择器 */}
      {renderCommunityPicker()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollContent: {
    padding: 16,
  },
  communitySelector: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
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
  titleInput: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.black,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    paddingVertical: 12,
    marginBottom: 16,
  },
  contentInput: {
    fontSize: 16,
    color: theme.colors.black,
    minHeight: 150,
    lineHeight: 24,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addFirstImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 24,
    marginTop: 16,
  },
  progressOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
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
