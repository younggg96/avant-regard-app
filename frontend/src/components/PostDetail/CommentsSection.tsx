import React from "react";
import { ActivityIndicator, Image as RNImage } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack, OptimizedImage } from "../ui";
import { ImageSize } from "../../utils/imageUtils";
import { theme } from "../../theme";
import { Comment, CommentReply, PostStatus, ReplyTarget } from "./types";
import { styles } from "./styles";

export interface ReportTarget {
  commentId: string;
  authorId: number;
  authorName: string;
}

interface CommentsSectionProps {
  comments: Comment[];
  isLoading: boolean;
  postStatus: PostStatus;
  currentUserId?: number;
  onCommentLike: (commentId: string) => void;
  onReplyLike: (replyId: string, parentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onDeleteReply: (replyId: string, parentId: string) => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReplyPress: (target: ReplyTarget) => void;
  onToggleReplies: (commentId: string) => void;
  onReportComment?: (target: ReportTarget) => void;
}

// 单个回复项组件
const ReplyItem: React.FC<{
  reply: CommentReply;
  isOwner: boolean;
  onLike: () => void;
  onDelete: () => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReply: () => void;
  onReport: () => void;
}> = ({ reply, isOwner, onLike, onDelete, onUserPress, onReply, onReport }) => {
  const { t } = useTranslation();
  return (
  <HStack space="sm" mt="$sm" ml="$xl" pl="$md" borderLeftWidth={2} borderLeftColor="$gray200">
    <Pressable
      onPress={() => onUserPress(reply.userId, reply.userName, reply.userAvatar)}
    >
      <OptimizedImage
        uri={reply.userAvatar}
        size={ImageSize.THUMBNAIL}
        style={styles.headerAvatar}
        contentFit="cover"
        lazy={true}
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
          {reply.userTitle ? (
            <Box bg="$gray100" px="$xs" py={1} rounded="$xs">
              <Text fontSize={9} fontWeight="$medium" color="$gray600">{reply.userTitle}</Text>
            </Box>
          ) : null}
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
            {t("postDetail.reply")}
          </Text>
        </Pressable>
        {isOwner ? (
          <Pressable onPress={onDelete}>
            <Text fontSize="$xs" color="$error">
              {t("postDetail.delete")}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onReport}>
            <HStack space="xs" alignItems="center">
              <Ionicons name="flag-outline" size={12} color={theme.colors.gray400} />
              <Text fontSize="$xs" color="$gray500">
                {t("postDetail.report")}
              </Text>
            </HStack>
          </Pressable>
        )}
      </HStack>
    </VStack>
  </HStack>
  );
};

