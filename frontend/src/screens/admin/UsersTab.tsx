import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView as RNScrollView,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
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
import { useSharedStyles } from "./adminStyles";
import UserDataModal from "./UserDataModal";
import { AnimatedChip, Box, chipRowStyle, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, VStack } from "../../components/ui";
import { Modal } from "../../components/ui/modal";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { getLevelTitleKey } from "../../components/level/levelTitles";

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
function renderKindChip(
  u: AdminUser,
  t: (key: string) => string,
  styles: ReturnType<typeof makeStyles>
) {
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
      <Text style={styles.kindChipOutlineText}>{t("admin.merchant")}</Text>
    </Box>
  );
}

/**
 * 等级 chip:
 *   Lv ≥ 1  -> 黑底白字 "Lv3 · 探店官"
 *   Lv 0   -> 灰底灰字 "—"   (与 Web 对齐, 让运营一眼分辨 "未达标" vs "数据缺失")
 */
function renderLevelChip(
  level: number,
  t: (key: string) => string,
  styles: ReturnType<typeof makeStyles>
) {
  if (!level || level < 1) {
    return (
      <Box style={styles.levelChipMuted}>
        <Text style={styles.levelChipMutedText}>—</Text>
      </Box>
    );
  }
  const title = t(getLevelTitleKey(level));
  return (
    <Box style={styles.levelChip}>
      <Text style={styles.levelChipText}>Lv{level}</Text>
      {title ? <Text style={styles.levelChipTitle}> · {title}</Text> : null}
    </Box>
  );
}

type SubTab = "users" | "reports" | "blocks";
type ReportFilter = "ALL" | "PENDING" | "RESOLVED" | "DISMISSED";

const TARGET_TYPE_ICONS: Record<string, string> = {
  POST: "document-text-outline",
  COMMENT: "chatbubble-outline",
  MESSAGE: "mail-outline",
  USER: "person-outline",
};

