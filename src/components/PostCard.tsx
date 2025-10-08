import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, Pressable, HStack, VStack } from "./ui";
import { theme } from "../theme";

// Post类型定义
export interface Post {
  id: string;
  type?: string;
  title?: string;
  image?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    isVerified?: boolean;
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

  return (
    <Box
      bg="$white"
      rounded="$md"
      overflow="hidden"
      sx={{
        shadowColor: '$black',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      {/* 图片 */}
      <Pressable onPress={() => onPress?.(post)}>
        <Image
          source={{ uri: displayImage }}
          style={styles.image}
          resizeMode="cover"
        />
      </Pressable>

      {/* 标题 */}
      <Pressable
        px="$sm"
        pt="$sm"
        pb="$xs"
        onPress={() => onPress?.(post)}
      >
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
      <HStack
        px="$sm"
        pb="$sm"
        justifyContent="between"
        alignItems="center"
      >
        <Pressable
          onPress={() => onAuthorPress?.(post.author.id)}
          flex={1}
          mr="$sm"
        >
          <HStack space="xs" alignItems="center">
            <Image 
              source={{ uri: post.author.avatar }} 
              style={styles.avatar} 
            />
            <Text
              color="$gray600"
              fontWeight="$medium"
              fontSize="$xs"
              numberOfLines={1}
              flex={1}
            >
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
  avatar: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
  },
});

export default PostCard;
