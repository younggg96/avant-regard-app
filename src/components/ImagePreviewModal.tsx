import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  Image as RNImage,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable } from "./ui";
import { theme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl?: string; // 单图模式（向后兼容）
  imageUrls?: string[]; // 多图模式
  initialIndex?: number; // 初始显示的图片索引
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUrl,
  imageUrls,
  initialIndex = 0,
  title,
  subtitle,
  onClose,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 确定要显示的图片数组
  const images = imageUrls || (imageUrl ? [imageUrl] : []);
  const hasMultipleImages = images.length > 1;

  // 当 visible 或 initialIndex 改变时，重置当前索引
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />

        {/* 关闭按钮 */}
        <Pressable style={styles.closeButtonTop} onPress={onClose}>
          <Ionicons name="close" size={30} color={theme.colors.white} />
        </Pressable>

        {/* 图片计数器 */}
        {hasMultipleImages && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* 图片轮播 */}
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setCurrentIndex(newIndex);
          }}
          renderItem={({ item }) => (
            <View style={styles.fullscreenImageWrapper}>
              <RNImage
                source={{ uri: item }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </View>
          )}
          keyExtractor={(item, index) => `image-${index}`}
        />

        {/* 底部信息 */}
        {(title || subtitle) && (
          <Box position="absolute" bottom={0} left={0} right={0}>
            <SafeAreaView edges={["bottom"]}>
              <Box
                px="$lg"
                py="$lg"
                bg="rgba(0,0,0,0.8)"
                borderTopWidth={1}
                borderTopColor="rgba(255,255,255,0.1)"
              >
                {title && (
                  <Text
                    color="$white"
                    fontSize="$lg"
                    fontWeight="$bold"
                    mb="$xs"
                  >
                    {title}
                  </Text>
                )}
                {subtitle && (
                  <Text color="$gray300" fontSize="$md">
                    {subtitle}
                  </Text>
                )}
              </Box>
            </SafeAreaView>
          </Box>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  closeButtonTop: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },
  imageCounter: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
});

export default ImagePreviewModal;
