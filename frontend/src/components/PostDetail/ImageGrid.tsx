import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Pressable } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { VideoPlayer } from "./VideoPlayer";
import { useMediaAspectRatio } from "../../utils/useMediaAspectRatio";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MediaGridProps {
  images: string[];
  /** Width/height of the cover (first image); keeps every cell on this ratio. */
  coverAspectRatio?: number;
  onOpenFullscreen: (index: number) => void;
}

const MediaItem: React.FC<{
  uri: string;
  wrapperStyle: any;
  imageStyle: any;
  imageSize: ImageSize;
  index: number;
  onOpenFullscreen: (index: number) => void;
  contentFit?: "cover" | "contain";
}> = ({ uri, wrapperStyle, imageStyle, imageSize, index, onOpenFullscreen, contentFit = "cover" }) => {
  if (isVideoUrl(uri)) {
    return (
      <VideoPlayer
        uri={uri}
        style={wrapperStyle}
        videoStyle={{ width: "100%", height: "100%" }}
        contentFit={contentFit}
      />
    );
  }
  return (
    <Pressable style={wrapperStyle} onPress={() => onOpenFullscreen(index)}>
      <OptimizedImage
        uri={uri}
        size={imageSize}
        style={imageStyle}
        contentFit={contentFit}
        placeholderColor={theme.colors.gray50}
        lazy={true}
      />
    </Pressable>
  );
};

/**
 * Single-media posts (1 image or 1 video) use the media's natural aspect
 * ratio — no more 4:5 cover-crop that chops the sides off a 16:9 video or
 * squeezes a 1:1 photo. Multi-item grids keep their fixed-ratio cells so
 * the collage layout stays predictable.
 */
const SingleMediaItem: React.FC<{
  uri: string;
  coverAspectRatio?: number;
  onOpenFullscreen: (index: number) => void;
}> = ({ uri, coverAspectRatio, onOpenFullscreen }) => {
  const gridStyles = useThemedStyles(makeGridStyles);
  const ratio = useMediaAspectRatio(uri, 4 / 5, coverAspectRatio);
  const wrapperStyle = [
    gridStyles.singleImageWrapperBase,
    { aspectRatio: ratio },
  ];
  return (
    <MediaItem
      uri={uri}
      wrapperStyle={wrapperStyle}
      imageStyle={gridStyles.singleImage}
      imageSize={ImageSize.LARGE}
      index={0}
      onOpenFullscreen={onOpenFullscreen}
      contentFit="contain"
    />
  );
};

export const ImageGrid: React.FC<MediaGridProps> = ({
  images,
  coverAspectRatio,
  onOpenFullscreen,
}) => {
  const gridStyles = useThemedStyles(makeGridStyles);
  const leadRatio = useMediaAspectRatio(
    images[0],
    4 / 5,
    coverAspectRatio
  );

  if (images.length === 0) return null;

  const isSingleItem = images.length === 1;
  const isTwoItems = images.length === 2;
  const twoImageWrapper = [gridStyles.twoImageWrapperBase, { aspectRatio: leadRatio }];
  const gridImageWrapper = [gridStyles.gridImageWrapperBase, { aspectRatio: leadRatio }];

  return (
    <View style={gridStyles.container}>
      {isSingleItem ? (
        <SingleMediaItem
          uri={images[0]}
          coverAspectRatio={coverAspectRatio}
          onOpenFullscreen={onOpenFullscreen}
        />
      ) : isTwoItems ? (
        <View style={gridStyles.twoImageRow}>
          {images.map((image, index) => (
            <MediaItem
              key={index}
              uri={image}
              wrapperStyle={twoImageWrapper}
              imageStyle={gridStyles.twoImage}
              imageSize={ImageSize.MEDIUM}
              index={index}
              onOpenFullscreen={onOpenFullscreen}
              contentFit="contain"
            />
          ))}
        </View>
      ) : (
        <View style={gridStyles.gridContainer}>
          {images.map((image, index) => (
            <MediaItem
              key={index}
              uri={image}
              wrapperStyle={gridImageWrapper}
              imageStyle={gridStyles.gridImage}
              imageSize={ImageSize.THUMBNAIL}
              index={index}
              onOpenFullscreen={onOpenFullscreen}
              contentFit="contain"
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

const makeGridStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 12,
    },
    // aspectRatio is injected at render time from the media's natural size so
    // single-media posts no longer cover-crop into a fixed 4:5 frame.
    singleImageWrapperBase: {
      width: "100%",
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.colors.gray50,
    },
    singleImage: {
      width: "100%",
      height: "100%",
      backgroundColor: t.colors.gray100,
    },
    twoImageRow: {
      flexDirection: "row",
      gap: IMAGE_GAP,
    },
    twoImageWrapperBase: {
      flex: 1,
      borderRadius: 6,
      overflow: "hidden",
    },
    twoImage: {
      width: "100%",
      height: "100%",
      backgroundColor: t.colors.gray100,
    },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: IMAGE_GAP,
    },
    gridImageWrapperBase: {
      width: GRID_IMAGE_WIDTH,
      borderRadius: 4,
      overflow: "hidden",
    },
    gridImage: {
      width: "100%",
      height: "100%",
      backgroundColor: t.colors.gray100,
    },
  });
