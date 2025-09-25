import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

// Post types based on PublishScreen content types
export type PostType = "lookbook" | "outfit" | "review" | "article";

export interface PostAuthor {
  id: string;
  name: string;
  avatar: string;
  isVerified?: boolean;
}

export interface PostContent {
  title: string;
  description: string;
  images: string[];
  tags?: string[];
}

export interface PostEngagement {
  likes: number;
  saves: number;
  comments: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface Post {
  id: string;
  type: PostType;
  author: PostAuthor;
  content: PostContent;
  engagement: PostEngagement;
  timestamp: string;
  // Type-specific data
  brandName?: string; // For lookbook posts
  season?: string; // For lookbook posts
  items?: Array<{
    // For outfit posts
    id: string;
    name: string;
    brand: string;
    price: string;
    imageUrl: string;
  }>;
  rating?: number; // For review posts
  readTime?: string; // For article posts
}

interface PostCardProps {
  post: Post;
  onPress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
  onLike?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onItemPress?: (itemId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  onAuthorPress,
  onLike,
  onSave,
  onComment,
  onItemPress,
}) => {
  const [imageIndex, setImageIndex] = useState(0);

  // Early return if post is invalid
  if (!post || !post.id || !post.author || !post.content) {
    return null;
  }

  const getPostTypeLabel = (type: PostType) => {
    switch (type) {
      case "lookbook":
        return "Lookbook";
      case "outfit":
        return "搭配分享";
      case "review":
        return "单品评价";
      case "article":
        return "时尚文章";
      default:
        return "";
    }
  };

  const getPostTypeColor = (type: PostType) => {
    switch (type) {
      case "lookbook":
        return theme.colors.accent;
      case "outfit":
        return theme.colors.success;
      case "review":
        return "#FF6B6B";
      case "article":
        return theme.colors.gray400;
      default:
        return theme.colors.gray400;
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setImageIndex(index);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.authorInfo}
        onPress={() => onAuthorPress?.(post.author.id)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
        <View style={styles.authorText}>
          <View style={styles.authorName}>
            <Text style={styles.authorNameText}>{post.author.name}</Text>
            {post.author.isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.colors.accent}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.timestamp}>{post.timestamp}</Text>
            <View style={styles.separator} />
            <View
              style={[
                styles.typeTag,
                { backgroundColor: getPostTypeColor(post.type) },
              ]}
            >
              <Text style={styles.typeText}>{getPostTypeLabel(post.type)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderImages = () => {
    const images = post.content.images || [];
    if (images.length === 0) {
      return null;
    }

    return (
      <TouchableOpacity onPress={() => onPress?.(post)} activeOpacity={0.95}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.imageContainer}
        >
          {images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={styles.imageIndicator}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === imageIndex && styles.activeDot]}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderContent = () => (
    <TouchableOpacity
      style={styles.content}
      onPress={() => onPress?.(post)}
      activeOpacity={0.95}
    >
      <View style={styles.contentHeader}>
        <Text style={styles.title}>{post.content.title}</Text>
        {post.brandName && (
          <Text style={styles.brandName}>{post.brandName}</Text>
        )}
        {post.season && (
          <View style={styles.seasonBadge}>
            <Text style={styles.seasonText}>{post.season}</Text>
          </View>
        )}
        {post.rating && (
          <View style={styles.ratingContainer}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name="star"
                size={14}
                color={i < post.rating! ? "#FFD700" : theme.colors.gray200}
              />
            ))}
          </View>
        )}
        {post.readTime && <Text style={styles.readTime}>{post.readTime}</Text>}
      </View>

      <Text style={styles.description} numberOfLines={3}>
        {post.content.description}
      </Text>

      {post.content.tags && post.content.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {post.content.tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
          {post.content.tags.length > 3 && (
            <Text style={styles.moreTagsText}>
              +{post.content.tags.length - 3}
            </Text>
          )}
        </View>
      )}

      {/* Outfit items grid for outfit posts */}
      {post.type === "outfit" && post.items && post.items.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsTitle}>搭配单品</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.itemsScroll}
            contentContainerStyle={styles.itemsContent}
          >
            {post.items.map((item) => (
              <TouchableOpacity
                key={item?.id || Math.random().toString()}
                style={styles.itemCard}
                onPress={() => item?.id && onItemPress?.(item.id)}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri:
                      item?.imageUrl || "https://via.placeholder.com/150x200",
                  }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemBrand} numberOfLines={1}>
                    {item?.brand || ""}
                  </Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item?.name || ""}
                  </Text>
                  <Text style={styles.itemPrice}>{item?.price || ""}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderActions = () => {
    const engagement = post.engagement || { likes: 0, saves: 0, comments: 0 };

    return (
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onLike?.(post.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={engagement.isLiked ? "heart" : "heart-outline"}
              size={24}
              color={engagement.isLiked ? "#FF3040" : theme.colors.gray400}
            />
            <Text
              style={[
                styles.actionText,
                engagement.isLiked && { color: "#FF3040" },
              ]}
            >
              {engagement.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment?.(post.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-outline"
              size={24}
              color={theme.colors.gray400}
            />
            <Text style={styles.actionText}>{engagement.comments}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSave?.(post.id)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={engagement.isSaved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={
              engagement.isSaved ? theme.colors.accent : theme.colors.gray400
            }
          />
          <Text
            style={[
              styles.actionText,
              engagement.isSaved && { color: theme.colors.accent },
            ]}
          >
            {engagement.saves}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderImages()}
      {renderContent()}
      {renderActions()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  authorText: {
    flex: 1,
  },
  authorName: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  authorNameText: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  separator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray300,
    marginHorizontal: theme.spacing.xs,
  },
  typeTag: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  typeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
    fontSize: 11,
  },
  imageContainer: {
    maxHeight: 300,
  },
  postImage: {
    width: screenWidth,
    height: 300,
    backgroundColor: theme.colors.gray100,
  },
  imageIndicator: {
    position: "absolute",
    bottom: theme.spacing.sm,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  contentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
    flexWrap: "wrap",
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.black,
    flex: 1,
    marginRight: theme.spacing.sm,
    marginBottom: 4,
  },
  brandName: {
    ...theme.typography.bodySmall,
    color: theme.colors.accent,
    fontWeight: "600",
    marginRight: theme.spacing.sm,
  },
  seasonBadge: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
  },
  seasonText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  readTime: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.xs,
    marginBottom: 4,
  },
  tagText: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
  },
  moreTagsText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.xs,
  },
  itemsSection: {
    marginTop: theme.spacing.sm,
  },
  itemsTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  itemsScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  itemsContent: {
    paddingHorizontal: theme.spacing.md,
  },
  itemCard: {
    width: 100,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.sm,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  itemImage: {
    width: "100%",
    height: 120,
    backgroundColor: theme.colors.gray100,
  },
  itemInfo: {
    padding: theme.spacing.xs,
  },
  itemBrand: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontSize: 10,
    marginBottom: 2,
  },
  itemName: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontSize: 11,
    marginBottom: 2,
  },
  itemPrice: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: "600",
    fontSize: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    paddingTop: theme.spacing.sm,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: theme.spacing.lg,
  },
  actionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.xs,
    fontWeight: "500",
  },
});

export default PostCard;
