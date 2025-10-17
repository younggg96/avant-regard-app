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
import ImageCropper from "../components/ImageCropper";

const PublishReviewScreen = () => {
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);

  const MAX_IMAGES = 6;

  const predefinedTags = ["推荐", "性价比", "质量", "设计", "舒适", "值得"];

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.show("提示: 请填写评价标题");
      return false;
    }
    if (!productName.trim()) {
      Alert.show("提示: 请填写产品名称");
      return false;
    }
    if (rating === 0) {
      Alert.show("提示: 请给出评分");
      return false;
    }
    if (!reviewText.trim()) {
      Alert.show("提示: 单品评价需要填写评价内容");
      return false;
    }
    return true;
  };

  const handlePublish = () => {
    if (!validateForm()) {
      return;
    }

    const publishData = {
      type: "review",
      title,
      productName,
      brand,
      rating,
      reviewText,
      images,
      tags: selectedTags,
    };

    console.log("Publishing:", publishData);

    Alert.show("发布成功: 您的评价已成功发布！", "", 1000);
    setTimeout(() => {
      resetForm();
      navigation.goBack();
    }, 1000);
  };

  const handleSaveDraft = () => {
    const draftData = {
      type: "review",
      title,
      productName,
      brand,
      rating,
      reviewText,
      images,
      tags: selectedTags,
    };

    console.log("Saving draft:", draftData);
    Alert.show("草稿已保存: 您的内容已保存为草稿");
  };

  const resetForm = () => {
    setTitle("");
    setProductName("");
    setBrand("");
    setRating(0);
    setReviewText("");
    setImages([]);
    setSelectedTags([]);
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

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    Alert.show("图片已移除");
  };

  const handleCropDone = (croppedUri: string) => {
    setShowImageCropper(false);
    const newImages = [...images, croppedUri];
    setImages(newImages);
    Alert.show("图片已添加", "", 1500);
    setCropperImageUri(null);
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    setCropperImageUri(null);
  };

  const renderRatingSection = () => (
    <Box mx="$md" mb="$md">
      <Text color="$gray600" fontSize="$sm" mb="$sm">
        评分
      </Text>
      <HStack gap="$sm">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={32}
              color={star <= rating ? "#FFD700" : theme.colors.gray300}
            />
          </Pressable>
        ))}
      </HStack>
    </Box>
  );

  const renderImageGallery = () => (
    <Box mx="$md" mb="$md">
      <Text color="$gray600" fontSize="$sm" mb="$sm">
        产品图片
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((image, index) => (
          <Box
            key={`${image}-${index}`}
            w={80}
            h={80}
            mr="$sm"
            position="relative"
          >
            <Image
              source={{ uri: image }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 8,
              }}
            />
            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={24}
              h={24}
              rounded="$full"
              bg="rgba(0,0,0,0.6)"
              alignItems="center"
              justifyContent="center"
              onPress={() => handleRemoveImage(index)}
            >
              <Ionicons name="close" size={16} color={theme.colors.white} />
            </Pressable>
          </Box>
        ))}
        {images.length < MAX_IMAGES && (
          <Pressable
            w={80}
            h={80}
            rounded="$sm"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            onPress={handleAddImage}
          >
            <Ionicons name="add" size={24} color={theme.colors.gray400} />
          </Pressable>
        )}
      </ScrollView>
    </Box>
  );

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
              选择图片
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

  if (showImageCropper && cropperImageUri) {
    return (
      <ImageCropper
        sourceUri={cropperImageUri}
        aspect="1:1"
        onCancel={handleCropCancel}
        onDone={handleCropDone}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="单品评价"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Box mx="$md" mb="$md" mt="$md">
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="为这个单品写一个标题"
            placeholderTextColor={theme.colors.gray400}
            variant="filled"
            sx={{
              fontSize: 18,
              fontWeight: "500",
              minHeight: 50,
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </Box>

        <Box mx="$md" mb="$md">
          <Text color="$gray600" fontSize="$sm" mb="$sm">
            产品名称
          </Text>
          <Input
            value={productName}
            onChangeText={setProductName}
            placeholder="输入产品名称"
            placeholderTextColor={theme.colors.gray400}
            variant="outline"
            sx={{
              fontSize: 16,
            }}
          />
        </Box>

        <Box mx="$md" mb="$md">
          <Text color="$gray600" fontSize="$sm" mb="$sm">
            品牌（可选）
          </Text>
          <Input
            value={brand}
            onChangeText={setBrand}
            placeholder="输入品牌名称"
            placeholderTextColor={theme.colors.gray400}
            variant="outline"
            sx={{
              fontSize: 16,
            }}
          />
        </Box>

        {renderRatingSection()}

        {images.length > 0 && renderImageGallery()}

        <Box mx="$md" mb="$md">
          <Text color="$gray600" fontSize="$sm" mb="$sm">
            评价内容
          </Text>
          <Input
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="输入简短点评（50-200字）"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="filled"
            sx={{
              color: theme.colors.gray600,
              minHeight: 120,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: theme.colors.gray200,
              backgroundColor: "$white",
              padding: 12,
            }}
          />
        </Box>
      </ScrollView>

      {renderBottomButtons()}
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

export default PublishReviewScreen;
