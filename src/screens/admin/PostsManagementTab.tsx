import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ScrollView as RNScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  adminService,
  AllPostsResponse,
  ReportedPostsResponse,
  ReportedPostItem,
} from "../../services/adminService";
import { Post } from "../../services/postService";
import { sharedStyles } from "./adminStyles";
import { formatDate, getPostTypeName } from "./adminUtils";
import {
  Box,
  HStack,
  Text,
  Input,
  Button,
  ButtonText,
  Pressable,
  ScrollView,
} from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";

type SubTab = "all" | "reported";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT" | "HIDDEN";
type AuditFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type GradeFilter = "ALL" | "A" | "B" | "C" | "D" | "F" | "NONE";

const GRADE_FILTER_LABELS: Record<string, string> = {
  ALL: "全部",
  A: "A级",
  B: "B级",
  C: "C级",
  D: "D级",
  F: "F级",
  NONE: "未评级",
};

const STATUS_LABELS: Record<string, string> = {
  ALL: "全部",
  PUBLISHED: "已发布",
  DRAFT: "草稿",
  HIDDEN: "隐藏",
};

const AUDIT_LABELS: Record<string, string> = {
  ALL: "全部",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
};

const AUDIT_COLORS: Record<string, string> = {
  PENDING: "#F59E0B",
  APPROVED: theme.colors.success,
  REJECTED: theme.colors.error,
};

const GRADE_LABELS: Record<string, string> = {
  A: "A级·深度",
  B: "B级·单品",
  C: "C级·日常",
  D: "D级·无关联",
  F: "F级·违规",
};

const GRADE_COLORS: Record<string, string> = {
  A: "#7C3AED",
  B: "#2563EB",
  C: "#059669",
  D: "#9CA3AF",
  F: "#DC2626",
};

const GRADE_REWARDS: Record<string, string> = {
  A: "¥30",
  B: "¥15",
  C: "¥5",
  D: "—",
  F: "—",
};

const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "垃圾内容",
  HARASSMENT: "骚扰",
  INAPPROPRIATE: "不当内容",
  VIOLENCE: "暴力",
  HATE_SPEECH: "仇恨言论",
  FALSE_INFO: "虚假信息",
  MISINFORMATION: "虚假信息",
  COPYRIGHT: "侵权",
  OTHER: "其他",
};

