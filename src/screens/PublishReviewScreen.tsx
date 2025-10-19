import React, { useState, useEffect } from "react";
import { StyleSheet, Modal, Dimensions } from "react-native";
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
import LookSelectorModal from "../components/LookSelectorModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import showsData from "../data/data.json";

const { width: screenWidth } = Dimensions.get("window");

interface LookImage {
  image_url: string;
  image_type: string;
}

interface Show {
  show_url: string;
  season: string;
  category: string;
  images: LookImage[];
}

interface DesignerData {
  designer: string;
  shows: Show[];
}

interface SelectedLook {
  designer: string;
  season: string;
  imageUrl: string;
}

const PublishReviewScreen = () => {
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLooks, setSelectedLooks] = useState<SelectedLook[]>([]);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [showLookSelector, setShowLookSelector] = useState(false);
  const [showLookPreview, setShowLookPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewLook, setPreviewLook] = useState<SelectedLook | null>(null);
  const [cropperImageUri, setCropperImageUri] = useState<string | null>(null);
  const [allLooks, setAllLooks] = useState<
    Array<{ designer: string; season: string; imageUrl: string }>
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  const MAX_IMAGES = 6;
  const MAX_LOOKS = 6;

  const predefinedTags = ["推荐", "性价比", "质量", "设计", "舒适", "值得"];

  // 加载所有 look 数据
  useEffect(() => {
    const looks: Array<{
      designer: string;
      season: string;
      imageUrl: string;
    }> = [];

    (showsData as DesignerData[]).forEach((designerData) => {
      designerData.shows.forEach((show) => {
        if (show.images && show.images.length > 0) {
          show.images.forEach((img) => {
            if (img.image_type === "look") {
              looks.push({
                designer: designerData.designer,
                season: show.season,
                imageUrl: img.image_url,
              });
            }
          });
        }
      });
    });

    setAllLooks(looks);
  }, []);

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
    if (images.length === 0) {
      Alert.show("提示: 请至少上传一张产品图片");
      return false;
    }
    if (selectedLooks.length === 0) {
      Alert.show("提示: 请至少关联一个相关造型");
      return false;
    }
    if (!reviewText.trim()) {
      Alert.show("提示: 请填写评价内容");
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
      associatedLooks: selectedLooks,
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
      associatedLooks: selectedLooks,
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
    setSelectedLooks([]);
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

  const handleSelectLook = (look: SelectedLook) => {
    if (selectedLooks.length >= MAX_LOOKS) {
      Alert.show("提示: 最多只能关联" + MAX_LOOKS + "个造型");
      return;
    }

    // 检查是否已经添加过相同的 look
    const isDuplicate = selectedLooks.some(
      (item) =>
        item.designer === look.designer &&
        item.season === look.season &&
        item.imageUrl === look.imageUrl
    );

    if (isDuplicate) {
      Alert.show("提示: 该造型已经添加过了");
      return;
    }

    setSelectedLooks([...selectedLooks, look]);
    setShowLookSelector(false);
    Alert.show("已关联造型", "", 1500);
  };

  const handleRemoveLook = (index: number) => {
    const newLooks = selectedLooks.filter((_, i) => i !== index);
    setSelectedLooks(newLooks);
    Alert.show("已取消关联");
  };

  const filteredLooks = searchQuery
    ? allLooks.filter(
        (look) =>
          look.designer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          look.season.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allLooks;

  // 评分组件
  const renderRatingSection = () => (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text color="$gray600" fontSize="$sm">
          评分
        </Text>
        <Text color="$red500" fontSize="$sm" ml="$xs">
          *
        </Text>
      </HStack>
      <HStack gap="$sm" pl="$md">
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

  // 产品图片组件
  const renderImageGallery = () => {
    const itemWidth = (screenWidth - 48 - 16) / 3; // 减去左右边距和间距

    return (
      <Box mx="$md" mb="$md">
        <HStack mb="$sm" alignItems="center">
          <Text color="$gray600" fontSize="$sm">
            产品图片
          </Text>
          <Text color="$red500" fontSize="$sm" ml="$xs">
            *
          </Text>
        </HStack>
        <HStack flexWrap="wrap" gap="$sm" pl="$md">
          {images.map((image, index) => (
            <Box
              key={`image-${index}`}
              w={itemWidth}
              h={itemWidth}
              position="relative"
            >
              <Pressable
                onPress={() => {
                  setPreviewImageIndex(index);
                  setShowImagePreview(true);
                }}
              >
                <Image
                  source={{ uri: image }}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 8,
                  }}
                />
              </Pressable>
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
              w={itemWidth}
              h={itemWidth}
              rounded="$sm"
              bg="$gray100"
              alignItems="center"
              justifyContent="center"
              onPress={handleAddImage}
            >
              <Ionicons name="add" size={24} color={theme.colors.gray400} />
            </Pressable>
          )}
        </HStack>
      </Box>
    );
  };

  // 关联造型组件
  const renderSelectedLook = () => {
    const lookWidth = (screenWidth - 48 - 16) / 3; // 减去左右边距和间距

    return (
      <Box mx="$md" mb="$md">
        <HStack mb="$sm" alignItems="center">
          <Text color="$gray600" fontSize="$sm">
            关联造型
          </Text>
          <Text color="$red500" fontSize="$sm" ml="$xs">
            *
          </Text>
        </HStack>

        <HStack flexWrap="wrap" gap="$sm" pl="$md">
          {/* 已选择的 Look 列表 */}
          {selectedLooks.map((look, index) => (
            <Box key={`look-${index}`} w={lookWidth} position="relative">
              <Pressable
                onPress={() => {
                  setPreviewLook(look);
                  setShowLookPreview(true);
                }}
              >
                <Box
                  borderWidth={1}
                  borderColor="$gray200"
                  rounded="$md"
                  overflow="hidden"
                  bg="$white"
                >
                  <Image
                    source={{ uri: look.imageUrl }}
                    style={{
                      width: "100%",
                      height: lookWidth * 1.5,
                    }}
                  />
                  <Box p="$xs" bg="$white">
                    <Text
                      fontSize="$xs"
                      color="$black"
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {look.designer}
                    </Text>
                    <Text fontSize={10} color="$gray400" numberOfLines={1}>
                      {look.season}
                    </Text>
                  </Box>
                </Box>
              </Pressable>

              {/* 删除按钮 */}
              <Pressable
                position="absolute"
                top={4}
                right={4}
                w={24}
                h={24}
                rounded="$full"
                bg="rgba(0,0,0,0.7)"
                alignItems="center"
                justifyContent="center"
                onPress={() => handleRemoveLook(index)}
              >
                <Ionicons name="close" size={14} color={theme.colors.white} />
              </Pressable>
            </Box>
          ))}

          {/* 添加按钮 */}
          {selectedLooks.length < MAX_LOOKS && (
            <Pressable
              w={lookWidth}
              h={lookWidth * 1.5 + 44}
              rounded="$sm"
              bg="$gray100"
              alignItems="center"
              justifyContent="center"
              onPress={() => setShowLookSelector(true)}
            >
              <Ionicons
                name="add-circle-outline"
                size={32}
                color={theme.colors.gray400}
              />
              <Text color="$gray400" fontSize="$xs" mt="$xs">
                添加造型
              </Text>
            </Pressable>
          )}
        </HStack>
      </Box>
    );
  };

  // 底部按钮组件
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

  // 图片选择器组件
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

  // 图片裁剪组件
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
            placeholder="为这个单品写一个标题"
            placeholderTextColor={theme.colors.gray400}
            variant="outline"
            sx={{
              fontSize: 18,
              fontWeight: "500",
              minHeight: 50,
              borderWidth: 0,
              padding: 0,
            }}
          />
        </Box>

        {/* 产品图片 */}
        <Box key="image-gallery-section">{renderImageGallery()}</Box>

        <Box mx="$md" mb="$md">
          <HStack mb="$sm" alignItems="center">
            <Text color="$gray600" fontSize="$sm">
              产品名称
            </Text>
            <Text color="$red500" fontSize="$sm" ml="$xs">
              *
            </Text>
          </HStack>
          <Input
            value={productName}
            onChangeText={setProductName}
            placeholder="输入产品名称"
            placeholderTextColor={theme.colors.gray400}
            variant="outline"
            sx={{
              fontSize: 16,
              borderWidth: 0,
              padding: 0,
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
              borderWidth: 0,
              padding: 0,
            }}
          />
        </Box>

        {renderRatingSection()}

        {/* 关联造型 */}
        <Box key="selected-look-section">{renderSelectedLook()}</Box>

        {/* 评价内容 */}
        <Box mx="$md" mb="$md">
          <HStack mb="$sm" alignItems="center">
            <Text color="$gray600" fontSize="$sm">
              评价内容
            </Text>
            <Text color="$red500" fontSize="$sm" ml="$xs">
              *
            </Text>
          </HStack>
          <Input
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="输入简短点评（50-200字）"
            placeholderTextColor={theme.colors.gray400}
            multiline
            variant="outline"
            sx={{
              color: theme.colors.gray600,
              minHeight: 120,
              textAlignVertical: "top",
              borderWidth: 0,
              backgroundColor: "transparent",
              padding: 0,
            }}
          />
        </Box>
      </ScrollView>

      {renderBottomButtons()}
      {renderImagePickerModal()}

      <ImagePreviewModal
        visible={showLookPreview}
        imageUrl={previewLook?.imageUrl || ""}
        title={previewLook?.designer}
        subtitle={previewLook?.season}
        onClose={() => setShowLookPreview(false)}
      />

      <ImagePreviewModal
        visible={showImagePreview}
        imageUrls={images}
        initialIndex={previewImageIndex}
        title=""
        onClose={() => setShowImagePreview(false)}
      />

      <LookSelectorModal
        visible={showLookSelector}
        looks={filteredLooks}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectLook={handleSelectLook}
        onClose={() => setShowLookSelector(false)}
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
});

export default PublishReviewScreen;
