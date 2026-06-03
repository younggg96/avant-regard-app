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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import {
  showService,
  Show,
  CreateShowParams,
  UpdateShowParams,
} from "../../services/showService";
import { useSharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";
import { AnimatedChip, Box, chipRowStyle, HStack, VStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const STATUS_COLORS: Record<string, string> = {
    APPROVED: theme.colors.success,
    PENDING: "#F59E0B",
    REJECTED: theme.colors.error,
  };

  const STATUS_OPTIONS = [
    { key: "", label: t("common.all") },
    { key: "APPROVED", label: t("admin.approved") },
    { key: "PENDING", label: t("admin.pendingReview") },
    { key: "REJECTED", label: t("admin.rejected") },
  ];

  const [shows, setShows] = useState<Show[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchShows(1, keyword, statusFilter);
  }, []);

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
        console.error("fetchShows error:", error);
        Alert.alert(
          t("admin.error"),
          error instanceof Error ? error.message : t("admin.fetchShowsFailed")
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
      Alert.alert(t("admin.hint"), t("admin.showRequiredFields"));
      return;
    }
    try {
      setActionLoading(true);
      await showService.adminCreateShow(createForm);
      Alert.alert(t("common.success"), t("admin.showCreated"));
      setCreateModalVisible(false);
      fetchShows(1, keyword, statusFilter);
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.createFailed")
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
      Alert.alert(t("common.success"), t("admin.showUpdated"));
      setEditModalVisible(false);
      fetchShows(page, keyword, statusFilter);
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.updateFailed")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (show: Show) => {
    Alert.alert(
      t("admin.confirmDelete"),
      t("admin.confirmDeleteShow", { name: show.title || show.brand + " " + show.season }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await showService.adminDeleteShow(String(show.id));
              Alert.alert(t("admin.deleted"), t("admin.showDeleted"));
              fetchShows(page, keyword, statusFilter);
            } catch (error) {
              Alert.alert(
                t("admin.error"),
                error instanceof Error ? error.message : t("admin.deleteFailed")
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
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.imageUploadFailed"));
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
      <Text style={sharedStyles.formLabel}>{t("admin.brandNameRequired")}</Text>
      <Input
        variant="outline"
        size="md"
        placeholder={t("admin.brandNamePlaceholder")}
        placeholderTextColor={theme.colors.gray300}
        value={form.brand || ""}
        onChangeText={(v: string) => setForm((f: any) => ({ ...f, brand: v }))}
      />

      <Text style={sharedStyles.formLabel}>{t("admin.coverImage")}</Text>
      {form.coverImage ? (
        <OptimizedImage
          uri={form.coverImage}
          size={ImageSize.MEDIUM}
          style={styles.coverPreview}
          contentFit="cover"
          lazy={true}
        />
      ) : (
        <Box style={[styles.coverPreview, styles.coverPlaceholder]}>
          <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
        </Box>
      )}
      <Pressable
        style={sharedStyles.uploadImageButton}
        onPress={() => handleUploadCover(setForm)}
        disabled={imageUploading}
      >
        {imageUploading ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.white} />
            <Text style={sharedStyles.uploadImageButtonText}>
              {form.coverImage ? t("admin.changeCover") : t("admin.uploadCover")}
            </Text>
          </>
        )}
      </Pressable>

      <Text style={sharedStyles.formLabel}>{t("admin.showTitleRequired")}</Text>
      <Input
        variant="outline"
        size="md"
        placeholder={t("admin.showTitlePlaceholder")}
        placeholderTextColor={theme.colors.gray300}
        value={form.title || ""}
        onChangeText={(v: string) => setForm((f: any) => ({ ...f, title: v }))}
      />

      <Text style={sharedStyles.formLabel}>{t("admin.yearRequired")}</Text>
      <Input
        variant="outline"
        size="md"
        placeholder={t("admin.yearPlaceholder")}
        placeholderTextColor={theme.colors.gray300}
        value={String(form.year || "")}
        onChangeText={(v: string) =>
          setForm((f: any) => ({
            ...f,
            year: v ? parseInt(v, 10) || "" : "",
          }))
        }
        keyboardType="number-pad"
        maxLength={4}
      />

      <Text style={sharedStyles.formLabel}>{t("admin.seasonRequired")}</Text>
      <Box style={sharedStyles.linkTypeContainer}>
        {SEASONS.map((s) => (
          <Pressable
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
          </Pressable>
        ))}
      </Box>

      <Text style={sharedStyles.formLabel}>{t("admin.category")}</Text>
      <Box style={sharedStyles.linkTypeContainer}>
        {CATEGORIES.map((c) => (
          <Pressable
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
          </Pressable>
        ))}
      </Box>

      <Text style={sharedStyles.formLabel}>{t("admin.chiefDesigner")}</Text>
      <Input
        variant="outline"
        size="md"
        placeholder={t("admin.optional")}
        placeholderTextColor={theme.colors.gray300}
        value={form.designer || ""}
        onChangeText={(v: string) => setForm((f: any) => ({ ...f, designer: v }))}
      />

      <Text style={sharedStyles.formLabel}>{t("admin.showDescription")}</Text>
      <Input
        variant="outline"
        size="md"
        style={{ minHeight: 80 }}
        placeholder={t("admin.optional")}
        placeholderTextColor={theme.colors.gray300}
        value={form.description || ""}
        onChangeText={(v: string) => setForm((f: any) => ({ ...f, description: v }))}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {isEdit && (
        <>
          <Text style={sharedStyles.formLabel}>{t("admin.status")}</Text>
          <HStack style={styles.statusChips}>
            {["APPROVED", "PENDING", "REJECTED"].map((s) => (
              <Pressable
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
                    ? t("admin.approved")
                    : s === "PENDING"
                      ? t("admin.pendingReview")
                      : t("admin.rejected")}
                </Text>
              </Pressable>
            ))}
          </HStack>
        </>
      )}
    </>
  );

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search */}
        <HStack space="sm" style={styles.searchRow}>
          <Input
            style={styles.searchInput}
            placeholder={t("admin.searchShowPlaceholder")}
            placeholderTextColor={theme.colors.gray300}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            variant="outline"
            size="sm"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={16} color={theme.colors.white} />
          </Pressable>
        </HStack>

        {/* Status filter + Create button */}
        <HStack style={styles.filterRow}>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterContainer}
          >
            <View style={chipRowStyle}>
              {STATUS_OPTIONS.map((opt) => (
                <AnimatedChip
                  key={opt.key}
                  label={opt.label}
                  isActive={statusFilter === opt.key}
                  onPress={() => handleStatusFilter(opt.key)}
                />
              ))}
            </View>
          </RNScrollView>
          <Pressable style={styles.createButton} onPress={handleOpenCreate}>
            <Ionicons name="add" size={18} color={theme.colors.white} />
          </Pressable>
        </HStack>

        <Text style={styles.totalText}>{t("admin.totalShows", { count: total })}</Text>

        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : shows.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="film-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>{t("admin.noShows")}</Text>
          </Box>
        ) : (
          shows.map((show) => (
            <Box key={show.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>
                  {show.title || show.season}
                </Text>
                <Box
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
                      ? t("admin.approved")
                      : show.status === "PENDING"
                        ? t("admin.pendingReview")
                        : show.status === "REJECTED"
                          ? t("admin.rejected")
                          : t("admin.approved")}
                  </Text>
                </Box>
              </HStack>

              {show.coverImage && (
                <OptimizedImage
                  uri={show.coverImage}
                  size={ImageSize.MEDIUM}
                  style={styles.coverImage}
                  contentFit="cover"
                  lazy={true}
                />
              )}

              <VStack style={styles.metaSection}>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t("admin.brand")}</Text>
                  <Text style={styles.metaValue}>{show.brand}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t("admin.year")}</Text>
                  <Text style={styles.metaValue}>{show.year}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t("admin.season")}</Text>
                  <Text style={styles.metaValue}>{show.season}</Text>
                </HStack>
                {show.category && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("admin.category")}</Text>
                    <Text style={styles.metaValue}>{show.category}</Text>
                  </HStack>
                )}
                {show.designer && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("admin.designer")}</Text>
                    <Text style={styles.metaValue}>{show.designer}</Text>
                  </HStack>
                )}
                {show.contributorName && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("admin.contributor")}</Text>
                    <Text style={styles.metaValue}>
                      {show.contributorName}
                    </Text>
                  </HStack>
                )}
              </VStack>

              {show.description && (
                <Text style={styles.description} numberOfLines={3}>
                  {show.description}
                </Text>
              )}

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => handleOpenEdit(show)}
                  leftIcon={<Ionicons name="create-outline" size={14} />}
                  style={{ borderColor: theme.colors.gray200, gap: 4 }}
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("common.edit")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleDelete(show)}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="trash-outline" size={14} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("common.delete")}</ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}

        {/* Pagination */}
        {total > 50 && (
          <HStack justifyContent="center" space="md" style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              onPress={() => fetchShows(page - 1, keyword, statusFilter)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.colors.black}
              />
            </Pressable>
            <Text style={styles.paginationText}>
              {t("admin.pagination", { page, total: totalPages })}
            </Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => fetchShows(page + 1, keyword, statusFilter)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.black}
              />
            </Pressable>
          </HStack>
        )}

        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={sharedStyles.modalTitle}>{t("admin.createShow")}</Text>
              {renderShowFormFields(createForm, setCreateForm, false)}
              <HStack style={sharedStyles.modalButtons}>
                <Button variant="outline" size="sm" onPress={() => setCreateModalVisible(false)}>
                  <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button size="sm" onPress={handleCreate} disabled={actionLoading} isLoading={actionLoading}>
                  <ButtonText>{t("admin.create")}</ButtonText>
                </Button>
              </HStack>
            </ScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={sharedStyles.modalTitle}>{t("admin.editShow")}</Text>
              {renderShowFormFields(editForm, setEditForm, true)}
              <HStack style={sharedStyles.modalButtons}>
                <Button variant="outline" size="sm" onPress={() => setEditModalVisible(false)}>
                  <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button size="sm" onPress={handleSave} disabled={actionLoading} isLoading={actionLoading}>
                  <ButtonText>{t("admin.saveChanges")}</ButtonText>
                </Button>
              </HStack>
            </ScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
  },
  searchButton: {
    backgroundColor: t.colors.text,
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
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
  createButton: {
    backgroundColor: t.colors.text,
    borderRadius: 4,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  totalText: {
    paddingBottom: 6,
    fontSize: 11,
    color: t.colors.gray400,
  },
  coverImage: {
    width: "100%",
    height: 130,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: t.colors.gray100,
  },
  metaSection: {
    gap: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray300,
    width: 48,
  },
  metaValue: {
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
    flex: 1,
  },
  description: {
    fontSize: 12,
    color: t.colors.gray400,
    lineHeight: 16,
    marginBottom: 8,
    backgroundColor: t.colors.gray50,
    padding: 8,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    gap: 16,
  },
  paginationText: {
    fontSize: 13,
    color: t.colors.gray500,
  },
  editModalContent: {
    height: "85%",
    width: "92%",
    padding: t.spacing.lg,
  },
  coverPreview: {
    width: "100%",
    height: 130,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    marginBottom: t.spacing.sm,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    backgroundColor: t.colors.gray100,
  },
  statusChipText: {
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
    fontWeight: "500",
  },
});

export default ShowManagementTab;
