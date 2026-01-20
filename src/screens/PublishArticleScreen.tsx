import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Modal,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  RichEditor,
  RichToolbar,
  actions,
} from "react-native-pell-rich-editor";
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
import ImagePickerModal from "../components/ImagePickerModal";
import PublishButtons from "../components/PublishButtons";
import SingleImageUploader from "../components/SingleImageUploader";
import { postService } from "../services/postService";
import { useAuthStore } from "../store/authStore";

const PublishArticleScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const richText = useRef<RichEditor>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [showContentImagePicker, setShowContentImagePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 检查表单是否完整（用于禁用发布按钮）
  const canPublish = (): boolean => {
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    return title.trim().length > 0 && textContent.length >= 100;
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.show("提示: 请填写标题");
      return false;
    }
    // 移除 HTML 标签来计算纯文本长度
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!textContent || textContent.length < 100) {
      Alert.show("提示: 文章内容至少需要100字");
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
      let uploadedUrls: string[] = [];

      // 如果有封面图，先上传
      if (coverImage) {
        setUploadProgress("上传封面图片...");
        const coverUrl = await postService.uploadImage(coverImage);
        uploadedUrls = [coverUrl];
      }

      // 创建帖子
      setUploadProgress("正在发布...");
      await postService.createPost({
        userId: user.userId,
        postType: "ARTICLES",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: htmlContent,
        imageUrls: uploadedUrls,
      });

      setUploadProgress(null);
      Alert.show("发布成功！", "", 1500);
      setTimeout(() => {
        resetForm();
        (navigation as any).reset({
          index: 0,
          routes: [{ name: "Main", params: { screen: "Home" } }],
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

    // 草稿至少需要有标题或内容
    if (!title.trim() && !content.trim()) {
      Alert.show("请至少填写标题或内容");
      return;
    }

    setIsSavingDraft(true);
    try {
      let uploadedUrls: string[] = [];

      // 如果有封面图，先上传
      if (coverImage) {
        setUploadProgress("上传封面图片...");
        const coverUrl = await postService.uploadImage(coverImage);
        uploadedUrls = [coverUrl];
      }

      // 保存草稿
      setUploadProgress("正在保存...");
      await postService.createPost({
        userId: user.userId,
        postType: "ARTICLES",
        postStatus: "DRAFT",
        title: title.trim() || "文章草稿",
        contentText: htmlContent,
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
    setContent("");
    setHtmlContent("");
    setCoverImage(null);
    setSelectedTags([]);
    richText.current?.setContentHTML("");
  };

  // 处理文章内容中插入图片
  const handleInsertContentImage = () => {
    Keyboard.dismiss();
    setShowContentImagePicker(true);
  };

  const handleContentImageSelection = async (source: "camera" | "gallery") => {
    setShowContentImagePicker(false);

    try {
      let result;

      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1.0,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        richText.current?.insertImage(imageUri);
        Alert.show("图片已插入", "", 1500);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
    }
  };

  // 处理富文本编辑器内容变化
  const handleContentChange = (html: string) => {
    setHtmlContent(html);
    // 移除 HTML 标签以获取纯文本用于计数
    const text = html.replace(/<[^>]*>/g, "");
    setContent(text);
  };

  const wordCount = content.trim().length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="时尚文章"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
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
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="文章标题，支持长标题"
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

          {/* Rich Text Editor */}
          <Box mx="$md" mb="$md">
            {/* Toolbar */}
            <Box
              mb="$sm"
              borderWidth={1}
              borderColor="$gray200"
              borderRadius="$md"
              overflow="hidden"
            >
              <RichToolbar
                editor={richText}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.heading1,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                  actions.blockquote,
                  actions.alignLeft,
                  actions.alignCenter,
                  actions.alignRight,
                  actions.code,
                  actions.line,
                  "insertImage",
                ]}
                iconMap={{
                  insertImage: ({ tintColor }: { tintColor: string }) => (
                    <Ionicons name="image" size={20} color={tintColor} />
                  ),
                }}
                onPressAddImage={handleInsertContentImage}
                style={styles.richToolbar}
                selectedIconTint={theme.colors.accent}
                disabledIconTint={theme.colors.gray300}
                iconTint={theme.colors.gray600}
              />
            </Box>

            {/* Editor */}
            <Box
              borderWidth={1}
              borderColor="$gray200"
              borderRadius="$md"
              overflow="hidden"
              minHeight={300}
            >
              <RichEditor
                ref={richText}
                onChange={handleContentChange}
                placeholder="支持段落、加粗、引用、插图...分享你的时尚观点、趋势分析或专业见解。最少需要100字。"
                style={styles.richEditor}
                initialHeight={300}
                useContainer={true}
                editorStyle={{
                  backgroundColor: theme.colors.white,
                  color: theme.colors.gray700,
                  placeholderColor: theme.colors.gray400,
                  contentCSSText: `
                    font-size: 16px;
                    line-height: 1.6;
                    padding: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  `,
                }}
              />
            </Box>
          </Box>

          {/* Word Count */}
          <Box mx="$md" mb="$md">
            <Text
              color={wordCount >= 100 ? "$gray500" : "$orange"}
              fontSize="$sm"
              textAlign="right"
            >
              {wordCount} / 100 字（最少）
            </Text>
          </Box>
        </ScrollView>

        {/* Bottom Buttons */}
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
      </KeyboardAvoidingView>

      {/* Modals */}
      <ImagePickerModal
        visible={showContentImagePicker}
        onClose={() => setShowContentImagePicker(false)}
        onSelectCamera={() => handleContentImageSelection("camera")}
        onSelectGallery={() => handleContentImageSelection("gallery")}
        title="插入图片"
      />
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
  richToolbar: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 0,
    minHeight: 50,
  },
  richEditor: {
    backgroundColor: theme.colors.white,
    flex: 1,
    minHeight: 300,
  },
});

export default PublishArticleScreen;
