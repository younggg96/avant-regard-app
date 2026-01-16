import React from "react";
import { ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack, Image } from "../ui";
import { theme } from "../../theme";
import { Comment, CommentReply, PostStatus, ReplyTarget } from "./types";
import { styles } from "./styles";

interface CommentsSectionProps {
  comments: Comment[];
  isLoading: boolean;
  postStatus: PostStatus;
  onCommentLike: (commentId: string) => void;
  onReplyLike: (replyId: string, parentId: string) => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReplyPress: (target: ReplyTarget) => void;
  onToggleReplies: (commentId: string) => void;
}

// 单个回复项组件
const ReplyItem: React.FC<{
  reply: CommentReply;
  onLike: () => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReply: () => void;
}> = ({ reply, onLike, onUserPress, onReply }) => (
  <HStack space="sm" mt="$sm" ml="$xl" pl="$md" borderLeftWidth={2} borderLeftColor="$gray200">
    <Pressable
      onPress={() => onUserPress(reply.userId, reply.userName, reply.userAvatar)}
    >
      <Image
        source={{ uri: reply.userAvatar }}
        style={styles.replyAvatar}
      />
    </Pressable>
    <VStack flex={1} space="xs">
      <HStack justifyContent="between" alignItems="center">
        <HStack space="xs" alignItems="center" flexWrap="wrap" flex={1}>
          <Pressable
            onPress={() => onUserPress(reply.userId, reply.userName, reply.userAvatar)}
          >
            <Text fontSize="$xs" fontWeight="$semibold" color="$gray800">
              {reply.userName}
            </Text>
          </Pressable>
          {reply.replyToUsername && (
            <>
              <Ionicons name="arrow-forward" size={10} color={theme.colors.gray400} />
              <Text fontSize="$xs" color="$accent" fontWeight="$medium">
                @{reply.replyToUsername}
              </Text>
            </>
          )}
        </HStack>
        <Text fontSize="$xs" color="$gray500">
          {reply.timestamp}
        </Text>
      </HStack>
      <Text fontSize="$sm" color="$gray700" lineHeight="$md">
        {reply.content}
      </Text>
      <HStack space="md" mt="$xs">
        <Pressable onPress={onLike}>
          <HStack space="xs" alignItems="center">
            <Ionicons
              name={reply.isLiked ? "heart" : "heart-outline"}
              size={14}
              color={reply.isLiked ? "#FF3040" : theme.colors.gray400}
            />
            <Text
              fontSize="$xs"
              color={reply.isLiked ? "#FF3040" : "$gray500"}
            >
              {reply.likes > 0 ? reply.likes : ""}
            </Text>
          </HStack>
        </Pressable>
        <Pressable onPress={onReply}>
          <Text fontSize="$xs" color="$gray500">
            回复
          </Text>
        </Pressable>
      </HStack>
    </VStack>
  </HStack>
);

// 单条评论组件
const CommentItem: React.FC<{
  comment: Comment;
  onLike: () => void;
  onReplyLike: (replyId: string) => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReply: () => void;
  onReplyToReply: (reply: CommentReply) => void;
  onToggleReplies: () => void;
}> = ({
  comment,
  onLike,
  onReplyLike,
  onUserPress,
  onReply,
  onReplyToReply,
  onToggleReplies,
}) => (
  <VStack mt="$md">
    <HStack space="sm">
      <Pressable
        onPress={() =>
          onUserPress(comment.userId, comment.userName, comment.userAvatar)
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
              onUserPress(comment.userId, comment.userName, comment.userAvatar)
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
        <HStack space="md" mt="$xs" alignItems="center">
          <Pressable onPress={onLike}>
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
                {comment.likes > 0 ? comment.likes : ""}
              </Text>
            </HStack>
          </Pressable>
          <Pressable onPress={onReply}>
            <Text fontSize="$xs" color="$gray600">
              回复
            </Text>
          </Pressable>
          {comment.replyCount > 0 && !comment.showReplies && (
            <Pressable onPress={onToggleReplies}>
              <Text fontSize="$xs" color="$accent" fontWeight="$medium">
                查看 {comment.replyCount} 条回复
              </Text>
            </Pressable>
          )}
        </HStack>
      </VStack>
    </HStack>

    {/* 回复列表 */}
    {comment.showReplies && comment.replies && comment.replies.length > 0 && (
      <VStack mt="$xs">
        {comment.replies.map((reply) => (
          <ReplyItem
            key={reply.id}
            reply={reply}
            onLike={() => onReplyLike(reply.id)}
            onUserPress={onUserPress}
            onReply={() => onReplyToReply(reply)}
          />
        ))}
        {comment.replies.length > 0 && (
          <Pressable onPress={onToggleReplies} mt="$sm" ml="$xl" pl="$md">
            <Text fontSize="$xs" color="$gray500">
              收起回复
            </Text>
          </Pressable>
        )}
      </VStack>
    )}
  </VStack>
);

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  isLoading,
  postStatus,
  onCommentLike,
  onReplyLike,
  onUserPress,
  onReplyPress,
  onToggleReplies,
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

  // 计算总评论数（包括回复）
  const totalComments = comments.reduce(
    (sum, c) => sum + 1 + (c.replyCount || 0),
    0
  );

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
        评论 ({totalComments})
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
          <CommentItem
            key={comment.id}
            comment={comment}
            onLike={() => onCommentLike(comment.id)}
            onReplyLike={(replyId) => onReplyLike(replyId, comment.id)}
            onUserPress={onUserPress}
            onReply={() =>
              onReplyPress({
                commentId: comment.id,
                userId: comment.userId,
                userName: comment.userName,
              })
            }
            onReplyToReply={(reply) =>
              onReplyPress({
                commentId: comment.id, // 始终使用父评论ID
                userId: reply.userId,
                userName: reply.userName,
              })
            }
            onToggleReplies={() => onToggleReplies(comment.id)}
          />
        ))}
    </VStack>
  );
};