const PostsManagementTab = () => {
  const [subTab, setSubTab] = useState<SubTab>("all");

  return (
    <Box style={styles.container}>
      <HStack style={styles.subTabBar}>
        {(
          [
            { key: "all", label: "全部帖子", icon: "documents-outline" },
            { key: "reported", label: "被投诉帖子", icon: "flag-outline" },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.subTabItem,
              subTab === tab.key && styles.subTabItemActive,
            ]}
            onPress={() => setSubTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={
                subTab === tab.key ? theme.colors.white : theme.colors.gray400
              }
            />
            <Text
              style={[
                styles.subTabText,
                subTab === tab.key && styles.subTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </HStack>

      {subTab === "all" && <AllPostsSubTab />}
      {subTab === "reported" && <ReportedPostsSubTab />}
    </Box>
  );
};

// ==================== All Posts Sub-Tab ====================

const AllPostsSubTab = () => {
  const navigation = useNavigation();
  const [data, setData] = useState<AllPostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("ALL");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ALL");
  const [page, setPage] = useState(1);

  const loadPosts = useCallback(
    async (p = 1, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const result = await adminService.getAllPosts({
          page: p,
          pageSize: 20,
          keyword: keyword || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          auditStatus: auditFilter !== "ALL" ? auditFilter : undefined,
        });
        setData(result);
        setPage(p);
      } catch (e) {
        Alert.alert(
          "错误",
          e instanceof Error ? e.message : "获取帖子列表失败"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [keyword, statusFilter, auditFilter]
  );

  useEffect(() => {
    loadPosts(1);
  }, [statusFilter, auditFilter]);

  const handleSearch = () => loadPosts(1);

  const handleDelete = (postId: number) => {
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
            loadPosts(page);
          } catch (e) {
            Alert.alert(
              "错误",
              e instanceof Error ? e.message : "删除失败"
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleApprove = async (postId: number) => {
    try {
      setActionLoading(true);
      await adminService.approvePost(postId);
      Alert.alert("成功", "帖子已通过审核");
      loadPosts(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (postId: number) => {
    try {
      setActionLoading(true);
      await adminService.rejectPost(postId);
      Alert.alert("成功", "帖子已被拒绝");
      loadPosts(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const rawPosts = data?.posts ?? [];
  const posts =
    gradeFilter === "ALL"
      ? rawPosts
      : gradeFilter === "NONE"
        ? rawPosts.filter((p) => !p.grade)
        : rawPosts.filter((p) => p.grade === gradeFilter);
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  const handleRegrade = async (postId: number) => {
    try {
      setActionLoading(true);
      await adminService.regradePost(postId);
      Alert.alert("成功", "评级已触发，请稍后刷新查看");
      setTimeout(() => loadPosts(page), 2000);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChat = async (userId: number, username: string) => {
    try {
      const { createConversation } = require("../../services/chatService");
      const res = await createConversation(userId);
      (navigation as any).navigate("Chat", {
        conversationId: res.conversationId,
        otherUserName: username,
        otherUserId: userId,
      });
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "创建会话失败");
    }
  };

  const renderPostCard = (post: Post) => (
    <Box key={post.id} style={sharedStyles.postCard}>
      <HStack style={sharedStyles.postHeader}>
        <HStack style={sharedStyles.postMeta}>
          <Text style={sharedStyles.postType}>
            {getPostTypeName(post.postType)}
          </Text>
          <Text style={sharedStyles.postId}>ID: {post.id}</Text>
        </HStack>
        <HStack style={{ alignItems: "center", gap: 6 }}>
          {post.auditStatus && (
            <Box
              style={[
                styles.auditBadge,
                {
                  backgroundColor:
                    AUDIT_COLORS[post.auditStatus] || theme.colors.gray300,
                },
              ]}
            >
              <Text style={styles.auditBadgeText}>
                {AUDIT_LABELS[post.auditStatus] || post.auditStatus}
              </Text>
            </Box>
          )}
          <Text style={sharedStyles.postDate}>
            {formatDate(post.createdAt)}
          </Text>
        </HStack>
      </HStack>

      <HStack style={sharedStyles.userInfo}>
        <Ionicons
          name="person-circle-outline"
          size={20}
          color={theme.colors.gray400}
        />
        <Text style={sharedStyles.username}>{post.username}</Text>
        <Text style={sharedStyles.userId}>(ID: {post.userId})</Text>
      </HStack>

      <Text style={sharedStyles.postTitle} numberOfLines={2}>
        {post.title}
      </Text>

      {post.contentText && post.postType !== "ARTICLES" ? (
        <Text style={sharedStyles.postContent} numberOfLines={2}>
          {post.contentText}
        </Text>
      ) : null}

      {post.imageUrls && post.imageUrls.length > 0 && (
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imageScroll}
        >
          {post.imageUrls.slice(0, 3).map((url, i) => (
            <OptimizedImage
              key={i}
              uri={url}
              size={ImageSize.MEDIUM}
              style={styles.postImage}
              contentFit="cover"
              lazy
            />
          ))}
          {post.imageUrls.length > 3 && (
            <Box style={styles.moreImages}>
              <Text style={styles.moreImagesText}>
                +{post.imageUrls.length - 3}
              </Text>
            </Box>
          )}
        </RNScrollView>
      )}

      {/* Grade Badge */}
      {post.grade ? (
        <HStack style={styles.gradeRow}>
          <Box
            style={[
              styles.gradeBadge,
              { backgroundColor: GRADE_COLORS[post.grade] || theme.colors.gray300 },
            ]}
          >
            <Text style={styles.gradeBadgeText}>
              {GRADE_LABELS[post.grade] || post.grade}
            </Text>
          </Box>
          {post.grade !== "D" && post.grade !== "F" && (
            <Text style={styles.gradeRewardText}>
              奖励 {GRADE_REWARDS[post.grade]}
            </Text>
          )}
          <Pressable
            onPress={() => handleRegrade(post.id)}
            disabled={actionLoading}
            style={styles.regradeBtn}
          >
            <Ionicons name="refresh" size={12} color={theme.colors.gray400} />
            <Text style={styles.regradeBtnText}>重新评级</Text>
          </Pressable>
        </HStack>
      ) : (
        <HStack style={styles.gradeRow}>
          <Text style={styles.noGradeText}>未评级</Text>
          <Pressable
            onPress={() => handleRegrade(post.id)}
            disabled={actionLoading}
            style={styles.regradeBtn}
          >
            <Ionicons name="refresh" size={12} color={theme.colors.gray400} />
            <Text style={styles.regradeBtnText}>触发评级</Text>
          </Pressable>
        </HStack>
      )}

      <HStack style={styles.statsRow}>
        <HStack style={styles.statItem}>
          <Ionicons name="heart" size={14} color={theme.colors.gray300} />
          <Text style={styles.statText}>{post.likeCount}</Text>
        </HStack>
        <HStack style={styles.statItem}>
          <Ionicons name="bookmark" size={14} color={theme.colors.gray300} />
          <Text style={styles.statText}>{post.favoriteCount}</Text>
        </HStack>
        <HStack style={styles.statItem}>
          <Ionicons
            name="chatbubble"
            size={14}
            color={theme.colors.gray300}
          />
          <Text style={styles.statText}>{post.commentCount}</Text>
        </HStack>
      </HStack>

      <HStack style={sharedStyles.actionButtons}>
        {post.auditStatus === "PENDING" && (
          <>
            <Button
              size="sm"
              colorScheme="success"
              onPress={() => handleApprove(post.id)}
              disabled={actionLoading}
              leftIcon={
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.white}
                />
              }
            >
              <ButtonText style={{ fontSize: 12 }}>通过</ButtonText>
            </Button>
            <Button
              size="sm"
              colorScheme="error"
              onPress={() => handleReject(post.id)}
              disabled={actionLoading}
              leftIcon={
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={theme.colors.white}
                />
              }
            >
              <ButtonText style={{ fontSize: 12 }}>拒绝</ButtonText>
            </Button>
          </>
        )}
        <Button
          size="sm"
          colorScheme="error"
          onPress={() => handleDelete(post.id)}
          disabled={actionLoading}
          leftIcon={
            <Ionicons
              name="trash-outline"
              size={16}
              color={theme.colors.white}
            />
          }
        >
          <ButtonText style={{ fontSize: 12 }}>删除</ButtonText>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() =>
            (navigation as any).navigate("PostDetail", { postId: post.id })
          }
          leftIcon={
            <Ionicons
              name="eye-outline"
              size={16}
              color={theme.colors.white}
            />
          }
        >
          <ButtonText style={{ color: theme.colors.white, fontSize: 12 }}>
            查看
          </ButtonText>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() => handleChat(post.userId, post.username)}
          leftIcon={
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={theme.colors.white}
            />
          }
        >
          <ButtonText style={{ color: theme.colors.white, fontSize: 12 }}>
            私聊
          </ButtonText>
        </Button>
      </HStack>
    </Box>
  );

  return (
    <ScrollView
      style={sharedStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadPosts(1, true)}
        />
      }
    >
      {/* Search */}
      <HStack style={styles.searchRow}>
        <Input
          style={styles.searchInput}
          placeholder="搜索标题或内容..."
          placeholderTextColor={theme.colors.gray300}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          variant="outline"
          size="sm"
        />
        <Button size="sm" onPress={handleSearch}>
          <ButtonText>搜索</ButtonText>
        </Button>
      </HStack>

      {/* Filters */}
      <Box style={styles.filterSection}>
        <Text style={styles.filterLabel}>状态</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.filterChip,
                statusFilter === key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === key && styles.filterChipTextActive,
                ]}
              >
                {STATUS_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        <Text style={styles.filterLabel}>审核</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {(Object.keys(AUDIT_LABELS) as AuditFilter[]).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.filterChip,
                auditFilter === key && styles.filterChipActive,
              ]}
              onPress={() => setAuditFilter(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  auditFilter === key && styles.filterChipTextActive,
                ]}
              >
                {AUDIT_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        <Text style={styles.filterLabel}>评级</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {(Object.keys(GRADE_FILTER_LABELS) as GradeFilter[]).map((key) => (
            <Pressable
              key={key}
              style={[
                styles.filterChip,
                gradeFilter === key && styles.filterChipActive,
              ]}
              onPress={() => setGradeFilter(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  gradeFilter === key && styles.filterChipTextActive,
                ]}
              >
                {GRADE_FILTER_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>
      </Box>

      {/* Content */}
      {loading && posts.length === 0 ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </Box>
      ) : posts.length === 0 ? (
        <Box style={sharedStyles.emptyContainer}>
          <Ionicons
            name="documents-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={sharedStyles.emptyText}>暂无帖子</Text>
        </Box>
      ) : (
        <>
          <Text style={styles.totalText}>共 {total} 篇帖子</Text>
          {posts.map(renderPostCard)}

          {totalPages > 1 && (
            <HStack justifyContent="center" space="md" style={styles.pagination}>
              <Pressable
                disabled={page <= 1}
                onPress={() => page > 1 && loadPosts(page - 1)}
                style={{ opacity: page <= 1 ? 0.3 : 1 }}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={theme.colors.black}
                />
              </Pressable>
              <Text style={styles.paginationText}>
                第 {page} 页 / 共 {totalPages} 页
              </Text>
              <Pressable
                disabled={page >= totalPages}
                onPress={() => page < totalPages && loadPosts(page + 1)}
                style={{ opacity: page >= totalPages ? 0.3 : 1 }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={theme.colors.black}
                />
              </Pressable>
            </HStack>
          )}
        </>
      )}
      <Box style={{ height: 40 }} />
    </ScrollView>
  );
};

// ==================== Reported Posts Sub-Tab ====================

const ReportedPostsSubTab = () => {
  const navigation = useNavigation();
  const [data, setData] = useState<ReportedPostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadReports = useCallback(async (p = 1, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const result = await adminService.getReportedPosts(p, 20);
      setData(result);
      setPage(p);
    } catch (e) {
      Alert.alert(
        "错误",
        e instanceof Error ? e.message : "获取投诉帖子失败"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports(1);
  }, [loadReports]);

  const handleDeletePost = (postId: number) => {
    Alert.alert("确认删除", "确定要删除这篇被投诉的帖子吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deletePost(postId);
            Alert.alert("成功", "帖子已删除");
            loadReports(page);
          } catch (e) {
            Alert.alert(
              "错误",
              e instanceof Error ? e.message : "删除失败"
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleResolveReport = async (reportId: number) => {
    try {
      setActionLoading(true);
      await adminService.updateReportStatus(reportId, "RESOLVED");
      Alert.alert("成功", "投诉已标记为已处理");
      loadReports(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReport = async (reportId: number) => {
    try {
      setActionLoading(true);
      await adminService.updateReportStatus(reportId, "DISMISSED");
      Alert.alert("成功", "投诉已驳回");
      loadReports(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  const REPORT_STATUS_COLORS: Record<string, string> = {
    PENDING: "#F59E0B",
    REVIEWED: "#3B82F6",
    RESOLVED: theme.colors.success,
    DISMISSED: theme.colors.gray300,
  };

  const REPORT_STATUS_LABELS: Record<string, string> = {
    PENDING: "待处理",
    REVIEWED: "已审阅",
    RESOLVED: "已处理",
    DISMISSED: "已驳回",
  };

  const renderReportCard = (item: ReportedPostItem, index: number) => {
    const { report, post } = item;
    return (
      <Box key={`${report.id}-${index}`} style={styles.reportCard}>
        {/* Report info */}
        <Box style={styles.reportHeader}>
          <HStack style={{ justifyContent: "space-between", alignItems: "center" }}>
            <HStack style={{ alignItems: "center", gap: 6 }}>
              <Ionicons name="flag" size={16} color="#F59E0B" />
              <Text style={styles.reportReasonText}>
                {REPORT_REASON_LABELS[report.reason] || report.reason}
              </Text>
            </HStack>
            <Box
              style={[
                styles.reportStatusBadge,
                {
                  backgroundColor:
                    REPORT_STATUS_COLORS[report.status] || theme.colors.gray300,
                },
              ]}
            >
              <Text style={styles.reportStatusText}>
                {REPORT_STATUS_LABELS[report.status] || report.status}
              </Text>
            </Box>
          </HStack>
          <Text style={styles.reportMeta}>
            举报人: {report.reporterName} (ID: {report.reporterId}) ·{" "}
            {formatDate(report.createdAt)}
          </Text>
          {report.description ? (
            <Text style={styles.reportDescription} numberOfLines={2}>
              {report.description}
            </Text>
          ) : null}
        </Box>

        {/* Post info */}
        {post ? (
          <Box style={styles.reportPostContent}>
            <HStack style={sharedStyles.postHeader}>
              <HStack style={sharedStyles.postMeta}>
                <Text style={sharedStyles.postType}>
                  {getPostTypeName(post.postType)}
                </Text>
                <Text style={sharedStyles.postId}>ID: {post.id}</Text>
              </HStack>
            </HStack>

            <HStack style={sharedStyles.userInfo}>
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={theme.colors.gray400}
              />
              <Text style={sharedStyles.username}>{post.username}</Text>
              <Text style={sharedStyles.userId}>(ID: {post.userId})</Text>
            </HStack>

            <Text style={sharedStyles.postTitle} numberOfLines={2}>
              {post.title}
            </Text>

            {post.imageUrls && post.imageUrls.length > 0 && (
              <RNScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageScroll}
              >
                {post.imageUrls.slice(0, 3).map((url, i) => (
                  <OptimizedImage
                    key={i}
                    uri={url}
                    size={ImageSize.MEDIUM}
                    style={styles.postImage}
                    contentFit="cover"
                    lazy
                  />
                ))}
              </RNScrollView>
            )}

            <HStack style={sharedStyles.actionButtons}>
              {report.status === "PENDING" && (
                <>
                  <Button
                    size="sm"
                    colorScheme="success"
                    onPress={() => handleResolveReport(report.id)}
                    disabled={actionLoading}
                    leftIcon={
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={theme.colors.white}
                      />
                    }
                  >
                    <ButtonText style={{ fontSize: 12 }}>已处理</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleDismissReport(report.id)}
                    disabled={actionLoading}
                    leftIcon={
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={theme.colors.gray400}
                      />
                    }
                  >
                    <ButtonText
                      style={{ color: theme.colors.gray400, fontSize: 12 }}
                    >
                      驳回
                    </ButtonText>
                  </Button>
                </>
              )}
              <Button
                size="sm"
                colorScheme="error"
                onPress={() => handleDeletePost(post.id)}
                disabled={actionLoading}
                leftIcon={
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.white}
                  />
                }
              >
                <ButtonText style={{ fontSize: 12 }}>删帖</ButtonText>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() =>
                  (navigation as any).navigate("PostDetail", {
                    postId: post.id,
                  })
                }
                leftIcon={
                  <Ionicons
                    name="eye-outline"
                    size={16}
                    color={theme.colors.white}
                  />
                }
              >
                <ButtonText
                  style={{ color: theme.colors.white, fontSize: 12 }}
                >
                  查看
                </ButtonText>
              </Button>
            </HStack>
          </Box>
        ) : (
          <Box style={styles.deletedPostBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={theme.colors.gray300}
            />
            <Text style={styles.deletedPostText}>帖子已被删除</Text>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <ScrollView
      style={sharedStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadReports(1, true)}
        />
      }
    >
      {loading && items.length === 0 ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </Box>
      ) : items.length === 0 ? (
        <Box style={sharedStyles.emptyContainer}>
          <Ionicons
            name="flag-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={sharedStyles.emptyText}>暂无投诉记录</Text>
        </Box>
      ) : (
        <>
          <Text style={styles.totalText}>共 {total} 条投诉</Text>
          {items.map((item, idx) => renderReportCard(item, idx))}

          {totalPages > 1 && (
            <HStack justifyContent="center" space="md" style={styles.pagination}>
              <Pressable
                disabled={page <= 1}
                onPress={() => page > 1 && loadReports(page - 1)}
                style={{ opacity: page <= 1 ? 0.3 : 1 }}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={theme.colors.black}
                />
              </Pressable>
              <Text style={styles.paginationText}>
                第 {page} 页 / 共 {totalPages} 页
              </Text>
              <Pressable
                disabled={page >= totalPages}
                onPress={() => page < totalPages && loadReports(page + 1)}
                style={{ opacity: page >= totalPages ? 0.3 : 1 }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={theme.colors.black}
                />
              </Pressable>
            </HStack>
          )}
        </>
      )}
      <Box style={{ height: 40 }} />
    </ScrollView>
  );
};

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subTabBar: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  subTabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    gap: 4,
  },
  subTabItemActive: {
    backgroundColor: theme.colors.black,
  },
  subTabText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
  subTabTextActive: {
    color: theme.colors.white,
  },
  searchRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.typography.body,
    color: theme.colors.black,
  },
  filterSection: {
    marginBottom: theme.spacing.md,
  },
  filterLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: theme.spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.xs,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  totalText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.md,
  },
  auditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  auditBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "600",
  },
  gradeRow: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexWrap: "wrap",
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gradeBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  gradeRewardText: {
    ...theme.typography.caption,
    color: "#F59E0B",
    fontWeight: "600",
    fontSize: 11,
  },
  noGradeText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    fontSize: 11,
  },
  regradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.gray100,
  },
  regradeBtnText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontSize: 10,
  },
  statsRow: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 3,
  },
  statText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  imageScroll: {
    marginBottom: theme.spacing.sm,
  },
  postImage: {
    width: 70,
    height: 70,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  moreImages: {
    width: 70,
    height: 70,
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
  pagination: {
    paddingVertical: theme.spacing.lg,
  },
  paginationText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  // Report card
  reportCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    overflow: "hidden",
  },
  reportHeader: {
    padding: theme.spacing.md,
    backgroundColor: "#FFF8E1",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE082",
  },
  reportReasonText: {
    ...theme.typography.bodySmall,
    color: "#E65100",
    fontWeight: "600",
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportStatusText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "600",
  },
  reportMeta: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 4,
  },
  reportDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: 4,
    fontStyle: "italic",
  },
  reportPostContent: {
    padding: theme.spacing.md,
  },
  deletedPostBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: theme.spacing.md,
  },
  deletedPostText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
  },
});

export default PostsManagementTab;
