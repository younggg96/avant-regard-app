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
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  showService,
  Show,
  CreateShowParams,
  UpdateShowParams,
} from "../../services/showService";
import { sharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";

const SEASONS = [
  "Spring/Summer", "Fall/Winter", "Autumn/Winter",
  "Resort", "Pre-Fall",
  "Printemps/Été", "Automne/Hiver",
  "Primavera/Estate", "Autunno/Inverno",
];

const CATEGORIES = [
  "Ready-to-Wear", "Couture", "Menswear", "Womenswear",
  "Co-Ed", "Accessories", "Beauty", "Bridal", "Kids Wear",
];

const STATUS_OPTIONS = [
  { key: "", label: "全部" },
  { key: "APPROVED", label: "已通过" },
  { key: "PENDING", label: "待审核" },
  { key: "REJECTED", label: "已拒绝" },
];

const STATUS_COLORS: Record<string, string> = {
  APPROVED: theme.colors.success,
  PENDING: "#F59E0B",
  REJECTED: theme.colors.error,
};

const EMPTY_FORM: CreateShowParams = {
  brand: "",
  title: "",
  year: new Date().getFullYear(),
  season: "",
  category: "",
  designer: "",
  description: "",
  coverImage: "",
};

const ShowManagementTab = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [editForm, setEditForm] = useState<UpdateShowParams>({});
  const [createForm, setCreateForm] = useState<CreateShowParams>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);

  const fetchShows = useCallback(
    async (p: number = 1, kw?: string, status?: string) => {
      try {
        setLoading(true);
        const result = await showService.adminGetAllShows({
          keyword: kw,
          status: status || undefined,
          page: p,
          pageSize: 50,
        });
        setShows(result.shows);
        setTotal(result.total);
        setPage(result.page);
      } catch (error) {
        console.error("获取秀场列表失败:", error);
        Alert.alert(
          "错误",
          error instanceof Error ? error.message : "获取秀场列表失败"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchShows(1, keyword, statusFilter);
  }, [fetchShows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchShows(1, keyword, statusFilter);
    setRefreshing(false);
  }, [fetchShows, keyword, statusFilter]);

  const handleSearch = () => {
    fetchShows(1, keyword, statusFilter);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    fetchShows(1, keyword, status);
  };

  const handleOpenCreate = () => {
    setCreateForm({ ...EMPTY_FORM });
    setCreateModalVisible(true);
  };

  const handleCreate = async () => {
    if (!createForm.brand.trim() || !createForm.title.trim() || !createForm.season.trim()) {
      Alert.alert("提示", "品牌、标题和季度为必填项");
      return;
    }
    try {
      setActionLoading(true);
      await showService.adminCreateShow(createForm);
      Alert.alert("成功", "秀场已创建");
      setCreateModalVisible(false);
      fetchShows(1, keyword, statusFilter);
    } catch (error) {
      Alert.alert(
        "错误",
        error instanceof Error ? error.message : "创建失败"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (show: Show) => {
    setEditingShow(show);
    setEditForm({
      brand: show.brand,
      title: show.title || "",
      year: show.year,
      season: show.season,
      category: show.category || "",
      designer: show.designer || "",
      description: show.description || "",
      coverImage: show.coverImage || "",
      status: show.status || "APPROVED",
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingShow) return;
    try {
      setActionLoading(true);
      await showService.adminUpdateShow(String(editingShow.id), editForm);
      Alert.alert("成功", "秀场已更新");
      setEditModalVisible(false);
      fetchShows(page, keyword, statusFilter);
    } catch (error) {
      Alert.alert(
        "错误",
        error instanceof Error ? error.message : "更新失败"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (show: Show) => {
    Alert.alert(
      "确认删除",
      `确定要删除秀场「${show.title || show.brand + " " + show.season}」吗？此操作不可撤销。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await showService.adminDeleteShow(String(show.id));
              Alert.alert("已删除", "秀场已删除");
              fetchShows(page, keyword, statusFilter);
            } catch (error) {
              Alert.alert(
                "错误",
                error instanceof Error ? error.message : "删除失败"
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const totalPages = Math.ceil(total / 50);

  const handleUploadCover = async (
    setForm: (updater: (prev: any) => any) => void
  ) => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([16, 9]);
      if (url) {
        setForm((f: any) => ({ ...f, coverImage: url }));
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setImageUploading(false);
    }
  };

  const renderShowFormFields = (
    form: Record<string, any>,
    setForm: (updater: (prev: any) => any) => void,
    isEdit: boolean
  ) => (
    <>
      <Text style={sharedStyles.formLabel}>品牌名称 *</Text>
      <TextInput
        style={sharedStyles.modalInput}
        placeholder="例如: Yohji Yamamoto"
        placeholderTextColor={theme.colors.gray300}
        value={form.brand || ""}
        onChangeText={(v) => setForm((f: any) => ({ ...f, brand: v }))}
      />

      <Text style={sharedStyles.formLabel}>封面图</Text>
      {form.coverImage ? (
        <Image
          source={{ uri: form.coverImage }}
          style={styles.coverPreview}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverPreview, styles.coverPlaceholder]}>
          <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
        </View>
      )}
      <TouchableOpacity
        style={sharedStyles.uploadImageButton}
        onPress={() => handleUploadCover(setForm)}
        disabled={imageUploading}
      >
        {imageUploading ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
            <Text style={sharedStyles.uploadImageButtonText}>
              {form.coverImage ? "更换封面" : "上传封面"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={sharedStyles.formLabel}>秀场标题 *</Text>
      <TextInput
        style={sharedStyles.modalInput}
        placeholder="例如: Spring 2025 Ready-to-Wear"
        placeholderTextColor={theme.colors.gray300}
        value={form.title || ""}
        onChangeText={(v) => setForm((f: any) => ({ ...f, title: v }))}
      />

      <Text style={sharedStyles.formLabel}>年份 *</Text>
      <TextInput
        style={sharedStyles.modalInput}
        placeholder="例如: 2025"
        placeholderTextColor={theme.colors.gray300}
        value={String(form.year || "")}
        onChangeText={(v) =>
          setForm((f: any) => ({
            ...f,
            year: v ? parseInt(v, 10) || "" : "",
          }))
        }
        keyboardType="number-pad"
        maxLength={4}
      />

      <Text style={sharedStyles.formLabel}>季度 *</Text>
      <View style={sharedStyles.linkTypeContainer}>
        {SEASONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              sharedStyles.linkTypeButton,
              form.season === s && sharedStyles.linkTypeButtonActive,
            ]}
            onPress={() => setForm((f: any) => ({ ...f, season: s }))}
          >
            <Text
              style={[
                sharedStyles.linkTypeButtonText,
                form.season === s && sharedStyles.linkTypeButtonTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={sharedStyles.formLabel}>类别</Text>
      <View style={sharedStyles.linkTypeContainer}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              sharedStyles.linkTypeButton,
              form.category === c && sharedStyles.linkTypeButtonActive,
            ]}
            onPress={() =>
              setForm((f: any) => ({
                ...f,
                category: f.category === c ? "" : c,
              }))
            }
          >
            <Text
              style={[
                sharedStyles.linkTypeButtonText,
                form.category === c && sharedStyles.linkTypeButtonTextActive,
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={sharedStyles.formLabel}>主设计师</Text>
      <TextInput
        style={sharedStyles.modalInput}
        placeholder="选填"
        placeholderTextColor={theme.colors.gray300}
        value={form.designer || ""}
        onChangeText={(v) => setForm((f: any) => ({ ...f, designer: v }))}
      />

      <Text style={sharedStyles.formLabel}>秀场介绍</Text>
      <TextInput
        style={[sharedStyles.modalInput, { minHeight: 80 }]}
        placeholder="选填，介绍秀场的亮点、主题等"
        placeholderTextColor={theme.colors.gray300}
        value={form.description || ""}
        onChangeText={(v) => setForm((f: any) => ({ ...f, description: v }))}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {isEdit && (
        <>
          <Text style={sharedStyles.formLabel}>状态</Text>
          <View style={styles.statusChips}>
            {["APPROVED", "PENDING", "REJECTED"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  form.status === s && {
                    backgroundColor: STATUS_COLORS[s],
                    borderColor: STATUS_COLORS[s],
                  },
                ]}
                onPress={() => setForm((f: any) => ({ ...f, status: s }))}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    form.status === s && { color: theme.colors.white },
                  ]}
                >
                  {s === "APPROVED"
                    ? "已通过"
                    : s === "PENDING"
                      ? "待审核"
                      : "已拒绝"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={[sharedStyles.modalInput, styles.searchInput]}
            placeholder="搜索品牌/标题/设计师..."
            placeholderTextColor={theme.colors.gray300}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        {/* Status filter + Create button */}
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterContainer}
          >
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterChip,
                  statusFilter === opt.key && styles.filterChipActive,
                ]}
                onPress={() => handleStatusFilter(opt.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === opt.key && styles.filterChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.createButton} onPress={handleOpenCreate}>
            <Ionicons name="add" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        <Text style={styles.totalText}>共 {total} 个秀场</Text>

        {loading ? (
          <View style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </View>
        ) : shows.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons
              name="film-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>暂无秀场数据</Text>
          </View>
        ) : (
          shows.map((show) => (
            <View key={show.id} style={sharedStyles.postCard}>
              <View style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>
                  {show.title || show.season}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        STATUS_COLORS[show.status || "APPROVED"] + "18",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: STATUS_COLORS[show.status || "APPROVED"],
                      },
                    ]}
                  >
                    {show.status === "APPROVED"
                      ? "已通过"
                      : show.status === "PENDING"
                        ? "待审核"
                        : show.status === "REJECTED"
                          ? "已拒绝"
                          : "已通过"}
                  </Text>
                </View>
              </View>

              {show.coverImage && (
                <Image
                  source={{ uri: show.coverImage }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>品牌</Text>
                  <Text style={styles.metaValue}>{show.brand}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>年份</Text>
                  <Text style={styles.metaValue}>{show.year}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>季度</Text>
                  <Text style={styles.metaValue}>{show.season}</Text>
                </View>
                {show.category && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>类别</Text>
                    <Text style={styles.metaValue}>{show.category}</Text>
                  </View>
                )}
                {show.designer && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>设计师</Text>
                    <Text style={styles.metaValue}>{show.designer}</Text>
                  </View>
                )}
                {show.contributorName && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>贡献者</Text>
                    <Text style={styles.metaValue}>
                      {show.contributorName}
                    </Text>
                  </View>
                )}
              </View>

              {show.description && (
                <Text style={styles.description} numberOfLines={3}>
                  {show.description}
                </Text>
              )}

              <View style={sharedStyles.actionButtons}>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.viewButton]}
                  onPress={() => handleOpenEdit(show)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={theme.colors.black}
                  />
                  <Text
                    style={[
                      sharedStyles.actionButtonText,
                      { color: theme.colors.black },
                    ]}
                  >
                    编辑
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    sharedStyles.actionButton,
                    sharedStyles.deletePostButton,
                  ]}
                  onPress={() => handleDelete(show)}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={theme.colors.white}
                  />
                  <Text style={sharedStyles.actionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Pagination */}
        {total > 50 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => fetchShows(page - 1, keyword, statusFilter)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={theme.colors.black}
              />
            </TouchableOpacity>
            <Text style={styles.paginationText}>
              第 {page} 页 / 共 {totalPages} 页
            </Text>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => fetchShows(page + 1, keyword, statusFilter)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={theme.colors.black}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={sharedStyles.modalOverlay}>
          <View style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={sharedStyles.modalTitle}>新建秀场</Text>
              {renderShowFormFields(createForm, setCreateForm, false)}
              <View style={sharedStyles.modalButtons}>
                <TouchableOpacity
                  style={[
                    sharedStyles.modalButton,
                    sharedStyles.modalCancelButton,
                  ]}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={sharedStyles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    sharedStyles.modalButton,
                    sharedStyles.modalConfirmButton,
                    { backgroundColor: theme.colors.black },
                  ]}
                  onPress={handleCreate}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator
                      color={theme.colors.white}
                      size="small"
                    />
                  ) : (
                    <Text style={sharedStyles.modalConfirmText}>创建</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={sharedStyles.modalOverlay}>
          <View style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={sharedStyles.modalTitle}>编辑秀场</Text>
              {renderShowFormFields(editForm, setEditForm, true)}
              <View style={sharedStyles.modalButtons}>
                <TouchableOpacity
                  style={[
                    sharedStyles.modalButton,
                    sharedStyles.modalCancelButton,
                  ]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={sharedStyles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    sharedStyles.modalButton,
                    sharedStyles.modalConfirmButton,
                    { backgroundColor: theme.colors.black },
                  ]}
                  onPress={handleSave}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator
                      color={theme.colors.white}
                      size="small"
                    />
                  ) : (
                    <Text style={sharedStyles.modalConfirmText}>保存修改</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginBottom: 0,
  },
  searchButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  statusFilterContainer: {
    flexDirection: "row",
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  createButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  totalText: {
    paddingBottom: 8,
    fontSize: 12,
    color: theme.colors.gray400,
  },
  coverImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.colors.gray100,
  },
  metaSection: {
    gap: 6,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 13,
    color: theme.colors.gray300,
    width: 52,
  },
  metaValue: {
    fontSize: 13,
    color: theme.colors.black,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: theme.colors.gray400,
    lineHeight: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.gray50,
    padding: 10,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  paginationText: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  editModalContent: {
    height: "85%",
    width: "92%",
    padding: theme.spacing.lg,
  },
  coverPreview: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
    marginBottom: theme.spacing.sm,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.gray100,
  },
  statusChipText: {
    fontSize: 12,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
});

export default ShowManagementTab;
