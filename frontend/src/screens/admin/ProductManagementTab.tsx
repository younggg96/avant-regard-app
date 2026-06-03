import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Modal,
  ActivityIndicator,
  ScrollView as RNScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  adminListAllProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminSetListingCurated,
  centsToPriceInput,
  parsePriceInputToCents,
  type StoreProduct,
  type StoreProductCreateParams,
  type StoreProductUpdateParams,
  type ProductStatus,
} from "../../services/storeProductService";
import { useFormatPrice } from "../../utils/currency";
import { useSharedStyles } from "./adminStyles";
import { pickAndUploadImage, formatAdminDate } from "./adminUtils";
import {
  AnimatedChip,
  Box,
  chipRowStyle,
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
import { Alert as RNAlert } from "react-native";
import { Alert } from "../../utils/Alert";

const PAGE_SIZE = 20;

const STATUS_VALUES = [
  "",
  "active",
  "draft",
  "reviewing",
  "sold",
  "offline",
  "rejected",
  "frozen",
] as const;

const STATUS_I18N_KEYS: Record<string, string> = {
  active: "trading.myListings.tabActive",
  draft: "trading.myListings.tabDraft",
  reviewing: "trading.myListings.tabReviewing",
  sold: "trading.myListings.tabSold",
  offline: "trading.myListings.tabOffline",
  rejected: "trading.myListings.tabRejected",
  frozen: "trading.myListings.statusFrozen",
};

const EDITABLE_STATUS_VALUES = STATUS_VALUES.filter((v) => v !== "");

const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  draft: "#9CA3AF",
  reviewing: "#F59E0B",
  sold: "#6366F1",
  offline: "#EF4444",
  rejected: "#DC2626",
  frozen: "#3B82F6",
};

interface ProductForm {
  title: string;
  brand: string;
  description: string;
  priceCentsInput: string;
  discountPriceCentsInput: string;
  currency: string;
  size: string;
  color: string;
  condition: string;
  conditionNote: string;
  tags: string;
  images: string[];
  isNew: boolean;
  status: ProductStatus;
}

const EMPTY_FORM: ProductForm = {
  title: "",
  brand: "",
  description: "",
  priceCentsInput: "",
  discountPriceCentsInput: "",
  currency: "CNY",
  size: "",
  color: "",
  condition: "",
  conditionNote: "",
  tags: "",
  images: [],
  isNew: false,
  status: "active" as ProductStatus,
};

