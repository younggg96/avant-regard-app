import React from "react";
import { StyleSheet, TouchableOpacity, View, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, HStack, VStack } from "./ui";
import { theme } from "../theme";
import { Post } from "./PostCard";

interface ForumPostCardProps {
  post: Post;
  onPress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
  onLike?: (postId: string) => void;
}

/**
 * 论坛帖子卡片 - 横向排版
 * 类似于传统论坛的帖子列表样式
 */
const ForumPostCard: React.FC<ForumPostCardProps> = ({
  post,
  onPress,
  onAuthorPress,
  onLike,
}) => {
  // 安全检查
  if (!post || !post.id || !post.author) {
    return null;
  }

  // 从富文本 JSON 中提取第一个文本块的内容
  const parseContentText = (text: string): string => {
    if (!text) return "";
    try {
      const blocks = JSON.parse(text);
      if (Array.isArray(blocks) && blocks.length > 0) {
        const firstTextBlock = blocks.find((b: any) => b.type === "text");
        return firstTextBlock?.content || "";
      }
    } catch {
      // not JSON, return as-is
    }
    return text;
  };

  // 获取显示数据
  const displayTitle = post.content?.title || post.title || "";
  const rawDescription = post.content?.description || "";
  const displayDescription = parseContentText(rawDescription);
  const displayImages = post.content?.images || (post.image ? [post.image] : []);
  const displayLikes = post.engagement?.likes || post.likes || 0;
  const displayIsLiked = post.engagement?.isLiked ?? post.isLiked ?? false;
  const displayComments = post.engagement?.comments || 0;


  // 渲染图片预览
  const renderImagePreview = () => {
    if (displayImages.length === 0) return null;

    // 最多显示3张图片
    const previewImages = displayImages.slice(0, 3);
    const remainingCount = displayImages.length - 3;

    return (
      <HStack mt="$sm" gap="$xs">
        {previewImages.map((imageUri, index) => (
          <Box
            key={index}
            position="relative"
            overflow="hidden"
            rounded="$sm"
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            {/* 显示剩余图片数量 */}
            {index === 2 && remainingCount > 0 && (
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bg="rgba(0, 0, 0, 0.5)"
                justifyContent="center"
                alignItems="center"
              >
                <Text color="$white" fontSize="$sm" fontWeight="$semibold">
                  +{remainingCount}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </HStack>
    );
  };

  return (
    <TouchableOpacity
      onPress={() => onPress?.(post)}
      activeOpacity={0.95}
      style={styles.container}
    >
      <VStack flex={1}>
        {/* 顶部：用户信息 */}
        <HStack alignItems="center" gap="$sm">
          <TouchableOpacity
            onPress={() => onAuthorPress?.(post.author.id)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onAuthorPress?.(post.author.id)}
            activeOpacity={0.8}
            style={{ flex: 1 }}
          >
            <HStack alignItems="center" gap="$xs">
              <Text
                color="$black"
                fontWeight="$semibold"
                fontSize="$sm"
                numberOfLines={1}
              >
                {post.author.name}
              </Text>
            </HStack>
          </TouchableOpacity>
        </HStack>

        {/* 帖子标题 */}
        <Text
          color="$black"
          fontWeight="$bold"
          fontSize="$md"
          lineHeight="$md"
          numberOfLines={2}
          mt="$sm"
        >
          {displayTitle}
        </Text>

        {/* 帖子内容摘要 */}
        {displayDescription && (
          <Text
            color="$gray600"
            fontSize="$sm"
            lineHeight="$sm"
            numberOfLines={2}
            mt="$xs"
          >
            {displayDescription}
          </Text>
        )}

        {/* 图片预览 */}
        {renderImagePreview()}

        {/* 底部：社区标签、时间、互动数据 */}
        <HStack mt="$sm" alignItems="center" justifyContent="space-between">
          <HStack alignItems="center" gap="$sm">
            {/* 社区标签 */}
            {post.communityName && (
              <HStack alignItems="center" gap="$xs">
                <Box
                  bg="$gray100"
                  px="$sm"
                  py="$xs"
                  rounded="$sm"
                >
                  <Text color="$gray600" fontSize="$xs">
                    {post.communityName}
                  </Text>
                </Box>
              </HStack>
            )}

            {/* 时间 */}
            {post.timestamp && (
              <Text color="$gray400" fontSize="$xs">
                {post.timestamp}
              </Text>
            )}
          </HStack>

          {/* 互动数据 */}
          <HStack alignItems="center" gap="$md">
            {/* 评论数 */}
            <HStack alignItems="center" gap="$xs">
              <Ionicons
                name="chatbubble-outline"
                size={14}
                color={theme.colors.gray400}
              />
              <Text color="$gray400" fontSize="$xs">
                {displayComments}
              </Text>
            </HStack>

            {/* 点赞数 */}
            <TouchableOpacity
              onPress={() => onLike?.(post.id)}
              activeOpacity={0.8}
            >
              <HStack alignItems="center" gap="$xs">
                <Ionicons
                  name={displayIsLiked ? "heart" : "heart-outline"}
                  size={14}
                  color={displayIsLiked ? "#FF3040" : theme.colors.gray400}
                />
                <Text
                  color={displayIsLiked ? "#FF3040" : "$gray400"}
                  fontSize="$xs"
                >
                  {displayLikes}
                </Text>
              </HStack>
            </TouchableOpacity>
          </HStack>
        </HStack>
      </VStack>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
  },
  previewImage: {
    width: 100,
    height: 100,
    backgroundColor: theme.colors.gray100,
    borderRadius: 4,
  },
});

export default ForumPostCard;
