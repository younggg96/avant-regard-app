import React, { useState } from "react";
import { View, FlatList, Image as RNImage } from "react-native";
import { Text, Pressable } from "../ui";
import { Post } from "../PostCard";
import { styles, SCREEN_WIDTH } from "./styles";

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
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => onOpenFullscreen(index)}
              style={styles.lookbookImageWrapper}
            >
              <RNImage
                source={{ uri: item }}
                style={styles.lookbookImage}
                resizeMode="cover"
              />
            </Pressable>
          )}
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
