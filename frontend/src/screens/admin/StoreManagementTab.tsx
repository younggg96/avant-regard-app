import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  BuyerStore,
  BuyerStoreCreateParams,
  BuyerStoreUpdateParams,
  getStoresPaginated,
  createStore,
  updateStore,
  deleteStore,
  getAllCountries,
  getAllCities,
} from "../../services/buyerStoreService";
import { useSharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";
import {
  Box,
  HStack,
  VStack,
  Text,
  Input,
  Button,
  ButtonText,
  Pressable,
  ScrollView,
  OptimizedImage,
} from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail";

const PAGE_SIZE = 20;

const EMPTY_CREATE_FORM: BuyerStoreCreateParams = {
  id: "",
  name: "",
  address: "",
  city: "",
  country: "",
  coordinates: { latitude: 0, longitude: 0 },
  brands: [],
  style: [],
  isOpen: true,
  phone: [],
  hours: "",
  description: "",
  images: [],
  rest: "",
};

const StoreManagementTab = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<BuyerStore | null>(null);
  const [editForm, setEditForm] = useState<BuyerStoreUpdateParams>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm, setCreateForm] = useState<BuyerStoreCreateParams>({
    ...EMPTY_CREATE_FORM,
  });
  const [imageUploading, setImageUploading] = useState(false);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailStore, setDetailStore] = useState<BuyerStore | null>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const detailModalWasOpenRef = useRef(false);

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (filterCountry) {
      loadCities(filterCountry);
    } else {
      setCities([]);
      setFilterCity("");
    }
  }, [filterCountry]);

  useEffect(() => {
    fetchStores(1);
  }, [filterCountry, filterCity]);

  const loadCountries = async () => {
    try {
      const result = await getAllCountries();
      setCountries(result);
    } catch {
      setCountries([]);
    }
  };

  const loadCities = async (country: string) => {
    try {
      const result = await getAllCities(country);
      setCities(result);
    } catch {
      setCities([]);
    }
  };

  const fetchStores = useCallback(
    async (p: number = 1) => {
      try {
        setLoading(true);
        const result = await getStoresPaginated({
          searchQuery: keyword || undefined,
          country: filterCountry || undefined,
          city: filterCity || undefined,
          page: p,
          pageSize: PAGE_SIZE,
        });
        setStores(result.stores);
        setTotal(result.total);
        setPage(result.page);
      } catch (error) {
        console.error("fetchStores error:", error);
        Alert.alert(
          t("admin.error"),
          error instanceof Error ? error.message : t("admin.fetchStoresFailed")
        );
      } finally {
        setLoading(false);
      }
    },
    [keyword, filterCountry, filterCity]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStores(1);
    setRefreshing(false);
  }, [fetchStores]);

  const handleSearch = () => {
    fetchStores(1);
  };

  // ==================== Create ====================

  const handleOpenCreate = () => {
    setCreateForm({ ...EMPTY_CREATE_FORM });
    setCreateModalVisible(true);
  };

  const handleCreate = async () => {
    if (!createForm.id.trim() || !createForm.name.trim()) {
      Alert.alert(t("admin.hint"), t("admin.storeIdNameRequired"));
      return;
    }
    if (
      !createForm.address.trim() ||
      !createForm.city.trim() ||
      !createForm.country.trim()
    ) {
      Alert.alert(t("admin.hint"), t("admin.storeAddressRequired"));
      return;
    }
    try {
      setActionLoading(true);
      const payload: BuyerStoreCreateParams = {
        ...createForm,
        brands: parseCommaSeparated(createForm.brands as unknown as string),
        style: parseCommaSeparated(createForm.style as unknown as string),
        phone: parseCommaSeparated(createForm.phone as unknown as string),
        images: Array.isArray(createForm.images) ? createForm.images : [],
      };
      await createStore(payload);
      Alert.alert(t("common.success"), t("admin.storeCreated"));
      setCreateModalVisible(false);
      fetchStores(1);
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.createFailed")
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== Edit ====================

  const handleOpenEdit = (store: BuyerStore) => {
    setEditingStore(store);
    setEditForm({
      name: store.name,
      address: store.address,
      city: store.city,
      country: store.country,
      coordinates: store.coordinates || { latitude: 0, longitude: 0 },
      brands: store.brands || [],
      style: store.style || [],
      isOpen: store.isOpen,
      phone: store.phone || [],
      hours: store.hours || "",
      description: store.description || "",
      images: store.images || [],
      rest: store.rest || "",
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingStore) return;
    try {
      setActionLoading(true);
      const payload: BuyerStoreUpdateParams = {
        ...editForm,
        brands:
          typeof editForm.brands === "string"
            ? parseCommaSeparated(editForm.brands)
            : editForm.brands,
        style:
          typeof editForm.style === "string"
            ? parseCommaSeparated(editForm.style)
            : editForm.style,
        phone:
          typeof editForm.phone === "string"
            ? parseCommaSeparated(editForm.phone)
            : editForm.phone,
        images: Array.isArray(editForm.images) ? editForm.images : [],
      };
      await updateStore(editingStore.id, payload);
      Alert.alert(t("common.success"), t("admin.storeUpdated"));
      setEditModalVisible(false);
      fetchStores(page);
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.updateFailed")
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== Delete ====================

  const handleDelete = (store: BuyerStore) => {
    Alert.alert(
      t("admin.confirmDelete"),
      t("admin.confirmDeleteStore", { name: store.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await deleteStore(store.id);
              Alert.alert(t("admin.deleted"), `${store.name}`);
              fetchStores(page);
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

  // ==================== Image Handlers ====================

  const handleUploadCreateImage = async () => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([4, 3]);
      if (url) {
        setCreateForm((f) => ({ ...f, images: [...(f.images || []), url] }));
      }
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.uploadFailed")
      );
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteCreateImage = (index: number) => {
    setCreateForm((f) => ({
      ...f,
      images: (f.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleUploadEditImage = async () => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([4, 3]);
      if (url) {
        const currentImages = Array.isArray(editForm.images)
          ? editForm.images
          : [];
        setEditForm((f) => ({ ...f, images: [...currentImages, url] }));
      }
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.uploadFailed")
      );
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteEditImage = (index: number) => {
    const currentImages = Array.isArray(editForm.images)
      ? editForm.images
      : [];
    setEditForm((f) => ({
      ...f,
      images: currentImages.filter((_, i) => i !== index),
    }));
  };

  // ==================== Helpers ====================

  const parseCommaSeparated = (val: unknown): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const toEditableString = (val: string[] | undefined): string => {
    return val?.join(", ") || "";
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilterCount = (filterCountry ? 1 : 0) + (filterCity ? 1 : 0);

  const openStoreDetail = (store: BuyerStore) => {
    setDetailStore(store);
    setDetailModalVisible(true);
  };

  const openImageFullscreen = (urls: string[], index: number) => {
    if (!urls.length) return;
    if (detailModalVisible) {
      detailModalWasOpenRef.current = true;
      setDetailModalVisible(false);
    }
    setFullscreenImages(urls);
    setFullscreenIndex(index >= 0 ? index : 0);
    requestAnimationFrame(() => setFullscreenVisible(true));
  };

  const closeImageFullscreen = () => {
    setFullscreenVisible(false);
    if (detailModalWasOpenRef.current) {
      detailModalWasOpenRef.current = false;
      setTimeout(() => setDetailModalVisible(true), Platform.OS === "ios" ? 280 : 0);
    }
  };

  const renderDetailMetaRow = (label: string, value?: string | number | null) => {
    if (value === undefined || value === null || value === "") return null;
    return (
      <HStack style={styles.detailMetaRow}>
        <Text style={styles.detailMetaLabel}>{label}</Text>
        <Text style={styles.detailMetaValue}>{String(value)}</Text>
      </HStack>
    );
  };

  const renderStoreDetailBody = (store: BuyerStore) => {
    const images = store.images || [];

    return (
      <>
        {images.length > 0 ? (
          <Pressable onPress={() => openImageFullscreen(images, 0)}>
            <OptimizedImage
              uri={images[0]}
              size={ImageSize.LARGE}
              style={styles.detailCoverImage}
              contentFit="cover"
              lazy={true}
            />
          </Pressable>
        ) : null}

        <Box style={styles.detailMetaCard}>
          {renderDetailMetaRow(t("admin.address"), store.address)}
          {renderDetailMetaRow(t("admin.country"), store.country)}
          {renderDetailMetaRow(t("admin.city"), store.city)}
          {renderDetailMetaRow("ID", store.id)}
          {renderDetailMetaRow(
            t("admin.businessStatus"),
            store.isOpen ? t("admin.open") : t("admin.closed"),
          )}
          {store.rating !== undefined && store.rating > 0
            ? renderDetailMetaRow(t("admin.rating"), store.rating.toFixed(1))
            : null}
          {store.phone && store.phone.length > 0
            ? renderDetailMetaRow(t("admin.phone"), store.phone.join(", "))
            : null}
          {renderDetailMetaRow(t("admin.hours"), store.hours)}
          {renderDetailMetaRow(t("admin.restDay"), store.rest)}
          {store.coordinates
            ? renderDetailMetaRow(
                t("admin.coordinates"),
                `${store.coordinates.latitude}, ${store.coordinates.longitude}`,
              )
            : null}
          {store.style && store.style.length > 0
            ? renderDetailMetaRow(t("admin.styleTags"), store.style.join(", "))
            : null}
          {store.favoriteCount !== undefined
            ? renderDetailMetaRow(t("admin.favoriteCount"), store.favoriteCount)
            : null}
        </Box>

        {store.description ? (
          <>
            <Text style={styles.detailSectionTitle}>{t("admin.description")}</Text>
            <Text style={styles.detailDescription}>{store.description}</Text>
          </>
        ) : null}

        {store.brands && store.brands.length > 0 ? (
          <>
            <Text style={styles.detailSectionTitle}>{t("admin.brands")}</Text>
            <Text style={styles.detailDescription}>{store.brands.join(", ")}</Text>
          </>
        ) : null}

        <Text style={styles.detailSectionTitle}>{t("admin.storeImages")}</Text>
        {images.length === 0 ? (
          <Text style={styles.detailEmptyImages}>{t("admin.noStoreImages")}</Text>
        ) : (
          <Box style={styles.detailImagesGrid}>
            {images.map((url, idx) => (
              <Pressable
                key={`${store.id}-${idx}`}
                style={styles.detailImageItem}
                onPress={() => openImageFullscreen(images, idx)}
              >
                <OptimizedImage
                  uri={url}
                  size={ImageSize.MEDIUM}
                  style={styles.detailImageThumb}
                  contentFit="cover"
                  lazy={true}
                />
              </Pressable>
            ))}
          </Box>
        )}

        <HStack style={styles.detailActions}>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              setDetailModalVisible(false);
              handleOpenEdit(store);
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
              handleDelete(store);
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

  const renderCompactStoreCard = (store: BuyerStore) => {
    const cover = store.images?.[0];

    return (
      <Pressable
        key={store.id}
        style={styles.compactCard}
        onPress={() => openStoreDetail(store)}
      >
        <HStack style={styles.compactCardRow}>
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.THUMBNAIL}
              style={styles.compactThumb}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <Box style={[styles.compactThumb, styles.compactThumbPlaceholder]}>
              <Ionicons name="storefront-outline" size={18} color={theme.colors.gray300} />
            </Box>
          )}

          <Box style={styles.compactMain}>
            <Text style={styles.compactName} numberOfLines={1}>
              {store.name}
            </Text>
            <Text style={styles.compactMeta} numberOfLines={1}>
              {[store.city, store.country].filter(Boolean).join(" · ")}
            </Text>
          </Box>

          <HStack style={styles.compactStatus}>
            <Box
              style={[
                styles.statusDot,
                {
                  backgroundColor: store.isOpen
                    ? theme.colors.success
                    : theme.colors.gray300,
                },
              ]}
            />
            <Text
              style={[
                styles.compactStatusText,
                {
                  color: store.isOpen
                    ? theme.colors.success
                    : theme.colors.gray300,
                },
              ]}
            >
              {store.isOpen ? t("admin.open") : t("admin.closed")}
            </Text>
          </HStack>

          <Ionicons name="chevron-forward" size={18} color={theme.colors.gray300} />
        </HStack>
      </Pressable>
    );
  };

  // ==================== Sub-renderers ====================

  const renderImageGrid = (
    images: string[],
    onDelete: (idx: number) => void,
    onUpload: () => void
  ) => (
    <HStack style={styles.imagesGrid}>
      {images.map((url, idx) => (
        <Box key={idx} style={styles.imageItem}>
          <OptimizedImage
            uri={url}
            size={ImageSize.THUMBNAIL}
            style={styles.imageThumb}
            contentFit="cover"
          />
          <Pressable style={styles.imageDeleteBtn} onPress={() => onDelete(idx)}>
            <Ionicons name="close-circle" size={20} color={theme.colors.error} />
          </Pressable>
        </Box>
      ))}
      <Pressable
        style={styles.imageAddBtn}
        onPress={onUpload}
        disabled={imageUploading}
      >
        {imageUploading ? (
          <ActivityIndicator size="small" color={theme.colors.gray300} />
        ) : (
          <Ionicons name="add" size={28} color={theme.colors.gray300} />
        )}
      </Pressable>
    </HStack>
  );

  const renderFormField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options?: {
      placeholder?: string;
      required?: boolean;
      multiline?: boolean;
      keyboardType?: "default" | "numeric" | "url" | "number-pad";
      autoCapitalize?: "none" | "sentences" | "words" | "characters";
      maxLength?: number;
    }
  ) => (
    <VStack space="xs" style={{ marginTop: theme.spacing.sm }}>
      <Text style={sharedStyles.formLabel}>
        {label}
        {options?.required ? " *" : ""}
      </Text>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={options?.placeholder || label}
        placeholderTextColor={theme.colors.gray300}
        variant="outline"
        size="md"
        multiline={options?.multiline}
        style={options?.multiline ? { minHeight: 60, textAlignVertical: "top" as any } : undefined}
        keyboardType={options?.keyboardType}
        autoCapitalize={options?.autoCapitalize}
        maxLength={options?.maxLength}
      />
    </VStack>
  );

  // ==================== Render ====================

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search & Actions */}
        <HStack space="sm" style={styles.topRow}>
          <Input
            style={styles.searchInput}
            placeholder={t("admin.searchStorePlaceholder")}
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
          <Pressable
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilter(!showFilter)}
          >
            <Ionicons
              name="filter"
              size={18}
              color={activeFilterCount > 0 ? theme.colors.white : theme.colors.text}
            />
            {activeFilterCount > 0 && (
              <Text style={styles.filterBadge}>{activeFilterCount}</Text>
            )}
          </Pressable>
          <Button size="sm" onPress={handleOpenCreate} style={styles.createButton}>
            <Ionicons name="add" size={18} color={theme.colors.white} />
            <ButtonText style={styles.createButtonText}>{t("admin.add")}</ButtonText>
          </Button>
        </HStack>

        {/* Filter Panel */}
        {showFilter && (
          <VStack style={styles.filterPanel}>
            <Box style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t("admin.country")}</Text>
              <RNScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChips}
              >
                <Pressable
                  style={[styles.filterChip, !filterCountry && styles.filterChipActive]}
                  onPress={() => setFilterCountry("")}
                >
                  <Text style={[styles.filterChipText, !filterCountry && styles.filterChipTextActive]}>
                    {t("common.all")}
                  </Text>
                </Pressable>
                {countries.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.filterChip, filterCountry === c && styles.filterChipActive]}
                    onPress={() => setFilterCountry(filterCountry === c ? "" : c)}
                  >
                    <Text style={[styles.filterChipText, filterCountry === c && styles.filterChipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </RNScrollView>
            </Box>
            {filterCountry && cities.length > 0 && (
              <Box style={styles.filterRow}>
                <Text style={styles.filterLabel}>{t("admin.city")}</Text>
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterChips}
                >
                  <Pressable
                    style={[styles.filterChip, !filterCity && styles.filterChipActive]}
                    onPress={() => setFilterCity("")}
                  >
                    <Text style={[styles.filterChipText, !filterCity && styles.filterChipTextActive]}>
                      {t("common.all")}
                    </Text>
                  </Pressable>
                  {cities.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.filterChip, filterCity === c && styles.filterChipActive]}
                      onPress={() => setFilterCity(filterCity === c ? "" : c)}
                    >
                      <Text style={[styles.filterChipText, filterCity === c && styles.filterChipTextActive]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </RNScrollView>
              </Box>
            )}
          </VStack>
        )}

        <Text style={styles.totalText}>{t("admin.totalStores", { count: total })}</Text>

        {/* Store List */}
        {loading ? (
          <VStack style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.text} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </VStack>
        ) : stores.length === 0 ? (
          <VStack style={sharedStyles.emptyContainer}>
            <Ionicons name="storefront-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noStores")}</Text>
          </VStack>
        ) : (
          stores.map(renderCompactStoreCard)
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <HStack justifyContent="center" space="md" style={styles.pagination}>
            <Pressable
              disabled={page <= 1}
              onPress={() => fetchStores(page - 1)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.paginationText}>
              {t("admin.pagination", { page, total: totalPages })}
            </Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => fetchStores(page + 1)}
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
          <Box style={styles.storeDetailModalContent}>
            <HStack style={styles.storeDetailHeader}>
              <Text style={styles.storeDetailTitle} numberOfLines={1}>
                {detailStore?.name ?? t("admin.storeDetailTitle")}
              </Text>
              <Pressable
                style={styles.storeDetailCloseBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </HStack>
            {detailStore ? (
              <RNScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.storeDetailScroll}
              >
                {renderStoreDetailBody(detailStore)}
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

      {/* Create Store Modal */}
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
          <Box style={[sharedStyles.modalContent, styles.formModalContent]}>
            <RNScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={sharedStyles.modalTitle}>{t("admin.createStore")}</Text>

              {renderFormField(t("admin.storeId"), createForm.id, (v) =>
                setCreateForm((f) => ({ ...f, id: v })),
                { placeholder: t("admin.storeIdPlaceholder"), required: true, autoCapitalize: "none" }
              )}

              {renderFormField(t("admin.storeName"), createForm.name, (v) =>
                setCreateForm((f) => ({ ...f, name: v })),
                { required: true }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.country")} *</Text>
                  <Input
                    value={createForm.country}
                    onChangeText={(v) => setCreateForm((f) => ({ ...f, country: v }))}
                    placeholder={t("admin.countryPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.city")} *</Text>
                  <Input
                    value={createForm.city}
                    onChangeText={(v) => setCreateForm((f) => ({ ...f, city: v }))}
                    placeholder={t("admin.cityPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
              </HStack>

              {renderFormField(t("admin.address"), createForm.address, (v) =>
                setCreateForm((f) => ({ ...f, address: v })),
                { required: true, multiline: true }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.latitude")}</Text>
                  <Input
                    value={String(createForm.coordinates.latitude || "")}
                    onChangeText={(v) =>
                      setCreateForm((f) => ({
                        ...f,
                        coordinates: { ...f.coordinates, latitude: parseFloat(v) || 0 },
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="numeric"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.longitude")}</Text>
                  <Input
                    value={String(createForm.coordinates.longitude || "")}
                    onChangeText={(v) =>
                      setCreateForm((f) => ({
                        ...f,
                        coordinates: { ...f.coordinates, longitude: parseFloat(v) || 0 },
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="numeric"
                  />
                </VStack>
              </HStack>

              {renderFormField(
                t("admin.brands"),
                toEditableString(createForm.brands),
                (v) => setCreateForm((f) => ({ ...f, brands: v as any })),
                { placeholder: t("admin.brandsPlaceholder") }
              )}

              {renderFormField(
                t("admin.styleTags"),
                toEditableString(createForm.style),
                (v) => setCreateForm((f) => ({ ...f, style: v as any })),
                { placeholder: t("admin.styleTagsPlaceholder") }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.phone")}</Text>
                  <Input
                    value={toEditableString(createForm.phone)}
                    onChangeText={(v) => setCreateForm((f) => ({ ...f, phone: v as any }))}
                    placeholder={t("admin.commaSeparated")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.hours")}</Text>
                  <Input
                    value={createForm.hours || ""}
                    onChangeText={(v) => setCreateForm((f) => ({ ...f, hours: v }))}
                    placeholder={t("admin.hoursPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
              </HStack>

              {renderFormField(
                t("admin.description"),
                createForm.description || "",
                (v) => setCreateForm((f) => ({ ...f, description: v })),
                { multiline: true }
              )}

              <VStack space="xs" style={{ marginTop: theme.spacing.sm }}>
                <Text style={sharedStyles.formLabel}>
                  {t("admin.storeImages")}（{(createForm.images || []).length}）
                </Text>
                {renderImageGrid(
                  createForm.images || [],
                  handleDeleteCreateImage,
                  handleUploadCreateImage
                )}
              </VStack>

              <HStack justifyContent="between" style={styles.switchRow}>
                <Text style={sharedStyles.formLabel}>{t("admin.businessStatus")}</Text>
                <Switch
                  value={createForm.isOpen}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, isOpen: v }))}
                  trackColor={{ false: theme.colors.gray200, true: theme.colors.success }}
                />
              </HStack>

              <HStack justifyContent="end" space="sm" style={{ marginTop: theme.spacing.lg }}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setCreateModalVisible(false)}
                >
                  <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleCreate}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{t("admin.create")}</ButtonText>
                </Button>
              </HStack>
            </RNScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Store Modal */}
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
          <Box style={[sharedStyles.modalContent, styles.formModalContent]}>
            <RNScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={sharedStyles.modalTitle}>{t("admin.editStore")}</Text>

              {renderFormField(t("admin.storeName"), editForm.name || "", (v) =>
                setEditForm((f) => ({ ...f, name: v }))
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.country")}</Text>
                  <Input
                    value={editForm.country || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, country: v }))}
                    placeholder={t("admin.country")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.city")}</Text>
                  <Input
                    value={editForm.city || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, city: v }))}
                    placeholder={t("admin.city")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
              </HStack>

              {renderFormField(t("admin.address"), editForm.address || "", (v) =>
                setEditForm((f) => ({ ...f, address: v })),
                { multiline: true }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.latitude")}</Text>
                  <Input
                    value={String(editForm.coordinates?.latitude || "")}
                    onChangeText={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        coordinates: {
                          latitude: parseFloat(v) || 0,
                          longitude: f.coordinates?.longitude || 0,
                        },
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="numeric"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.longitude")}</Text>
                  <Input
                    value={String(editForm.coordinates?.longitude || "")}
                    onChangeText={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        coordinates: {
                          latitude: f.coordinates?.latitude || 0,
                          longitude: parseFloat(v) || 0,
                        },
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="numeric"
                  />
                </VStack>
              </HStack>

              {renderFormField(
                t("admin.brands"),
                typeof editForm.brands === "string"
                  ? editForm.brands
                  : toEditableString(editForm.brands),
                (v) => setEditForm((f) => ({ ...f, brands: v as any })),
                { placeholder: t("admin.commaSeparated") }
              )}

              {renderFormField(
                t("admin.styleTags"),
                typeof editForm.style === "string"
                  ? editForm.style
                  : toEditableString(editForm.style),
                (v) => setEditForm((f) => ({ ...f, style: v as any })),
                { placeholder: t("admin.commaSeparated") }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.phone")}</Text>
                  <Input
                    value={
                      typeof editForm.phone === "string"
                        ? editForm.phone
                        : toEditableString(editForm.phone)
                    }
                    onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v as any }))}
                    placeholder={t("admin.commaSeparated")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>{t("admin.hours")}</Text>
                  <Input
                    value={editForm.hours || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, hours: v }))}
                    placeholder={t("admin.hoursPlaceholder")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                  />
                </VStack>
              </HStack>

              {renderFormField(t("admin.restDay"), editForm.rest || "", (v) =>
                setEditForm((f) => ({ ...f, rest: v })),
                { placeholder: t("admin.restDayPlaceholder") }
              )}

              {renderFormField(t("admin.description"), editForm.description || "", (v) =>
                setEditForm((f) => ({ ...f, description: v })),
                { multiline: true }
              )}

              <VStack space="xs" style={{ marginTop: theme.spacing.sm }}>
                <Text style={sharedStyles.formLabel}>
                  {t("admin.storeImages")}（{(Array.isArray(editForm.images) ? editForm.images : []).length}）
                </Text>
                {renderImageGrid(
                  Array.isArray(editForm.images) ? editForm.images : [],
                  handleDeleteEditImage,
                  handleUploadEditImage
                )}
              </VStack>

              <HStack justifyContent="between" style={styles.switchRow}>
                <Text style={sharedStyles.formLabel}>{t("admin.businessStatus")}</Text>
                <Switch
                  value={editForm.isOpen ?? true}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, isOpen: v }))}
                  trackColor={{ false: theme.colors.gray200, true: theme.colors.success }}
                />
              </HStack>

              <HStack justifyContent="end" space="sm" style={{ marginTop: theme.spacing.lg }}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setEditModalVisible(false)}
                >
                  <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleSave}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{t("admin.saveChanges")}</ButtonText>
                </Button>
              </HStack>
            </RNScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  topRow: {
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
  filterButton: {
    backgroundColor: t.colors.gray100,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: t.colors.text,
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: t.colors.error,
    borderRadius: 8,
    width: 16,
    height: 16,
    textAlign: "center",
    fontSize: 10,
    color: t.colors.textInverted,
    fontWeight: "600",
    lineHeight: 16,
    overflow: "hidden",
  },
  createButton: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  filterPanel: {
    backgroundColor: t.colors.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.gray400,
    marginBottom: 6,
  },
  filterChips: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: t.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: t.colors.gray200,
  },
  filterChipActive: {
    backgroundColor: t.colors.text,
    borderColor: t.colors.text,
  },
  filterChipText: {
    fontSize: 12,
    color: t.colors.gray400,
  },
  filterChipTextActive: {
    color: t.colors.textInverted,
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
  compactStatus: {
    alignItems: "center",
    gap: 4,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  storeDetailModalContent: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    height: "88%",
    width: "92%",
    padding: t.spacing.md,
  },
  storeDetailHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.spacing.sm,
    paddingBottom: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  storeDetailTitle: {
    ...t.typography.h4,
    color: t.colors.text,
    flex: 1,
    marginRight: t.spacing.sm,
  },
  storeDetailCloseBtn: {
    padding: t.spacing.xs,
  },
  storeDetailScroll: {
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
    marginBottom: t.spacing.xs,
  },
  detailDescription: {
    fontSize: 13,
    color: t.colors.text,
    lineHeight: 19,
    marginBottom: t.spacing.md,
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  storeMeta: {
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  metaChip: {
    fontSize: 11,
    color: t.colors.gray400,
    backgroundColor: t.colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  ratingChip: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  brandsText: {
    fontSize: 12,
    color: t.colors.gray400,
    marginTop: 4,
    lineHeight: 18,
  },
  storeId: {
    fontSize: 11,
    color: t.colors.gray300,
    marginTop: 4,
  },
  editButton: {
    borderColor: t.colors.gray200,
    gap: 4,
  },
  pagination: {
    paddingVertical: 16,
  },
  paginationText: {
    fontSize: 14,
    color: t.colors.gray500,
  },
  formModalContent: {
    height: "85%",
    width: "92%",
    padding: t.spacing.lg,
  },
  switchRow: {
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  imagesGrid: {
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  imageItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.colors.gray200,
  },
  imageThumb: {
    width: "100%",
    height: "100%",
    backgroundColor: t.colors.gray100,
  },
  imageDeleteBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
  },
  imageAddBtn: {
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
  listImagesRow: {
    flexDirection: "row",
    marginBottom: 8,
    flexGrow: 0,
  },
  listImageThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: t.colors.gray100,
  },
  listImageMore: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  listImageMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: t.colors.gray400,
  },
});

export default StoreManagementTab;