const ProductManagementTab = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();

  const getStatusLabel = useCallback(
    (status: string) => {
      if (!status) return t("common.all");
      const key = STATUS_I18N_KEYS[status];
      return key ? t(key) : status;
    },
    [t],
  );

  const getSellerKindLabel = useCallback(
    (sellerKind?: string | null) =>
      sellerKind === "merchant"
        ? t("trading.marketplace.sellerMerchant")
        : t("trading.marketplace.sellerIndividual"),
    [t],
  );

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm, setCreateForm] = useState<ProductForm>({ ...EMPTY_FORM });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>({ ...EMPTY_FORM });

  const fetchProducts = useCallback(
    async (p: number = 1) => {
      try {
        setLoading(true);
        const result = await adminListAllProducts({
          status: filterStatus as ProductStatus | "",
          q: keyword || undefined,
          page: p,
          pageSize: PAGE_SIZE,
        });
        setProducts(result.products);
        setTotal(result.total);
        setPage(result.page);
      } catch (error) {
        Alert.show(
          error instanceof Error ? error.message : t("common.failed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [keyword, filterStatus, t],
  );

  useEffect(() => {
    fetchProducts(1);
  }, [filterStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts(1);
    setRefreshing(false);
  }, [fetchProducts]);

  const handleSearch = () => fetchProducts(1);

  // ==================== Create ====================

  const handleOpenCreate = () => {
    setCreateForm({ ...EMPTY_FORM });
    setCreateModalVisible(true);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      Alert.show(t("admin.productMgmt.titleRequired"));
      return;
    }
    const priceCents = parsePriceInputToCents(createForm.priceCentsInput);
    if (priceCents == null || priceCents <= 0) {
      Alert.show(t("admin.productMgmt.priceRequired"));
      return;
    }
    try {
      setActionLoading(true);
      const discountCents = parsePriceInputToCents(createForm.discountPriceCentsInput);
      const payload: StoreProductCreateParams & { sellerKind?: any; status?: any } = {
        title: createForm.title.trim(),
        brand: createForm.brand.trim() || undefined,
        description: createForm.description.trim() || undefined,
        priceCents,
        currency: createForm.currency || "CNY",
        discountPriceCents: discountCents,
        isNew: createForm.isNew,
        images: createForm.images,
        tags: createForm.tags
          ? createForm.tags.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        status: createForm.status,
        sellerKind: "individual",
      };
      await adminCreateProduct(payload);
      Alert.show(t("admin.productMgmt.createdSuccess"));
      setCreateModalVisible(false);
      fetchProducts(1);
    } catch (error) {
      Alert.show(
        error instanceof Error ? error.message : t("admin.createFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== Edit ====================

  const handleOpenEdit = (product: StoreProduct) => {
    setEditingProduct(product);
    setEditForm({
      title: product.title,
      brand: product.brand || "",
      description: product.description || "",
      priceCentsInput: centsToPriceInput(product.priceCents),
      discountPriceCentsInput: centsToPriceInput(product.discountPriceCents),
      currency: product.currency || "CNY",
      size: product.size || "",
      color: product.color || "",
      condition: product.condition || "",
      conditionNote: product.conditionNote || "",
      tags: product.tags?.join(", ") || "",
      images: product.images || [],
      isNew: product.isNew,
      status: product.status,
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingProduct) return;
    try {
      setActionLoading(true);
      const priceCents = parsePriceInputToCents(editForm.priceCentsInput);
      const discountCents = parsePriceInputToCents(editForm.discountPriceCentsInput);
      const payload: StoreProductUpdateParams & { status?: ProductStatus } = {
        title: editForm.title.trim(),
        brand: editForm.brand.trim() || undefined,
        description: editForm.description.trim() || undefined,
        priceCents: priceCents ?? undefined,
        currency: editForm.currency,
        discountPriceCents: discountCents,
        isNew: editForm.isNew,
        images: editForm.images,
        tags: editForm.tags
          ? editForm.tags.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        status: editForm.status,
      };
      await adminUpdateProduct(editingProduct.id, payload);
      Alert.show(t("admin.productMgmt.updatedSuccess"));
      setEditModalVisible(false);
      fetchProducts(page);
    } catch (error) {
      Alert.show(
        error instanceof Error ? error.message : t("admin.updateFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== 策展（「大家都在看」） ====================
  // 管理员一键把单品标记 / 取消「大家都在看」（migration 065 新增）。
  // 标记后该单品会出现在 marketplace 顶部 popular picks 段，按 curated_sort_order asc。
  const handleToggleCurated = async (product: StoreProduct) => {
    try {
      setActionLoading(true);
      await adminSetListingCurated(product.id, !product.isCurated);
      Alert.show(t("admin.productMgmt.curatedToggleSuccess"));
      // 局部更新避免整页 refetch 抖动
      setProducts((list) =>
        list.map((p) =>
          p.id === product.id ? { ...p, isCurated: !product.isCurated } : p,
        ),
      );
    } catch (error) {
      Alert.show(
        error instanceof Error ? error.message : t("admin.operationFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== Delete ====================

  const handleDelete = (product: StoreProduct) => {
    RNAlert.alert(
      t("admin.confirmDelete"),
      t("admin.productMgmt.deleteConfirmMessage", { title: product.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminDeleteProduct(product.id);
              Alert.show(t("admin.productMgmt.deletedSuccess"));
              fetchProducts(page);
            } catch (error) {
              Alert.show(
                error instanceof Error ? error.message : t("admin.deleteFailed"),
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

  const handleUploadImage = async (
    setter: React.Dispatch<React.SetStateAction<ProductForm>>
  ) => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([1, 1]);
      if (url) {
        setter((f) => ({ ...f, images: [...f.images, url] }));
      }
    } catch (error) {
      Alert.show(
        error instanceof Error ? error.message : t("admin.uploadFailed"),
      );
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteImage = (
    setter: React.Dispatch<React.SetStateAction<ProductForm>>,
    index: number
  ) => {
    setter((f) => ({
      ...f,
      images: f.images.filter((_, i) => i !== index),
    }));
  };

  // ==================== Helpers ====================

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
            <Ionicons name="close-circle" size={18} color={theme.colors.error} />
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
          <Ionicons name="add" size={24} color={theme.colors.gray300} />
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
      keyboardType?: "default" | "numeric" | "decimal-pad";
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
        style={
          options?.multiline
            ? { minHeight: 60, textAlignVertical: "top" as any }
            : undefined
        }
        keyboardType={options?.keyboardType}
      />
    </VStack>
  );

  const renderStatusPicker = (
    currentStatus: ProductStatus,
    onChange: (s: ProductStatus) => void
  ) => (
    <VStack space="xs" style={{ marginTop: theme.spacing.sm }}>
      <Text style={sharedStyles.formLabel}>{t("admin.productMgmt.status")}</Text>
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
      >
        <View style={chipRowStyle}>
          {EDITABLE_STATUS_VALUES.map((value) => (
            <AnimatedChip
              key={value}
              label={getStatusLabel(value)}
              isActive={currentStatus === value}
              onPress={() => onChange(value as ProductStatus)}
            />
          ))}
        </View>
      </RNScrollView>
    </VStack>
  );

  const renderProductFormModal = (
    visible: boolean,
    title: string,
    form: ProductForm,
    setForm: React.Dispatch<React.SetStateAction<ProductForm>>,
    onSubmit: () => void,
    onClose: () => void,
    submitLabel: string
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
              <Text style={sharedStyles.modalTitle}>{title}</Text>

              {renderFormField(t("admin.productMgmt.fieldTitle"), form.title, (v) =>
                setForm((f) => ({ ...f, title: v })),
                { required: true }
              )}

              {renderFormField(t("admin.productMgmt.fieldBrand"), form.brand, (v) =>
                setForm((f) => ({ ...f, brand: v }))
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>
                    {t("admin.productMgmt.fieldPrice")} *
                  </Text>
                  <Input
                    value={form.priceCentsInput}
                    onChangeText={(v) => setForm((f) => ({ ...f, priceCentsInput: v }))}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="decimal-pad"
                  />
                </VStack>
                <VStack space="xs" style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>
                    {t("admin.productMgmt.fieldDiscountPrice")}
                  </Text>
                  <Input
                    value={form.discountPriceCentsInput}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, discountPriceCentsInput: v }))
                    }
                    placeholder={t("admin.productMgmt.discountOptional")}
                    placeholderTextColor={theme.colors.gray300}
                    variant="outline"
                    size="md"
                    keyboardType="decimal-pad"
                  />
                </VStack>
              </HStack>

              {renderFormField(t("admin.productMgmt.fieldDescription"), form.description, (v) =>
                setForm((f) => ({ ...f, description: v })),
                { multiline: true }
              )}

              <HStack space="sm" style={{ marginTop: theme.spacing.sm }}>
                {renderFormField(t("admin.productMgmt.fieldSize"), form.size, (v) =>
                  setForm((f) => ({ ...f, size: v })),
                  { placeholder: t("admin.productMgmt.sizePlaceholder") }
                )}
                {renderFormField(t("admin.productMgmt.fieldColor"), form.color, (v) =>
                  setForm((f) => ({ ...f, color: v })),
                  { placeholder: t("admin.productMgmt.colorPlaceholder") }
                )}
              </HStack>

              {renderFormField(
                t("admin.productMgmt.fieldConditionNote"),
                form.conditionNote,
                (v) => setForm((f) => ({ ...f, conditionNote: v })),
                { multiline: true },
              )}

              {renderFormField(t("admin.productMgmt.fieldTags"), form.tags, (v) =>
                setForm((f) => ({ ...f, tags: v })),
                { placeholder: t("admin.productMgmt.tagsPlaceholder") },
              )}

              <VStack space="xs" style={{ marginTop: theme.spacing.sm }}>
                <Text style={sharedStyles.formLabel}>
                  {t("admin.productMgmt.fieldImages", {
                    count: form.images.length,
                  })}
                </Text>
                {renderImageGrid(
                  form.images,
                  (idx) => handleDeleteImage(setForm, idx),
                  () => handleUploadImage(setForm)
                )}
              </VStack>

              {renderStatusPicker(form.status, (s) =>
                setForm((f) => ({ ...f, status: s }))
              )}

              <HStack
                justifyContent="end"
                space="sm"
                style={{ marginTop: theme.spacing.lg }}
              >
                <Button variant="outline" size="sm" onPress={onClose}>
                  <ButtonText style={{ color: theme.colors.gray400 }}>
                    {t("common.cancel")}
                  </ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={onSubmit}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{submitLabel}</ButtonText>
                </Button>
              </HStack>
            </RNScrollView>
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </Modal>
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
            placeholder={t("admin.productMgmt.searchPlaceholder")}
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
          <Button
            size="sm"
            onPress={handleOpenCreate}
            style={styles.createButton}
          >
            <Ionicons name="add" size={16} color={theme.colors.white} />
            <ButtonText style={styles.createButtonText}>
              {t("admin.productMgmt.create")}
            </ButtonText>
          </Button>
        </HStack>

        {/* Status Filter */}
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
        >
          <View style={chipRowStyle}>
            {STATUS_VALUES.map((value) => (
              <AnimatedChip
                key={value || "all"}
                label={getStatusLabel(value)}
                isActive={filterStatus === value}
                onPress={() => setFilterStatus(value)}
              />
            ))}
          </View>
        </RNScrollView>

        <Text style={styles.totalText}>
          {t("admin.productMgmt.totalCount", { count: total })}
        </Text>

        {/* Product List */}
        {loading ? (
          <VStack style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.text} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </VStack>
        ) : products.length === 0 ? (
          <VStack style={sharedStyles.emptyContainer}>
            <Ionicons
              name="cube-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>
              {t("admin.productMgmt.empty")}
            </Text>
          </VStack>
        ) : (
          products.map((product) => (
            <Box key={product.id} style={sharedStyles.postCard}>
              <HStack
                justifyContent="between"
                style={{ marginBottom: theme.spacing.sm }}
              >
                <Box style={{ flex: 1, marginRight: 8 }}>
                  <Text style={sharedStyles.postTitle} numberOfLines={1}>
                    {product.title}
                  </Text>
                </Box>
                {product.isCurated ? (
                  <Box style={[styles.statusBadge, styles.curatedBadge]}>
                    <Ionicons
                      name="star"
                      size={10}
                      color={theme.colors.accent}
                      style={{ marginRight: 2 }}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t("admin.productMgmt.curatedBadge")}
                    </Text>
                  </Box>
                ) : null}
                <Box
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        (STATUS_COLORS[product.status] || "#9CA3AF") + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: STATUS_COLORS[product.status] || "#9CA3AF",
                      },
                    ]}
                  >
                    {getStatusLabel(product.status)}
                  </Text>
                </Box>
              </HStack>

              {product.images && product.images.length > 0 && (
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.listImagesRow}
                >
                  {product.images.slice(0, 5).map((url, idx) => (
                    <OptimizedImage
                      key={idx}
                      uri={url}
                      size={ImageSize.THUMBNAIL}
                      style={styles.listImageThumb}
                      contentFit="cover"
                      lazy={true}
                    />
                  ))}
                  {product.images.length > 5 && (
                    <Box style={styles.listImageMore}>
                      <Text style={styles.listImageMoreText}>
                        +{product.images.length - 5}
                      </Text>
                    </Box>
                  )}
                </RNScrollView>
              )}

              <HStack style={styles.metaRow}>
                {product.brand ? (
                  <Text style={styles.metaChip}>{product.brand}</Text>
                ) : null}
                {product.size ? (
                  <Text style={styles.metaChip}>{product.size}</Text>
                ) : null}
                {product.color ? (
                  <Text style={styles.metaChip}>{product.color}</Text>
                ) : null}
                {product.condition ? (
                  <Text style={styles.metaChip}>{product.condition}</Text>
                ) : null}
                <Text style={styles.metaChip}>
                  {getSellerKindLabel(product.sellerKind)}
                </Text>
              </HStack>

              <HStack
                justifyContent="between"
                style={{ marginTop: 4 }}
              >
                <Text style={styles.priceText}>
                  {formatPrice(product.priceCents, product.currency)}
                  {product.discountPriceCents
                    ? ` → ${formatPrice(product.discountPriceCents, product.currency)}`
                    : ""}
                </Text>
                <HStack space="sm">
                  <Text style={styles.statText}>
                    <Ionicons name="heart-outline" size={11} /> {product.likeCount}
                  </Text>
                  <Text style={styles.statText}>
                    <Ionicons name="eye-outline" size={11} /> {product.viewCount}
                  </Text>
                  <Text style={styles.statText}>
                    <Ionicons name="chatbubble-outline" size={11} />{" "}
                    {product.commentCount}
                  </Text>
                </HStack>
              </HStack>

              <Text style={styles.productId}>
                ID: {product.id}
                {product.createdAt
                  ? ` · ${formatAdminDate(product.createdAt)}`
                  : ""}
              </Text>

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => handleToggleCurated(product)}
                  disabled={actionLoading}
                  leftIcon={
                    <Ionicons
                      name={product.isCurated ? "star" : "star-outline"}
                      size={16}
                      color={
                        product.isCurated
                          ? theme.colors.accent
                          : theme.colors.text
                      }
                    />
                  }
                  style={[
                    styles.editButton,
                    product.isCurated && styles.curatedActiveButton,
                  ]}
                >
                  <ButtonText
                    style={{
                      color: product.isCurated
                        ? theme.colors.accent
                        : theme.colors.text,
                      fontSize: 12,
                    }}
                  >
                    {product.isCurated
                      ? t("admin.productMgmt.unsetCurated")
                      : t("admin.productMgmt.setCurated")}
                  </ButtonText>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => handleOpenEdit(product)}
                  leftIcon={
                    <Ionicons name="create-outline" size={16} />
                  }
                  style={styles.editButton}
                >
                  <ButtonText style={{ fontSize: 12 }}>
                    {t("admin.productMgmt.edit")}
                  </ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleDelete(product)}
                  disabled={actionLoading}
                  leftIcon={
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={theme.colors.white}
                    />
                  }
                >
                  <ButtonText style={{ fontSize: 12 }}>
                    {t("common.delete")}
                  </ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <HStack
            justifyContent="center"
            space="md"
            style={styles.pagination}
          >
            <Pressable
              disabled={page <= 1}
              onPress={() => fetchProducts(page - 1)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.paginationText}>
              {page} / {totalPages}
            </Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => fetchProducts(page + 1)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.text}
              />
            </Pressable>
          </HStack>
        )}

        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* Create Product Modal */}
      {renderProductFormModal(
        createModalVisible,
        t("admin.productMgmt.modalCreateTitle"),
        createForm,
        setCreateForm,
        handleCreate,
        () => setCreateModalVisible(false),
        t("admin.productMgmt.submitCreate"),
      )}

      {/* Edit Product Modal */}
      {renderProductFormModal(
        editModalVisible,
        t("admin.productMgmt.modalEditTitle"),
        editForm,
        setEditForm,
        handleSave,
        () => setEditModalVisible(false),
        t("admin.productMgmt.submitSave"),
      )}
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    topRow: {
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      height: 34,
    },
    searchButton: {
      backgroundColor: t.colors.text,
      borderRadius: 4,
      paddingHorizontal: 12,
      height: 34,
      justifyContent: "center",
      alignItems: "center",
    },
    createButton: {
      height: 34,
      borderRadius: 4,
      paddingHorizontal: 10,
      gap: 4,
    },
    createButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    filterRow: {
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 6,
    },
    totalText: {
      paddingBottom: 6,
      fontSize: 12,
      color: t.colors.gray400,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    curatedBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.accent + "20",
      marginRight: 6,
    },
    curatedActiveButton: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accent + "10",
    },
    metaRow: {
      flexWrap: "wrap",
      gap: 4,
      marginTop: 4,
    },
    metaChip: {
      fontSize: 11,
      color: t.colors.gray400,
      backgroundColor: t.colors.gray100,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      overflow: "hidden",
    },
    priceText: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 4,
    },
    statText: {
      fontSize: 11,
      color: t.colors.gray300,
    },
    productId: {
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 4,
    },
    editButton: {
      borderColor: t.colors.gray200,
      gap: 4,
    },
    pagination: {
      paddingVertical: 10,
    },
    paginationText: {
      fontSize: 13,
      color: t.colors.gray500,
    },
    formModalContent: {
      height: "85%",
      width: "92%",
      padding: t.spacing.md,
    },
    imagesGrid: {
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 8,
    },
    imageItem: {
      width: 64,
      height: 64,
      borderRadius: 4,
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
      borderRadius: 4,
    },
    imageAddBtn: {
      width: 64,
      height: 64,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.gray50,
    },
    listImagesRow: {
      flexDirection: "row",
      marginBottom: 6,
      flexGrow: 0,
    },
    listImageThumb: {
      width: 50,
      height: 50,
      borderRadius: 4,
      marginRight: 6,
      backgroundColor: t.colors.gray100,
    },
    listImageMore: {
      width: 50,
      height: 50,
      borderRadius: 4,
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

export default ProductManagementTab;
