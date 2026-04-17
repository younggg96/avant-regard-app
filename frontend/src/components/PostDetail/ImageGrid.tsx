import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Pressable } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { theme } from "../../theme";
import { VideoPlayer } from "./VideoPlayer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MediaGridProps {
  images: string[];
  onOpenFullscreen: (index: number) => void;
}

const MediaItem: React.FC<{
  uri: string;
  wrapperStyle: any;
  imageStyle: any;
  imageSize: ImageSize;
  index: number;
  onOpenFullscreen: (index: number) => void;
}> = ({ uri, wrapperStyle, imageStyle, imageSize, index, onOpenFullscreen }) => {
  if (isVideoUrl(uri)) {
    return (
      <VideoPlayer
        uri={uri}
        style={wrapperStyle}
        videoStyle={{ width: "100%", height: "100%" }}
      />
    );
  }
  return (
    <Pressable style={wrapperStyle} onPress={() => onOpenFullscreen(index)}>
      <OptimizedImage
        uri={uri}
        size={imageSize}
        style={imageStyle}
        contentFit="cover"
        lazy={true}
      />
    </Pressable>
  );
};

export const ImageGrid: React.FC<MediaGridProps> = ({
  images,
  onOpenFullscreen,
}) => {
  if (images.length === 0) return null;

  const isSingleItem = images.length === 1;
  const isTwoItems = images.length === 2;

  return (
    <View style={gridStyles.container}>
      {isSingleItem ? (
        <MediaItem
          uri={images[0]}
          wrapperStyle={gridStyles.singleImageWrapper}
          imageStyle={gridStyles.singleImage}
          imageSize={ImageSize.LARGE}
          index={0}
          onOpenFullscreen={onOpenFullscreen}
        />
      ) : isTwoItems ? (
        <View style={gridStyles.twoImageRow}>
          {images.map((image, index) => (
            <MediaItem
              key={index}
              uri={image}
              wrapperStyle={gridStyles.twoImageWrapper}
              imageStyle={gridStyles.twoImage}
              imageSize={ImageSize.MEDIUM}
              index={index}
              onOpenFullscreen={onOpenFullscreen}
            />
          ))}
        </View>
      ) : (
        <View style={gridStyles.gridContainer}>
          {images.map((image, index) => (
            <MediaItem
              key={index}
              uri={image}
              wrapperStyle={gridStyles.gridImageWrapper}
              imageStyle={gridStyles.gridImage}
              imageSize={ImageSize.THUMBNAIL}
              index={index}
              onOpenFullscreen={onOpenFullscreen}
            />
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
