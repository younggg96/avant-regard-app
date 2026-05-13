import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ScrollView as RNScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import {
  adminService,
  AllPostsResponse,
  ReportedPostsResponse,
  ReportedPostItem,
} from "../../services/adminService";
import { Post } from "../../services/postService";
import { useSharedStyles } from "./adminStyles";
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

const GRADE_FILTER_KEYS: GradeFilter[] = ["ALL", "A", "B", "C", "D", "F", "NONE"];
const STATUS_KEYS: StatusFilter[] = ["ALL", "PUBLISHED", "DRAFT", "HIDDEN"];
const AUDIT_KEYS: AuditFilter[] = ["ALL", "PENDING", "APPROVED", "REJECTED"];

const getGradeLabels = (t: (key: string) => string): Record<string, string> => ({
  A: t("admin.gradeLabelA"),
  B: t("admin.gradeLabelB"),
  C: t("admin.gradeLabelC"),
  D: t("admin.gradeLabelD"),
  F: t("admin.gradeLabelF"),
});

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


const PostsManagementTab = () => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("all");
  const styles = useThemedStyles(makeStyles);

  return (
    <Box style={styles.container}>
      <HStack style={styles.subTabBar}>
        {([
            { key: "all" as SubTab, label: t("admin.allPosts"), icon: "documents-outline" },
            { key: "reported" as SubTab, label: t("admin.reportedPosts"), icon: "flag-outline" },
          ]).map((tab) => (
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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const AUDIT_COLORS: Record<string, string> = {
    PENDING: "#F59E0B",
    APPROVED: theme.colors.success,
    REJECTED: theme.colors.error,
  };
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
          t("admin.error"),
          e instanceof Error ? e.message : t("admin.fetchPostsFailed")
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
            loadPosts(page);
          } catch (e) {
            Alert.alert(
              t("admin.error"),
              e instanceof Error ? e.message : t("admin.deleteFailed")
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
      Alert.alert(t("common.success"), t("admin.postApproved"));
      loadPosts(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (postId: number) => {
    try {
      setActionLoading(true);
      await adminService.rejectPost(postId);
      Alert.alert(t("common.success"), t("admin.postRejected"));
      loadPosts(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
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
      Alert.alert(t("common.success"), t("admin.gradeTriggered"));
      setTimeout(() => loadPosts(page), 2000);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRegrade = (ungradedOnly: boolean) => {
    const label = ungradedOnly ? t("admin.ungradedPosts") : t("admin.currentPagePosts");
    Alert.alert(t("admin.batchGrade"), t("admin.confirmBatchGrade", { label }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.confirm"),
        onPress: async () => {
          try {
            setActionLoading(true);
            const ids = posts.map((p) => p.id);
            const result = await adminService.batchRegradePosts(
              ids,
              ungradedOnly
            );
            Alert.alert(t("common.success"), t("admin.batchGradeTriggered", { count: result.triggered }));
            setTimeout(() => loadPosts(page), 3000);
          } catch (e) {
            Alert.alert(
              t("admin.error"),
              e instanceof Error ? e.message : t("admin.batchGradeFailed")
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleGradeAll = () => {
    Alert.alert(
      t("admin.globalGrade"),
      t("admin.confirmGlobalGrade"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.ungradedOnly"),
          onPress: async () => {
            try {
              setActionLoading(true);
              const result = await adminService.batchRegradePosts(
                undefined,
                true
              );
              Alert.alert(t("common.success"), t("admin.batchGradeTriggered", { count: result.triggered }));
              setTimeout(() => loadPosts(page), 3000);
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.batchGradeFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
        {
          text: t("admin.regradeAll"),
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const result = await adminService.batchRegradePosts(
                undefined,
                false
              );
              Alert.alert(t("common.success"), t("admin.batchGradeTriggered", { count: result.triggered }));
              setTimeout(() => loadPosts(page), 3000);
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.batchGradeFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.createChatFailed"));
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
                {t(`admin.audit_${post.auditStatus}`) || post.auditStatus}
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
              {getGradeLabels(t)[post.grade] || post.grade}
            </Text>
          </Box>
          {post.grade !== "D" && post.grade !== "F" && (
            <Text style={styles.gradeRewardText}>
              {t("admin.reward")} {GRADE_REWARDS[post.grade]}
            </Text>
          )}
          <Pressable
            onPress={() => handleRegrade(post.id)}
            disabled={actionLoading}
            style={styles.regradeBtn}
          >
            <Ionicons name="refresh" size={12} color={theme.colors.gray400} />
            <Text style={styles.regradeBtnText}>{t("admin.regrade")}</Text>
          </Pressable>
        </HStack>
      ) : (
        <HStack style={styles.gradeRow}>
          <Text style={styles.noGradeText}>{t("admin.ungraded")}</Text>
          <Pressable
            onPress={() => handleRegrade(post.id)}
            disabled={actionLoading}
            style={styles.regradeBtn}
          >
            <Ionicons name="refresh" size={12} color={theme.colors.gray400} />
            <Text style={styles.regradeBtnText}>{t("admin.triggerGrade")}</Text>
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
              <ButtonText style={{ fontSize: 12 }}>{t("admin.approve")}</ButtonText>
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
              <ButtonText style={{ fontSize: 12 }}>{t("admin.reject")}</ButtonText>
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
          <ButtonText style={{ fontSize: 12 }}>{t("common.delete")}</ButtonText>
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
            {t("admin.view")}
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
            {t("admin.chat")}
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
          placeholder={t("admin.searchPostPlaceholder")}
          placeholderTextColor={theme.colors.gray300}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          variant="outline"
          size="sm"
        />
        <Button size="sm" onPress={handleSearch}>
          <ButtonText>{t("common.search")}</ButtonText>
        </Button>
      </HStack>

      {/* Filters */}
      <Box style={styles.filterSection}>
        <Text style={styles.filterLabel}>{t("admin.status")}</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {STATUS_KEYS.map((key) => (
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
                {t(`admin.status_${key}`)}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        <Text style={styles.filterLabel}>{t("admin.audit")}</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {AUDIT_KEYS.map((key) => (
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
                {t(`admin.audit_${key}`)}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        <Text style={styles.filterLabel}>{t("admin.grade")}</Text>
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {GRADE_FILTER_KEYS.map((key) => (
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
                {t(`admin.grade_${key}`)}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>
      </Box>

      {/* Content */}
      {loading && posts.length === 0 ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
        </Box>
      ) : posts.length === 0 ? (
        <Box style={sharedStyles.emptyContainer}>
          <Ionicons
            name="documents-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={sharedStyles.emptyText}>{t("admin.noPosts")}</Text>
        </Box>
      ) : (
        <>
          <HStack style={styles.batchRow}>
            <Text style={styles.totalText}>{t("admin.totalPosts", { count: total })}</Text>
            <HStack style={{ gap: 6 }}>
              <Pressable
                style={styles.batchBtn}
                onPress={() => handleBatchRegrade(true)}
                disabled={actionLoading}
              >
                <Ionicons
                  name="flash-outline"
                  size={13}
                  color={theme.colors.white}
                />
                <Text style={styles.batchBtnText}>{t("admin.pageUngraded")}</Text>
              </Pressable>
              <Pressable
                style={[styles.batchBtn, styles.batchBtnAll]}
                onPress={() => handleBatchRegrade(false)}
                disabled={actionLoading}
              >
                <Ionicons
                  name="sync-outline"
                  size={13}
                  color={theme.colors.white}
                />
                <Text style={styles.batchBtnText}>{t("admin.pageRegrade")}</Text>
              </Pressable>
              <Pressable
                style={[styles.batchBtn, styles.batchBtnGlobal]}
                onPress={handleGradeAll}
                disabled={actionLoading}
              >
                <Ionicons
                  name="globe-outline"
                  size={13}
                  color={theme.colors.white}
                />
                <Text style={styles.batchBtnText}>{t("admin.globalGrade")}</Text>
              </Pressable>
            </HStack>
          </HStack>
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
                {t("admin.pagination", { page, total: totalPages })}
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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
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
        t("admin.error"),
        e instanceof Error ? e.message : t("admin.fetchReportedPostsFailed")
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
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteReportedPost"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deletePost(postId);
            Alert.alert(t("common.success"), t("admin.postDeleted"));
            loadReports(page);
          } catch (e) {
            Alert.alert(
              t("admin.error"),
              e instanceof Error ? e.message : t("admin.deleteFailed")
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
      Alert.alert(t("common.success"), t("admin.reportMarkedResolved"));
      loadReports(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReport = async (reportId: number) => {
    try {
      setActionLoading(true);
      await adminService.updateReportStatus(reportId, "DISMISSED");
      Alert.alert(t("common.success"), t("admin.reportDismissed"));
      loadReports(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
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
                {t(`admin.reason_${report.reason}`) || report.reason}
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
                {t(`admin.reportStatus_${report.status}`) || report.status}
              </Text>
            </Box>
          </HStack>
          <Text style={styles.reportMeta}>
            {t("admin.reporter")} {report.reporterName} (ID: {report.reporterId}) ·{" "}
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
                    <ButtonText style={{ fontSize: 12 }}>{t("admin.reportResolved")}</ButtonText>
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
                      {t("admin.dismiss")}
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
                <ButtonText style={{ fontSize: 12 }}>{t("admin.deletePost")}</ButtonText>
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
                  {t("admin.view")}
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
            <Text style={styles.deletedPostText}>{t("admin.postAlreadyDeleted")}</Text>
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
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
        </Box>
      ) : items.length === 0 ? (
        <Box style={sharedStyles.emptyContainer}>
          <Ionicons
            name="flag-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={sharedStyles.emptyText}>{t("admin.noReportedPosts")}</Text>
        </Box>
      ) : (
        <>
          <Text style={styles.totalText}>{t("admin.totalReports", { count: total })}</Text>
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
                {t("admin.pagination", { page, total: totalPages })}
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

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  subTabBar: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  subTabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.gray100,
    gap: 4,
  },
  subTabItemActive: {
    backgroundColor: t.colors.text,
  },
  subTabText: {
    ...t.typography.caption,
    color: t.colors.gray400,
    fontWeight: "500",
  },
  subTabTextActive: {
    color: t.colors.textInverted,
  },
  searchRow: {
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    ...t.typography.body,
    color: t.colors.text,
  },
  filterSection: {
    marginBottom: t.spacing.md,
  },
  filterLabel: {
    ...t.typography.caption,
    color: t.colors.gray400,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: t.spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: t.colors.gray100,
    marginRight: t.spacing.xs,
  },
  filterChipActive: {
    backgroundColor: t.colors.text,
  },
  filterChipText: {
    ...t.typography.caption,
    color: t.colors.gray400,
  },
  filterChipTextActive: {
    color: t.colors.textInverted,
  },
  batchRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: t.spacing.md,
    flexWrap: "wrap",
    gap: 6,
  },
  batchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#7C3AED",
  },
  batchBtnAll: {
    backgroundColor: t.colors.gray400,
  },
  batchBtnGlobal: {
    backgroundColor: "#DC2626",
  },
  batchBtnText: {
    ...t.typography.caption,
    color: t.colors.textInverted,
    fontSize: 11,
    fontWeight: "600",
  },
  totalText: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
  },
  auditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  auditBadgeText: {
    ...t.typography.caption,
    color: t.colors.textInverted,
    fontSize: 10,
    fontWeight: "600",
  },
  gradeRow: {
    alignItems: "center",
    gap: t.spacing.sm,
    marginBottom: t.spacing.sm,
    flexWrap: "wrap",
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gradeBadgeText: {
    ...t.typography.caption,
    color: t.colors.textInverted,
    fontSize: 10,
    fontWeight: "700",
  },
  gradeRewardText: {
    ...t.typography.caption,
    color: "#F59E0B",
    fontWeight: "600",
    fontSize: 11,
  },
  noGradeText: {
    ...t.typography.caption,
    color: t.colors.gray300,
    fontSize: 11,
  },
  regradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  regradeBtnText: {
    ...t.typography.caption,
    color: t.colors.gray400,
    fontSize: 10,
  },
  statsRow: {
    gap: t.spacing.md,
    marginBottom: t.spacing.sm,
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 3,
  },
  statText: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
  imageScroll: {
    marginBottom: t.spacing.sm,
  },
  postImage: {
    width: 70,
    height: 70,
    borderRadius: t.borderRadius.md,
    marginRight: t.spacing.sm,
    backgroundColor: t.colors.gray100,
  },
  moreImages: {
    width: 70,
    height: 70,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  moreImagesText: {
    ...t.typography.body,
    color: t.colors.gray400,
    fontWeight: "600",
  },
  pagination: {
    paddingVertical: t.spacing.lg,
  },
  paginationText: {
    ...t.typography.body,
    color: t.colors.gray400,
  },
  // Report card
  reportCard: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    marginBottom: t.spacing.md,
    ...t.shadows.sm,
    overflow: "hidden",
  },
  reportHeader: {
    padding: t.spacing.md,
    backgroundColor: "#FFF8E1",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE082",
  },
  reportReasonText: {
    ...t.typography.bodySmall,
    color: "#E65100",
    fontWeight: "600",
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportStatusText: {
    ...t.typography.caption,
    color: t.colors.textInverted,
    fontSize: 10,
    fontWeight: "600",
  },
  reportMeta: {
    ...t.typography.caption,
    color: t.colors.gray400,
    marginTop: 4,
  },
  reportDescription: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
    marginTop: 4,
    fontStyle: "italic",
  },
  reportPostContent: {
    padding: t.spacing.md,
  },
  deletedPostBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: t.spacing.md,
  },
  deletedPostText: {
    ...t.typography.bodySmall,
    color: t.colors.gray300,
  },
});

export default PostsManagementTab;