const UsersTab = () => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("users");
  const styles = useThemedStyles(makeStyles);

  return (
    <Box style={styles.container}>
      <HStack style={styles.subTabBar}>
        {([
            { key: "users" as SubTab, label: t("admin.userList"), icon: "people-outline" as const },
            { key: "reports" as SubTab, label: t("admin.reportRecords"), icon: "flag-outline" as const },
            { key: "blocks" as SubTab, label: t("admin.blockRelations"), icon: "ban-outline" as const },
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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);

  const [dataModalVisible, setDataModalVisible] = useState(false);
  const [dataUser, setDataUser] = useState<AdminUser | null>(null);

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
        Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchUsersFailed"));
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

  const openUserDetail = (user: AdminUser) => {
    setDetailUser(user);
    setDetailModalVisible(true);
  };

  const handleDelete = (user: AdminUser) => {
    setDeleteTarget(user);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(true);
      await adminService.deleteUser(deleteTarget.id);
      Alert.alert(t("common.success"), t("admin.userDeleted", { name: deleteTarget.username }));
      setDeleteModalVisible(false);
      setDeleteTarget(null);
      loadUsers(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.deleteFailed"));
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
        Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchTitlesFailed"));
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
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.addTitleFailed"));
    } finally {
      setAddingTitle(false);
    }
  };

  const handleRemoveTitle = async (titleId: number) => {
    try {
      await adminService.removeUserTitle(titleId);
      setTitleList((prev) => prev.filter((item) => item.id !== titleId));
      loadUsers(page);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.removeTitleFailed"));
    }
  };

  const GENDER_LABELS: Record<string, string> = {
    MALE: t("admin.gender_MALE"),
    FEMALE: t("admin.gender_FEMALE"),
    OTHER: "",
  };

  const renderUserDetailBody = (item: AdminUser) => (
    <>
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
              <Ionicons name="person" size={18} color={theme.colors.gray300} />
            </Box>
          )}
          <Box style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
            <HStack style={{ alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.username}
              </Text>
              {renderKindChip(item, t, styles)}
              {renderLevelChip(item.currentLevel ?? 0, t, styles)}
              {item.merchant && item.merchant.status !== "APPROVED" && (
                <Box style={styles.kindChipMuted}>
                  <Text style={styles.kindChipMutedText}>
                    {t("admin.merchantPending")}
                  </Text>
                </Box>
              )}
            </HStack>
            <Text style={styles.userMeta}>ID: {item.id}</Text>
          </Box>
        </HStack>
        <Box
          style={[
            styles.statusBadge,
            item.status === "ACTIVE" ? styles.statusActive : styles.statusInactive,
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
            {item.status === "ACTIVE" ? t("admin.active") : item.status}
          </Text>
        </Box>
      </HStack>

      {item.titles && item.titles.length > 0 ? (
        <HStack style={styles.titleChipsRow}>
          {item.titles.map((titleItem) => (
            <Box
              key={titleItem.id}
              style={[
                styles.titleChip,
                titleItem.isPrimary && styles.titleChipPrimary,
              ]}
            >
              <Text
                style={[
                  styles.titleChipText,
                  titleItem.isPrimary && styles.titleChipTextPrimary,
                ]}
              >
                {titleItem.title}
              </Text>
            </Box>
          ))}
        </HStack>
      ) : null}

      <HStack style={styles.statsRow}>
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.postCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("admin.posts")}</Text>
        </Box>
        <Box style={styles.statDivider} />
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.followerCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("admin.followers")}</Text>
        </Box>
        <Box style={styles.statDivider} />
        <Box style={styles.statItem}>
          <Text style={styles.statValue}>{item.followingCount ?? 0}</Text>
          <Text style={styles.statLabel}>{t("admin.following")}</Text>
        </Box>
      </HStack>

      <Box style={styles.cardBody}>
        {item.bio ? <Text style={styles.bioText}>{item.bio}</Text> : null}
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
              <Text style={styles.detailText} numberOfLines={2}>
                {item.email}
              </Text>
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
                <Text style={styles.detailText}>
                  {" "}
                  · {t("admin.ageYears", { age: item.age })}
                </Text>
              ) : null}
            </HStack>
          ) : null}
          {item.createdAt ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </HStack>
          ) : null}
          {item.merchant ? (
            <HStack style={styles.infoItem}>
              <Ionicons name="storefront-outline" size={12} color={theme.colors.gray300} />
              <Text style={styles.detailText}>
                {t("admin.storeId")}: {item.merchant.storeId}
              </Text>
            </HStack>
          ) : null}
        </HStack>
      </Box>

      <HStack style={styles.cardActions}>
        <Button
          size="sm"
          onPress={() => {
            setDetailModalVisible(false);
            setDataUser(item);
            setDataModalVisible(true);
          }}
          leftIcon={
            <Ionicons name="analytics-outline" size={14} color={theme.colors.white} />
          }
          style={{ flex: 1 }}
        >
          <ButtonText style={{ fontSize: 12 }}>{t("admin.userData.entry")}</ButtonText>
        </Button>
        <Button
          size="sm"
          onPress={() => {
            setDetailModalVisible(false);
            openTitleModal(item);
          }}
          leftIcon={
            <Ionicons name="ribbon-outline" size={14} color={theme.colors.white} />
          }
          style={{ flex: 1 }}
        >
          <ButtonText style={{ fontSize: 12 }}>{t("admin.title_btn")}</ButtonText>
        </Button>
        <Button
          size="sm"
          colorScheme="error"
          onPress={() => {
            setDetailModalVisible(false);
            handleDelete(item);
          }}
          leftIcon={
            <Ionicons name="trash-outline" size={14} color={theme.colors.white} />
          }
          style={{ flex: 1 }}
        >
          <ButtonText style={{ fontSize: 12 }}>{t("common.delete")}</ButtonText>
        </Button>
      </HStack>
    </>
  );

  const renderUserCard = (item: AdminUser) => (
    <Pressable key={item.id} style={styles.compactCard} onPress={() => openUserDetail(item)}>
      <HStack style={styles.compactCardRow}>
        {item.avatarUrl ? (
          <OptimizedImage
            uri={item.avatarUrl}
            style={styles.compactAvatar}
            size={ImageSize.THUMBNAIL}
          />
        ) : (
          <Box style={[styles.compactAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={14} color={theme.colors.gray300} />
          </Box>
        )}

        <Box style={styles.compactMain}>
          <HStack style={styles.compactTitleRow}>
            <Text style={styles.compactName} numberOfLines={1}>
              {item.username}
            </Text>
            {renderKindChip(item, t, styles)}
          </HStack>
          <Text style={styles.compactMeta}>ID: {item.id}</Text>
        </Box>

        <Box
          style={[
            styles.compactStatusBadge,
            item.status === "ACTIVE" ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text
            style={[
              styles.compactStatusText,
              item.status === "ACTIVE"
                ? styles.statusTextActive
                : styles.statusTextInactive,
            ]}
          >
            {item.status === "ACTIVE" ? t("admin.active") : item.status}
          </Text>
        </Box>

        <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
      </HStack>
    </Pressable>
  );

  return (
    <Box style={{ flex: 1 }}>
      <HStack style={styles.searchBar}>
        <Input
          style={styles.searchInput}
          placeholder={t("admin.searchUserPlaceholder")}
          placeholderTextColor={theme.colors.gray300}
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          variant="outline"
          size="sm"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={16} color={theme.colors.white} />
        </Pressable>
      </HStack>

      {loading && !refreshing ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
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
            <Text style={styles.totalText}>{t("admin.totalUsers", { count: total })}</Text>
          </Box>

          {users.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={40}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>{t("admin.noUsers")}</Text>
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
                    <Ionicons name="chevron-back" size={20} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    {t("admin.pagination", { page, total: totalPages })}
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadUsers(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.black} />
                  </Pressable>
                </HStack>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={styles.userDetailModalContent}>
            <HStack style={styles.userDetailHeader}>
              <Text style={styles.userDetailTitle} numberOfLines={1}>
                {detailUser?.username ?? t("admin.userDetailTitle")}
              </Text>
              <Pressable
                style={styles.userDetailCloseBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </HStack>
            {detailUser ? (
              <RNScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.userDetailScroll}
              >
                {renderUserDetailBody(detailUser)}
              </RNScrollView>
            ) : null}
          </Box>
        </Box>
      </Modal>

      <UserDataModal
        visible={dataModalVisible}
        onClose={() => {
          setDataModalVisible(false);
          setDataUser(null);
        }}
        user={dataUser}
      />

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
                size={22}
                color={theme.colors.error}
              />
              <Text
                style={[
                  sharedStyles.modalTitle,
                  { color: theme.colors.error, marginLeft: 8 },
                ]}
              >
                {t("admin.deleteUser")}
              </Text>
            </HStack>
            <Text style={sharedStyles.modalWarning}>
              {t("admin.confirmDeleteUser", { username: deleteTarget?.username, id: deleteTarget?.id })}
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
                <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={confirmDelete}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                <ButtonText>{t("admin.confirmDelete")}</ButtonText>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, { maxHeight: "70%" }]}>
            <HStack style={sharedStyles.modalTitleRow}>
              <Ionicons name="ribbon" size={22} color={theme.colors.black} />
              <Text style={[sharedStyles.modalTitle, { marginLeft: 8 }]}>
                {t("admin.manageTitles")} - {titleTarget?.username}
              </Text>
            </HStack>

            {titleLoading ? (
              <Box style={{ alignItems: "center", paddingVertical: 16 }}>
                <ActivityIndicator color={theme.colors.black} />
              </Box>
            ) : (
              <RNScrollView style={{ maxHeight: 200, marginVertical: 12 }}>
                {titleList.length === 0 ? (
                  <Text style={{ color: theme.colors.gray300, textAlign: "center", paddingVertical: 16 }}>
                    {t("admin.noTitles")}
                  </Text>
                ) : (
                  titleList.map((titleItem) => (
                    <HStack
                      key={titleItem.id}
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
                          name={titleItem.isPrimary ? "star" : "star-outline"}
                          size={16}
                          color={titleItem.isPrimary ? "#F59E0B" : theme.colors.gray300}
                        />
                        <Text style={{ fontSize: 14, fontWeight: titleItem.isPrimary ? "600" : "400", color: theme.colors.black }}>
                          {titleItem.title}
                        </Text>
                        {titleItem.isPrimary && (
                          <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "500" }}>{t("admin.primaryTitle")}</Text>
                        )}
                      </HStack>
                      <Pressable onPress={() => handleRemoveTitle(titleItem.id)}>
                        <Ionicons name="close-circle" size={18} color={theme.colors.error} />
                      </Pressable>
                    </HStack>
                  ))
                )}
              </RNScrollView>
            )}

            <HStack style={{ gap: 8, marginTop: 4 }}>
              <Input
                style={{ flex: 1, height: 32 }}
                placeholder={t("admin.titlePlaceholder")}
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
                <ButtonText style={{ fontSize: 12 }}>{t("admin.add")}</ButtonText>
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
                <ButtonText>{t("common.close")}</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>
    </Box>
  );
};

// ==================== Reports Sub-Tab ====================

const ReportsSubTab = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const REPORT_STATUS_COLORS: Record<string, string> = {
    PENDING: "#F59E0B",
    REVIEWED: "#3B82F6",
    RESOLVED: theme.colors.success,
    DISMISSED: theme.colors.gray300,
  };
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
        Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchReportsFailed"));
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
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
    }
  };

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleResolveMessageReport = (item: AdminReport) => {
    Alert.alert(
      t("admin.deleteMessageNotify"),
      t("admin.confirmDeleteMessage", { id: item.targetId }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.confirm"),
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
        t("admin.violationNoticeMessage", { reason: t(`admin.reason_${item.reason}`) || item.reason })
      );

      await adminService.updateReportStatus(item.id, "RESOLVED");
      Alert.alert(t("admin.done"), t("admin.messageDeletedNotified"));
      loadReports(page);
    } catch (e) {
      Alert.alert(t("admin.operationFailed"), e instanceof Error ? e.message : t("admin.retryLater"));
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const renderReportCard = (item: AdminReport) => {
    const targetInfo = {
      label: t(`admin.targetType_${item.targetType}`) || item.targetType,
      icon: TARGET_TYPE_ICONS[item.targetType] || "help-circle-outline",
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
                  {t(`admin.reportStatus_${item.status}`) || item.status}
                </Text>
              </Box>
            </HStack>
            <Text style={styles.detailText}>
              {t("admin.reporter")} {item.reporterName} (ID: {item.reporterId})
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
              {t(`admin.reason_${item.reason}`) || item.reason}
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
                <ButtonText style={{ fontSize: 12 }}>{t("admin.deleteMessageNotify")}</ButtonText>
              </Button>
            ) : (
              <Button
                size="sm"
                colorScheme="success"
                onPress={() => handleUpdateStatus(item.id, "RESOLVED")}
                leftIcon={<Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>{t("admin.resolve")}</ButtonText>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onPress={() => handleUpdateStatus(item.id, "DISMISSED")}
              disabled={actionLoading === item.id}
              leftIcon={<Ionicons name="close-circle-outline" size={14} />}
            >
              <ButtonText style={{ fontSize: 12 }}>{t("admin.dismiss")}</ButtonText>
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
        <View style={chipRowStyle}>
          {(["ALL", "PENDING", "RESOLVED", "DISMISSED"] as ReportFilter[]).map(
            (f) => (
              <AnimatedChip
                key={f}
                label={
                  f === "ALL" ? t("common.all") : t(`admin.reportStatus_${f}`) || f
                }
                isActive={filter === f}
                onPress={() => setFilter(f)}
              />
            ),
          )}
        </View>
      </RNScrollView>

      {loading && !refreshing ? (
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
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
            <Text style={styles.totalText}>{t("admin.totalReports", { count: total })}</Text>
          </Box>

          {reports.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="flag-outline"
                size={40}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>{t("admin.noReports")}</Text>
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
                    <Ionicons name="chevron-back" size={20} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    {t("admin.pagination", { page, total: totalPages })}
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadReports(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.black} />
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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
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
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchBlocksFailed"));
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
          size={16}
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
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
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
            <Text style={styles.totalText}>{t("admin.totalBlocks", { count: total })}</Text>
          </Box>

          {blocks.length === 0 ? (
            <Box style={sharedStyles.emptyContainer}>
              <Ionicons
                name="ban-outline"
                size={40}
                color={theme.colors.gray300}
              />
              <Text style={sharedStyles.emptyText}>{t("admin.noBlocks")}</Text>
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
                    <Ionicons name="chevron-back" size={20} color={theme.colors.black} />
                  </Pressable>
                  <Text style={styles.paginationText}>
                    {t("admin.pagination", { page, total: totalPages })}
                  </Text>
                  <Pressable
                    disabled={page >= totalPages}
                    onPress={() => page < totalPages && loadBlocks(page + 1)}
                    style={{ opacity: page >= totalPages ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.black} />
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

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.gray50,
  },
  // Sub-tab bar
  subTabBar: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: t.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  subTabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    gap: 4,
  },
  subTabItemActive: {
    backgroundColor: t.colors.text,
  },
  subTabText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
    fontWeight: "500",
  },
  subTabTextActive: {
    color: t.colors.textInverted,
  },
  // Search
  searchBar: {
    flexDirection: "row",
    padding: 10,
    gap: t.spacing.sm,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 34,
  },
  searchBtn: {
    width: 34,
    height: 34,
    backgroundColor: t.colors.text,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  // List
  listContainer: {
    flex: 1,
    padding: 10,
  },
  listHeader: {
    marginBottom: t.spacing.sm,
  },
  totalText: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray400,
  },
  // Card
  card: {
    backgroundColor: t.colors.card,
    borderRadius: 4,
    padding: 10,
    marginBottom: t.spacing.sm,
    ...t.shadows.sm,
  },
  compactCard: {
    backgroundColor: t.colors.card,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    ...t.shadows.sm,
  },
  compactCardRow: {
    alignItems: "center",
    gap: 8,
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  compactMain: {
    flex: 1,
    minWidth: 0,
  },
  compactTitleRow: {
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  compactName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: t.colors.text,
    flexShrink: 1,
  },
  compactMeta: {
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    marginTop: 2,
  },
  compactStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  userDetailModalContent: {
    backgroundColor: t.colors.card,
    borderRadius: 4,
    height: "88%",
    width: "92%",
    padding: 10,
  },
  userDetailHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  userDetailTitle: {
    ...t.typography.h4,
    fontSize: 15,
    lineHeight: 20,
    color: t.colors.text,
    flex: 1,
    marginRight: t.spacing.sm,
  },
  userDetailCloseBtn: {
    padding: t.spacing.xs,
  },
  userDetailScroll: {
    paddingBottom: t.spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBody: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  cardActions: {
    gap: t.spacing.sm,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  // User card
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 4,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    ...t.typography.body,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: t.colors.text,
  },
  userMeta: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    marginTop: 2,
  },
  detailText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: t.colors.success + "15",
  },
  statusInactive: {
    backgroundColor: t.colors.error + "15",
  },
  statusText: {
    ...t.typography.caption,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 14,
  },
  statusTextActive: {
    color: t.colors.success,
  },
  statusTextInactive: {
    color: t.colors.error,
  },
  // 身份 chip (三档) — 与 /admin/users Web 端视觉对齐
  kindChipSolid: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: t.colors.text,
  },
  kindChipSolidText: {
    fontSize: 10,
    fontWeight: "700",
    color: t.colors.textInverted,
    letterSpacing: 0.5,
  },
  kindChipOutline: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.colors.text,
    backgroundColor: "transparent",
  },
  kindChipOutlineText: {
    fontSize: 10,
    fontWeight: "700",
    color: t.colors.text,
  },
  kindChipMuted: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  kindChipMutedText: {
    fontSize: 10,
    fontWeight: "500",
    color: t.colors.gray400,
  },
  // 等级 chip (Lv ≥ 1 黑底 / Lv 0 占位)
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: t.colors.text,
  },
  levelChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: t.colors.textInverted,
    letterSpacing: 0.5,
  },
  levelChipTitle: {
    fontSize: 10,
    fontWeight: "500",
    color: t.colors.textInverted,
    opacity: 0.8,
  },
  levelChipMuted: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  levelChipMutedText: {
    fontSize: 11,
    fontWeight: "600",
    color: t.colors.gray400,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: t.colors.gray300,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: t.colors.border,
  },
  bioText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
    fontStyle: "italic",
    marginBottom: 6,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
    marginTop: 6,
    paddingTop: 6,
  },
  titleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  titleChipPrimary: {
    backgroundColor: "#FEF3C7",
  },
  titleChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: t.colors.gray400,
  },
  titleChipTextPrimary: {
    color: "#D97706",
    fontWeight: "600",
  },
  // Report card
  reportTarget: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: t.colors.text,
  },
  reportStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportStatusText: {
    ...t.typography.caption,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 14,
  },
  reportReason: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.error,
    fontWeight: "500",
  },
  reportDesc: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray400,
    marginTop: 4,
  },
  reportDate: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    marginTop: 6,
  },
  // Filter
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 6,
  },
  // Block card
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  blockUser: {
    flex: 1,
    alignItems: "center",
  },
  blockUserName: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: t.colors.text,
  },
  blockUserId: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    marginTop: 2,
  },
  blockDate: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    textAlign: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  // Pagination
  pagination: {
    paddingVertical: t.spacing.md,
  },
  paginationText: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 17,
    color: t.colors.gray400,
  },
});

export default UsersTab;
