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
  UserTitle,
} from "../../services/adminService";
import {
  createConversation,
  sendMessageREST,
} from "../../services/chatService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, VStack } from "../../components/ui";
import { Modal } from "../../components/ui/modal";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { LEVEL_TITLES } from "../../components/level/levelTitles";

/**
 * 三档身份解析 (与 Web 端 /admin/users 对齐):
 *   isAdmin                              -> ADMIN   (权限最高, 一票制)
 *   merchant.status === 'APPROVED'       -> 商家    (PENDING / REJECTED 不算)
 *   其它                                 -> USER    (不单独挂标签, 卡片默认就是用户)
 */
type UserKind = "ADMIN" | "MERCHANT" | "USER";
function resolveUserKind(u: AdminUser): UserKind {
  if (u.isAdmin) return "ADMIN";
  if (u.merchant?.status === "APPROVED") return "MERCHANT";
  return "USER";
}

/**
 * 身份 chip · 三档视觉区分:
 *   ADMIN    — 黑底白字实心
 *   MERCHANT — 黑色描边 (次醒目)
 *   USER     — 不挂 (卡片默认就是用户, 减噪)
 */
function renderKindChip(u: AdminUser) {
  const kind = resolveUserKind(u);
  if (kind === "USER") return null;
  if (kind === "ADMIN") {
    return (
      <Box style={styles.kindChipSolid}>
        <Text style={styles.kindChipSolidText}>ADMIN</Text>
      </Box>
    );
  }
  return (
    <Box style={styles.kindChipOutline}>
      <Text style={styles.kindChipOutlineText}>商家</Text>
    </Box>
  );
}

/**
 * 等级 chip:
 *   Lv ≥ 1  -> 黑底白字 "Lv3 · 探店官"
 *   Lv 0   -> 灰底灰字 "—"   (与 Web 对齐, 让运营一眼分辨 "未达标" vs "数据缺失")
 */
function renderLevelChip(level: number) {
  if (!level || level < 1) {
    return (
      <Box style={styles.levelChipMuted}>
        <Text style={styles.levelChipMutedText}>—</Text>
      </Box>
    );
  }
  const title = LEVEL_TITLES[level] ?? "";
  return (
    <Box style={styles.levelChip}>
      <Text style={styles.levelChipText}>Lv{level}</Text>
      {title ? <Text style={styles.levelChipTitle}> · {title}</Text> : null}
    </Box>
  );
}

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
  PORNOGRAPHY: "色情低俗",
  MISINFORMATION: "虚假信息",
  COPYRIGHT: "侵权",
  OTHER: "其他",
};

