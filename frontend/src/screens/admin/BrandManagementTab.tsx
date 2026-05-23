import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService, AdminBrand, AdminBrandImage, UpdateBrandParams } from "../../services/adminService";
import { useSharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail";

const BrandManagementTab = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
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

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailBrand, setDetailBrand] = useState<AdminBrand | null>(null);
  const [detailBrandImages, setDetailBrandImages] = useState<AdminBrandImage[]>([]);
  const [detailImagesLoading, setDetailImagesLoading] = useState(false);

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const detailModalWasOpenRef = useRef(false);
  const editModalWasOpenRef = useRef(false);

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

  const loadDetailBrandImages = async (brandId: number) => {
    try {
      setDetailImagesLoading(true);
      const result = await adminService.getBrandImagesAdmin(brandId);
      setDetailBrandImages(result.images);
    } catch {
      setDetailBrandImages([]);
    } finally {
      setDetailImagesLoading(false);
    }
  };

  const openBrandDetail = (brand: AdminBrand) => {
    setDetailBrand(brand);
    setDetailBrandImages([]);
    setDetailModalVisible(true);
    loadDetailBrandImages(brand.id);
  };

  const openImageFullscreen = (urls: string[], index: number) => {
    if (!urls.length) return;
    if (detailModalVisible) {
      detailModalWasOpenRef.current = true;
      setDetailModalVisible(false);
    } else if (editModalVisible) {
      editModalWasOpenRef.current = true;
      setEditModalVisible(false);
    }
    setFullscreenImages(urls);
    setFullscreenIndex(index >= 0 ? index : 0);
    requestAnimationFrame(() => setFullscreenVisible(true));
  };

  const closeImageFullscreen = () => {
    setFullscreenVisible(false);
    const reopenDelay = Platform.OS === "ios" ? 280 : 0;
    if (detailModalWasOpenRef.current) {
      detailModalWasOpenRef.current = false;
      setTimeout(() => setDetailModalVisible(true), reopenDelay);
    } else if (editModalWasOpenRef.current) {
      editModalWasOpenRef.current = false;
      setTimeout(() => setEditModalVisible(true), reopenDelay);
    }
  };

  const getBrandGalleryUrls = (brand: AdminBrand, images: AdminBrandImage[]) => {
    const urls: string[] = [];
    if (brand.coverImage) urls.push(brand.coverImage);
    images.forEach((img) => {
      if (img.imageUrl && !urls.includes(img.imageUrl)) {
        urls.push(img.imageUrl);
      }
    });
    return urls;
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

  const renderBrandDetailBody = (brand: AdminBrand) => {
    const galleryUrls = getBrandGalleryUrls(brand, detailBrandImages);

    return (
      <>
        {brand.coverImage ? (
          <Pressable
            onPress={() =>
              openImageFullscreen(
                galleryUrls,
                galleryUrls.indexOf(brand.coverImage!),
              )
            }
          >
            <OptimizedImage
              uri={brand.coverImage}
              size={ImageSize.LARGE}
              style={styles.detailCoverImage}
              contentFit="cover"
              lazy={true}
            />
          </Pressable>
        ) : null}

        <Box style={styles.detailMetaCard}>
          {brand.category ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.category")}</Text>
              <Text style={styles.detailMetaValue}>{brand.category}</Text>
            </HStack>
          ) : null}
          {brand.founder ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.founder")}</Text>
              <Text style={styles.detailMetaValue}>{brand.founder}</Text>
            </HStack>
          ) : null}
          {brand.country ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.country")}</Text>
              <Text style={styles.detailMetaValue}>{brand.country}</Text>
            </HStack>
          ) : null}
          {brand.foundedYear ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.foundedYear")}</Text>
              <Text style={styles.detailMetaValue}>{brand.foundedYear}</Text>
            </HStack>
          ) : null}
          {brand.website ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.website")}</Text>
              <Text style={styles.detailMetaValue} numberOfLines={2}>
                {brand.website}
              </Text>
            </HStack>
          ) : null}
          <HStack style={styles.detailMetaRow}>
            <Text style={styles.detailMetaLabel}>ID</Text>
            <Text style={styles.detailMetaValue}>{brand.id}</Text>
          </HStack>
          {brand.createdAt ? (
            <HStack style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>{t("admin.communityCreatedAt")}</Text>
              <Text style={styles.detailMetaValue}>
                {new Date(brand.createdAt).toLocaleDateString()}
              </Text>
            </HStack>
          ) : null}
        </Box>

        <Text style={styles.detailSectionTitle}>{t("admin.brandGallery")}</Text>
        {detailImagesLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.text}
            style={{ marginVertical: 12 }}
          />
        ) : detailBrandImages.length === 0 && !brand.coverImage ? (
          <Text style={styles.detailEmptyImages}>{t("admin.noBrandImages")}</Text>
        ) : (
          <Box style={styles.detailImagesGrid}>
            {detailBrandImages.map((img, idx) => {
              const urlIndex = galleryUrls.indexOf(img.imageUrl);
              return (
                <Pressable
                  key={img.id}
                  style={styles.detailImageItem}
                  onPress={() =>
                    openImageFullscreen(galleryUrls, urlIndex >= 0 ? urlIndex : idx)
                  }
                >
                  <OptimizedImage
                    uri={img.imageUrl}
                    size={ImageSize.MEDIUM}
                    style={styles.detailImageThumb}
                    contentFit="cover"
                    lazy={true}
                  />
                  {img.status === "PENDING" ? (
                    <Box style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>
                        {t("admin.pendingReview")}
                      </Text>
                    </Box>
                  ) : null}
                </Pressable>
              );
            })}
          </Box>
        )}

        <HStack style={styles.detailActions}>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              setDetailModalVisible(false);
              handleOpenEdit(brand);
            }}
            leftIcon={
              <Ionicons name="create-outline" size={14} color={theme.colors.text} />
            }
            style={{ flex: 1, borderColor: theme.colors.border }}
          >
            <ButtonText style={{ color: theme.colors.text, fontSize: 12 }}>
              {t("common.edit")}
            </ButtonText>
          </Button>
          <Button
            size="sm"
            colorScheme="error"
            onPress={() => {
              setDetailModalVisible(false);
              handleDelete(brand);
            }}
            disabled={actionLoading}
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
  };

  const renderCompactBrandCard = (brand: AdminBrand) => (
    <Pressable
      key={brand.id}
      style={styles.compactCard}
      onPress={() => openBrandDetail(brand)}
    >
      <HStack style={styles.compactCardRow}>
        {brand.coverImage ? (
          <OptimizedImage
            uri={brand.coverImage}
            size={ImageSize.THUMBNAIL}
            style={styles.compactThumb}
            contentFit="cover"
            lazy={true}
          />
        ) : (
          <Box style={[styles.compactThumb, styles.compactThumbPlaceholder]}>
            <Ionicons name="pricetag-outline" size={18} color={theme.colors.gray300} />
          </Box>
        )}

        <Box style={styles.compactMain}>
          <Text style={styles.compactName} numberOfLines={1}>
            {brand.name}
          </Text>
          <Text style={styles.compactMeta} numberOfLines={1}>
            {brand.category
              ? `${brand.category} · ID: ${brand.id}`
              : `ID: ${brand.id}`}
          </Text>
        </Box>

        <Ionicons name="chevron-forward" size={18} color={theme.colors.gray300} />
      </HStack>
    </Pressable>
  );

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
            <ActivityIndicator size="small" color={theme.colors.text} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : brands.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="pricetag-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noData")}</Text>
          </Box>
        ) : (
          brands.map(renderCompactBrandCard)
        )}

        {total > 50 && (
          <HStack justifyContent="center" space="md" style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              onPress={() => fetchBrands(page - 1, keyword)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.paginationText}>{t("admin.pagination", { page, total: totalPages })}</Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => fetchBrands(page + 1, keyword)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            </Pressable>
          </HStack>
        )}

        <Box style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={styles.brandDetailModalContent}>
            <HStack style={styles.brandDetailHeader}>
              <Text style={styles.brandDetailTitle} numberOfLines={1}>
                {detailBrand?.name ?? t("admin.brandDetailTitle")}
              </Text>
              <Pressable
                style={styles.brandDetailCloseBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </HStack>
            {detailBrand ? (
              <RNScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.brandDetailScroll}
              >
                {renderBrandDetailBody(detailBrand)}
              </RNScrollView>
            ) : null}
          </Box>
        </Box>
      </Modal>

      <FullscreenImageViewer
        visible={fullscreenVisible && fullscreenImages.length > 0}
        images={fullscreenImages}
        currentIndex={fullscreenIndex}
        onClose={closeImageFullscreen}
        onIndexChange={setFullscreenIndex}
      />

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <Text style={sharedStyles.modalTitle}>{t("admin.editBrand")}</Text>

              <Text style={sharedStyles.formLabel}>
                {t("admin.brandImagesLabel", { selected: selectedCount })}{pendingCount > 0 ? t("admin.brandImagesPending", { count: pendingCount }) : ""}
              </Text>
              <Text style={styles.imageHint}>{t("admin.brandImagesHint")}</Text>
              {brandImagesLoading ? (
                <ActivityIndicator size="small" color={theme.colors.text} style={{ marginVertical: 12 }} />
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
                        onPress={() => {
                          const urls = brandImages.map((i) => i.imageUrl).filter(Boolean);
                          openImageFullscreen(urls, urls.indexOf(img.imageUrl));
                        }}
                        onLongPress={() => handleToggleImageSelected(img)}
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
    height: 40,
  },
  searchButton: {
    backgroundColor: t.colors.text,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  totalText: {
    paddingBottom: 8,
    fontSize: 12,
    color: t.colors.gray400,
  },
  compactCard: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    ...t.shadows.sm,
  },
  compactCardRow: {
    alignItems: "center",
    gap: 10,
  },
  compactThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: t.colors.gray100,
  },
  compactThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  compactMain: {
    flex: 1,
    minWidth: 0,
  },
  compactName: {
    fontSize: 15,
    fontWeight: "600",
    color: t.colors.text,
  },
  compactMeta: {
    fontSize: 11,
    color: t.colors.gray300,
    marginTop: 2,
  },
  brandDetailModalContent: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    height: "88%",
    width: "92%",
    padding: t.spacing.md,
  },
  brandDetailHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.spacing.sm,
    paddingBottom: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  brandDetailTitle: {
    ...t.typography.h4,
    color: t.colors.text,
    flex: 1,
    marginRight: t.spacing.sm,
  },
  brandDetailCloseBtn: {
    padding: t.spacing.xs,
  },
  brandDetailScroll: {
    paddingBottom: t.spacing.lg,
  },
  detailCoverImage: {
    width: "100%",
    height: 180,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.md,
    backgroundColor: t.colors.gray100,
  },
  detailMetaCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  detailMetaRow: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: t.spacing.sm,
  },
  detailMetaLabel: {
    fontSize: 12,
    color: t.colors.gray400,
    flex: 1,
  },
  detailMetaValue: {
    fontSize: 12,
    color: t.colors.text,
    fontWeight: "500",
    flex: 1.2,
    textAlign: "right",
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.gray300,
    marginBottom: t.spacing.sm,
  },
  detailEmptyImages: {
    fontSize: 12,
    color: t.colors.gray300,
    marginBottom: t.spacing.md,
  },
  detailImagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: t.spacing.md,
  },
  detailImageItem: {
    width: 88,
    height: 88,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
  },
  detailImageThumb: {
    width: "100%",
    height: "100%",
  },
  detailActions: {
    gap: t.spacing.sm,
    marginTop: t.spacing.xs,
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
    color: t.colors.gray500,
  },
  editModalContent: {
    height: "85%",
    width: "92%",
    padding: t.spacing.lg,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: t.spacing.sm,
  },
  imageHint: {
    fontSize: 12,
    color: t.colors.gray300,
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
    backgroundColor: t.colors.gray100,
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
    borderColor: t.colors.gray200,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.gray50,
  },
});

export default BrandManagementTab;
