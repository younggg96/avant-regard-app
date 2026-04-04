import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView as RNScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
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
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import HalfStarRating from "../../components/HalfStarRating";

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
      <Pressable
        key={post.id}
        style={[sharedStyles.postCard, isSelected && styles.postCardSelected]}
        onPress={batchMode ? () => toggleSelectPost(post.id) : undefined}
      >
        <HStack style={sharedStyles.postHeader}>
          <HStack style={sharedStyles.postMeta}>
            {batchMode && (
              <Pressable style={styles.checkbox} onPress={() => toggleSelectPost(post.id)}>
                <Ionicons
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={22}
                  color={isSelected ? theme.colors.black : theme.colors.gray300}
                />
              </Pressable>
            )}
            <Text style={sharedStyles.postType}>{getPostTypeName(post.postType)}</Text>
            <Text style={sharedStyles.postId}>ID: {post.id}</Text>
          </HStack>
          <Text style={sharedStyles.postDate}>{formatDate(post.createdAt)}</Text>
        </HStack>

        <HStack style={sharedStyles.userInfo}>
          <Ionicons name="person-circle-outline" size={20} color={theme.colors.gray400} />
          <Text style={sharedStyles.username}>{post.username}</Text>
          <Text style={sharedStyles.userId}>(ID: {post.userId})</Text>
        </HStack>

        <Text style={sharedStyles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>

        {post.contentText && (
          <Text style={sharedStyles.postContent} numberOfLines={3}>
            {post.contentText}
          </Text>
        )}

        {post.imageUrls && post.imageUrls.length > 0 && (
          <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {post.imageUrls.slice(0, 4).map((url, index) => (
              <OptimizedImage
                key={index}
                uri={url}
                size={ImageSize.MEDIUM}
                style={styles.postImage}
                contentFit="cover"
                lazy={true}
              />
            ))}
            {post.imageUrls.length > 4 && (
              <Box style={styles.moreImages}>
                <Text style={styles.moreImagesText}>+{post.imageUrls.length - 4}</Text>
              </Box>
            )}
          </RNScrollView>
        )}

        {post.postType === "ITEM_REVIEW" && (
          <Box style={styles.reviewInfo}>
            {post.brandName && <Text style={styles.reviewText}>品牌: {post.brandName}</Text>}
            {post.productName && <Text style={styles.reviewText}>产品: {post.productName}</Text>}
            {post.rating !== undefined && (
              <HStack style={styles.ratingContainer}>
                <Text style={styles.reviewText}>评分: </Text>
                <HalfStarRating
                  rating={post.rating || 0}
                  size={14}
                  color="#FFD700"
                  inactiveColor="#D1D5DB"
                />
              </HStack>
            )}
          </Box>
        )}

        {!batchMode && (
          <HStack style={sharedStyles.actionButtons}>
            <Button
              size="sm"
              colorScheme="success"
              onPress={() => handleApprove(post.id)}
              disabled={actionLoading}
              leftIcon={<Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 12 }}>通过</ButtonText>
            </Button>
            <Button
              size="sm"
              colorScheme="error"
              onPress={() => handleOpenRejectModal(post.id)}
              disabled={actionLoading}
              leftIcon={<Ionicons name="close-circle" size={18} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 12 }}>拒绝</ButtonText>
            </Button>
            <Button
              size="sm"
              colorScheme="error"
              onPress={() => handleDeletePost(post.id)}
              disabled={actionLoading}
              leftIcon={<Ionicons name="trash-outline" size={18} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 12 }}>删除</ButtonText>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => (navigation as any).navigate("PostDetail", { postId: post.id })}
              leftIcon={<Ionicons name="eye-outline" size={18} color={theme.colors.white} />}
            >
              <ButtonText style={{ color: theme.colors.white, fontSize: 12 }}>查看</ButtonText>
            </Button>
          </HStack>
        )}
      </Pressable>
    );
  };

  return (
    <Box style={{ flex: 1 }}>
      {pendingPosts.length > 0 && (
        <HStack style={styles.batchToolbar}>
          <Pressable
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
          </Pressable>

          {batchMode && (
            <>
              <Pressable style={styles.selectAllButton} onPress={toggleSelectAll}>
                <Ionicons
                  name={selectedPostIds.size === pendingPosts.length ? "checkbox" : "square-outline"}
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.selectAllText}>
                  {selectedPostIds.size === pendingPosts.length ? "取消全选" : "全选"}
                </Text>
              </Pressable>

              <HStack style={styles.batchActions}>
                <Pressable
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
                </Pressable>
                <Pressable
                  style={[styles.batchActionButton, styles.batchRejectButton, selectedPostIds.size === 0 && styles.batchActionButtonDisabled]}
                  onPress={handleOpenBatchRejectModal}
                  disabled={actionLoading || selectedPostIds.size === 0}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.white} />
                  <Text style={styles.batchActionText}>拒绝({selectedPostIds.size})</Text>
                </Pressable>
              </HStack>
            </>
          )}
        </HStack>
      )}

      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </Box>
        ) : pendingPosts.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核帖子</Text>
          </Box>
        ) : (
          <>
            {pendingPosts.map(renderPostCard)}
            <Box style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>拒绝原因</Text>
            <Input
              style={sharedStyles.modalInput}
              placeholder="请输入拒绝原因（可选）"
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              variant="outline"
              size="md"
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button variant="outline" size="sm" onPress={() => setRejectModalVisible(false)}>
                <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
              </Button>
              <Button size="sm" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>确认拒绝</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>

      <Modal visible={batchRejectModalVisible} transparent animationType="fade" onRequestClose={() => setBatchRejectModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>批量拒绝 ({selectedPostIds.size} 篇)</Text>
            <Input
              style={sharedStyles.modalInput}
              placeholder="请输入拒绝原因（可选，将应用于所有选中帖子）"
              placeholderTextColor={theme.colors.gray300}
              value={batchRejectReason}
              onChangeText={setBatchRejectReason}
              multiline
              numberOfLines={3}
              variant="outline"
              size="md"
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button variant="outline" size="sm" onPress={() => setBatchRejectModalVisible(false)}>
                <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
              </Button>
              <Button size="sm" onPress={handleConfirmBatchReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>确认拒绝</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
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
    alignItems: "center",
  },
  batchToolbar: {
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
