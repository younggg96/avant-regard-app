import React, { useState } from "react";
import { StyleSheet, Modal } from "react-native";
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

const PublishArticleScreen = () => {
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const predefinedTags = ["趋势", "分析", "观点", "专业", "搭配", "推荐"];

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.show("提示: 请填写标题");
      return false;
    }
    if (!content.trim() || content.trim().length < 100) {
      Alert.show("提示: 文章内容至少需要100字");
      return false;
    }
    return true;
  };

  const handlePublish = () => {
    if (!validateForm()) {
      return;
    }

    const publishData = {
      type: "article",
      title,
      content,
      coverImage,
      tags: selectedTags,
    };

    console.log("Publishing:", publishData);

    Alert.show("发布成功: 您的时尚文章已成功发布！", "", 1000);
    setTimeout(() => {
      resetForm();
      navigation.goBack();
    }, 1000);
  };

  const handleSaveDraft = () => {
    const draftData = {
      type: "article",
      title,
      content,
      coverImage,
      tags: selectedTags,
    };

    console.log("Saving draft:", draftData);
    Alert.show("草稿已保存: 您的内容已保存为草稿");
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCoverImage(null);
    setSelectedTags([]);
  };

  const handleAddCoverImage = () => {
    setShowImagePicker(true);
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      let result;

      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 9],
          quality: 1.0,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCoverImage(result.assets[0].uri);
        Alert.show("封面已设置", "", 1500);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
    }
  };

  const handleRemoveCoverImage = () => {
    setCoverImage(null);
    Alert.show("封面已移除");
  };

  // Render cover image section
  const renderCoverImageSection = () => {
    if (!coverImage) {
      return (
        <Box mx="$md" mb="$md">
          <Pressable
            h={180}
            rounded="$md"
            overflow="hidden"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            borderWidth={1}
            borderColor="$gray200"
            borderStyle="dashed"
            onPress={handleAddCoverImage}
          >
            <Ionicons
              name="image-outline"
              size={40}
              color={theme.colors.gray400}
            />
            <Text color="$gray500" mt="$sm" fontSize="$sm">
              添加封面图（可选）
            </Text>
            <Text color="$gray400" fontSize="$xs" mt="$xs">
              建议尺寸 16:9
            </Text>
          </Pressable>
        </Box>
      );
    }

    return (
      <Box mx="$md" mb="$md" position="relative">
        <Box h={180} rounded="$md" overflow="hidden">
          <Image
            source={{ uri: coverImage }}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
          />
        </Box>

        {/* Remove button */}
        <Pressable
          position="absolute"
          top={8}
          right={8}
          w={32}
          h={32}
          rounded="$full"
          bg="rgba(0,0,0,0.6)"
          alignItems="center"
          justifyContent="center"
          onPress={handleRemoveCoverImage}
        >
          <Ionicons name="close" size={20} color={theme.colors.white} />
        </Pressable>
      </Box>
    );
  };

  // Render the bottom buttons
  const renderBottomButtons = () => (
    <Box
      position="absolute"
      bottom={6}
      left={0}
      right={0}
      bg="$white"
      px="$lg"
      py="$md"
      borderTopWidth={1}
      borderTopColor="$gray100"
    >
      <HStack>
        <Pressable
          flex={1}
          py="$md"
          mr="$sm"
          bg="$gray100"
          rounded="$md"
          onPress={handleSaveDraft}
        >
          <HStack justifyContent="center" alignItems="center" gap="$xs">
            <Ionicons
              name="bookmark-outline"
              size={20}
              color={theme.colors.gray600}
            />
            <Text color="$gray600" ml="$xs" fontWeight="$medium">
              存草稿
            </Text>
          </HStack>
        </Pressable>
        <Pressable
          flex={2}
          py="$md"
          ml="$sm"
          bg="$accent"
          rounded="$md"
          onPress={handlePublish}
        >
          <HStack justifyContent="center" alignItems="center" gap="$xs">
            <Ionicons name="paper-plane" size={20} color={theme.colors.white} />
            <Text color="$white" ml="$xs" fontWeight="$medium">
              发布
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );

  // Render image picker bottom sheet
  const renderImagePickerModal = () => (
    <Modal
      visible={showImagePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowImagePicker(false)}
    >
      <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="flex-end">
        <Pressable flex={1} onPress={() => setShowImagePicker(false)} />
        <Box
          bg="$white"
          borderTopLeftRadius="$lg"
          borderTopRightRadius="$lg"
          pb={34}
        >
          <HStack
            px="$lg"
            py="$md"
            borderBottomWidth={1}
            borderBottomColor="$gray100"
            alignItems="center"
            justifyContent="between"
          >
            <Text fontSize="$lg" color="$black" fontWeight="$medium">
              选择封面图
            </Text>
            <Pressable p="$xs" onPress={() => setShowImagePicker(false)}>
              <Ionicons name="close" size={24} color={theme.colors.gray600} />
            </Pressable>
          </HStack>

          <Pressable
            px="$lg"
            py="$lg"
            onPress={() => handleImageSelection("camera")}
          >
            <HStack alignItems="center">
              <Ionicons name="camera" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                拍照
              </Text>
            </HStack>
          </Pressable>

          <Pressable
            px="$lg"
            py="$lg"
            onPress={() => handleImageSelection("gallery")}
          >
            <HStack alignItems="center">
              <Ionicons name="images" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                从相册选择
              </Text>
            </HStack>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );

  const wordCount = content.trim().length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="时尚文章"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Cover Image */}
        {renderCoverImageSection()}

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

        {/* Content Input */}
        <Box mx="$md" mb="$md" flex={1}>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder="支持段落、加粗、引用、插图...&#10;&#10;分享你的时尚观点、趋势分析或专业见解。最少需要100字。"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="filled"
            sx={{
              color: theme.colors.gray600,
              fontSize: 16,
              lineHeight: 24,
              minHeight: 300,
              textAlignVertical: "top",
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
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
      {renderBottomButtons()}

      {/* Modals */}
      {renderImagePickerModal()}
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
});

export default PublishArticleScreen;
