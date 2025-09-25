import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

// 简化的Post类型
export interface Post {
  id: string;
  title: string;
  image: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    isVerified?: boolean;
  };
  likes: number;
  isLiked?: boolean;
}

interface PostCardProps {
  post: Post;
  onPress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
  onLike?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  onAuthorPress,
  onLike,
}) => {
  // 安全检查
  if (!post || !post.id || !post.author) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* 图片 */}
      <TouchableOpacity onPress={() => onPress?.(post)} activeOpacity={0.95}>
        <Image
          source={{ uri: post.image }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* 标题 */}
      <TouchableOpacity
        style={styles.titleContainer}
        onPress={() => onPress?.(post)}
        activeOpacity={0.95}
      >
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
      </TouchableOpacity>

      {/* 底部：用户信息和点赞 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={() => onAuthorPress?.(post.author.id)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
          <Text style={styles.authorName} numberOfLines={1}>
            {post.author.name}
          </Text>
          {post.author.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={12}
              color={theme.colors.accent}
              style={{ marginLeft: 2 }}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onLike?.(post.id)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={post.isLiked ? "heart" : "heart-outline"}
            size={16}
            color={post.isLiked ? "#FF3040" : theme.colors.gray400}
          />
          <Text style={[styles.likeText, post.isLiked && { color: "#FF3040" }]}>
            {post.likes}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  image: {
    width: "100%",
    aspectRatio: 3 / 4, // 3:4比例，类似小红书
    backgroundColor: theme.colors.gray100,
  },
  titleContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
    backgroundColor: theme.colors.gray100,
  },
  authorName: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontWeight: "500",
    flex: 1,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.xs / 2,
    fontWeight: "600",
  },
});

export default PostCard;
