import React, { useState } from "react";
import { StyleSheet, Modal } from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import ImageCropPicker from "react-native-image-crop-picker";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  VStack,
  HStack,
  Image,
  Input,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageEditMenu from "../components/ImageEditMenu";

type ContentType = "lookbook" | "outfit" | "review" | "article";

interface ContentOption {
  id: ContentType;
  title: string;
  subtitle: string;
}

// State interfaces for different content types
interface LookbookState {
  title: string;
  coverImage: string | null;
  description: string;
  images: string[];
  tags: string[];
  customTags: string;
}

interface OutfitState {
  title: string;
  images: string[];
  description: string;
  tags: string[];
  customTags: string;
  occasions: string[];
  hashtags: string;
  linkedItems: string[];
}

interface ReviewState {
  title: string;
  productName: string;
  brand: string;
  rating: number;
  reviewText: string;
  images: string[];
  pros: string;
  cons: string;
  priceRange: string;
}

interface ArticleState {
  title: string;
  content: string;
  coverImage: string | null;
  tags: string[];
  customTags: string;
  references: string;
}

const PublishScreen = () => {
  const navigation = useNavigation();
  const [selectedType, setSelectedType] = useState<ContentType | null>(null); // Start with type selection

  // Common state for the new unified UI
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Image picker states
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showImageEditMenu, setShowImageEditMenu] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const MAX_IMAGES = 9;

  // State for different content types (keeping for compatibility)
  const [lookbookData, setLookbookData] = useState<LookbookState>({
    title: "",
    coverImage: null,
    description: "",
    images: [],
    tags: [],
    customTags: "",
  });

  const [outfitData, setOutfitData] = useState<OutfitState>({
    title: "",
    images: [],
    description: "",
    tags: [],
    customTags: "",
    occasions: [],
    hashtags: "",
    linkedItems: [],
  });

  const [reviewData, setReviewData] = useState<ReviewState>({
    title: "",
    productName: "",
    brand: "",
    rating: 0,
    reviewText: "",
    images: [],
    pros: "",
    cons: "",
    priceRange: "",
  });

  const [articleData, setArticleData] = useState<ArticleState>({
    title: "",
    content: "",
    coverImage: null,
    tags: [],
    customTags: "",
    references: "",
  });

  const contentOptions: ContentOption[] = [
    {
      id: "lookbook",
      title: "发布Lookbook",
      subtitle: "分享时装系列或造型集合",
    },
    {
      id: "outfit",
      title: "分享搭配",
      subtitle: "展示个人穿搭或搭配建议",
    },
    {
      id: "review",
      title: "单品评价",
      subtitle: "对时尚单品进行专业点评",
    },
    {
      id: "article",
      title: "时尚文章",
      subtitle: "发表时尚观点或趋势分析",
    },
  ];

  const validateForm = (): boolean => {
    if (!selectedType) {
      Alert.show("提示: 请选择内容类型");
      return false;
    }

    if (!title.trim()) {
      Alert.show("提示: 请填写标题");
      return false;
    }

    // Type-specific validation
    switch (selectedType) {
      case "lookbook":
        if (images.length === 0) {
          Alert.show("提示: Lookbook需要至少上传一张图片");
          return false;
        }
        break;

      case "outfit":
        if (images.length === 0) {
          Alert.show("提示: 分享搭配需要至少上传一张图片");
          return false;
        }
        break;

      case "review":
        if (!description.trim()) {
          Alert.show("提示: 单品评价需要填写评价内容");
          return false;
        }
        break;

      case "article":
        if (!description.trim()) {
          Alert.show("提示: 时尚文章需要填写正文内容");
          return false;
        }
        break;
    }

    return true;
  };

  const handlePublish = () => {
    if (!validateForm()) {
      return;
    }

    // Here you would typically send the data to your backend
    const publishData = {
      type: selectedType,
      title,
      description,
      images,
      coverImage,
      tags,
      location,
      selectedTags,
    };

    console.log("Publishing:", publishData);

    Alert.show("发布成功: 您的内容已成功发布！", "", 1000);
    setTimeout(() => {
      // Reset form and navigate back
      resetForm();
      navigation.goBack();
    }, 1000);
  };

  const handleSaveDraft = () => {
    const draftData = {
      type: selectedType,
      title,
      description,
      images,
      coverImage,
      tags,
      location,
      selectedTags,
    };

    console.log("Saving draft:", draftData);
    Alert.show("草稿已保存: 您的内容已保存为草稿");
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImages([]);
    setCoverImage(null);
    setTags("");
    setLocation("");
    setSelectedTags([]);
  };

  const handleAddImage = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.show("提示: 最多只能上传" + MAX_IMAGES + "张图片");
      return;
    }
    setShowImagePicker(true);
  };

  const handleEditCover = () => {
    if (images.length === 0) {
      handleAddImage();
    } else {
      // Open cropper for current cover image
      const coverIndex = images.findIndex((img) => img === coverImage);
      if (coverIndex !== -1 && coverImage) {
        ImageCropPicker.openCropper({
          path: coverImage,
          mediaType: 'photo',
          width: 1080,
          height: 1080,
          cropping: true,
          cropperToolbarTitle: '裁剪封面',
          cropperActiveWidgetColor: '#000000',
          cropperToolbarColor: '#000000',
          cropperToolbarWidgetColor: '#FFFFFF',
          freeStyleCropEnabled: true,
          cropperChooseText: '选择',
          cropperCancelText: '取消',
          compressImageQuality: 0.9,
        }).then(image => {
          // Update cropped image
          const newImages = [...images];
          newImages[coverIndex] = image.path;
          setImages(newImages);
          setCoverImage(image.path);
          Alert.show("裁剪成功", "", 1500);
        }).catch(error => {
          console.log('取消裁剪或错误:', error);
        });
      }
    }
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      if (source === "camera") {
        // Open camera with cropping
        ImageCropPicker.openCamera({
          width: 1080,
          height: 1080,
          cropping: true,
          cropperToolbarTitle: '裁剪照片',
          cropperActiveWidgetColor: '#000000',
          cropperToolbarColor: '#000000',
          cropperToolbarWidgetColor: '#FFFFFF',
          freeStyleCropEnabled: true,
          cropperChooseText: '选择',
          cropperCancelText: '取消',
          compressImageQuality: 0.9,
        }).then(image => {
          const newImages = [...images, image.path];
          setImages(newImages);

          // Set first image as cover if no cover exists
          if (!coverImage) {
            setCoverImage(image.path);
          }
          Alert.show("照片已添加", "", 1500);
        }).catch(error => {
          console.log('拍摄取消或错误:', error);
        });
      } else {
        // Open gallery with cropping
        ImageCropPicker.openPicker({
          width: 1080,
          height: 1080,
          cropping: true,
          multiple: false,
          cropperToolbarTitle: '裁剪图片',
          cropperActiveWidgetColor: '#000000',
          cropperToolbarColor: '#000000',
          cropperToolbarWidgetColor: '#FFFFFF',
          freeStyleCropEnabled: true,
          cropperChooseText: '选择',
          cropperCancelText: '取消',
          compressImageQuality: 0.9,
        }).then(image => {
          const newImages = [...images, image.path];
          setImages(newImages);

          // Set first image as cover if no cover exists
          if (!coverImage) {
            setCoverImage(image.path);
          }
          Alert.show("图片已添加", "", 1500);
        }).catch(error => {
          console.log('选择取消或错误:', error);
        });
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

  // Handle image edit menu actions
  const handleEditImage = () => {
    setShowImageEditMenu(false);
    // 打开裁剪器
    if (selectedImageIndex !== null && selectedImageUri) {
      ImageCropPicker.openCropper({
        path: selectedImageUri,
        mediaType: 'photo',
        width: 1080,
        height: 1080,
        cropping: true,
        cropperToolbarTitle: '编辑图片',
        cropperActiveWidgetColor: '#000000',
        cropperToolbarColor: '#000000',
        cropperToolbarWidgetColor: '#FFFFFF',
        freeStyleCropEnabled: true,
        cropperChooseText: '选择',
        cropperCancelText: '取消',
        compressImageQuality: 0.9,
      }).then(image => {
        // Update cropped image
        const newImages = [...images];
        newImages[selectedImageIndex] = image.path;
        setImages(newImages);
        
        // Update cover if it was the edited image
        if (coverImage === selectedImageUri) {
          setCoverImage(image.path);
        }
        
        Alert.show("编辑成功", "", 1500);
        setSelectedImageUri(null);
        setSelectedImageIndex(null);
      }).catch(error => {
        console.log('取消裁剪或错误:', error);
      });
    }
  };

  const handleSetCover = () => {
    setShowImageEditMenu(false);
    if (selectedImageUri) {
      setCoverImage(selectedImageUri);
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

      // If removed image was cover, set new cover
      if (coverImage === imageToRemove) {
        setCoverImage(newImages.length > 0 ? newImages[0] : null);
      }

      Alert.show("删除成功: 图片已删除");
    }

    // Reset selected image
    setSelectedImageUri(null);
    setSelectedImageIndex(null);
  };

  const handleCloseEditMenu = () => {
    setShowImageEditMenu(false);
    setSelectedImageUri(null);
    setSelectedImageIndex(null);
  };


  const handleReorderImages = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    setImages(newImages);
  };

  const handleDragStart = (index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedIndex(null);
  };

  // Render the type selector
  const renderTypeSelector = () => (
    <VStack mx="$md" mt="$lg">
      {contentOptions.map((option) => (
        <Pressable
          key={option.id}
          px="$lg"
          py="$md"
          borderWidth={1}
          borderColor={selectedType === option.id ? "$accent" : "$gray200"}
          rounded="$md"
          mb="$md"
          bg={selectedType === option.id ? "$gray50" : "$white"}
          onPress={() => setSelectedType(option.id)}
        >
          <HStack justifyContent="between" alignItems="center">
            <VStack flex={1}>
              <Text fontSize="$lg" fontWeight="$semibold" color="$black" mb={2}>
                {option.title}
              </Text>
              <Text fontSize="$sm" color="$gray500">
                {option.subtitle}
              </Text>
            </VStack>
            {selectedType === option.id && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.accent}
              />
            )}
          </HStack>
        </Pressable>
      ))}
    </VStack>
  );

  // Render the main preview section
  const renderPreviewSection = () => (
    <Box h={300} mx="$md" my="$md">
      <Pressable
        flex={1}
        rounded="$md"
        overflow="hidden"
        position="relative"
        onPress={handleEditCover}
      >
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.previewImage} />
        ) : (
          <Box
            flex={1}
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons
              name="image-outline"
              size={48}
              color={theme.colors.gray400}
            />
          </Box>
        )}
      </Pressable>
    </Box>
  );

  // Render the image gallery section
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
            borderColor="#FF3B30"
            opacity={draggedIndex === index ? 0.5 : 1}
            sx={
              draggedIndex === index
                ? { transform: [{ scale: 1.1 }] }
                : undefined
            }
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

  // Render the action buttons section
  const renderActionButtons = () => (
    <HStack mx="$md" mb="$md" py="$sm" alignItems="center">
      <Pressable mr="$lg">
        <Text color="$gray600" fontSize="$md">
          # 话题
        </Text>
      </Pressable>
      <Pressable mr="$lg">
        <Text color="$gray600" fontSize="$md">
          @ 朋友
        </Text>
      </Pressable>
      <Pressable mr="$lg">
        <Text color="$gray600" fontSize="$md">
          ⚏ 模板
        </Text>
      </Pressable>
      <Box ml="auto">
        <Pressable>
          <Ionicons name="chevron-up" size={20} color={theme.colors.gray400} />
        </Pressable>
      </Box>
    </HStack>
  );

  // Render the predefined tags section based on content type
  const renderPredefinedTags = () => {
    let predefinedTags: string[] = [];

    switch (selectedType) {
      case "lookbook":
        predefinedTags = ["春夏", "秋冬", "经典", "时尚"];
        break;
      case "outfit":
        predefinedTags = ["日常", "工作", "约会", "派对"];
        break;
      case "review":
        predefinedTags = ["推荐", "性价比", "质量", "设计"];
        break;
      case "article":
        predefinedTags = ["趋势", "分析", "观点", "专业"];
        break;
      default:
        predefinedTags = ["技术分享", "日常生活", "电商", "我服了"];
    }

    return (
      <Box mx="$md" mb="$md" sx={{ flexDirection: "row", flexWrap: "wrap" }}>
        {predefinedTags.map((tag, index) => (
          <Pressable
            key={index}
            bg={selectedTags.includes(tag) ? "$accent" : "$gray100"}
            px="$md"
            py="$sm"
            rounded="$full"
            mr="$sm"
            mb="$sm"
            onPress={() => {
              if (selectedTags.includes(tag)) {
                setSelectedTags(selectedTags.filter((t) => t !== tag));
              } else {
                setSelectedTags([...selectedTags, tag]);
              }
            }}
          >
            <Text
              color={selectedTags.includes(tag) ? "$white" : "$gray600"}
              fontSize="$sm"
            >
              # {tag}
            </Text>
          </Pressable>
        ))}
      </Box>
    );
  };

  // Render the location section
  const renderLocationSection = () => (
    <Pressable
      mx="$md"
      py="$md"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      <HStack alignItems="center">
        <Ionicons
          name="location-outline"
          size={20}
          color={theme.colors.gray400}
        />
        <Text color="$gray600" flex={1} ml="$sm">
          你在哪里
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.colors.gray400}
        />
      </HStack>
    </Pressable>
  );

  // Render the labels section
  const renderLabelsSection = () => (
    <Pressable
      mx="$md"
      py="$md"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      <HStack alignItems="center">
        <Ionicons
          name="pricetag-outline"
          size={20}
          color={theme.colors.gray400}
        />
        <Text color="$gray600" flex={1} ml="$sm">
          添加标签
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.colors.gray400}
        />
      </HStack>
    </Pressable>
  );

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

  const selectedOption = contentOptions.find(
    (option) => option.id === selectedType
  );

  const getPlaceholderText = () => {
    switch (selectedType) {
      case "lookbook":
        return "请输入您的 Lookbook 标题（例：2025 我的春夏穿搭合集）";
      case "outfit":
        return "分享您的搭配灵感和穿搭心得";
      case "review":
        return "为这个单品写一个标题";
      case "article":
        return "文章标题，支持长标题";
      default:
        return "添加标题";
    }
  };

  const getDescriptionPlaceholder = () => {
    switch (selectedType) {
      case "lookbook":
        return "请简单介绍您的 Lookbook 灵感或主题（可选）";
      case "outfit":
        return "详细描述您的搭配...";
      case "review":
        return "输入简短点评（50-200字）";
      case "article":
        return "支持段落、加粗、引用、插图（Markdown/富文本编辑器）";
      default:
        return "添加作品描述...";
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={selectedOption ? selectedOption.title : "发布内容"}
        showBackButton
        onBackPress={() => {
          if (selectedType) {
            setSelectedType(null);
          } else {
            navigation.goBack();
          }
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {!selectedType ? (
          /* Type Selection */
          renderTypeSelector()
        ) : (
          <>
            {/* Preview Section */}
            {renderPreviewSection()}

            {/* Image Gallery */}
            {renderImageGallery()}

            {/* Title Input */}
            <Box mx="$md" mb="$md">
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={getPlaceholderText()}
                placeholderTextColor={theme.colors.gray400}
                multiline
                variant="filled"
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

            {/* Description Input */}
            <Box mx="$md" mb="$md">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder={getDescriptionPlaceholder()}
                placeholderTextColor={theme.colors.gray400}
                multiline
                variant="filled"
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

            {/* Action Buttons */}
            {renderActionButtons()}

            {/* Predefined Tags */}
            {renderPredefinedTags()}

            {/* Location Section - Only show for certain types */}
            {(selectedType === "lookbook" || selectedType === "outfit") &&
              renderLocationSection()}

            {/* Labels Section */}
            {renderLabelsSection()}
          </>
        )}
      </ScrollView>

      {/* Bottom Buttons - Only show when type is selected */}
      {selectedType && renderBottomButtons()}

      {/* Modals */}
      {renderImagePickerModal()}

      {/* Image Edit Menu */}
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
    paddingBottom: 100, // Space for bottom buttons
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});

export default PublishScreen;
