import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import { adminService, AdminBrand, AdminBrandImage, UpdateBrandParams } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";
import { Box, HStack, VStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const BrandManagementTab = () => {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBrands(1, keyword);
  }, []);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [editForm, setEditForm] = useState<UpdateBrandParams>({});
  const [brandImages, setBrandImages] = useState<AdminBrandImage[]>([]);
  const [brandImagesLoading, setBrandImagesLoading] = useState(false);
  const [brandImageUploading, setBrandImageUploading] = useState(false);

  const fetchBrands = useCallback(async (p: number = 1, kw?: string) => {
    try {
      setLoading(true);
      const result = await adminService.getAdminBrands(kw, p, 50);
      setBrands(result.brands);
      setTotal(result.total);
      setPage(result.page);
    } catch (error) {
      console.error("fetchBrands error:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBrands(1, keyword);
    setRefreshing(false);
  }, [fetchBrands, keyword]);

  const handleSearch = () => {
    fetchBrands(1, keyword);
  };

  const handleOpenEdit = (brand: AdminBrand) => {
    setEditingBrand(brand);
    setEditForm({
      name: brand.name,
      category: brand.category || "",
      foundedYear: brand.foundedYear || "",
      founder: brand.founder || "",
      country: brand.country || "",
      website: brand.website || "",
    });
    setEditModalVisible(true);
    loadBrandImages(brand.id);
  };

  const loadBrandImages = async (brandId: number) => {
    try {
      setBrandImagesLoading(true);
      const result = await adminService.getBrandImagesAdmin(brandId);
      setBrandImages(result.images);
    } catch {
      setBrandImages([]);
    } finally {
      setBrandImagesLoading(false);
    }
  };

  const handleAdminUploadBrandImage = async () => {
    if (!editingBrand) return;
    try {
      setBrandImageUploading(true);
      const url = await pickAndUploadImage([3, 4]);
      if (url) {
        await adminService.adminUploadBrandImage(editingBrand.id, url);
        loadBrandImages(editingBrand.id);
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.uploadFailed"));
    } finally {
      setBrandImageUploading(false);
    }
  };

  const handleDeleteBrandImage = async (imageId: number) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteImage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await adminService.deleteBrandImage(imageId);
            setBrandImages((prev) => prev.filter((img) => img.id !== imageId));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deleteFailed"));
          }
        },
      },
    ]);
  };

  const handleToggleImageSelected = async (img: AdminBrandImage) => {
    if (img.status === "PENDING") {
      Alert.alert(t("admin.pendingReview"), t("admin.brandImagePendingApprove"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.approve"),
          onPress: async () => {
            try {
              await adminService.approveBrandImage(img.id);
              setBrandImages((prev) =>
                prev.map((i) => (i.id === img.id ? { ...i, status: "APPROVED", isSelected: true } : i))
              );
            } catch (error) {
              Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
            }
          },
        },
      ]);
      return;
    }
    const newSelected = !img.isSelected;
    try {
      await adminService.toggleBrandImageSelected(img.id, newSelected);
      setBrandImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, isSelected: newSelected } : i))
      );
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    }
  };

  const handleSave = async () => {
    if (!editingBrand) return;
    try {
      setActionLoading(true);
      await adminService.updateAdminBrand(editingBrand.id, editForm);
      Alert.alert(t("common.success"), t("admin.brandUpdated"));
      setEditModalVisible(false);
      fetchBrands(page, keyword);
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.updateFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (brand: AdminBrand) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteBrand", { name: brand.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteAdminBrand(brand.id);
            Alert.alert(t("admin.deleted"), t("admin.brandDeleted", { name: brand.name }));
            fetchBrands(page, keyword);
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deleteFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const totalPages = Math.ceil(total / 50);
  const selectedCount = brandImages.filter((i) => i.status === "APPROVED" && i.isSelected).length;
  const pendingCount = brandImages.filter((i) => i.status === "PENDING").length;

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HStack space="sm" style={styles.searchRow}>
          <Input
            style={styles.searchInput}
            placeholder={t("admin.searchBrandPlaceholder")}
            placeholderTextColor={theme.colors.gray300}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            variant="outline"
            size="sm"
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={18} color={theme.colors.white} />
          </Pressable>
        </HStack>

        <Text style={styles.totalText}>{t("admin.totalBrands", { count: total })}</Text>

        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : brands.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="pricetag-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noData")}</Text>
          </Box>
        ) : (
          brands.map((brand) => (
            <Box key={brand.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>{brand.name}</Text>
                <Text style={sharedStyles.postDate}>ID: {brand.id}</Text>
              </HStack>

              {brand.coverImage && (
                <OptimizedImage
                  uri={brand.coverImage}
                  size={ImageSize.MEDIUM}
                  style={styles.brandImage}
                  contentFit="cover"
                  lazy={true}
                />
              )}

              <VStack style={styles.brandMeta}>
                {brand.category && <Text style={sharedStyles.postContent} numberOfLines={1}>{t("admin.category")}: {brand.category}</Text>}
                {brand.founder && <Text style={sharedStyles.postContent} numberOfLines={1}>{t("admin.founder")}: {brand.founder}</Text>}
                {brand.country && <Text style={sharedStyles.postContent} numberOfLines={1}>{t("admin.country")}: {brand.country}</Text>}
                {brand.foundedYear && <Text style={sharedStyles.postContent} numberOfLines={1}>{t("admin.foundedYear")}: {brand.foundedYear}</Text>}
              </VStack>

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => handleOpenEdit(brand)}
                  leftIcon={<Ionicons name="create-outline" size={16} color={theme.colors.white} />}
                  style={{ borderColor: theme.colors.gray200, gap: 4 }}
                >
                  <ButtonText style={{ color: theme.colors.white, fontSize: 12 }}>{t("common.edit")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleDelete(brand)}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="trash-outline" size={16} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("common.delete")}</ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}

        {total > 50 && (
          <HStack justifyContent="center" space="md" style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              onPress={() => fetchBrands(page - 1, keyword)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
            </Pressable>
            <Text style={styles.paginationText}>{t("admin.pagination", { page, total: totalPages })}</Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => fetchBrands(page + 1, keyword)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
            </Pressable>
          </HStack>
        )}

        <Box style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={sharedStyles.modalTitle}>{t("admin.editBrand")}</Text>

              <Text style={sharedStyles.formLabel}>
                {t("admin.brandImagesLabel", { selected: selectedCount })}{pendingCount > 0 ? t("admin.brandImagesPending", { count: pendingCount }) : ""}
              </Text>
              <Text style={styles.imageHint}>{t("admin.brandImagesHint")}</Text>
              {brandImagesLoading ? (
                <ActivityIndicator size="small" color={theme.colors.black} style={{ marginVertical: 12 }} />
              ) : (
                <Box style={styles.brandImagesGrid}>
                  {brandImages.map((img) => {
                    const isPending = img.status === "PENDING";
                    return (
                      <Pressable
                        key={img.id}
                        style={[
                          styles.brandImageItem,
                          isPending && styles.brandImageItemPending,
                          !isPending && img.isSelected && styles.brandImageItemSelected,
                        ]}
                        onPress={() => handleToggleImageSelected(img)}
                        onLongPress={() => handleDeleteBrandImage(img.id)}
                      >
                        <OptimizedImage
                          uri={img.imageUrl}
                          size={ImageSize.MEDIUM}
                          style={styles.brandImageThumb}
                          contentFit="cover"
                          lazy={true}
                        />
                        {isPending ? (
                          <Box style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>{t("admin.pendingReview")}</Text>
                          </Box>
                        ) : (
                          <Box style={[styles.checkboxOverlay, img.isSelected && styles.checkboxOverlaySelected]}>
                            <Ionicons
                              name={img.isSelected ? "checkmark-circle" : "ellipse-outline"}
                              size={22}
                              color={img.isSelected ? "#3B82F6" : "rgba(255,255,255,0.7)"}
                            />
                          </Box>
                        )}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={styles.brandImageAddBtn}
                    onPress={handleAdminUploadBrandImage}
                    disabled={brandImageUploading}
                  >
                    {brandImageUploading ? (
                      <ActivityIndicator size="small" color={theme.colors.gray300} />
                    ) : (
                      <Ionicons name="add" size={28} color={theme.colors.gray300} />
                    )}
                  </Pressable>
                </Box>
              )}

              <Text style={sharedStyles.formLabel}>{t("admin.storeName")}</Text>
              <Input
                variant="outline"
                size="md"
                placeholder={t("admin.brandNameRequired")}
                placeholderTextColor={theme.colors.gray300}
                value={editForm.name || ""}
                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
              />

              <HStack style={styles.fieldRow}>
                <Box style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.category")}</Text>
                  <Input
                    variant="outline"
                    size="md"
                    placeholder={t("admin.categoryPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.category || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, category: v }))}
                  />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.country")}</Text>
                  <Input
                    variant="outline"
                    size="md"
                    placeholder={t("admin.countryPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.country || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, country: v }))}
                  />
                </Box>
              </HStack>

              <HStack style={styles.fieldRow}>
                <Box style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.founder")}</Text>
                  <Input
                    variant="outline"
                    size="md"
                    placeholder={t("admin.founder")}
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.founder || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, founder: v }))}
                  />
                </Box>
                <Box style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.foundedYear")}</Text>
                  <Input
                    variant="outline"
                    size="md"
                    placeholder={t("admin.yearPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.foundedYear || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, foundedYear: v }))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </Box>
              </HStack>

              <Text style={sharedStyles.formLabel}>{t("admin.website")}</Text>
              <Input
                variant="outline"
                size="md"
                placeholder="https://..."
                placeholderTextColor={theme.colors.gray300}
                value={editForm.website || ""}
                onChangeText={(v) => setEditForm((f) => ({ ...f, website: v }))}
                autoCapitalize="none"
                keyboardType="url"
              />

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
      </Modal>
    </Box>
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
  },
  searchButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  totalText: {
    paddingBottom: 8,
    fontSize: 12,
    color: theme.colors.gray400,
  },
  brandImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  brandMeta: {
    gap: 2,
    marginBottom: 8,
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
  fieldRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: theme.spacing.sm,
  },
  imageHint: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginBottom: 8,
  },
  brandImagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  brandImageItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  brandImageItemSelected: {
    borderColor: "#3B82F6",
  },
  brandImageItemPending: {
    borderColor: "#F59E0B",
  },
  pendingBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(245,158,11,0.85)",
    paddingVertical: 2,
    alignItems: "center",
  },
  pendingBadgeText: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "600" as const,
  },
  brandImageThumb: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  checkboxOverlay: {
    position: "absolute",
    top: 3,
    right: 3,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 11,
  },
  checkboxOverlaySelected: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  brandImageAddBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
  },
});

export default BrandManagementTab;
