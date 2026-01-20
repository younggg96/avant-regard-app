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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { adminService, AdminComment } from "../services/adminService";
import { Post } from "../services/postService";

type TabType = "pending" | "comments" | "users";

const AdminScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 拒绝原因 Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 删除用户 Modal
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");

  // 批量操作状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<number>>(new Set());
  const [batchRejectModalVisible, setBatchRejectModalVisible] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");

  // 评论管理状态
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(0);
  const [commentsTotal, setCommentsTotal] = useState(0);

  // 获取待审核帖子
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

  // 获取所有评论
  const fetchComments = useCallback(async (page: number = 1) => {
    try {
      setCommentsLoading(true);
      const result = await adminService.getAllComments(page, 20);
      setComments(result.comments);
      setCommentsPage(result.page);
      setCommentsTotalPages(result.totalPages);
      setCommentsTotal(result.total);
    } catch (error) {
      console.error("获取评论列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取评论列表失败");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "pending") {
      await fetchPendingPosts();
    } else if (activeTab === "comments") {
      await fetchComments(1);
    }
    setRefreshing(false);
  }, [activeTab, fetchPendingPosts, fetchComments]);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingPosts();
    } else if (activeTab === "comments") {
      fetchComments(1);
    }
  }, [activeTab, fetchPendingPosts, fetchComments]);

  // 审核通过
  const handleApprove = async (postId: number) => {
    Alert.alert(
      "确认通过",
      "确定要通过这篇帖子吗？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminService.approvePost(postId);
              Alert.alert("成功", "帖子已通过审核");
              // 从列表中移除
              setPendingPosts(prev => prev.filter(p => p.id !== postId));
            } catch (error) {
              Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 打开拒绝 Modal
  const handleOpenRejectModal = (postId: number) => {
    setSelectedPostId(postId);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  // 确认拒绝
  const handleConfirmReject = async () => {
    if (selectedPostId === null) return;

    try {
      setActionLoading(true);
      await adminService.rejectPost(selectedPostId, rejectReason || undefined);
      Alert.alert("成功", "帖子已被拒绝");
      // 从列表中移除
      setPendingPosts(prev => prev.filter(p => p.id !== selectedPostId));
      setRejectModalVisible(false);
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  // 切换批量模式
  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedPostIds(new Set());
  };

  // 切换选中状态
  const toggleSelectPost = (postId: number) => {
    setSelectedPostIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedPostIds.size === pendingPosts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(pendingPosts.map(p => p.id)));
    }
  };

  // 批量通过
  const handleBatchApprove = async () => {
    if (selectedPostIds.size === 0) {
      Alert.alert("提示", "请先选择要通过的帖子");
      return;
    }

    Alert.alert(
      "批量通过",
      `确定要通过选中的 ${selectedPostIds.size} 篇帖子吗？`,
      [
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

              // 从列表中移除成功的帖子
              setPendingPosts(prev => prev.filter(p => !selectedPostIds.has(p.id) || failCount > 0));
              setSelectedPostIds(new Set());

              if (failCount > 0) {
                Alert.alert("完成", `成功通过 ${successCount} 篇，失败 ${failCount} 篇`);
                // 刷新列表获取最新状态
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
      ]
    );
  };

  // 打开批量拒绝 Modal
  const handleOpenBatchRejectModal = () => {
    if (selectedPostIds.size === 0) {
      Alert.alert("提示", "请先选择要拒绝的帖子");
      return;
    }
    setBatchRejectReason("");
    setBatchRejectModalVisible(true);
  };

  // 确认批量拒绝
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

      // 从列表中移除成功的帖子
      setPendingPosts(prev => prev.filter(p => !selectedPostIds.has(p.id) || failCount > 0));
      setSelectedPostIds(new Set());
      setBatchRejectModalVisible(false);

      if (failCount > 0) {
        Alert.alert("完成", `成功拒绝 ${successCount} 篇，失败 ${failCount} 篇`);
        // 刷新列表获取最新状态
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

  // 删除帖子
  const handleDeletePost = async (postId: number) => {
    Alert.alert(
      "确认删除",
      "确定要删除这篇帖子吗？此操作不可撤销。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminService.deletePost(postId);
              Alert.alert("成功", "帖子已删除");
              // 从列表中移除
              setPendingPosts(prev => prev.filter(p => p.id !== postId));
            } catch (error) {
              Alert.alert("错误", error instanceof Error ? error.message : "删除帖子失败");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 删除评论
  const handleDeleteComment = async (commentId: number) => {
    Alert.alert(
      "确认删除",
      "确定要删除这条评论吗？此操作不可撤销。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminService.deleteComment(commentId);
              Alert.alert("成功", "评论已删除");
              // 从列表中移除
              setComments(prev => prev.filter(c => c.id !== commentId));
              setCommentsTotal(prev => prev - 1);
            } catch (error) {
              Alert.alert("错误", error instanceof Error ? error.message : "删除评论失败");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 加载更多评论
  const loadMoreComments = () => {
    if (commentsPage < commentsTotalPages && !commentsLoading) {
      fetchComments(commentsPage + 1);
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    const userId = parseInt(deleteUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      Alert.alert("错误", "请输入有效的用户ID");
      return;
    }

    Alert.alert(
      "危险操作",
      `确定要删除用户 ${userId} 及其所有数据吗？\n\n此操作不可撤销！`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminService.deleteUser(userId);
              Alert.alert("成功", `用户 ${userId} 已被删除`);
              setDeleteUserModalVisible(false);
              setDeleteUserId("");
            } catch (error) {
              Alert.alert("错误", error instanceof Error ? error.message : "删除用户失败");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 获取帖子类型显示名称
  const getPostTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      OUTFIT: "穿搭",
      DAILY_SHARE: "日常分享",
      ITEM_REVIEW: "单品评价",
      ARTICLES: "文章",
    };
    return typeMap[type] || type;
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  // 渲染帖子卡片
  const renderPostCard = (post: Post) => {
    const isSelected = selectedPostIds.has(post.id);

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.postCard, isSelected && styles.postCardSelected]}
        onPress={batchMode ? () => toggleSelectPost(post.id) : undefined}
        activeOpacity={batchMode ? 0.7 : 1}
      >
        {/* 帖子头部信息 */}
        <View style={styles.postHeader}>
          <View style={styles.postMeta}>
            {batchMode && (
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleSelectPost(post.id)}
              >
                <Ionicons
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={22}
                  color={isSelected ? theme.colors.black : theme.colors.gray300}
                />
              </TouchableOpacity>
            )}
            <Text style={styles.postType}>{getPostTypeName(post.postType)}</Text>
            <Text style={styles.postId}>ID: {post.id}</Text>
          </View>
          <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
        </View>

        {/* 用户信息 */}
        <View style={styles.userInfo}>
          <Ionicons name="person-circle-outline" size={20} color={theme.colors.gray400} />
          <Text style={styles.username}>{post.username}</Text>
          <Text style={styles.userId}>(ID: {post.userId})</Text>
        </View>

        {/* 帖子标题 */}
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>

        {/* 帖子内容预览 */}
        {post.contentText && (
          <Text style={styles.postContent} numberOfLines={3}>
            {post.contentText}
          </Text>
        )}

        {/* 图片预览 */}
        {post.imageUrls && post.imageUrls.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {post.imageUrls.slice(0, 4).map((url, index) => (
              <Image
                key={index}
                source={{ uri: url }}
                style={styles.postImage}
                resizeMode="cover"
              />
            ))}
            {post.imageUrls.length > 4 && (
              <View style={styles.moreImages}>
                <Text style={styles.moreImagesText}>+{post.imageUrls.length - 4}</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* 单品评价额外信息 */}
        {post.postType === "ITEM_REVIEW" && (
          <View style={styles.reviewInfo}>
            {post.brandName && (
              <Text style={styles.reviewText}>品牌: {post.brandName}</Text>
            )}
            {post.productName && (
              <Text style={styles.reviewText}>产品: {post.productName}</Text>
            )}
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

        {/* 操作按钮 - 非批量模式下显示 */}
        {!batchMode && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>通过</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleOpenRejectModal(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>拒绝</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deletePostButton]}
              onPress={() => handleDeletePost(post.id)}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>删除</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => (navigation as any).navigate("PostDetail", { postId: post.id })}
            >
              <Ionicons name="eye-outline" size={18} color={theme.colors.black} />
              <Text style={[styles.actionButtonText, { color: theme.colors.black }]}>查看</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 渲染评论卡片
  const renderCommentCard = (comment: AdminComment) => (
    <View key={comment.id} style={styles.commentCard}>
      {/* 评论头部 */}
      <View style={styles.commentHeader}>
        <View style={styles.commentMeta}>
          <Ionicons name="chatbubble-outline" size={16} color={theme.colors.gray400} />
          <Text style={styles.commentId}>ID: {comment.id}</Text>
        </View>
        <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
      </View>

      {/* 用户信息 */}
      <View style={styles.commentUserInfo}>
        <Ionicons name="person-circle-outline" size={18} color={theme.colors.gray400} />
        <Text style={styles.commentUsername}>{comment.username}</Text>
        <Text style={styles.commentUserId}>(ID: {comment.userId})</Text>
      </View>

      {/* 帖子信息 */}
      <View style={styles.commentPostInfo}>
        <Ionicons name="document-text-outline" size={16} color={theme.colors.gray300} />
        <Text style={styles.commentPostTitle} numberOfLines={1}>
          帖子: {comment.postTitle || `#${comment.postId}`}
        </Text>
      </View>

      {/* 评论内容 */}
      <Text style={styles.commentContent} numberOfLines={4}>
        {comment.content}
      </Text>

      {/* 点赞数 */}
      <View style={styles.commentStats}>
        <Ionicons name="heart" size={14} color={theme.colors.gray300} />
        <Text style={styles.commentLikes}>{comment.likeCount}</Text>
      </View>

      {/* 操作按钮 */}
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteCommentButton]}
          onPress={() => handleDeleteComment(comment.id)}
          disabled={actionLoading}
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.white} />
          <Text style={styles.actionButtonText}>删除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => (navigation as any).navigate("PostDetail", { postId: comment.postId })}
        >
          <Ionicons name="eye-outline" size={16} color={theme.colors.black} />
          <Text style={[styles.actionButtonText, { color: theme.colors.black }]}>查看帖子</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染评论管理标签页
  const renderCommentsTab = () => (
    <ScrollView
      style={styles.commentsList}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {commentsLoading && comments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.gray300} />
          <Text style={styles.emptyText}>暂无评论</Text>
        </View>
      ) : (
        <>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsHeaderText}>
              共 {commentsTotal} 条评论
            </Text>
          </View>
          {comments.map(renderCommentCard)}

          {/* 分页控制 */}
          {commentsTotalPages > 1 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.pageButton, commentsPage <= 1 && styles.pageButtonDisabled]}
                onPress={() => commentsPage > 1 && fetchComments(commentsPage - 1)}
                disabled={commentsPage <= 1}
              >
                <Text style={styles.pageButtonText}>上一页</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>
                {commentsPage} / {commentsTotalPages}
              </Text>
              <TouchableOpacity
                style={[styles.pageButton, commentsPage >= commentsTotalPages && styles.pageButtonDisabled]}
                onPress={() => commentsPage < commentsTotalPages && fetchComments(commentsPage + 1)}
                disabled={commentsPage >= commentsTotalPages}
              >
                <Text style={styles.pageButtonText}>下一页</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  // 渲染用户管理标签页
  const renderUsersTab = () => (
    <View style={styles.usersContainer}>
      <View style={styles.userManageCard}>
        <View style={styles.userManageHeader}>
          <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
          <Text style={styles.userManageTitle}>删除用户</Text>
        </View>
        <Text style={styles.userManageDesc}>
          删除用户及其所有关联数据（帖子/关注/点赞/评论/收藏等）。此操作不可撤销。
        </Text>
        <TouchableOpacity
          style={styles.deleteUserButton}
          onPress={() => setDeleteUserModalVisible(true)}
        >
          <Text style={styles.deleteUserButtonText}>删除用户</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="管理员后台" showBack={true} />

      {/* 标签页切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "pending" && styles.tabActive]}
          onPress={() => setActiveTab("pending")}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>
            待审核帖子
          </Text>
          {pendingPosts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingPosts.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "comments" && styles.tabActive]}
          onPress={() => setActiveTab("comments")}
        >
          <Text style={[styles.tabText, activeTab === "comments" && styles.tabTextActive]}>
            评论管理
          </Text>
          {commentsTotal > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{commentsTotal}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "users" && styles.tabActive]}
          onPress={() => setActiveTab("users")}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.tabTextActive]}>
            用户管理
          </Text>
        </TouchableOpacity>
      </View>

      {/* 批量操作工具栏 */}
      {activeTab === "pending" && pendingPosts.length > 0 && (
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
                    <ActivityIndicator size="small" color={theme.colors.white} />
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

      {/* 内容区域 */}
      {activeTab === "pending" ? (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.black} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : pendingPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.gray200} />
              <Text style={styles.emptyText}>暂无待审核帖子</Text>
            </View>
          ) : (
            <>
              {pendingPosts.map(renderPostCard)}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      ) : activeTab === "comments" ? (
        renderCommentsTab()
      ) : (
        renderUsersTab()
      )}

      {/* 拒绝原因 Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>拒绝原因</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入拒绝原因（可选）"
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>确认拒绝</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 批量拒绝 Modal */}
      <Modal
        visible={batchRejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBatchRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>批量拒绝 ({selectedPostIds.size} 篇)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入拒绝原因（可选，将应用于所有选中帖子）"
              placeholderTextColor={theme.colors.gray300}
              value={batchRejectReason}
              onChangeText={setBatchRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setBatchRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmBatchReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>确认拒绝</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 删除用户 Modal */}
      <Modal
        visible={deleteUserModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="warning" size={24} color={theme.colors.error} />
              <Text style={[styles.modalTitle, { color: theme.colors.error, marginLeft: 8 }]}>
                删除用户
              </Text>
            </View>
            <Text style={styles.modalWarning}>
              此操作将删除用户及其所有数据，包括帖子、评论、点赞、收藏、关注等。此操作不可撤销！
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入要删除的用户ID"
              placeholderTextColor={theme.colors.gray300}
              value={deleteUserId}
              onChangeText={setDeleteUserId}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setDeleteUserModalVisible(false);
                  setDeleteUserId("");
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteConfirmButton]}
                onPress={handleDeleteUser}
                disabled={actionLoading || !deleteUserId}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>确认删除</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
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
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
    marginTop: theme.spacing.md,
  },
  postCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  postCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.black,
  },
  checkbox: {
    marginRight: theme.spacing.sm,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  postType: {
    ...theme.typography.caption,
    color: theme.colors.white,
    backgroundColor: theme.colors.black,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  postId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginLeft: theme.spacing.sm,
  },
  postDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  username: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginLeft: 6,
    fontWeight: "500",
  },
  userId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginLeft: 4,
  },
  postTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.xs,
  },
  postContent: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
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
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  deletePostButton: {
    backgroundColor: "#FF6B6B",
  },
  viewButton: {
    backgroundColor: theme.colors.gray100,
  },
  actionButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  usersContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  userManageCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  userManageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  userManageTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginLeft: theme.spacing.sm,
  },
  userManageDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.lg,
  },
  deleteUserButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  deleteUserButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: "85%",
    maxWidth: 400,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  modalWarning: {
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.black,
    minHeight: 48,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: theme.colors.gray100,
  },
  modalCancelText: {
    ...theme.typography.button,
    color: theme.colors.gray400,
  },
  modalConfirmButton: {
    backgroundColor: theme.colors.error,
  },
  deleteConfirmButton: {
    backgroundColor: theme.colors.error,
  },
  modalConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  // 评论管理样式
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
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pageButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
  },
  pageInfo: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
});

export default AdminScreen;
