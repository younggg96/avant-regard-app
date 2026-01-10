import React from "react";
import { ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack, Image } from "../ui";
import { theme } from "../../theme";
import { Comment, PostStatus } from "./types";
import { styles } from "./styles";

interface CommentsSectionProps {
  comments: Comment[];
  isLoading: boolean;
  postStatus: PostStatus;
  onCommentLike: (commentId: string) => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  isLoading,
  postStatus,
  onCommentLike,
  onUserPress,
}) => {
  // 草稿和审核中的帖子不显示评论
  const showComments = postStatus === "published";

  if (!showComments) {
    return (
      <VStack
        space="md"
        px="$md"
        py="$xl"
        mt="$md"
        alignItems="center"
        borderTopWidth={8}
        borderTopColor="$gray100"
      >
        <Ionicons
          name={postStatus === "draft" ? "create-outline" : "time-outline"}
          size={48}
          color={theme.colors.gray300}
        />
        <Text fontSize="$md" color="$gray600" textAlign="center">
          {postStatus === "draft"
            ? "草稿暂不支持评论，请先完成编辑并发布"
            : "内容正在审核中，审核通过后可以查看评论"}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack
      space="md"
      px="$md"
      py="$lg"
      mt="$md"
      borderTopWidth={8}
      borderTopColor="$gray100"
    >
      <Text fontSize="$lg" fontWeight="$semibold" color="$black">
        评论 ({comments.length})
      </Text>

      {/* Loading State */}
      {isLoading && (
        <Box py="$lg" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.gray400} />
          <Text fontSize="$sm" color="$gray400" mt="$sm">
            加载评论中...
          </Text>
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && comments.length === 0 && (
        <Box py="$lg" alignItems="center">
          <Ionicons
            name="chatbubble-outline"
            size={32}
            color={theme.colors.gray300}
          />
          <Text fontSize="$sm" color="$gray400" mt="$sm">
            暂无评论，快来发表第一条评论吧
          </Text>
        </Box>
      )}

      {/* Comments List */}
      {!isLoading &&
        comments.map((comment) => (
          <HStack key={comment.id} space="sm" mt="$md">
            <Pressable
              onPress={() =>
                onUserPress(
                  comment.userId,
                  comment.userName,
                  comment.userAvatar
                )
              }
            >
              <Image
                source={{ uri: comment.userAvatar }}
                style={styles.commentAvatar}
              />
            </Pressable>
            <VStack flex={1} space="xs">
              <HStack justifyContent="between" alignItems="center">
                <Pressable
                  onPress={() =>
                    onUserPress(
                      comment.userId,
                      comment.userName,
                      comment.userAvatar
                    )
                  }
                >
                  <Text fontSize="$sm" fontWeight="$semibold" color="$black">
                    {comment.userName}
                  </Text>
                </Pressable>
                <Text fontSize="$xs" color="$gray600">
                  {comment.timestamp}
                </Text>
              </HStack>
              <Text fontSize="$sm" color="$gray800" lineHeight="$md">
                {comment.content}
              </Text>
              <HStack space="md" mt="$xs">
                <Pressable onPress={() => onCommentLike(comment.id)}>
                  <HStack space="xs" alignItems="center">
                    <Ionicons
                      name={comment.isLiked ? "heart" : "heart-outline"}
                      size={16}
                      color={comment.isLiked ? "#FF3040" : theme.colors.gray400}
                    />
                    <Text
                      fontSize="$xs"
                      color={comment.isLiked ? "#FF3040" : "$gray600"}
                    >
                      {comment.likes}
                    </Text>
                  </HStack>
                </Pressable>
                <Pressable>
                  <Text fontSize="$xs" color="$gray600">
                    回复
                  </Text>
                </Pressable>
              </HStack>
            </VStack>
          </HStack>
        ))}
    </VStack>
  );
};
