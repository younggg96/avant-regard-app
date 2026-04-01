import React, { useState, useCallback, useRef } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Text, Pressable } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { Post } from "../PostCard";
import { styles, SCREEN_WIDTH } from "./styles";

interface LookbookContentProps {
  post: Post;
  images: string[];
  currentImageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpenFullscreen: (index: number) => void;
}

const LookbookVideoItem: React.FC<{
  uri: string;
  wrapperStyle: any;
  videoStyle: any;
}> = ({ uri, wrapperStyle, videoStyle }) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePress = useCallback(() => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  return (
    <Pressable onPress={handlePress} style={wrapperStyle}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={videoStyle}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping
        isMuted={false}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
      {!isPlaying && (
        <View style={localStyles.videoOverlay}>
          <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.85)" />
        </View>
      )}
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});

export const LookbookContent: React.FC<LookbookContentProps> = ({
  post,
  images,
  currentImageIndex,
  onImageIndexChange,
  onOpenFullscreen,
}) => {
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
                <LookbookVideoItem
                  uri={item}
                  wrapperStyle={styles.lookbookImageWrapper}
                  videoStyle={styles.lookbookImage}
                />
              );
            }
            return (
              <Pressable
                onPress={() => onOpenFullscreen(index)}
                style={styles.lookbookImageWrapper}
              >
                <OptimizedImage
                  uri={item}
                  size={ImageSize.LARGE}
                  style={styles.lookbookImage}
                  contentFit="cover"
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