const TARGET_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  POST: { label: "帖子", icon: "document-text-outline" },
  COMMENT: { label: "评论", icon: "chatbubble-outline" },
  MESSAGE: { label: "聊天消息", icon: "mail-outline" },
  USER: { label: "用户", icon: "person-outline" },
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

  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [titleTarget, setTitleTarget] = useState<AdminUser | null>(null);
  const [titleList, setTitleList] = useState<UserTitle[]>([]);
  const [titleLoading, setTitleLoading] = useState(false);
  const [newTitleText, setNewTitleText] = useState("");
  const [addingTitle, setAddingTitle] = useState(false);

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

  const openTitleModal = async (user: AdminUser) => {
    setTitleTarget(user);
    setTitleModalVisible(true);
    setNewTitleText("");
    if (user.titles && user.titles.length > 0) {
      setTitleList(user.titles);
    } else {
      setTitleLoading(true);
      try {
        const titles = await adminService.getUserTitlesAdmin(user.id);
        setTitleList(titles);
      } catch (e) {
        Alert.alert("错误", e instanceof Error ? e.message : "获取头衔失败");
      } finally {
        setTitleLoading(false);
      }
    }
  };

  const handleAddTitle = async () => {
    if (!titleTarget || !newTitleText.trim()) return;
    setAddingTitle(true);
    try {
      const newTitle = await adminService.addUserTitle(titleTarget.id, newTitleText.trim());
      setTitleList((prev) => [...prev, newTitle]);
      setNewTitleText("");
      loadUsers(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "添加头衔失败");
    } finally {
      setAddingTitle(false);
    }
  };

  const handleRemoveTitle = async (titleId: number) => {
    try {
      await adminService.removeUserTitle(titleId);
      setTitleList((prev) => prev.filter((t) => t.id !== titleId));
      loadUsers(page);
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "删除头衔失败");
    }
  };

  const GENDER_LABELS: Record<string, string> = {
    MALE: "♂ 男",
    FEMALE: "♀ 女",
    OTHER: "",
  };

  const renderUserCard = (item: AdminUser) => (
    <Box key={item.id} style={styles.card}>
      {/* 顶部：头像 + 名称 + 状态 */}
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
            <HStack style={{ alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.username}
              </Text>
              {renderKindChip(item)}
              {renderLevelChip(item.currentLevel ?? 0)}
              {item.merchant && item.merchant.status !== "APPROVED" && (
                <Box style={styles.kindChipMuted}>
                  <Text style={styles.kindChipMutedText}>商家审核中</Text>
                </Box>
              )}
            </HStack>
            <Text style={styles.userMeta}>
              ID: {item.id}
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

      {/* 头衔标签 */}
      {item.titles && item.titles.length > 0 && (
        <HStack style={styles.titleChipsRow}>
          {item.titles.map((t) => (
            <Box
              key={t.id}
              style={[
                styles.titleChip,
                t.isPrimary && styles.titleChipPrimary,
              ]}
            >
              <Text
                style={[
                  styles.titleChipText,
                  t.isPrimary && styles.titleChipTextPrimary,
                ]}
              >
                {t.title}
              </Text>
            </Box>
          ))}
        </HStack>
      )}

      {/* 数据统计 */}
      <HStack style={styles.statsRow}>
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.postCount ?? 0}</Text>
          <Text style={styles.statLabel}>帖子</Text>
        </Box>
        <Box style={styles.statDivider} />
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.followerCount ?? 0}</Text>
          <Text style={styles.statLabel}>粉丝</Text>
        </Box>
        <Box style={styles.statDivider} />
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.followingCount ?? 0}</Text>
          <Text style={styles.statLabel}>关注</Text>
        </Box>
      </HStack>

      {/* 详细信息 */}
      <Box style={styles.cardBody}>
        {item.bio ? (
          <Text style={styles.bioText} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}
        <HStack style={styles.infoGrid}>
          {item.phone ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="call-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>{item.phone}</Text>
            </HStack>
          ) : null}
          {item.email ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="mail-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
            </HStack>
          ) : null}
          {item.location ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="location-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>{item.location}</Text>
            </HStack>
          ) : null}
          {item.gender && GENDER_LABELS[item.gender] ? (
            <HStack style={styles.infoItem}>
              <Text style={styles.detailText}>{GENDER_LABELS[item.gender]}</Text>
              {item.age && item.age > 0 ? (
                <Text style={styles.detailText}> · {item.age}岁</Text>
              ) : null}
            </HStack>
          ) : null}
          {item.createdAt ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>
                {new Date(item.createdAt).toLocaleDateString("zh-CN")}
              </Text>
            </HStack>
          ) : null}
          {item.merchant ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="storefront-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>
                店铺: {item.merchant.storeId}
              </Text>
            </HStack>
          ) : null}
        </HStack>
      </Box>

      <HStack style={styles.cardActions}>
        <Button
          size="sm"
          onPress={() => openTitleModal(item)}
          leftIcon={<Ionicons name="ribbon-outline" size={14} color={theme.colors.white} />}
        >
          <ButtonText style={{ fontSize: 12 }}>头衔</ButtonText>
        </Button>
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

      {/* 头衔管理 Modal */}
      <Modal
        visible={titleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTitleModalVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, { maxHeight: "70%" }]}>
            <HStack style={sharedStyles.modalTitleRow}>
              <Ionicons name="ribbon" size={24} color={theme.colors.black} />
              <Text style={[sharedStyles.modalTitle, { marginLeft: 8 }]}>
                管理头衔 - {titleTarget?.username}
              </Text>
            </HStack>

            {titleLoading ? (
              <Box style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator color={theme.colors.black} />
              </Box>
            ) : (
              <RNScrollView style={{ maxHeight: 200, marginVertical: 12 }}>
                {titleList.length === 0 ? (
                  <Text style={{ color: theme.colors.gray300, textAlign: "center", paddingVertical: 16 }}>
                    暂无头衔
                  </Text>
                ) : (
                  titleList.map((t) => (
                    <HStack
                      key={t.id}
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.gray100,
                      }}
                    >
                      <HStack style={{ alignItems: "center", gap: 8, flex: 1 }}>
                        <Ionicons
                          name={t.isPrimary ? "star" : "star-outline"}
                          size={16}
                          color={t.isPrimary ? "#F59E0B" : theme.colors.gray300}
                        />
                        <Text style={{ fontSize: 14, fontWeight: t.isPrimary ? "600" : "400", color: theme.colors.black }}>
                          {t.title}
                        </Text>
                        {t.isPrimary && (
                          <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "500" }}>主头衔</Text>
                        )}
                      </HStack>
                      <Pressable onPress={() => handleRemoveTitle(t.id)}>
                        <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                      </Pressable>
                    </HStack>
                  ))
                )}
              </RNScrollView>
            )}

            <HStack style={{ gap: 8, marginTop: 4 }}>
              <Input
                style={{ flex: 1, height: 36 }}
                placeholder="输入头衔（如 Archivist）"
                placeholderTextColor={theme.colors.gray300}
                value={newTitleText}
                onChangeText={setNewTitleText}
                onSubmitEditing={handleAddTitle}
                returnKeyType="done"
                variant="outline"
                size="sm"
              />
              <Button
                size="sm"
                onPress={handleAddTitle}
                disabled={addingTitle || !newTitleText.trim()}
                isLoading={addingTitle}
              >
                <ButtonText style={{ fontSize: 12 }}>添加</ButtonText>
              </Button>
            </HStack>

            <HStack style={[sharedStyles.modalButtons, { marginTop: 12 }]}>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setTitleModalVisible(false);
                  setTitleTarget(null);
                  setTitleList([]);
                }}
              >
                <ButtonText style={{ color: theme.colors.white }}>关闭</ButtonText>
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

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleResolveMessageReport = (item: AdminReport) => {
    Alert.alert(
      "删除消息并通知",
      `确认删除聊天消息 #${item.targetId} 并通知发送者？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认",
          style: "destructive",
          onPress: () => executeResolveMessage(item),
        },
      ]
    );
  };

  const executeResolveMessage = async (item: AdminReport) => {
    setActionLoading(item.id);
    try {
      const { senderId } = await adminService.adminDeleteChatMessage(item.targetId);

      const { conversationId } = await createConversation(senderId);
      await sendMessageREST(
        conversationId,
        `您好，您发送的一条聊天消息因违反社区规范（${REASON_LABELS[item.reason] || item.reason}）已被删除。请遵守社区规则，共同维护良好的交流环境。`
      );

      await adminService.updateReportStatus(item.id, "RESOLVED");
      Alert.alert("完成", "消息已删除，发送者已收到通知");
      loadReports(page);
    } catch (e) {
      Alert.alert("操作失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderReportCard = (item: AdminReport) => {
    const targetInfo = TARGET_TYPE_LABELS[item.targetType] || {
      label: item.targetType,
      icon: "help-circle-outline",
    };

    return (
      <Box key={item.id} style={styles.card}>
        <HStack style={styles.cardHeader}>
          <Box style={{ flex: 1 }}>
            <HStack style={{ alignItems: "center", gap: 8 }}>
              <HStack style={{ alignItems: "center", gap: 4 }}>
                <Ionicons
                  name={targetInfo.icon as any}
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.reportTarget}>
                  {targetInfo.label} #{item.targetId}
                </Text>
              </HStack>
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
            {item.targetType === "MESSAGE" ? (
              <Button
                size="sm"
                colorScheme="error"
                onPress={() => handleResolveMessageReport(item)}
                disabled={actionLoading === item.id}
                isLoading={actionLoading === item.id}
                leftIcon={<Ionicons name="trash-outline" size={14} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>删除消息并通知</ButtonText>
              </Button>
            ) : (
              <Button
                size="sm"
                colorScheme="success"
                onPress={() => handleUpdateStatus(item.id, "RESOLVED")}
                leftIcon={<Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>处理</ButtonText>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onPress={() => handleUpdateStatus(item.id, "DISMISSED")}
              disabled={actionLoading === item.id}
              leftIcon={<Ionicons name="close-circle-outline" size={14} color={theme.colors.white} />}
            >
              <ButtonText style={{ color: theme.colors.white, fontSize: 12 }}>驳回</ButtonText>
            </Button>
          </HStack>
        )}
      </Box>
    );
  };

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
  // 身份 chip (三档) — 与 /admin/users Web 端视觉对齐
  kindChipSolid: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
  },
  kindChipSolidText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  kindChipOutline: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.black,
    backgroundColor: "transparent",
  },
  kindChipOutlineText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.black,
  },
  kindChipMuted: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  kindChipMutedText: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.gray400,
  },
  // 等级 chip (Lv ≥ 1 黑底 / Lv 0 占位)
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
  },
  levelChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  levelChipTitle: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.white,
    opacity: 0.8,
  },
  levelChipMuted: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  levelChipMutedText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.black,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.gray100,
  },
  bioText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontStyle: "italic",
    marginBottom: 6,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    rowGap: 4,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  titleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  titleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: theme.colors.gray100,
  },
  titleChipPrimary: {
    backgroundColor: "#FEF3C7",
  },
  titleChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.gray400,
  },
  titleChipTextPrimary: {
    color: "#D97706",
    fontWeight: "600",
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
