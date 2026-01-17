import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, Pressable, HStack, VStack } from "./ui";
import { theme } from "../theme";
import { Show } from "../services/showService";

// 关联秀场类型（兼容旧数据）
export interface ShowImageInfo {
  id: number;
  imageUrl: string;
  brandName?: string;
  season?: string;
}

// Post类型定义
export interface Post {
  id: string;
  type?: string;
  auditStatus?: string; // 审核状态: PENDING, APPROVED, REJECTED
  title?: string;
  image?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  content?: {
    title: string;
    description?: string;
    images: string[];
    tags?: string[];
  };
  engagement?: {
    likes: number;
    saves?: number;
    comments?: number;
    isLiked?: boolean;
    isSaved?: boolean;
  };
  likes?: number;
  isLiked?: boolean;
  timestamp?: string;
  rating?: number;
  readTime?: string;
  brandName?: string;
  season?: string;
  items?: Array<{
    id: string;
    name: string;
    brand: string;
    price: string;
    imageUrl: string;
  }>;
  // 关联的秀场造型（兼容旧数据）
  showImages?: ShowImageInfo[];
  // 关联的秀场（完整信息）
  shows?: Show[];
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

  // 获取显示数据，支持新旧两种数据结构
  const displayTitle = post.content?.title || post.title || "";
  const displayImage = post.content?.images?.[0] || post.image || "";
  const displayLikes = post.engagement?.likes || post.likes || 0;
  const displayIsLiked = post.engagement?.isLiked ?? post.isLiked ?? false;

  // 是否为待审核状态
  const isPending = post.auditStatus === "PENDING";

  return (
    <Box
      bg="$white"
      rounded="$md"
      overflow="hidden"
      sx={{
        shadowColor: "$black",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      {/* 图片 */}
      <Pressable onPress={() => onPress?.(post)}>
        <Box position="relative">
          <Image
            source={{ uri: displayImage }}
            style={[styles.image, isPending && styles.pendingImage]}
            resizeMode="cover"
          />
          {/* 待审核标签 */}
          {isPending && (
            <Box
              position="absolute"
              top={8}
              left={8}
              bg="rgba(255, 165, 0, 0.9)"
              px="$sm"
              py="$xs"
              rounded="$sm"
            >
              <Text color="$white" fontSize="$xs" fontWeight="$semibold">
                审核中
              </Text>
            </Box>
          )}
        </Box>
      </Pressable>

      {/* 标题 */}
      <Pressable px="$sm" pt="$sm" pb="$xs" onPress={() => onPress?.(post)}>
        <Text
          color="$black"
          fontWeight="$semibold"
          fontSize="$sm"
          lineHeight="$sm"
          numberOfLines={2}
        >
          {displayTitle}
        </Text>
      </Pressable>

      {/* 底部：用户信息和点赞 */}
      <HStack px="$sm" pb="$sm" justifyContent="between" alignItems="center">
        <Pressable
          onPress={() => onAuthorPress?.(post.author.id)}
          flex={1}
          mr="$sm"
        >
          <HStack space="xs" alignItems="center">
            <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
            <Text
              color="$gray600"
              fontWeight="$medium"
              fontSize="$xs"
              numberOfLines={1}
              flex={1}
            >
              {post.author.name}
            </Text>
          </HStack>
        </Pressable>

        <Pressable onPress={() => onLike?.(post.id)}>
          <HStack space="xs" alignItems="center">
            <Ionicons
              name={displayIsLiked ? "heart" : "heart-outline"}
              size={16}
              color={displayIsLiked ? "#FF3040" : theme.colors.gray400}
            />
            <Text
              color={displayIsLiked ? "#FF3040" : "$gray400"}
              fontWeight="$semibold"
              fontSize="$xs"
            >
              {displayLikes}
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  image: {
    width: "100%",
    aspectRatio: 3 / 4, // 3:4比例，类似小红书
    backgroundColor: theme.colors.gray100,
  },
  pendingImage: {
    opacity: 0.85, // 待审核图片轻微降低透明度
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
  },
});

export default PostCard;
