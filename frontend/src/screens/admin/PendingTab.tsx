import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView as RNScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService } from "../../services/adminService";
import { Post } from "../../services/postService";
import { useSharedStyles } from "./adminStyles";
import { formatDate, getPostTypeName } from "./adminUtils";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import HalfStarRating from "../../components/HalfStarRating";

const PendingTab = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
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
      console.error("fetchPendingPosts failed:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.fetchPendingFailed"));
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
    Alert.alert(t("admin.confirmApprove"), t("admin.confirmApprovePost"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approvePost(postId);
            Alert.alert(t("common.success"), t("admin.postApproved"));
            setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
      Alert.alert(t("common.success"), t("admin.postRejected"));
      setPendingPosts((prev) => prev.filter((p) => p.id !== selectedPostId));
      setRejectModalVisible(false);
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
      Alert.alert(t("admin.hint"), t("admin.selectPostsToApprove"));
      return;
    }
    Alert.alert(t("admin.batchApprove"), t("admin.batchApprove") + ` (${selectedPostIds.size})`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
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
              Alert.alert(t("admin.done"), t("admin.batchApproveResult", { success: successCount, fail: failCount }));
              fetchPendingPosts();
            } else {
              Alert.alert(t("common.success"), t("admin.batchApproveSuccess", { count: successCount }));
            }
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleOpenBatchRejectModal = () => {
    if (selectedPostIds.size === 0) {
      Alert.alert(t("admin.hint"), t("admin.selectPostsToReject"));
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
        Alert.alert(t("admin.done"), t("admin.batchRejectResult", { success: successCount, fail: failCount }));
        fetchPendingPosts();
      } else {
        Alert.alert(t("common.success"), t("admin.batchRejectSuccess", { count: successCount }));
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeletePost"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deletePost(postId);
            Alert.alert(t("common.success"), t("admin.postDeleted"));
            setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deletePostFailed"));
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
                  size={20}
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
          <Ionicons name="person-circle-outline" size={18} color={theme.colors.gray400} />
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
            {post.brandName && <Text style={styles.reviewText}>{t("admin.brand")} {post.brandName}</Text>}
            {post.productName && <Text style={styles.reviewText}>{t("admin.product")} {post.productName.split("\n").map((s) => s.trim()).filter(Boolean).join(" · ")}</Text>}
            {post.rating !== undefined && (
              <HStack style={styles.ratingContainer}>
                <Text style={styles.reviewText}>{t("admin.rating")} </Text>
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
              leftIcon={<Ionicons name="checkmark-circle" size={16} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 11 }}>{t("admin.approve")}</ButtonText>
            </Button>
            <Button
              size="sm"
              colorScheme="error"
              onPress={() => handleOpenRejectModal(post.id)}
              disabled={actionLoading}
              leftIcon={<Ionicons name="close-circle" size={16} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 11 }}>{t("admin.reject")}</ButtonText>
            </Button>
            <Button
              size="sm"
              colorScheme="error"
              onPress={() => handleDeletePost(post.id)}
              disabled={actionLoading}
              leftIcon={<Ionicons name="trash-outline" size={16} color={theme.colors.white} />}
            >
              <ButtonText style={{ fontSize: 11 }}>{t("common.delete")}</ButtonText>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => (navigation as any).navigate("PostDetail", { postId: post.id })}
              leftIcon={<Ionicons name="eye-outline" size={16} />}
            >
              <ButtonText style={{ fontSize: 11 }}>{t("admin.view")}</ButtonText>
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
              size={16}
              color={batchMode ? theme.colors.white : theme.colors.black}
            />
            <Text style={[styles.batchModeButtonText, batchMode && styles.batchModeButtonTextActive]}>
              {batchMode ? t("common.cancel") : t("admin.batchOperation")}
            </Text>
          </Pressable>

          {batchMode && (
            <>
              <Pressable style={styles.selectAllButton} onPress={toggleSelectAll}>
                <Ionicons
                  name={selectedPostIds.size === pendingPosts.length ? "checkbox" : "square-outline"}
                  size={16}
                  color={theme.colors.black}
                />
                <Text style={styles.selectAllText}>
                  {selectedPostIds.size === pendingPosts.length ? t("admin.deselectAll") : t("admin.selectAll")}
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
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.white} />
                      <Text style={styles.batchActionText}>{t("admin.approve")}({selectedPostIds.size})</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.batchActionButton, styles.batchRejectButton, selectedPostIds.size === 0 && styles.batchActionButtonDisabled]}
                  onPress={handleOpenBatchRejectModal}
                  disabled={actionLoading || selectedPostIds.size === 0}
                >
                  <Ionicons name="close-circle" size={14} color={theme.colors.white} />
                  <Text style={styles.batchActionText}>{t("admin.batchReject", { count: selectedPostIds.size })}</Text>
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
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : pendingPosts.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noPendingPosts")}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.gray300, marginTop: 4, textAlign: "center" }}>
              {t("admin.autoReviewEnabled")}
            </Text>
          </Box>
        ) : (
          <>
            {pendingPosts.map(renderPostCard)}
            <Box style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>{t("admin.rejectReason")}</Text>
            <Input
              style={sharedStyles.modalInput}
              placeholder={t("admin.rejectReasonPlaceholder")}
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
                <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
              </Button>
              <Button size="sm" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>{t("admin.confirmReject")}</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={batchRejectModalVisible} transparent animationType="fade" onRequestClose={() => setBatchRejectModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>{t("admin.batchReject", { count: selectedPostIds.size })}</Text>
            <Input
              style={sharedStyles.modalInput}
              placeholder={t("admin.batchRejectReasonPlaceholder")}
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
                <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
              </Button>
              <Button size="sm" onPress={handleConfirmBatchReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>{t("admin.confirmReject")}</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  postCardSelected: {
    borderWidth: 2,
    borderColor: t.colors.text,
  },
  checkbox: {
    marginRight: t.spacing.sm,
  },
  imageScroll: {
    marginBottom: 6,
  },
  postImage: {
    width: 64,
    height: 64,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: t.colors.gray100,
  },
  moreImages: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  moreImagesText: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 16,
    color: t.colors.gray400,
    fontWeight: "600",
  },
  reviewInfo: {
    backgroundColor: t.colors.gray50,
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  reviewText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
    marginBottom: 2,
  },
  ratingContainer: {
    alignItems: "center",
  },
  batchToolbar: {
    alignItems: "center",
    backgroundColor: t.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    flexWrap: "wrap",
    gap: 6,
  },
  batchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    gap: 4,
  },
  batchModeButtonActive: {
    backgroundColor: t.colors.text,
  },
  batchModeButtonText: {
    ...t.typography.caption,
    fontSize: 11,
    color: t.colors.text,
    fontWeight: "600",
  },
  batchModeButtonTextActive: {
    color: t.colors.textInverted,
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  selectAllText: {
    ...t.typography.caption,
    fontSize: 11,
    color: t.colors.text,
    fontWeight: "500",
  },
  batchActions: {
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  batchActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    gap: 4,
  },
  batchApproveButton: {
    backgroundColor: t.colors.success,
  },
  batchRejectButton: {
    backgroundColor: t.colors.error,
  },
  batchActionButtonDisabled: {
    opacity: 0.5,
  },
  batchActionText: {
    ...t.typography.caption,
    fontSize: 11,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
});

export default PendingTab;
