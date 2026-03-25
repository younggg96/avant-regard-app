import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView as RNScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  adminService,
  AdminUser,
  AdminReport,
  AdminBlock,
} from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView } from "../../components/ui";
import { Modal } from "../../components/ui/modal";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";

type SubTab = "users" | "reports" | "blocks";
type ReportFilter = "ALL" | "PENDING" | "RESOLVED" | "DISMISSED";

const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: "待处理",
  REVIEWED: "已审阅",
  RESOLVED: "已处理",
  DISMISSED: "已驳回",
};

const REPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B",
  REVIEWED: "#3B82F6",
  RESOLVED: theme.colors.success,
  DISMISSED: theme.colors.gray300,
};

const REASON_LABELS: Record<string, string> = {
  SPAM: "垃圾内容",
  HARASSMENT: "骚扰",
  INAPPROPRIATE: "不当内容",
  VIOLENCE: "暴力",
  HATE_SPEECH: "仇恨言论",
  FALSE_INFO: "虚假信息",
  OTHER: "其他",
};

const UsersTab = () => {
  const [subTab, setSubTab] = useState<SubTab>("users");

  return (
    <Box style={styles.container}>
      <HStack style={styles.subTabBar}>
        {(
          [
            { key: "users", label: "用户列表", icon: "people-outline" },
            { key: "reports", label: "举报记录", icon: "flag-outline" },
            { key: "blocks", label: "屏蔽关系", icon: "ban-outline" },
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
                subTab === tab.key
                  ? theme.colors.white
                  : theme.colors.gray400
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

      {subTab === "users" && <UsersSubTab />}
      {subTab === "reports" && <ReportsSubTab />}
      {subTab === "blocks" && <BlocksSubTab />}
    </Box>
  );
};

// ==================== Users Sub-Tab ====================

const UsersSubTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(
    async (p = page, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const result = await adminService.getAdminUsers(
          keyword || undefined,
          p,
          pageSize
        );
        setUsers(result.users);
        setTotal(result.total);
        setPage(p);
      } catch (e) {
        Alert.alert("错误", e instanceof Error ? e.message : "获取用户列表失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [keyword]
  );

  useEffect(() => {
    loadUsers(1);
  }, []);

  const handleSearch = () => loadUsers(1);
  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = (user: AdminUser) => {
    setDeleteTarget(user);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(true);
      await adminService.deleteUser(deleteTarget.id);
      Alert.alert("成功", `用户 ${deleteTarget.username} 已被删除`);
      setDeleteModalVisible(false);
      setDeleteTarget(null);
      loadUsers(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "删除失败");
    } finally {
      setActionLoading(false);
    }
  };

  const renderUserCard = (item: AdminUser) => (
    <Box key={item.id} style={styles.card}>
      <HStack style={styles.cardHeader}>
        <HStack style={{ alignItems: "center", flex: 1 }}>
          {item.avatarUrl ? (
            <OptimizedImage
              uri={item.avatarUrl}
              style={styles.avatar}
              size={ImageSize.THUMBNAIL}
            />
          ) : (
            <Box style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color={theme.colors.gray300} />
            </Box>
          )}
          <Box style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.username}
            </Text>
            <Text style={styles.userMeta}>
              ID: {item.id}
              {item.isAdmin ? " · 管理员" : ""}
              {item.userType !== "USER" ? ` · ${item.userType}` : ""}
            </Text>
          </Box>
        </HStack>
        <Box
          style={[
            styles.statusBadge,
            item.status === "ACTIVE"
              ? styles.statusActive
              : styles.statusInactive,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === "ACTIVE"
                ? styles.statusTextActive
                : styles.statusTextInactive,
            ]}
          >
            {item.status === "ACTIVE" ? "正常" : item.status}
          </Text>
        </Box>
      </HStack>

      <Box style={styles.cardBody}>
        {item.email ? (
          <Text style={styles.detailText}>邮箱: {item.email}</Text>
        ) : null}
        {item.phone ? (
          <Text style={styles.detailText}>手机: {item.phone}</Text>
        ) : null}
        {item.createdAt ? (
          <Text style={styles.detailText}>
            注册: {new Date(item.createdAt).toLocaleDateString("zh-CN")}
          </Text>
        ) : null}
      </Box>

      <HStack style={styles.cardActions}>
        <Button
          size="sm"
          colorScheme="error"
          onPress={() => handleDelete(item)}
          leftIcon={<Ionicons name="trash-outline" size={14} color={theme.colors.white} />}
        >
          <ButtonText style={{ fontSize: 12 }}>删除</ButtonText>
        </Button>
      </HStack>
    </Box>
  );

  return (
    <Box style={{ flex: 1 }}>
      <HStack style={styles.searchBar}>
        <Input
          style={styles.searchInput}
          placeholder="搜索用户名或ID"
          placeholderTextColor={theme.colors.gray300}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          variant="outline"
          size="sm"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={18} color={theme.colors.white} />
        </Pressable>
      </HStack>

      {loading && !refreshing ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </Box>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadUsers(page, true)}
            />
          }
        >
          <Box style={styles.listHeader}>
            <Text style={styles.totalText}>共 {total} 位用户</Text>
          </Box>

          {users.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>暂无用户</Text>
            </Box>
          ) : (
            <>
              {users.map(renderUserCard)}

              {totalPages > 1 && (
                <HStack justifyContent="center" space="md" style={styles.pagination}>
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => page > 1 && loadUsers(page - 1)}
                    style={{ opacity: page <= 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    第 {page} 页 / 共 {totalPages} 页
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadUsers(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
                  </Pressable>
                </HStack>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <HStack style={sharedStyles.modalTitleRow}>
              <Ionicons
                name="warning"
                size={24}
                color={theme.colors.error}
              />
              <Text
                style={[
                  sharedStyles.modalTitle,
                  { color: theme.colors.error, marginLeft: 8 },
                ]}
              >
                删除用户
              </Text>
            </HStack>
            <Text style={sharedStyles.modalWarning}>
              确定要删除用户 {deleteTarget?.username} (ID:{" "}
              {deleteTarget?.id})
              及其所有数据？此操作不可撤销！
            </Text>
            <HStack style={sharedStyles.modalButtons}>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteTarget(null);
                }}
              >
                <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={confirmDelete}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                <ButtonText>确认删除</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

// ==================== Reports Sub-Tab ====================

const ReportsSubTab = () => {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadReports = useCallback(
    async (p = 1, refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const statusParam = filter === "ALL" ? undefined : filter;
        const result = await adminService.getAdminReports(
          statusParam,
          p,
          pageSize
        );
        setReports(result.reports);
        setTotal(result.total);
        setPage(p);
      } catch (e) {
        Alert.alert("错误", e instanceof Error ? e.message : "获取举报记录失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    loadReports(1);
  }, [filter]);

  const handleUpdateStatus = async (reportId: number, status: string) => {
    try {
      await adminService.updateReportStatus(reportId, status);
      loadReports(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderReportCard = (item: AdminReport) => (
    <Box key={item.id} style={styles.card}>
      <HStack style={styles.cardHeader}>
        <Box style={{ flex: 1 }}>
          <HStack style={{ alignItems: "center", gap: 8 }}>
            <Text style={styles.reportTarget}>
              {item.targetType === "POST" ? "帖子" : "评论"} #{item.targetId}
            </Text>
            <Box
              style={[
                styles.reportStatusBadge,
                { backgroundColor: (REPORT_STATUS_COLORS[item.status] || theme.colors.gray300) + "20" },
              ]}
            >
              <Text
                style={[
                  styles.reportStatusText,
                  { color: REPORT_STATUS_COLORS[item.status] || theme.colors.gray300 },
                ]}
              >
                {REPORT_STATUS_LABELS[item.status] || item.status}
              </Text>
            </Box>
          </HStack>
          <Text style={styles.detailText}>
            举报人: {item.reporterName} (ID: {item.reporterId})
          </Text>
        </Box>
      </HStack>

      <Box style={styles.cardBody}>
        <HStack style={{ alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Ionicons
            name="alert-circle-outline"
            size={14}
            color={theme.colors.error}
          />
          <Text style={styles.reportReason}>
            {REASON_LABELS[item.reason] || item.reason}
          </Text>
        </HStack>
        {item.description ? (
          <Text style={styles.reportDesc} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.reportDate}>
          {new Date(item.createdAt).toLocaleString("zh-CN")}
        </Text>
      </Box>

      {item.status === "PENDING" && (
        <HStack style={styles.cardActions}>
          <Button
            size="sm"
            colorScheme="success"
            onPress={() => handleUpdateStatus(item.id, "RESOLVED")}
            leftIcon={<Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.white} />}
          >
            <ButtonText style={{ fontSize: 12 }}>处理</ButtonText>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() => handleUpdateStatus(item.id, "DISMISSED")}
            leftIcon={<Ionicons name="close-circle-outline" size={14} color={theme.colors.black} />}
          >
            <ButtonText style={{ color: theme.colors.gray400, fontSize: 12 }}>驳回</ButtonText>
          </Button>
        </HStack>
      )}
    </Box>
  );

  return (
    <Box style={{ flex: 1 }}>
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
      >
        {(["ALL", "PENDING", "RESOLVED", "DISMISSED"] as ReportFilter[]).map(
          (f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {f === "ALL" ? "全部" : REPORT_STATUS_LABELS[f] || f}
              </Text>
            </Pressable>
          )
        )}
      </RNScrollView>

      {loading && !refreshing ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </Box>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReports(page, true)}
            />
          }
        >
          <Box style={styles.listHeader}>
            <Text style={styles.totalText}>共 {total} 条举报</Text>
          </Box>

          {reports.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="flag-outline"
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>暂无举报记录</Text>
            </Box>
          ) : (
            <>
              {reports.map(renderReportCard)}

              {totalPages > 1 && (
                <HStack justifyContent="center" space="md" style={styles.pagination}>
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => page > 1 && loadReports(page - 1)}
                    style={{ opacity: page <= 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    第 {page} 页 / 共 {totalPages} 页
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadReports(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
                  </Pressable>
                </HStack>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Box>
  );
};

// ==================== Blocks Sub-Tab ====================

const BlocksSubTab = () => {
  const [blocks, setBlocks] = useState<AdminBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadBlocks = useCallback(async (p = 1, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const result = await adminService.getAdminBlocks(p, pageSize);
      setBlocks(result.blocks);
      setTotal(result.total);
      setPage(p);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "获取屏蔽关系失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBlocks(1);
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const renderBlockCard = (item: AdminBlock) => (
    <Box key={item.id} style={styles.card}>
      <HStack style={styles.blockRow}>
        <Box style={styles.blockUser}>
          <Text style={styles.blockUserName}>{item.blockerName || `#${item.blockerId}`}</Text>
          <Text style={styles.blockUserId}>ID: {item.blockerId}</Text>
        </Box>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={theme.colors.error}
        />
        <Box style={styles.blockUser}>
          <Text style={styles.blockUserName}>{item.blockedName || `#${item.blockedId}`}</Text>
          <Text style={styles.blockUserId}>ID: {item.blockedId}</Text>
        </Box>
      </HStack>
      <Text style={styles.blockDate}>
        {new Date(item.createdAt).toLocaleString("zh-CN")}
      </Text>
    </Box>
  );

  return (
    <Box style={{ flex: 1 }}>
      {loading && !refreshing ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>加载中...</Text>
        </Box>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadBlocks(page, true)}
            />
          }
        >
          <Box style={styles.listHeader}>
            <Text style={styles.totalText}>共 {total} 条屏蔽关系</Text>
          </Box>

          {blocks.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="ban-outline"
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>暂无屏蔽关系</Text>
            </Box>
          ) : (
            <>
              {blocks.map(renderBlockCard)}

              {totalPages > 1 && (
                <HStack justifyContent="center" space="md" style={styles.pagination}>
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => page > 1 && loadBlocks(page - 1)}
                    style={{ opacity: page <= 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    第 {page} 页 / 共 {totalPages} 页
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadBlocks(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
                  </Pressable>
                </HStack>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  // Sub-tab bar
  subTabBar: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  subTabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
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
  // Search
  searchBar: {
    flexDirection: "row",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  searchBtn: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  // List
  listContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  listHeader: {
    marginBottom: theme.spacing.md,
  },
  totalText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  // Card
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBody: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  cardActions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  // User card
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
  },
  userMeta: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: theme.colors.success + "15",
  },
  statusInactive: {
    backgroundColor: theme.colors.error + "15",
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: "600",
    fontSize: 11,
  },
  statusTextActive: {
    color: theme.colors.success,
  },
  statusTextInactive: {
    color: theme.colors.error,
  },
  // Report card
  reportTarget: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reportStatusText: {
    ...theme.typography.caption,
    fontWeight: "600",
    fontSize: 11,
  },
  reportReason: {
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    fontWeight: "500",
  },
  reportDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: 4,
  },
  reportDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 6,
  },
  // Filter
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.sm,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  // Block card
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  blockUser: {
    flex: 1,
    alignItems: "center",
  },
  blockUserName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
  },
  blockUserId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  blockDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  // Pagination
  pagination: {
    paddingVertical: theme.spacing.lg,
  },
  paginationText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
});

export default UsersTab;
