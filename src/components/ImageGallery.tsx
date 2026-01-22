import React, { useState, useRef } from "react";
import {
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Modal,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./ui";
import { theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

interface ImageGalleryProps {
  images: string[];
  imageHeight?: number;
  showThumbnails?: boolean;
  showFullscreenOnPress?: boolean;
  initialIndex?: number;
  onImagePress?: (index: number) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  imageHeight = screenWidth * 1.2,
  showThumbnails = true,
  showFullscreenOnPress = true,
  initialIndex = 0,
  onImagePress,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialIndex);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);

  const imageListRef = useRef<FlatList>(null);
  const fullscreenListRef = useRef<FlatList>(null);

  const handleImagePress = (index: number) => {
    if (onImagePress) {
      onImagePress(index);
    }
    if (showFullscreenOnPress) {
      setFullscreenImageIndex(index);
      setIsFullscreenVisible(true);
    }
  };

  const handleThumbnailPress = (index: number) => {
    setCurrentImageIndex(index);
    imageListRef.current?.scrollToIndex({ index, animated: true });
  };

  const renderMainImage = () => {
    if (images.length === 0) return null;

    return (
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <FlatList
          ref={imageListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `image-${index}`}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / screenWidth
            );
            setCurrentImageIndex(index);
          }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.imageSlide, { height: imageHeight }]}
              onPress={() => handleImagePress(index)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item }}
                style={[styles.mainImage, { height: imageHeight }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />

        {images.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderImageThumbnails = () => {
    if (!showThumbnails || images.length <= 1) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailContainer}
        contentContainerStyle={styles.thumbnailContent}
      >
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.thumbnail,
              currentImageIndex === index && styles.activeThumbnail,
            ]}
            onPress={() => handleThumbnailPress(index)}
          >
            <Image
              source={{ uri: image }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderFullscreenModal = () => {
    if (!showFullscreenOnPress) return null;

    return (
      <Modal
        visible={isFullscreenVisible}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsFullscreenVisible(false)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <FlatList
            ref={fullscreenListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `fullscreen-${index}`}
            initialScrollIndex={fullscreenImageIndex}
            getItemLayout={(data, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / screenWidth
              );
              setFullscreenImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={styles.fullscreenImageContainer}>
                <Image
                  source={{ uri: item }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {images.length > 1 && (
            <View style={styles.fullscreenCounter}>
              <Text style={styles.fullscreenCounterText}>
                {fullscreenImageIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <>
      {renderMainImage()}
      {renderImageThumbnails()}
      {renderFullscreenModal()}
    </>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    position: "relative",
    width: screenWidth,
  },
  imageSlide: {
    width: screenWidth,
  },
  mainImage: {
    width: screenWidth,
  },
  imageCounter: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: theme.colors.white,
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  thumbnailContainer: {
    marginTop: 16,
  },
  thumbnailContent: {
    paddingHorizontal: 20,
  },
  thumbnail: {
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeThumbnail: {
    borderColor: theme.colors.gray600,
  },
  thumbnailImage: {
    width: 60,
    height: 80,
  },
  // 全屏查看样式
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImageContainer: {
    width: screenWidth,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: screenWidth,
    height: "100%",
  },
  fullscreenCounter: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  fullscreenCounterText: {
    color: "white",
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
});

export default ImageGallery;
