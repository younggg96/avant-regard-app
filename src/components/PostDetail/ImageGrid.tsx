import React from "react";
import { View, Image as RNImage, StyleSheet, Dimensions } from "react-native";
import { Pressable } from "../ui";
import { theme } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ImageGridProps {
  images: string[];
  onOpenFullscreen: (index: number) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onOpenFullscreen,
}) => {
  if (images.length === 0) return null;

  // 根据图片数量选择不同的布局
  const isSingleImage = images.length === 1;
  const isTwoImages = images.length === 2;

  return (
    <View style={gridStyles.container}>
      {isSingleImage ? (
        // 单张图片 - 大图展示
        <Pressable
          style={gridStyles.singleImageWrapper}
          onPress={() => onOpenFullscreen(0)}
        >
          <RNImage
            source={{ uri: images[0] }}
            style={gridStyles.singleImage}
            resizeMode="cover"
          />
        </Pressable>
      ) : isTwoImages ? (
        // 两张图片 - 并排展示
        <View style={gridStyles.twoImageRow}>
          {images.map((image, index) => (
            <Pressable
              key={index}
              style={gridStyles.twoImageWrapper}
              onPress={() => onOpenFullscreen(index)}
            >
              <RNImage
                source={{ uri: image }}
                style={gridStyles.twoImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      ) : (
        // 多张图片 - 网格布局
        <View style={gridStyles.gridContainer}>
          {images.map((image, index) => (
            <Pressable
              key={index}
              style={gridStyles.gridImageWrapper}
              onPress={() => onOpenFullscreen(index)}
            >
              <RNImage
                source={{ uri: image }}
                style={gridStyles.gridImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const IMAGE_GAP = 3;
const GRID_PADDING = 16;
const GRID_IMAGE_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - IMAGE_GAP * 2) / 3;

const gridStyles = StyleSheet.create({
  container: {
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 12,
  },
  // 单张图片样式
  singleImageWrapper: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  singleImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  // 两张图片样式
  twoImageRow: {
    flexDirection: "row",
    gap: IMAGE_GAP,
  },
  twoImageWrapper: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  twoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  // 网格样式
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: IMAGE_GAP,
  },
  gridImageWrapper: {
    width: GRID_IMAGE_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
});
