import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService, AdminComment } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { formatDate } from "./adminUtils";

const CommentsTab = () => {
  const navigation = useNavigation();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchComments = useCallback(async (p: number = 1) => {
    try {
      setLoading(true);
      const result = await adminService.getAllComments(p, 20);
      setComments(result.comments);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (error) {
      console.error("获取评论列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取评论列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchComments(1);
    setRefreshing(false);
  }, [fetchComments]);

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert("确认删除", "确定要删除这条评论吗？此操作不可撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteComment(commentId);
            Alert.alert("成功", "评论已删除");
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setTotal((prev) => prev - 1);
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除评论失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderCommentCard = (comment: AdminComment) => (
    <View key={comment.id} style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.commentMeta}>
          <Ionicons name="chatbubble-outline" size={16} color={theme.colors.gray400} />
          <Text style={styles.commentId}>ID: {comment.id}</Text>
        </View>
        <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
      </View>

      <View style={styles.commentUserInfo}>
        <Ionicons name="person-circle-outline" size={18} color={theme.colors.gray400} />
        <Text style={styles.commentUsername}>{comment.username}</Text>
        <Text style={styles.commentUserId}>(ID: {comment.userId})</Text>
      </View>

      <View style={styles.commentPostInfo}>
        <Ionicons name="document-text-outline" size={16} color={theme.colors.gray300} />
        <Text style={styles.commentPostTitle} numberOfLines={1}>
          帖子: {comment.postTitle || `#${comment.postId}`}
        </Text>
      </View>

      <Text style={styles.commentContent} numberOfLines={4}>
        {comment.content}
      </Text>

      <View style={styles.commentStats}>
        <Ionicons name="heart" size={14} color={theme.colors.gray300} />
        <Text style={styles.commentLikes}>{comment.likeCount}</Text>
      </View>

      <View style={styles.commentActions}>
        <TouchableOpacity
          style={[sharedStyles.actionButton, styles.deleteCommentButton]}
          onPress={() => handleDeleteComment(comment.id)}
          disabled={actionLoading}
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.white} />
          <Text style={sharedStyles.actionButtonText}>删除</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[sharedStyles.actionButton, sharedStyles.viewButton]}
          onPress={() => (navigation as any).navigate("PostDetail", { postId: comment.postId })}
        >
          <Ionicons name="eye-outline" size={16} color={theme.colors.black} />
          <Text style={[sharedStyles.actionButtonText, { color: theme.colors.black }]}>查看帖子</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.commentsList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {loading && comments.length === 0 ? (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={sharedStyles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.gray300} />
          <Text style={sharedStyles.emptyText}>暂无评论</Text>
        </View>
      ) : (
        <>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsHeaderText}>共 {total} 条评论</Text>
          </View>
          {comments.map(renderCommentCard)}

          {totalPages > 1 && (
            <View style={sharedStyles.paginationContainer}>
              <TouchableOpacity
                style={[sharedStyles.pageButton, page <= 1 && sharedStyles.pageButtonDisabled]}
                onPress={() => page > 1 && fetchComments(page - 1)}
                disabled={page <= 1}
              >
                <Text style={sharedStyles.pageButtonText}>上一页</Text>
              </TouchableOpacity>
              <Text style={sharedStyles.pageInfo}>
                {page} / {totalPages}
              </Text>
              <TouchableOpacity
                style={[sharedStyles.pageButton, page >= totalPages && sharedStyles.pageButtonDisabled]}
                onPress={() => page < totalPages && fetchComments(page + 1)}
                disabled={page >= totalPages}
              >
                <Text style={sharedStyles.pageButtonText}>下一页</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  commentsList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  commentsHeader: {
    marginBottom: theme.spacing.md,
  },
  commentsHeaderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  commentCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  commentId: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  commentDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  commentUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  commentUsername: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
  },
  commentUserId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  commentPostInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
  },
  commentPostTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    flex: 1,
  },
  commentContent: {
    ...theme.typography.body,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
    lineHeight: 22,
  },
  commentStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: theme.spacing.md,
  },
  commentLikes: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  commentActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  deleteCommentButton: {
    backgroundColor: theme.colors.error,
  },
});

export default CommentsTab;
