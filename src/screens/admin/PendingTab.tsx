import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService } from "../../services/adminService";
import { Post } from "../../services/postService";
import { sharedStyles } from "./adminStyles";
import { formatDate, getPostTypeName } from "./adminUtils";

const PendingTab = () => {
  const navigation = useNavigation();
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const [batchMode, setBatchMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<number>>(new Set());
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");

  const fetchPendingPosts = useCallback(async () => {
    try {
      setLoading(true);
      const posts = await adminService.getPendingPosts();
      setPendingPosts(posts);
    } catch (error) {
      console.error("获取待审核帖子失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取待审核帖子失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPosts();
  }, [fetchPendingPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingPosts();
    setRefreshing(false);
  }, [fetchPendingPosts]);

  const handleApprove = async (postId: number) => {
    Alert.alert("确认通过", "确定要通过这篇帖子吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approvePost(postId);
            Alert.alert("成功", "帖子已通过审核");
            setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleOpenRejectModal = (postId: number) => {
    setSelectedPostId(postId);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (selectedPostId === null) return;
    try {
      setActionLoading(true);
      await adminService.rejectPost(selectedPostId, rejectReason || undefined);
      Alert.alert("成功", "帖子已被拒绝");
      setPendingPosts((prev) => prev.filter((p) => p.id !== selectedPostId));
      setRejectModalVisible(false);
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedPostIds(new Set());
  };

  const toggleSelectPost = (postId: number) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPostIds.size === pendingPosts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(pendingPosts.map((p) => p.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedPostIds.size === 0) {
      Alert.alert("提示", "请先选择要通过的帖子");
      return;
    }
    Alert.alert("批量通过", `确定要通过选中的 ${selectedPostIds.size} 篇帖子吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: async () => {
          try {
            setActionLoading(true);
            const postIds = Array.from(selectedPostIds);
            let successCount = 0;
            let failCount = 0;
            for (const postId of postIds) {
              try {
                await adminService.approvePost(postId);
                successCount++;
              } catch {
                failCount++;
              }
            }
            setPendingPosts((prev) => prev.filter((p) => !selectedPostIds.has(p.id) || failCount > 0));
            setSelectedPostIds(new Set());
            if (failCount > 0) {
              Alert.alert("完成", `成功通过 ${successCount} 篇，失败 ${failCount} 篇`);
              fetchPendingPosts();
            } else {
              Alert.alert("成功", `已通过 ${successCount} 篇帖子`);
            }
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleOpenBatchRejectModal = () => {
    if (selectedPostIds.size === 0) {
      Alert.alert("提示", "请先选择要拒绝的帖子");
      return;
    }
    setBatchRejectReason("");
    setBatchRejectModalVisible(true);
  };

  const handleConfirmBatchReject = async () => {
    try {
      setActionLoading(true);
      const postIds = Array.from(selectedPostIds);
      let successCount = 0;
      let failCount = 0;
      for (const postId of postIds) {
        try {
          await adminService.rejectPost(postId, batchRejectReason || undefined);
          successCount++;
        } catch {
          failCount++;
        }
      }
      setPendingPosts((prev) => prev.filter((p) => !selectedPostIds.has(p.id) || failCount > 0));
      setSelectedPostIds(new Set());
      setBatchRejectModalVisible(false);
      if (failCount > 0) {
        Alert.alert("完成", `成功拒绝 ${successCount} 篇，失败 ${failCount} 篇`);
        fetchPendingPosts();
      } else {
        Alert.alert("成功", `已拒绝 ${successCount} 篇帖子`);
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    Alert.alert("确认删除", "确定要删除这篇帖子吗？此操作不可撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deletePost(postId);
            Alert.alert("成功", "帖子已删除");
            setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除帖子失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderPostCard = (post: Post) => {
    const isSelected = selectedPostIds.has(post.id);
    return (
      <TouchableOpacity
        key={post.id}
        style={[sharedStyles.postCard, isSelected && styles.postCardSelected]}
        onPress={batchMode ? () => toggleSelectPost(post.id) : undefined}
        activeOpacity={batchMode ? 0.7 : 1}
      >
        <View style={sharedStyles.postHeader}>
          <View style={sharedStyles.postMeta}>
            {batchMode && (
              <TouchableOpacity style={styles.checkbox} onPress={() => toggleSelectPost(post.id)}>
                <Ionicons
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={22}
                  color={isSelected ? theme.colors.black : theme.colors.gray300}
                />
              </TouchableOpacity>
            )}
            <Text style={sharedStyles.postType}>{getPostTypeName(post.postType)}</Text>
            <Text style={sharedStyles.postId}>ID: {post.id}</Text>
          </View>
          <Text style={sharedStyles.postDate}>{formatDate(post.createdAt)}</Text>
        </View>

        <View style={sharedStyles.userInfo}>
          <Ionicons name="person-circle-outline" size={20} color={theme.colors.gray400} />
          <Text style={sharedStyles.username}>{post.username}</Text>
          <Text style={sharedStyles.userId}>(ID: {post.userId})</Text>
        </View>

        <Text style={sharedStyles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>

        {post.contentText && (
          <Text style={sharedStyles.postContent} numberOfLines={3}>
            {post.contentText}
          </Text>
        )}

        {post.imageUrls && post.imageUrls.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {post.imageUrls.slice(0, 4).map((url, index) => (
              <Image key={index} source={{ uri: url }} style={styles.postImage} resizeMode="cover" />
            ))}
            {post.imageUrls.length > 4 && (
              <View style={styles.moreImages}>
                <Text style={styles.moreImagesText}>+{post.imageUrls.length - 4}</Text>
              </View>
            )}
          </ScrollView>
        )}

        {post.postType === "ITEM_REVIEW" && (
          <View style={styles.reviewInfo}>
            {post.brandName && <Text style={styles.reviewText}>品牌: {post.brandName}</Text>}
            {post.productName && <Text style={styles.reviewText}>产品: {post.productName}</Text>}
            {post.rating !== undefined && (
              <View style={styles.ratingContainer}>
                <Text style={styles.reviewText}>评分: </Text>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= (post.rating || 0) ? "star" : "star-outline"}
                    size={14}
                    color="#FFD700"
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {!batchMode && (
          <View style={sharedStyles.actionButtons}>
            <TouchableOpacity
              style={[sharedStyles.actionButton, sharedStyles.approveButton]}
              onPress={() => handleApprove(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
              <Text style={sharedStyles.actionButtonText}>通过</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sharedStyles.actionButton, sharedStyles.rejectButton]}
              onPress={() => handleOpenRejectModal(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.white} />
              <Text style={sharedStyles.actionButtonText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sharedStyles.actionButton, sharedStyles.deletePostButton]}
              onPress={() => handleDeletePost(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
              <Text style={sharedStyles.actionButtonText}>删除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sharedStyles.actionButton, sharedStyles.viewButton]}
              onPress={() => (navigation as any).navigate("PostDetail", { postId: post.id })}
            >
              <Ionicons name="eye-outline" size={18} color={theme.colors.black} />
              <Text style={[sharedStyles.actionButtonText, { color: theme.colors.black }]}>查看</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {pendingPosts.length > 0 && (
        <View style={styles.batchToolbar}>
          <TouchableOpacity
            style={[styles.batchModeButton, batchMode && styles.batchModeButtonActive]}
            onPress={toggleBatchMode}
          >
            <Ionicons
              name={batchMode ? "close" : "checkbox-outline"}
              size={18}
              color={batchMode ? theme.colors.white : theme.colors.black}
            />
            <Text style={[styles.batchModeButtonText, batchMode && styles.batchModeButtonTextActive]}>
              {batchMode ? "取消" : "批量操作"}
            </Text>
          </TouchableOpacity>

          {batchMode && (
            <>
              <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
                <Ionicons
                  name={selectedPostIds.size === pendingPosts.length ? "checkbox" : "square-outline"}
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.selectAllText}>
                  {selectedPostIds.size === pendingPosts.length ? "取消全选" : "全选"}
                </Text>
              </TouchableOpacity>

              <View style={styles.batchActions}>
                <TouchableOpacity
                  style={[styles.batchActionButton, styles.batchApproveButton, selectedPostIds.size === 0 && styles.batchActionButtonDisabled]}
                  onPress={handleBatchApprove}
                  disabled={actionLoading || selectedPostIds.size === 0}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.white} />
                      <Text style={styles.batchActionText}>通过({selectedPostIds.size})</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.batchActionButton, styles.batchRejectButton, selectedPostIds.size === 0 && styles.batchActionButtonDisabled]}
                  onPress={handleOpenBatchRejectModal}
                  disabled={actionLoading || selectedPostIds.size === 0}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.white} />
                  <Text style={styles.batchActionText}>拒绝({selectedPostIds.size})</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <View style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </View>
        ) : pendingPosts.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核帖子</Text>
          </View>
        ) : (
          <>
            {pendingPosts.map(renderPostCard)}
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={sharedStyles.modalOverlay}>
          <View style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>拒绝原因</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder="请输入拒绝原因（可选）"
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={sharedStyles.modalButtons}>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={() => setRejectModalVisible(false)}>
                <Text style={sharedStyles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalConfirmButton]} onPress={handleConfirmReject} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={sharedStyles.modalConfirmText}>确认拒绝</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Batch Reject Modal */}
      <Modal visible={batchRejectModalVisible} transparent animationType="fade" onRequestClose={() => setBatchRejectModalVisible(false)}>
        <View style={sharedStyles.modalOverlay}>
          <View style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>批量拒绝 ({selectedPostIds.size} 篇)</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder="请输入拒绝原因（可选，将应用于所有选中帖子）"
              placeholderTextColor={theme.colors.gray300}
              value={batchRejectReason}
              onChangeText={setBatchRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={sharedStyles.modalButtons}>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={() => setBatchRejectModalVisible(false)}>
                <Text style={sharedStyles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalConfirmButton]} onPress={handleConfirmBatchReject} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={sharedStyles.modalConfirmText}>确认拒绝</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  postCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.black,
  },
  checkbox: {
    marginRight: theme.spacing.sm,
  },
  imageScroll: {
    marginBottom: theme.spacing.sm,
  },
  postImage: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  moreImages: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  moreImagesText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    fontWeight: "600",
  },
  reviewInfo: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  reviewText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  batchToolbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  batchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    gap: 4,
  },
  batchModeButtonActive: {
    backgroundColor: theme.colors.black,
  },
  batchModeButtonText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontWeight: "600",
  },
  batchModeButtonTextActive: {
    color: theme.colors.white,
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 4,
  },
  selectAllText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontWeight: "500",
  },
  batchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginLeft: "auto",
  },
  batchActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  batchApproveButton: {
    backgroundColor: theme.colors.success,
  },
  batchRejectButton: {
    backgroundColor: theme.colors.error,
  },
  batchActionButtonDisabled: {
    opacity: 0.5,
  },
  batchActionText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
});

export default PendingTab;
