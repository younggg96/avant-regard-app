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
import {
  Banner,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from "../services/bannerService";
import { config } from "../config/env";
import { useAuthStore } from "../store/authStore";

type TabType = "pending" | "comments" | "users" | "stores" | "merchants" | "banners";

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

  // Banner 管理状态
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModalVisible, setBannerModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm, setBannerForm] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_type: "NONE" as string,
    link_value: "",
    sort_order: 0,
    is_active: true,
  });
  const [bannerImageUploading, setBannerImageUploading] = useState(false);

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

  // 获取所有 Banner
  const fetchBanners = useCallback(async () => {
    try {
      setBannersLoading(true);
      const result = await getAllBanners();
      setBanners(result);
    } catch (error) {
      console.error("获取 Banner 列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取 Banner 列表失败");
    } finally {
      setBannersLoading(false);
    }
  }, []);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "pending") {
      await fetchPendingPosts();
    } else if (activeTab === "comments") {
      await fetchComments(1);
    } else if (activeTab === "banners") {
      await fetchBanners();
    }
    setRefreshing(false);
  }, [activeTab, fetchPendingPosts, fetchComments, fetchBanners]);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingPosts();
    } else if (activeTab === "comments") {
      fetchComments(1);
    } else if (activeTab === "banners") {
      fetchBanners();
    }
  }, [activeTab, fetchPendingPosts, fetchComments, fetchBanners]);

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

  // ==================== Banner 管理 ====================

  // 打开创建 Banner Modal
  const handleOpenCreateBannerModal = () => {
    setEditingBanner(null);
    setBannerForm({
      title: "",
      subtitle: "",
      image_url: "",
      link_type: "NONE",
      link_value: "",
      sort_order: banners.length,
      is_active: true,
    });
    setBannerModalVisible(true);
  };

  // 打开编辑 Banner Modal
  const handleOpenEditBannerModal = (banner: Banner) => {
    setEditingBanner(banner);
    setBannerForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      image_url: banner.imageUrl,
      link_type: banner.linkType,
      link_value: banner.linkValue || "",
      sort_order: banner.sortOrder,
      is_active: banner.isActive,
    });
    setBannerModalVisible(true);
  };

  // 保存 Banner（创建或更新）
  const handleSaveBanner = async () => {
    if (!bannerForm.title.trim()) {
      Alert.alert("错误", "请输入 Banner 标题");
      return;
    }
    if (!bannerForm.image_url.trim()) {
      Alert.alert("错误", "请上传或输入图片 URL");
      return;
    }

    try {
      setActionLoading(true);
      if (editingBanner) {
        // 更新
        await updateBanner(editingBanner.id, bannerForm);
        Alert.alert("成功", "Banner 更新成功");
      } else {
        // 创建
        await createBanner(bannerForm);
        Alert.alert("成功", "Banner 创建成功");
      }
      setBannerModalVisible(false);
      fetchBanners();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  // 删除 Banner
  const handleDeleteBanner = async (bannerId: number) => {
    Alert.alert(
      "确认删除",
      "确定要删除这个 Banner 吗？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await deleteBanner(bannerId);
              Alert.alert("成功", "Banner 已删除");
              fetchBanners();
            } catch (error) {
              Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 切换 Banner 状态
  const handleToggleBannerStatus = async (banner: Banner) => {
    try {
      setActionLoading(true);
      await toggleBannerStatus(banner.id);
      Alert.alert("成功", `Banner 已${banner.isActive ? "禁用" : "启用"}`);
      fetchBanners();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  // 上传 Banner 图片
  const handleUploadBannerImage = async () => {
    // 使用 expo-image-picker 选择图片
    const ImagePicker = require("expo-image-picker");
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("权限不足", "需要访问相册权限才能上传图片");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      try {
        setBannerImageUploading(true);
        
        // 上传图片到服务器
        const formData = new FormData();
        const filename = asset.uri.split("/").pop() || "banner.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        
        formData.append("file", {
          uri: asset.uri,
          name: filename,
          type,
        } as any);

        const token = useAuthStore.getState().getAccessToken();
        const response = await fetch(
          `${config.EXPO_PUBLIC_API_BASE_URL}/api/files/upload-image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const data = await response.json();
        
        if (data.code === 0 && data.data?.url) {
          setBannerForm(prev => ({ ...prev, image_url: data.data.url }));
          Alert.alert("成功", "图片上传成功");
        } else {
          throw new Error(data.message || "上传失败");
        }
      } catch (error) {
        console.error("图片上传失败:", error);
        Alert.alert("错误", error instanceof Error ? error.message : "图片上传失败");
      } finally {
        setBannerImageUploading(false);
      }
    }
  };

  // 获取链接类型显示名称
  const getLinkTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      NONE: "无链接",
      POST: "帖子",
      BRAND: "品牌",
      SHOW: "秀场",
      EXTERNAL: "外部链接",
    };
    return typeMap[type] || type;
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
      }
    >
      {commentsLoading && comments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator  color={theme.colors.black} />
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

  // 渲染 Banner 卡片
  const renderBannerCard = (banner: Banner) => (
    <View key={banner.id} style={styles.bannerCard}>
      {/* 预览图 */}
      <Image
        source={{ uri: banner.imageUrl }}
        style={styles.bannerPreviewImage}
        resizeMode="cover"
      />
      
      {/* 状态标签 */}
      <View style={[styles.bannerStatusBadge, banner.isActive ? styles.bannerStatusActive : styles.bannerStatusInactive]}>
        <Text style={styles.bannerStatusText}>{banner.isActive ? "启用" : "禁用"}</Text>
      </View>

      {/* 信息区域 */}
      <View style={styles.bannerInfo}>
        <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
        {banner.subtitle && (
          <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>
        )}
        <View style={styles.bannerMeta}>
          <Text style={styles.bannerMetaText}>
            链接: {getLinkTypeName(banner.linkType)}
            {banner.linkValue && ` → ${banner.linkValue}`}
          </Text>
          <Text style={styles.bannerMetaText}>排序: {banner.sortOrder}</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View style={styles.bannerActions}>
        <TouchableOpacity
          style={[styles.bannerActionBtn, styles.bannerEditBtn]}
          onPress={() => handleOpenEditBannerModal(banner)}
          disabled={actionLoading}
        >
          <Ionicons name="create-outline" size={18} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bannerActionBtn, banner.isActive ? styles.bannerDisableBtn : styles.bannerEnableBtn]}
          onPress={() => handleToggleBannerStatus(banner)}
          disabled={actionLoading}
        >
          <Ionicons name={banner.isActive ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bannerActionBtn, styles.bannerDeleteBtn]}
          onPress={() => handleDeleteBanner(banner.id)}
          disabled={actionLoading}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染 Banner 管理标签页
  const renderBannersTab = () => (
    <ScrollView
      style={styles.bannersList}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 添加按钮 */}
      <TouchableOpacity
        style={styles.addBannerButton}
        onPress={handleOpenCreateBannerModal}
      >
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.white} />
        <Text style={styles.addBannerButtonText}>添加 Banner</Text>
      </TouchableOpacity>

      {bannersLoading && banners.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : banners.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color={theme.colors.gray300} />
          <Text style={styles.emptyText}>暂无 Banner</Text>
          <Text style={styles.emptySubtext}>点击上方按钮添加轮播图</Text>
        </View>
      ) : (
        <>
          <View style={styles.bannersHeader}>
            <Text style={styles.bannersHeaderText}>共 {banners.length} 个 Banner</Text>
          </View>
          {banners.map(renderBannerCard)}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
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

        <TouchableOpacity
          style={[styles.tab, activeTab === "stores" && styles.tabActive]}
          onPress={() => (navigation.navigate as any)("StoreReview")}
        >
          <Text style={[styles.tabText, activeTab === "stores" && styles.tabTextActive]}>
            店铺审核
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "merchants" && styles.tabActive]}
          onPress={() => (navigation.navigate as any)("MerchantReview")}
        >
          <Text style={[styles.tabText, activeTab === "merchants" && styles.tabTextActive]}>
            商家入驻
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "banners" && styles.tabActive]}
          onPress={() => setActiveTab("banners")}
        >
          <Text style={[styles.tabText, activeTab === "banners" && styles.tabTextActive]}>
            Banner
          </Text>
          {banners.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{banners.length}</Text>
            </View>
          )}
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
                    <ActivityIndicator  color={theme.colors.white} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
          }
        >
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator  color={theme.colors.black} />
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
      ) : activeTab === "banners" ? (
        renderBannersTab()
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
                  <ActivityIndicator  color={theme.colors.white} />
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
                  <ActivityIndicator  color={theme.colors.white} />
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
                  <ActivityIndicator  color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>确认删除</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Banner 编辑 Modal */}
      <Modal
        visible={bannerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBannerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.bannerModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingBanner ? "编辑 Banner" : "创建 Banner"}
              </Text>

              {/* 图片预览 */}
              {bannerForm.image_url ? (
                <Image
                  source={{ uri: bannerForm.image_url }}
                  style={styles.bannerFormPreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.bannerFormPlaceholder}>
                  <Ionicons name="image-outline" size={48} color={theme.colors.gray300} />
                  <Text style={styles.bannerFormPlaceholderText}>点击下方按钮上传图片</Text>
                </View>
              )}

              {/* 上传图片按钮 */}
              <TouchableOpacity
                style={styles.uploadImageButton}
                onPress={handleUploadBannerImage}
                disabled={bannerImageUploading}
              >
                {bannerImageUploading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
                    <Text style={styles.uploadImageButtonText}>
                      {bannerForm.image_url ? "更换图片" : "上传图片"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* 标题 */}
              <Text style={styles.formLabel}>标题 *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="输入 Banner 标题"
                placeholderTextColor={theme.colors.gray300}
                value={bannerForm.title}
                onChangeText={(text) => setBannerForm(prev => ({ ...prev, title: text }))}
              />

              {/* 副标题 */}
              <Text style={styles.formLabel}>副标题</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="输入副标题（可选）"
                placeholderTextColor={theme.colors.gray300}
                value={bannerForm.subtitle}
                onChangeText={(text) => setBannerForm(prev => ({ ...prev, subtitle: text }))}
              />

              {/* 链接类型 */}
              <Text style={styles.formLabel}>链接类型</Text>
              <View style={styles.linkTypeContainer}>
                {["NONE", "POST", "BRAND", "SHOW", "EXTERNAL"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.linkTypeButton,
                      bannerForm.link_type === type && styles.linkTypeButtonActive
                    ]}
                    onPress={() => setBannerForm(prev => ({ ...prev, link_type: type }))}
                  >
                    <Text style={[
                      styles.linkTypeButtonText,
                      bannerForm.link_type === type && styles.linkTypeButtonTextActive
                    ]}>
                      {getLinkTypeName(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 链接值 */}
              {bannerForm.link_type !== "NONE" && (
                <>
                  <Text style={styles.formLabel}>
                    {bannerForm.link_type === "POST" && "帖子 ID"}
                    {bannerForm.link_type === "BRAND" && "品牌标识"}
                    {bannerForm.link_type === "SHOW" && "秀场 ID"}
                    {bannerForm.link_type === "EXTERNAL" && "外部链接 URL"}
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={
                      bannerForm.link_type === "POST" ? "输入帖子 ID" :
                      bannerForm.link_type === "BRAND" ? "输入品牌标识（如 CHANEL）" :
                      bannerForm.link_type === "SHOW" ? "输入秀场 ID" :
                      "输入完整 URL（https://...）"
                    }
                    placeholderTextColor={theme.colors.gray300}
                    value={bannerForm.link_value}
                    onChangeText={(text) => setBannerForm(prev => ({ ...prev, link_value: text }))}
                    autoCapitalize={bannerForm.link_type === "EXTERNAL" ? "none" : "characters"}
                  />
                </>
              )}

              {/* 排序 */}
              <Text style={styles.formLabel}>排序（数字越小越靠前）</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="输入排序数字"
                placeholderTextColor={theme.colors.gray300}
                value={String(bannerForm.sort_order)}
                onChangeText={(text) => setBannerForm(prev => ({ ...prev, sort_order: parseInt(text) || 0 }))}
                keyboardType="numeric"
              />

              {/* 启用状态 */}
              <TouchableOpacity
                style={styles.statusToggle}
                onPress={() => setBannerForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              >
                <Text style={styles.formLabel}>启用状态</Text>
                <View style={[styles.statusToggleSwitch, bannerForm.is_active && styles.statusToggleSwitchActive]}>
                  <View style={[styles.statusToggleThumb, bannerForm.is_active && styles.statusToggleThumbActive]} />
                </View>
              </TouchableOpacity>

              {/* 操作按钮 */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setBannerModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: theme.colors.black }]}
                  onPress={handleSaveBanner}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>
                      {editingBanner ? "保存修改" : "创建 Banner"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
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
  // ==================== Banner 管理样式 ====================
  bannersList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  addBannerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addBannerButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  bannersHeader: {
    marginBottom: theme.spacing.md,
  },
  bannersHeaderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  bannerCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  bannerPreviewImage: {
    width: "100%",
    height: 120,
    backgroundColor: theme.colors.gray100,
  },
  bannerStatusBadge: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  bannerStatusActive: {
    backgroundColor: theme.colors.success,
  },
  bannerStatusInactive: {
    backgroundColor: theme.colors.gray400,
  },
  bannerStatusText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  bannerInfo: {
    padding: theme.spacing.md,
  },
  bannerTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: 4,
  },
  bannerSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
  },
  bannerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bannerMetaText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  bannerActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  bannerActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  bannerEditBtn: {
    backgroundColor: theme.colors.black,
  },
  bannerEnableBtn: {
    backgroundColor: theme.colors.success,
  },
  bannerDisableBtn: {
    backgroundColor: theme.colors.warning,
  },
  bannerDeleteBtn: {
    backgroundColor: theme.colors.error,
  },
  // Banner Modal 样式
  bannerModalContent: {
    maxHeight: "90%",
    width: "95%",
    maxWidth: 500,
  },
  bannerFormPreview: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
  },
  bannerFormPlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  bannerFormPlaceholderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
    marginTop: theme.spacing.sm,
  },
  uploadImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  uploadImageButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: "600",
  },
  formLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  linkTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  linkTypeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
  },
  linkTypeButtonActive: {
    backgroundColor: theme.colors.black,
  },
  linkTypeButtonText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
  linkTypeButtonTextActive: {
    color: theme.colors.white,
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.md,
  },
  statusToggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.gray200,
    padding: 2,
    justifyContent: "center",
  },
  statusToggleSwitchActive: {
    backgroundColor: theme.colors.success,
  },
  statusToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
  },
  statusToggleThumbActive: {
    alignSelf: "flex-end",
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: theme.spacing.xs,
  },
});

export default AdminScreen;
