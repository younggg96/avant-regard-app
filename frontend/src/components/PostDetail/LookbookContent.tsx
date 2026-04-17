import React from "react";
import { View, FlatList } from "react-native";
import { Text, Pressable } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { Post } from "../PostCard";
import { styles, SCREEN_WIDTH } from "./styles";
import { VideoPlayer } from "./VideoPlayer";
import {
  useMediaAspectRatio,
  clampAspectRatio,
} from "../../utils/useMediaAspectRatio";

interface LookbookContentProps {
  post: Post;
  images: string[];
  currentImageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpenFullscreen: (index: number) => void;
}

export const LookbookContent: React.FC<LookbookContentProps> = ({
  post,
  images,
  currentImageIndex,
  onImageIndexChange,
  onOpenFullscreen,
}) => {
  // Drive the carousel height from the cover (first) slide's natural aspect
  // ratio, clamped to a pleasant range. All slides share this height because
  // a paginated horizontal FlatList needs a consistent viewport — mismatched
  // slides fall back to `contentFit="contain"` so nothing is cropped. This
  // replaces the old fixed `SCREEN_HEIGHT * 0.55` box that cover-cropped
  // 16:9 videos into a tall portrait frame.
  const coverRatio = clampAspectRatio(
    useMediaAspectRatio(images[0], 4 / 5),
    3 / 4, // tallest allowed frame (portrait 3:4)
    16 / 9 // widest allowed frame (landscape 16:9)
  );
  const wrapperStyle = {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH / coverRatio,
  };
  const mediaStyle = { width: "100%" as const, height: "100%" as const };

  return (
    <View style={styles.lookbookContainer}>
      {/* 图片轮播 */}
      <View style={styles.lookbookImageSection}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            onImageIndexChange(newIndex);
          }}
          renderItem={({ item, index }) => {
            if (isVideoUrl(item)) {
              return (
                <VideoPlayer
                  uri={item}
                  style={wrapperStyle}
                  videoStyle={mediaStyle}
                  contentFit="contain"
                  playIconSize={56}
                />
              );
            }
            return (
              <Pressable
                onPress={() => onOpenFullscreen(index)}
                style={wrapperStyle}
              >
                <OptimizedImage
                  uri={item}
                  size={ImageSize.LARGE}
                  style={mediaStyle}
                  contentFit="contain"
                  lazy={index > 0}
                />
              </Pressable>
            );
          }}
          keyExtractor={(item, index) => `lookbook-img-${index}`}
        />
        {/* 圆点指示器 */}
        {images.length > 1 && (
          <View style={styles.dotIndicatorContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dotIndicator,
                  currentImageIndex === index && styles.dotIndicatorActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* 小红书风格的内容区域 */}
      <View style={styles.lookbookContentSection}>
        {/* 标题 */}
        <Text style={styles.lookbookTitle}>{post.content?.title}</Text>

        {/* 描述 */}
        {post.content?.description && (
          <Text style={styles.lookbookDescription}>
            {post.content.description}
          </Text>
        )}

        {/* 品牌和季节信息 */}
        {(post.brandName || post.season) && (
          <View style={styles.lookbookMeta}>
            {post.brandName && (
              <View style={styles.lookbookMetaItem}>
                <Text style={styles.lookbookMetaLabel}>品牌</Text>
                <Text style={styles.lookbookMetaValue}>{post.brandName}</Text>
              </View>
            )}
            {post.season && (
              <View style={styles.lookbookMetaItem}>
                <Text style={styles.lookbookMetaLabel}>系列</Text>
                <Text style={styles.lookbookMetaValue}>{post.season}</Text>
              </View>
            )}
          </View>
        )}

        {/* 标签 */}
        {post.content?.tags && post.content.tags.length > 0 && (
          <View style={styles.lookbookTagsContainer}>
            {post.content.tags.map((tag, index) => (
              <View key={index} style={styles.lookbookTag}>
                <Text style={styles.lookbookTagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};
