import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import {
  Banner,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from "../../services/bannerService";
import { searchPosts, Post } from "../../services/postService";
import { searchShows, Show } from "../../services/showService";
import { useSharedStyles } from "./adminStyles";
import { getLinkTypeName, pickAndUploadImage } from "./adminUtils";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail";

const BannersTab = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_type: "NONE" as string,
    link_value: "",
    sort_order: 0,
    is_active: true,
  });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<(Post | Show)[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);

  const openBannerImageFullscreen = useCallback(
    (imageUrl: string, scope: "list" | "form" = "list") => {
      if (!imageUrl) return;
      if (scope === "list") {
        const urls = banners.map((b) => b.imageUrl).filter(Boolean);
        const index = urls.indexOf(imageUrl);
        setFullscreenImages(urls);
        setFullscreenIndex(index >= 0 ? index : 0);
      } else {
        setFullscreenImages([imageUrl]);
        setFullscreenIndex(0);
      }
      setFullscreenVisible(true);
    },
    [banners],
  );

  const handleSearch = useCallback(async (keyword: string, linkType: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      if (linkType === "POST") {
        const results = (await searchPosts(keyword.trim(), 20)).posts;
        setSearchResults(results);
      } else if (linkType === "SHOW") {
        const results = await searchShows(keyword.trim(), 20);
        setSearchResults(results);
      }
    } catch (error) {
      console.error("search error:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchInputChange = useCallback((text: string) => {
    setSearchKeyword(text);
  }, []);

  const handleSelectSearchResult = useCallback((item: Post | Show) => {
    setForm((prev) => ({ ...prev, link_value: String(item.id) }));
    setSearchKeyword("");
    setSearchResults([]);
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllBanners();
      setBanners(result);
    } catch (error) {
      console.error("fetchBanners error:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBanners();
    setRefreshing(false);
  }, [fetchBanners]);

  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setForm({
      title: "",
      subtitle: "",
      image_url: "",
      link_type: "NONE",
      link_value: "",
      sort_order: banners.length,
      is_active: true,
    });
    setSearchKeyword("");
    setSearchResults([]);
    setModalVisible(true);
  };

  const handleOpenEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      image_url: banner.imageUrl,
      link_type: banner.linkType,
      link_value: banner.linkValue || "",
      sort_order: banner.sortOrder,
      is_active: banner.isActive,
    });
    setSearchKeyword("");
    setSearchResults([]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert(t("admin.error"), t("admin.bannerTitleRequired"));
      return;
    }
    if (!form.image_url.trim()) {
      Alert.alert(t("admin.error"), t("admin.bannerImageRequired"));
      return;
    }
    try {
      setActionLoading(true);
      if (editingBanner) {
        await updateBanner(editingBanner.id, form);
        Alert.alert(t("common.success"), t("admin.bannerUpdated"));
      } else {
        await createBanner(form);
        Alert.alert(t("common.success"), t("admin.bannerCreated"));
      }
      setModalVisible(false);
      fetchBanners();
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (bannerId: number) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteBanner"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await deleteBanner(bannerId);
            Alert.alert(t("common.success"), t("admin.bannerDeleted"));
            fetchBanners();
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deleteFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (banner: Banner) => {
    try {
      setActionLoading(true);
      await toggleBannerStatus(banner.id);
      Alert.alert(t("common.success"), banner.isActive ? t("admin.bannerDisabled") : t("admin.bannerEnabled"));
      fetchBanners();
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadImage = async () => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([16, 9]);
      if (url) {
        setForm((prev) => ({ ...prev, image_url: url }));
        Alert.alert(t("common.success"), t("admin.imageUploaded"));
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.uploadFailed"));
    } finally {
      setImageUploading(false);
    }
  };

  const renderBannerCard = (banner: Banner) => (
    <Box key={banner.id} style={styles.bannerCard}>
      <Pressable onPress={() => openBannerImageFullscreen(banner.imageUrl)}>
        <OptimizedImage
          uri={banner.imageUrl}
          size={ImageSize.LARGE}
          style={styles.bannerPreviewImage}
          contentFit="cover"
          lazy={true}
        />
      </Pressable>
      <Box style={[styles.bannerStatusBadge, banner.isActive ? styles.bannerStatusActive : styles.bannerStatusInactive]}>
        <Text style={styles.bannerStatusText}>{banner.isActive ? t("admin.communityActiveLabel") : t("admin.communityInactiveLabel")}</Text>
      </Box>
      <Box style={styles.bannerInfo}>
        <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
        {banner.subtitle && <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
        <HStack style={styles.bannerMeta}>
          <Text style={styles.bannerMetaText}>
            {t("admin.bannerLink")}: {getLinkTypeName(banner.linkType)}
            {banner.linkValue && ` → ${banner.linkValue}`}
          </Text>
          <Text style={styles.bannerMetaText}>{t("admin.bannerSort")}: {banner.sortOrder}</Text>
        </HStack>
      </Box>
      <HStack style={styles.bannerActions}>
        <Pressable style={[styles.bannerActionBtn, styles.bannerEditBtn]} onPress={() => handleOpenEditModal(banner)} disabled={actionLoading}>
          <Ionicons name="create-outline" size={18} color={theme.colors.white} />
        </Pressable>
        <Pressable style={[styles.bannerActionBtn, banner.isActive ? styles.bannerDisableBtn : styles.bannerEnableBtn]} onPress={() => handleToggleStatus(banner)} disabled={actionLoading}>
          <Ionicons name={banner.isActive ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.white} />
        </Pressable>
        <Pressable style={[styles.bannerActionBtn, styles.bannerDeleteBtn]} onPress={() => handleDelete(banner.id)} disabled={actionLoading}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
        </Pressable>
      </HStack>
    </Box>
  );

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={styles.bannersList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable style={styles.addBannerButton} onPress={handleOpenCreateModal}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.white} />
          <Text style={styles.addBannerButtonText}>{t("admin.addBanner")}</Text>
        </Pressable>

        {loading && banners.length === 0 ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : banners.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color={theme.colors.gray300} />
            <Text style={sharedStyles.emptyText}>{t("admin.noBanners")}</Text>
            <Text style={sharedStyles.emptySubtext}>{t("admin.noBannersHint")}</Text>
          </Box>
        ) : (
          <>
            <Box style={styles.bannersHeader}>
              <Text style={styles.bannersHeaderText}>{t("admin.totalBanners", { count: banners.length })}</Text>
            </Box>
            {banners.map(renderBannerCard)}
          </>
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* Banner Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.bannerModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <Text style={sharedStyles.modalTitle}>
                {editingBanner ? t("admin.editBanner") : t("admin.createBanner")}
              </Text>

              {form.image_url ? (
                <Pressable onPress={() => openBannerImageFullscreen(form.image_url, "form")}>
                  <OptimizedImage
                    uri={form.image_url}
                    size={ImageSize.MEDIUM}
                    style={styles.bannerFormPreview}
                    contentFit="cover"
                    lazy={true}
                  />
                </Pressable>
              ) : (
                <Box style={styles.bannerFormPlaceholder}>
                  <Ionicons name="image-outline" size={48} color={theme.colors.gray300} />
                  <Text style={styles.bannerFormPlaceholderText}>{t("admin.bannerUploadHint")}</Text>
                </Box>
              )}

              <Pressable style={sharedStyles.uploadImageButton} onPress={handleUploadImage} disabled={imageUploading}>
                {imageUploading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
                    <Text style={sharedStyles.uploadImageButtonText}>
                      {form.image_url ? t("admin.changeImage") : t("admin.uploadImage")}
                    </Text>
                  </>
                )}
              </Pressable>

              <Text style={sharedStyles.formLabel}>{t("admin.bannerTitleLabel")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.bannerTitlePlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={form.title}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, title: text }))}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>{t("admin.bannerSubtitleLabel")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.bannerSubtitlePlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={form.subtitle}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, subtitle: text }))}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>{t("admin.bannerLinkType")}</Text>
              <Box style={sharedStyles.linkTypeContainer}>
                {["NONE", "POST", "BRAND", "SHOW", "EXTERNAL"].map((type) => (
                  <Pressable
                    key={type}
                    style={[sharedStyles.linkTypeButton, form.link_type === type && sharedStyles.linkTypeButtonActive]}
                    onPress={() => { setForm((prev) => ({ ...prev, link_type: type })); setSearchKeyword(""); setSearchResults([]); }}
                  >
                    <Text style={[sharedStyles.linkTypeButtonText, form.link_type === type && sharedStyles.linkTypeButtonTextActive]}>
                      {getLinkTypeName(type)}
                    </Text>
                  </Pressable>
                ))}
              </Box>

              {form.link_type !== "NONE" && (
                <>
                  <Text style={sharedStyles.formLabel}>
                    {form.link_type === "POST" && t("admin.bannerPostId")}
                    {form.link_type === "BRAND" && t("admin.bannerBrandName")}
                    {form.link_type === "SHOW" && t("admin.bannerShowId")}
                    {form.link_type === "EXTERNAL" && t("admin.bannerExternalUrl")}
                  </Text>

                  {(form.link_type === "POST" || form.link_type === "SHOW") && (
                    <Box style={styles.searchSection}>
                      <HStack style={styles.searchInputRow}>
                        <Ionicons name="search-outline" size={18} color={theme.colors.gray300} style={styles.searchIcon} />
                        <Input
                          style={styles.searchInput}
                          placeholder={form.link_type === "POST" ? t("admin.bannerSearchPost") : t("admin.bannerSearchShow")}
                          placeholderTextColor={theme.colors.gray300}
                          value={searchKeyword}
                          onChangeText={(text: string) => handleSearchInputChange(text)}
                          onSubmitEditing={() => handleSearch(searchKeyword, form.link_type)}
                          returnKeyType="search"
                          variant="outline"
                          size="sm"
                        />
                        {searchLoading && <ActivityIndicator size="small" color={theme.colors.gray400} />}
                        {searchKeyword.length > 0 && !searchLoading && (
                          <Pressable onPress={() => { setSearchKeyword(""); setSearchResults([]); }}>
                            <Ionicons name="close-circle" size={18} color={theme.colors.gray300} />
                          </Pressable>
                        )}
                      </HStack>
                      {searchResults.length > 0 && (
                        <ScrollView
                          style={styles.searchResultsList}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {searchResults.map((item) => {
                            const isPost = form.link_type === "POST";
                            const post = isPost ? (item as Post) : null;
                            const show = !isPost ? (item as Show) : null;
                            return (
                              <Pressable
                                key={String(item.id)}
                                style={[
                                  styles.searchResultItem,
                                  String(item.id) === form.link_value && styles.searchResultItemSelected,
                                ]}
                                onPress={() => handleSelectSearchResult(item)}
                              >
                                <Box style={{ flex: 1 }}>
                                  <Text style={styles.searchResultTitle} numberOfLines={1}>
                                    {post ? post.title || post.contentText : `${show!.brand} ${show!.season}`}
                                  </Text>
                                  <Text style={styles.searchResultMeta} numberOfLines={1}>
                                    {post
                                      ? `ID: ${post.id} · ${post.username} · ${post.postType}`
                                      : `ID: ${show!.id}${show!.year ? ` · ${show!.year}` : ""}${show!.category ? ` · ${show!.category}` : ""}`
                                    }
                                  </Text>
                                </Box>
                                {String(item.id) === form.link_value && (
                                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                )}
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      )}
                      {searchKeyword.length > 0 && !searchLoading && searchResults.length === 0 && (
                        <Text style={styles.searchNoResult}>{t("search.noResults")}</Text>
                      )}
                    </Box>
                  )}

                  <Input
                    style={sharedStyles.modalInput}
                    placeholder={
                      form.link_type === "POST" ? t("admin.bannerPostIdPlaceholder") :
                        form.link_type === "BRAND" ? t("admin.bannerBrandNamePlaceholder") :
                          form.link_type === "SHOW" ? t("admin.bannerShowIdPlaceholder") :
                            t("admin.bannerUrlPlaceholder")
                    }
                    placeholderTextColor={theme.colors.gray300}
                    value={form.link_value}
                    onChangeText={(text: string) => setForm((prev) => ({ ...prev, link_value: text }))}
                    autoCapitalize={form.link_type === "EXTERNAL" ? "none" : "characters"}
                    variant="outline"
                    size="md"
                  />
                </>
              )}

              <Text style={sharedStyles.formLabel}>{t("admin.bannerSortLabel")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.sortOrderPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={String(form.sort_order)}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, sort_order: parseInt(text) || 0 }))}
                keyboardType="numeric"
                variant="outline"
                size="md"
              />

              <Pressable style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}>
                <Text style={sharedStyles.formLabel}>{t("admin.activeStatus")}</Text>
                <Box style={[sharedStyles.statusToggleSwitch, form.is_active && sharedStyles.statusToggleSwitchActive]}>
                  <Box style={[sharedStyles.statusToggleThumb, form.is_active && sharedStyles.statusToggleThumbActive]} />
                </Box>
              </Pressable>

              <Box style={sharedStyles.modalButtons}>
                <Button variant="outline" size="sm" onPress={() => setModalVisible(false)}>
                  <ButtonText style={{ color: theme.colors.white }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleSave}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{editingBanner ? t("admin.saveChanges") : t("admin.createBanner")}</ButtonText>
                </Button>
              </Box>
            </ScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>

      {fullscreenImages.length > 0 ? (
        <FullscreenImageViewer
          visible={fullscreenVisible}
          images={fullscreenImages}
          currentIndex={fullscreenIndex}
          onClose={() => setFullscreenVisible(false)}
          onIndexChange={setFullscreenIndex}
        />
      ) : null}
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  bannersList: {
    flex: 1,
    padding: t.spacing.md,
  },
  addBannerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  addBannerButtonText: {
    ...t.typography.button,
    color: t.colors.textInverted,
  },
  bannersHeader: {
    marginBottom: t.spacing.md,
  },
  bannersHeaderText: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
  },
  bannerCard: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    overflow: "hidden",
    marginBottom: t.spacing.md,
    ...t.shadows.sm,
  },
  bannerPreviewImage: {
    width: "100%",
    height: 120,
    backgroundColor: t.colors.gray100,
  },
  bannerStatusBadge: {
    position: "absolute",
    top: t.spacing.sm,
    right: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: t.borderRadius.sm,
  },
  bannerStatusActive: {
    backgroundColor: t.colors.success,
  },
  bannerStatusInactive: {
    backgroundColor: t.colors.gray400,
  },
  bannerStatusText: {
    ...t.typography.caption,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  bannerInfo: {
    padding: t.spacing.md,
  },
  bannerTitle: {
    ...t.typography.h4,
    color: t.colors.text,
    marginBottom: 4,
  },
  bannerSubtitle: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
    marginBottom: t.spacing.sm,
  },
  bannerMeta: {
    justifyContent: "space-between",
  },
  bannerMetaText: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
  bannerActions: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  bannerActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.spacing.md,
  },
  bannerEditBtn: {
    backgroundColor: t.colors.text,
  },
  bannerEnableBtn: {
    backgroundColor: t.colors.success,
  },
  bannerDisableBtn: {
    backgroundColor: "#F59E0B",
  },
  bannerDeleteBtn: {
    backgroundColor: t.colors.error,
  },
  bannerModalContent: {
    height: "85%",
    width: "92%",
    padding: t.spacing.lg,
  },
  bannerFormPreview: {
    width: "100%",
    height: 160,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.md,
    backgroundColor: t.colors.gray100,
  },
  bannerFormPlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.spacing.md,
  },
  bannerFormPlaceholderText: {
    ...t.typography.bodySmall,
    color: t.colors.gray300,
    marginTop: t.spacing.sm,
  },
  searchSection: {
    marginBottom: t.spacing.sm,
  },
  searchInputRow: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.sm,
    minHeight: 44,
    backgroundColor: t.colors.gray100,
  },
  searchIcon: {
    marginRight: t.spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...t.typography.bodySmall,
    color: t.colors.text,
    paddingVertical: t.spacing.sm,
  },
  searchResultsList: {
    marginTop: t.spacing.xs,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderRadius: t.borderRadius.md,
    maxHeight: 200,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  searchResultItemSelected: {
    backgroundColor: t.colors.gray100,
  },
  searchResultTitle: {
    ...t.typography.bodySmall,
    color: t.colors.text,
    fontWeight: "500",
  },
  searchResultMeta: {
    ...t.typography.caption,
    color: t.colors.gray300,
    marginTop: 2,
  },
  searchNoResult: {
    ...t.typography.caption,
    color: t.colors.gray300,
    textAlign: "center",
    paddingVertical: t.spacing.md,
  },
});

export default BannersTab;