// 单条评论组件
const CommentItem: React.FC<{
  comment: Comment;
  currentUserId?: number;
  onLike: () => void;
  onReplyLike: (replyId: string) => void;
  onDelete: () => void;
  onDeleteReply: (replyId: string) => void;
  onUserPress: (userId: number, userName: string, userAvatar: string) => void;
  onReply: () => void;
  onReplyToReply: (reply: CommentReply) => void;
  onToggleReplies: () => void;
  onReport: () => void;
  onReportReply: (reply: CommentReply) => void;
}> = ({
  comment,
  currentUserId,
  onLike,
  onReplyLike,
  onDelete,
  onDeleteReply,
  onUserPress,
  onReply,
  onReplyToReply,
  onToggleReplies,
  onReport,
  onReportReply,
}) => {
  const { t } = useTranslation();
  const replies = comment.replies ?? [];
  const [firstReply, ...otherReplies] = replies;
  const hasMoreReplies = otherReplies.length > 0;
  const repliesExpanded = comment.showReplies === true;

  return (
    <VStack mt="$md">
      <HStack space="sm">
        <Pressable
          onPress={() =>
            onUserPress(comment.userId, comment.userName, comment.userAvatar)
          }
        >
          <OptimizedImage
            uri={comment.userAvatar}
            size={ImageSize.THUMBNAIL}
            style={styles.commentAvatar}
            contentFit="cover"
            lazy={true}
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
            {comment.userTitle ? (
              <Box bg="$gray100" px="$xs" py={1} rounded="$xs">
                <Text fontSize={10} fontWeight="$medium" color="$gray600">{comment.userTitle}</Text>
              </Box>
            ) : null}
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
                {t("postDetail.reply")}
              </Text>
            </Pressable>
            {currentUserId === comment.userId ? (
              <Pressable onPress={onDelete}>
                <Text fontSize="$xs" color="$error">
                  {t("postDetail.delete")}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onReport}>
                <HStack space="xs" alignItems="center">
                  <Ionicons name="flag-outline" size={13} color={theme.colors.gray400} />
                  <Text fontSize="$xs" color="$gray600">
                    {t("postDetail.report")}
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>
        </VStack>
      </HStack>

      {/* 回复：首条默认展示，其余折叠后通过「查看其余」展开 */}
      {firstReply ? (
        <VStack mt="$xs">
          <ReplyItem
            key={firstReply.id}
            reply={firstReply}
            isOwner={currentUserId === firstReply.userId}
            onLike={() => onReplyLike(firstReply.id)}
            onDelete={() => onDeleteReply(firstReply.id)}
            onUserPress={onUserPress}
            onReply={() => onReplyToReply(firstReply)}
            onReport={() => onReportReply(firstReply)}
          />
          {hasMoreReplies && !repliesExpanded ? (
            <Pressable onPress={onToggleReplies} mt="$xs" ml="$xl" pl="$md">
              <Text fontSize="$xs" color="$accent" fontWeight="$medium">
                {t("postDetail.viewMoreReplies", { count: otherReplies.length })}
              </Text>
            </Pressable>
          ) : null}
          {repliesExpanded &&
            otherReplies.map((reply) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                isOwner={currentUserId === reply.userId}
                onLike={() => onReplyLike(reply.id)}
                onDelete={() => onDeleteReply(reply.id)}
                onUserPress={onUserPress}
                onReply={() => onReplyToReply(reply)}
                onReport={() => onReportReply(reply)}
              />
            ))}
          {repliesExpanded && hasMoreReplies ? (
            <Pressable onPress={onToggleReplies} mt="$sm" ml="$xl" pl="$md">
              <Text fontSize="$xs" color="$gray500">
                {t("postDetail.collapseReplies")}
              </Text>
            </Pressable>
          ) : null}
        </VStack>
      ) : comment.replyCount > 0 ? (
        <Pressable onPress={onToggleReplies} mt="$xs" ml="$xl" pl="$md">
          <Text fontSize="$xs" color="$accent" fontWeight="$medium">
            {t("postDetail.viewReplies", { count: comment.replyCount })}
          </Text>
        </Pressable>
      ) : null}
    </VStack>
  );
};

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  isLoading,
  postStatus,
  currentUserId,
  onCommentLike,
  onReplyLike,
  onDeleteComment,
  onDeleteReply,
  onUserPress,
  onReplyPress,
  onToggleReplies,
  onReportComment,
}) => {
  const { t } = useTranslation();
  const showComments: boolean = postStatus === "PUBLISHED";

  if (!showComments) {
    // REJECTED 在屏幕顶部已经有红色横幅说明状态 + 「修改并重新提交」按钮，
    // 这里就不再重复绘制一个大块「审核中」空态了——避免和顶部冲突。
    if (postStatus === "REJECTED") {
      return null;
    }
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
          name={postStatus === "DRAFT" ? "create-outline" : "time-outline"}
          size={48}
          color={theme.colors.gray300}
        />
        <Text fontSize="$md" color="$gray600" textAlign="center">
          {postStatus === "DRAFT"
            ? t("postDetail.draftNoComments")
            : t("postDetail.pendingNoComments")}
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
        {t("postDetail.comments", { count: totalComments })}
      </Text>

      {/* Loading State */}
      {isLoading && (
        <Box py="$lg" alignItems="center">
          <RNImage
            source={require("../../../assets/gif/profile-loading.gif")}
            style={styles.loadingGif}
            resizeMode="contain"
          />
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
            {t("postDetail.noComments")}
          </Text>
        </Box>
      )}

      {/* Comments List */}
      {!isLoading &&
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onLike={() => onCommentLike(comment.id)}
            onReplyLike={(replyId) => onReplyLike(replyId, comment.id)}
            onDelete={() => onDeleteComment(comment.id)}
            onDeleteReply={(replyId) => onDeleteReply(replyId, comment.id)}
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
                commentId: comment.id,
                userId: reply.userId,
                userName: reply.userName,
              })
            }
            onToggleReplies={() => onToggleReplies(comment.id)}
            onReport={() =>
              onReportComment?.({
                commentId: comment.id,
                authorId: comment.userId,
                authorName: comment.userName,
              })
            }
            onReportReply={(reply) =>
              onReportComment?.({
                commentId: reply.id,
                authorId: reply.userId,
                authorName: reply.userName,
              })
            }
          />
        ))}
    </VStack>
  );
};
