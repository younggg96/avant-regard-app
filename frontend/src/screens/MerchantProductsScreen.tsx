/**
 * MerchantProductsScreen —— App 商家后台 · 商品管理。
 *
 * 与 Web 端 `/me/merchant/[merchantId]/products/page.tsx` 功能对齐：
 *   - 列出当前商家的全部商品（含 DRAFT / HIDDEN / SOLD_OUT）；
 *   - 状态 / 分类 / 关键字过滤 + 分页；
 *   - 多图 + 折扣 + 标签 + 新品标记的创建 / 编辑表单；
 *   - PUBLISHED ↔ HIDDEN 一键上下架；
 *   - 删除；
 *   - 内置一个轻量「分类管理」入口：商家在编辑表单里直接新增 / 删除分类，
 *     避免离开当前页跳到独立的分类管理屏（移动端切屏成本较高）。
 *
 * 路由参数：
 *   - merchantId: number （来自 `MyMerchantStores` 跳转）
 *
 * 金额：表单输入用「元」（字符串），提交前 `parsePriceInputToCents` 转 `priceCents`；
 *       回填走 `centsToPriceInput`。这套约定和 Web 后台、后端 schema 一致。
 *
 * 设计注记：
 *   - 没有把这部分塞回 `MerchantManageScreen`：那个屏已经 2300+ 行 / 5 个 tab，
 *     再加商品 CRUD 会让 modal 表单分支过多。独立屏路径短，导航也更直观；
 *   - 为了和 Web 体验对齐，关键交互（状态过滤 chips / 分类过滤 chips / 卡片
 *     操作行）都尽量用 chip + 图标按钮，避免在小屏上做长文本按钮。
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import {
  AnimatedChip,
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
  chipRowStyle,
} from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import ScreenHeader from "../components/ScreenHeader";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import { uploadImageFromUri } from "./admin/adminUtils";
import {
  StoreMerchant,
  getMyMerchants,
} from "../services/storeMerchantService";
import {
  ProductStatus,
  StoreProduct,
  StoreProductCategory,
  StoreProductCreateParams,
  StoreProductUpdateParams,
  centsToPriceInput,
  createMerchantProductCategory,
  createMerchantStoreProduct,
  deleteMerchantProductCategory,
  deleteMerchantStoreProduct,
  getStoreProductCategories,
  listMerchantStoreProducts,
  parsePriceInputToCents,
  updateMerchantStoreProduct,
} from "../services/storeProductService";
import { useFormatPrice } from "../utils/currency";

const PAGE_SIZE = 20;
const MAX_PRODUCT_IMAGES = 9;
const MAX_PRODUCT_TAGS = 10;

type RouteParams = {
  MerchantProducts: {
    merchantId: number;
  };
};

type StatusFilter = ProductStatus | "ALL";

interface ProductForm {
  title: string;
  description: string;
  brand: string;
  images: string[];
  priceInput: string;
  discountPriceInput: string;
  hasDiscount: boolean;
  categoryId: number | null;
  isNew: boolean;
  tags: string[];
  status: ProductStatus;
}

const EMPTY_FORM: ProductForm = {
  title: "",
  description: "",
  brand: "",
  images: [],
  priceInput: "",
  discountPriceInput: "",
  hasDiscount: false,
  categoryId: null,
  isNew: false,
  tags: [],
  status: "PUBLISHED",
};

const MerchantProductsScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "MerchantProducts">>();
  const merchantId = route.params?.merchantId;
  const formatPrice = useFormatPrice();

  // ── 状态 ─────────────────────────────────────────────────────────────────
  const [merchant, setMerchant] = useState<StoreMerchant | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<number | "ALL">("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [productsLoading, setProductsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // ── 加载商家信息 ────────────────────────────────────────────────────────
  const loadMerchant = useCallback(async () => {
    if (!merchantId) {
      setMerchantLoading(false);
      return;
    }
    try {
      setMerchantLoading(true);
      const result = await getMyMerchants(1, 50);
      const target = result.merchants.find((m) => m.id === merchantId) ?? null;
      setMerchant(
        target && target.status === "APPROVED" ? target : null
      );
    } catch (e: any) {
      console.error("[MerchantProducts] load merchant failed:", e);
    } finally {
      setMerchantLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  // ── 加载分类 ────────────────────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    if (!merchant) return;
    try {
      const list = await getStoreProductCategories(merchant.storeId, true);
      setCategories(list);
    } catch (e: any) {
      console.error("[MerchantProducts] load categories failed:", e);
    }
  }, [merchant]);

  // ── 加载商品 ────────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!merchant) return;
    try {
      setProductsLoading(true);
      const result = await listMerchantStoreProducts(merchant.id, {
        status: statusFilter === "ALL" ? "" : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setProducts(result.products || []);
      setTotal(result.total || 0);
    } catch (e: any) {
      Alert.alert(
        t("common.loadFailed"),
        e?.message || t("common.retryLater")
      );
    } finally {
      setProductsLoading(false);
    }
  }, [merchant, statusFilter, categoryFilter, page, t]);

  useEffect(() => {
    if (merchant) {
      loadCategories();
    }
  }, [merchant, loadCategories]);

  useEffect(() => {
    if (merchant) {
      loadProducts();
    }
  }, [merchant, loadProducts]);

  // 关键字过滤走客户端（与 Web 一致）—— 后端列表接口未提供 search 参数
  const filteredProducts = useMemo(() => {
    if (!keyword.trim()) return products;
    const q = keyword.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
    );
  }, [products, keyword]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── 表单 ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTagDraft("");
    setFormVisible(true);
  };

  const openEdit = (p: StoreProduct) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      brand: p.brand ?? "",
      images: p.images ?? [],
      priceInput: centsToPriceInput(p.priceCents),
      discountPriceInput:
        p.discountPriceCents != null
          ? centsToPriceInput(p.discountPriceCents)
          : "",
      hasDiscount: p.discountPriceCents != null,
      categoryId: p.categoryId ?? null,
      isNew: p.isNew,
      tags: p.tags ?? [],
      status: p.status,
    });
    setTagDraft("");
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditing(null);
  };

  const pickImages = async () => {
    if (form.images.length >= MAX_PRODUCT_IMAGES) {
      Alert.alert(
        t("common.hint"),
        t("merchant.productImagesLimit", { count: MAX_PRODUCT_IMAGES })
      );
      return;
    }
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("common.permissionDenied"),
        t("common.photoPermissionRequired")
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PRODUCT_IMAGES - form.images.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      setUploadingImage(true);
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadImageFromUri(asset.uri);
        uploaded.push(url);
      }
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...uploaded].slice(0, MAX_PRODUCT_IMAGES),
      }));
    } catch (e: any) {
      Alert.alert(
        t("common.uploadFailed"),
        e?.message || t("common.retryLater")
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v) return;
    if (form.tags.length >= MAX_PRODUCT_TAGS) {
      Alert.alert(
        t("common.hint"),
        t("merchant.productTagsLimit", { count: MAX_PRODUCT_TAGS })
      );
      return;
    }
    if (form.tags.includes(v)) {
      setTagDraft("");
      return;
    }
    setForm({ ...form, tags: [...form.tags, v] });
    setTagDraft("");
  };

  const removeTag = (idx: number) => {
    setForm({ ...form, tags: form.tags.filter((_, i) => i !== idx) });
  };

  // ── 提交 ───────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.title.trim()) return t("merchant.validateTitleRequired");
    if (form.images.length === 0)
      return t("merchant.validateImageRequired");
    const priceCents = parsePriceInputToCents(form.priceInput);
    if (priceCents == null) return t("merchant.validatePriceInvalid");
    if (form.hasDiscount) {
      const dc = parsePriceInputToCents(form.discountPriceInput);
      if (dc == null) return t("merchant.validateDiscountInvalid");
      if (dc > priceCents) return t("merchant.validateDiscountExceed");
    }
    return null;
  };

  const handleSave = async () => {
    if (!merchant) return;
    const err = validate();
    if (err) {
      Alert.alert(t("common.hint"), err);
      return;
    }
    const priceCents = parsePriceInputToCents(form.priceInput)!;
    const discountPriceCents = form.hasDiscount
      ? parsePriceInputToCents(form.discountPriceInput)
      : null;
    try {
      setSaving(true);
      if (editing) {
        const payload: StoreProductUpdateParams = {
          title: form.title.trim(),
          description: form.description || undefined,
          brand: form.brand.trim() || undefined,
          images: form.images,
          priceCents,
          discountPriceCents,
          categoryId: form.categoryId,
          isNew: form.isNew,
          tags: form.tags,
          status: form.status,
        };
        await updateMerchantStoreProduct(editing.id, payload);
      } else {
        const payload: StoreProductCreateParams = {
          title: form.title.trim(),
          description: form.description || undefined,
          brand: form.brand.trim() || undefined,
          images: form.images,
          priceCents,
          discountPriceCents,
          categoryId: form.categoryId,
          isNew: form.isNew,
          tags: form.tags,
          status: form.status,
        };
        await createMerchantStoreProduct(merchant.id, payload);
      }
      closeForm();
      await loadProducts();
      await loadCategories();
      Alert.alert(
        t("common.success"),
        editing ? t("common.updateSuccess") : t("common.publishSuccess")
      );
    } catch (e: any) {
      Alert.alert(
        t("common.operationFailed"),
        e?.message || t("common.retryLater")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: StoreProduct) => {
    Alert.alert(
      t("common.confirmDelete"),
      t("merchant.deleteProductMsg", { title: p.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMerchantStoreProduct(p.id);
              setProducts((prev) => prev.filter((x) => x.id !== p.id));
              setTotal((n) => Math.max(0, n - 1));
            } catch (e: any) {
              Alert.alert(
                t("common.deleteFailed"),
                e?.message || t("common.retryLater")
              );
            }
          },
        },
      ]
    );
  };

  const handleQuickToggle = async (p: StoreProduct) => {
    if (p.status !== "PUBLISHED" && p.status !== "HIDDEN") return;
    const next: ProductStatus =
      p.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: next } : x))
    );
    try {
      await updateMerchantStoreProduct(p.id, { status: next });
    } catch (e: any) {
      // 失败回滚
      setProducts((prev) =>
        prev.map((x) =>
          x.id === p.id ? { ...x, status: p.status } : x
        )
      );
      Alert.alert(
        t("common.operationFailed"),
        e?.message || t("common.retryLater")
      );
    }
  };

  // ── 分类管理 ────────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!merchant) return;
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      setSavingCategory(true);
      await createMerchantProductCategory(merchant.id, { name });
      setNewCategoryName("");
      await loadCategories();
    } catch (e: any) {
      Alert.alert(
        t("common.operationFailed"),
        e?.message || t("common.retryLater")
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = (c: StoreProductCategory) => {
    Alert.alert(
      t("common.confirmDelete"),
      t("merchant.deleteCategoryMsg", { name: c.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMerchantProductCategory(c.id);
              await loadCategories();
              if (categoryFilter === c.id) setCategoryFilter("ALL");
              if (form.categoryId === c.id)
                setForm((prev) => ({ ...prev, categoryId: null }));
            } catch (e: any) {
              Alert.alert(
                t("common.deleteFailed"),
                e?.message || t("common.retryLater")
              );
            }
          },
        },
      ]
    );
  };

  // ── 渲染：守卫 ──────────────────────────────────────────────────────────
  if (merchantLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("merchant.productsTitle")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator color={theme.colors.black} />
        </VStack>
      </SafeAreaView>
    );
  }

  if (!merchant) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("merchant.productsTitle")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center" px="$lg">
          <Ionicons
            name="storefront-outline"
            size={64}
            color={theme.colors.gray200}
          />
          <Text
            style={[styles.textRegular, { color: theme.colors.gray300 }]}
            mt="$md"
            textAlign="center"

          >
            {t("merchant.onlyApprovedCanManage")}
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  // ── 主体 ───────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <VStack px="$md" pt="$md" pb="$sm" gap="$sm" style={{ backgroundColor: theme.colors.white }}>
      {/* 搜索框 */}
      <Box
        style={{ backgroundColor: theme.colors.gray50 }}
        rounded="$sm"
        flexDirection="row"
        alignItems="center"
        px="$sm"
      >
        <Ionicons
          name="search-outline"
          size={16}
          color={theme.colors.gray300}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={t("merchant.searchPlaceholder")}
          placeholderTextColor={theme.colors.gray200}
          value={keyword}
          onChangeText={setKeyword}
        />
        {keyword.length > 0 && (
          <Pressable onPress={() => setKeyword("")}>
            <Ionicons
              name="close-circle"
              size={16}
              color={theme.colors.gray300}
            />
          </Pressable>
        )}
      </Box>

      {/* 状态过滤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(
          [
            { value: "ALL", label: t("common.all") },
            { value: "PUBLISHED", label: t("merchant.statusPublished") },
            { value: "DRAFT", label: t("merchant.statusDraft") },
            { value: "HIDDEN", label: t("merchant.statusHidden") },
            { value: "SOLD_OUT", label: t("merchant.statusSoldOut") },
          ] as { value: StatusFilter; label: string }[]
        ).map((opt) => (
          <AnimatedChip
            key={opt.value}
            label={opt.label}
            isActive={statusFilter === opt.value}
            onPress={() => {
              setStatusFilter(opt.value);
              setPage(1);
            }}
          />
        ))}
      </ScrollView>

      {/* 分类过滤 + 管理入口 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <AnimatedChip
          label={t("common.all")}
          isActive={categoryFilter === "ALL"}
          onPress={() => {
            setCategoryFilter("ALL");
            setPage(1);
          }}
        />
        {categories.map((c) => (
          <AnimatedChip
            key={c.id}
            label={c.name}
            count={c.productCount ?? undefined}
            showZeroCount
            isActive={categoryFilter === c.id}
            onPress={() => {
              setCategoryFilter(c.id);
              setPage(1);
            }}
          />
        ))}
        <Pressable
          onPress={() => setCategoryModalVisible(true)}
          style={[styles.chipDashed, { alignSelf: "flex-start" }]}
        >
          <HStack alignItems="center" gap="$xs">
            <Ionicons
              name="settings-outline"
              size={12}
              color={theme.colors.gray400}
            />
            <Text
              fontSize="$xs"
              style={{ color: theme.colors.gray400, fontFamily: FONT_REGULAR }}
            >
              {t("merchant.manageCategories")}
            </Text>
          </HStack>
        </Pressable>
      </ScrollView>
    </VStack>
  );

  const renderProductCard = ({ item }: { item: StoreProduct }) => {
    const cover = item.images?.[0];
    const canQuickToggle =
      item.status === "PUBLISHED" || item.status === "HIDDEN";
    return (
      <Box
        style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray100 }]}
        rounded="$md"
        mb="$md"
        borderWidth={1}

        overflow="hidden"
      >
        <HStack alignItems="stretch">
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.MEDIUM}
              style={styles.productCover}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <Box
              style={[styles.productCover, { backgroundColor: theme.colors.gray100 }]}

              justifyContent="center"
              alignItems="center"
            >
              <Ionicons
                name="image-outline"
                size={32}
                color={theme.colors.gray200}
              />
            </Box>
          )}
          <VStack flex={1} p="$md" justifyContent="space-between">
            <VStack gap="$xs">
              <HStack alignItems="center" gap="$xs">
                <Text
                  fontSize="$md"
                  fontWeight="$semibold"
                  style={[styles.textBold, { flex: 1 }, { color: theme.colors.black }]}

                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Box
                  px="$xs"
                  py={2}
                  rounded="$xs"
                  style={{ backgroundColor: item.status === "PUBLISHED"
                      ? "#E8F5E9"
                      : theme.colors.gray100 }}
                >
                  <Text
                    fontSize={10}
                    style={[styles.textRegular, { color: item.status === "PUBLISHED"
                        ? "#27AE60"
                        : theme.colors.gray400 }]}

                  >
                    {labelOfStatus(item.status, t)}
                  </Text>
                </Box>
              </HStack>
              <Text
                fontSize="$xs"
                style={[styles.textRegular, { color: theme.colors.gray300 }]}

                numberOfLines={1}
              >
                {(item.brand || "—") +
                  " · " +
                  (item.categoryName || t("merchant.uncategorized"))}
              </Text>
              <HStack alignItems="baseline" gap="$xs">
                {item.hasDiscount && item.discountPriceCents != null ? (
                  <>
                    <Text
                      fontSize="$md"
                      fontWeight="$bold"
                      style={[styles.textBold, { color: theme.colors.black }]}

                    >
                      {formatPrice(
                        item.discountPriceCents,
                        item.currency
                      )}
                    </Text>
                    <Text
                      fontSize="$xs"
                      style={[styles.textRegular,
                        { textDecorationLine: "line-through" },, { color: theme.colors.gray300 }]}

                    >
                      {formatPrice(item.priceCents, item.currency)}
                    </Text>
                  </>
                ) : (
                  <Text
                    fontSize="$md"
                    fontWeight="$bold"
                    style={[styles.textBold, { color: theme.colors.black }]}

                  >
                    {formatPrice(item.priceCents, item.currency)}
                  </Text>
                )}
                {item.isNew && (
                  <Box style={{ backgroundColor: theme.colors.black }} px="$xs" rounded="$xs">
                    <Text
                      fontSize={9}
                      style={[styles.textBold, { color: theme.colors.white }]}

                    >
                      NEW
                    </Text>
                  </Box>
                )}
              </HStack>
              <HStack gap="$md" mt="$xs">
                <HStack alignItems="center" gap={2}>
                  <Ionicons
                    name="heart-outline"
                    size={12}
                    color={theme.colors.gray300}
                  />
                  <Text fontSize={11} style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                    {item.likeCount}
                  </Text>
                </HStack>
                <HStack alignItems="center" gap={2}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={12}
                    color={theme.colors.gray300}
                  />
                  <Text fontSize={11} style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                    {item.commentCount}
                  </Text>
                </HStack>
                <HStack alignItems="center" gap={2}>
                  <Ionicons
                    name="eye-outline"
                    size={12}
                    color={theme.colors.gray300}
                  />
                  <Text fontSize={11} style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                    {item.viewCount}
                  </Text>
                </HStack>
              </HStack>
            </VStack>

            {/* 操作按钮行：右侧可用宽度大约 230px（96px 封面 + 双侧内边距占
                掉一部分），3 个按钮在英文环境下"Hide / Delete / Edit"加图标
                总长可能逼近边界。使用 `flexWrap="wrap"` 保证窄屏 / 长 label
                不会被裁剪。 */}
            <HStack gap="$xs" mt="$sm" flexWrap="wrap">
              <Pressable
                onPress={() => openEdit(item)}
                style={styles.cardActionBtn}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={theme.colors.black}
                />
                <Text style={styles.cardActionText} numberOfLines={1}>
                  {t("common.edit")}
                </Text>
              </Pressable>
              {canQuickToggle && (
                <Pressable
                  onPress={() => handleQuickToggle(item)}
                  style={styles.cardActionBtn}
                >
                  <Ionicons
                    name={
                      item.status === "PUBLISHED"
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={14}
                    color={theme.colors.black}
                  />
                  <Text style={styles.cardActionText} numberOfLines={1}>
                    {item.status === "PUBLISHED"
                      ? t("merchant.unpublishProduct")
                      : t("merchant.publishProduct")}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleDelete(item)}
                style={styles.cardActionBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color={theme.colors.error}
                />
                <Text
                  style={[styles.cardActionText, { color: theme.colors.error }]}
                  numberOfLines={1}
                >
                  {t("common.delete")}
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        </HStack>
      </Box>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("merchant.productsTitle")}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightActions={[
          {
            icon: "add",
            onPress: openCreate,
          },
        ]}
      />

      <FlatList
        data={filteredProducts}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderProductCard}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([loadProducts(), loadCategories()]);
              setRefreshing(false);
            }}
            tintColor={theme.colors.black}
          />
        }
        ListEmptyComponent={
          productsLoading ? (
            <VStack alignItems="center" py="$xl">
              <ActivityIndicator color={theme.colors.black} />
            </VStack>
          ) : (
            <VStack alignItems="center" py="$xl" px="$lg">
              <Ionicons
                name="cube-outline"
                size={48}
                color={theme.colors.gray200}
              />
              <Text style={[styles.textRegular, { color: theme.colors.gray300 }]} mt="$md">
                {keyword.trim()
                  ? t("merchant.noProductsSearch")
                  : t("merchant.noProductsEmpty")}
              </Text>
              <Pressable
                mt="$md"
                px="$lg"
                py="$sm"
                style={{ backgroundColor: theme.colors.black }}
                rounded="$sm"
                onPress={openCreate}
              >
                <Text style={[styles.textBold, { color: theme.colors.white }]}>
                  {t("merchant.newProduct")}
                </Text>
              </Pressable>
            </VStack>
          )
        }
        ListFooterComponent={
          pageCount > 1 ? (
            <HStack
              justifyContent="center"
              alignItems="center"
              gap="$md"
              py="$md"
            >
              <Pressable
                disabled={page <= 1}
                onPress={() => setPage(page - 1)}
                style={[
                  styles.pagerBtn,
                  page <= 1 && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.pagerText}>
                  {t("common.previousPage")}
                </Text>
              </Pressable>
              <Text style={[styles.textRegular, { color: theme.colors.gray300 }]}>
                {page} / {pageCount}
              </Text>
              <Pressable
                disabled={page >= pageCount}
                onPress={() => setPage(page + 1)}
                style={[
                  styles.pagerBtn,
                  page >= pageCount && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.pagerText}>{t("common.nextPage")}</Text>
              </Pressable>
            </HStack>
          ) : null
        }
      />

      {/* 商品创建/编辑 */}
      <Modal
        visible={formVisible}
        transparent
        animationType="fade"
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
            <TouchableWithoutFeedback onPress={closeForm}>
              <Box flex={1} />
            </TouchableWithoutFeedback>
            <Box
              style={{ backgroundColor: theme.colors.white }}
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              maxHeight="92%"
            >
              <HStack
                px="$lg"
                py="$md"
                justifyContent="between"
                alignItems="center"
                borderBottomWidth={1}
                style={{ borderBottomColor: theme.colors.gray100 }}
              >
                <Pressable onPress={closeForm}>
                  <Text
                    fontSize="$md"
                    style={[styles.textRegular, { color: theme.colors.gray300 }]}

                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Text
                  fontSize="$lg"
                  fontWeight="$bold"
                  style={[styles.textBold, { color: theme.colors.black }]}

                >
                  {editing
                    ? t("merchant.editProduct")
                    : t("merchant.createProduct")}
                </Text>
                <Pressable
                  onPress={handleSave}
                  disabled={saving || uploadingImage}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.colors.black} />
                  ) : (
                    <Text
                      fontSize="$md"
                      fontWeight="$semibold"
                      style={[styles.textBold, { color: theme.colors.black }]}

                    >
                      {editing
                        ? t("common.save")
                        : t("merchant.publish")}
                    </Text>
                  )}
                </Pressable>
              </HStack>

              <ScrollView
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <VStack gap="$md" p="$lg">
                  {/* 多图 */}
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.productImages")} *
                    </Text>
                    <HStack flexWrap="wrap" gap="$sm">
                      {form.images.map((url, idx) => (
                        <Box key={`${url}-${idx}`} style={styles.imageThumb}>
                          <OptimizedImage
                            uri={url}
                            size={ImageSize.THUMBNAIL}
                            style={styles.imageThumbImg}
                            contentFit="cover"
                            lazy={true}
                          />
                          <Pressable
                            style={styles.imageRemoveBtn}
                            onPress={() => removeImage(idx)}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color={theme.colors.white}
                            />
                          </Pressable>
                        </Box>
                      ))}
                      {form.images.length < MAX_PRODUCT_IMAGES && (
                        <Pressable
                          style={styles.imageAddBtn}
                          onPress={pickImages}
                          disabled={uploadingImage}
                        >
                          {uploadingImage ? (
                            <ActivityIndicator color={theme.colors.black} />
                          ) : (
                            <>
                              <Ionicons
                                name="add"
                                size={28}
                                color={theme.colors.gray300}
                              />
                              <Text
                                fontSize={11}
                                style={[styles.textRegular, { color: theme.colors.gray300 }]}

                              >
                                {form.images.length}/{MAX_PRODUCT_IMAGES}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </HStack>
                  </VStack>

                  {/* 标题 + 品牌 */}
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.productTitle")} *
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t("merchant.productTitlePlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={form.title}
                      onChangeText={(text) =>
                        setForm({ ...form, title: text })
                      }
                    />
                  </VStack>
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.productBrand")}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t("merchant.productBrandPlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={form.brand}
                      onChangeText={(text) =>
                        setForm({ ...form, brand: text })
                      }
                    />
                  </VStack>

                  {/* 分类 */}
                  <VStack gap="$xs">
                    <HStack
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text style={styles.formLabel}>
                        {t("merchant.productCategory")}
                      </Text>
                      <Pressable
                        onPress={() => setCategoryModalVisible(true)}
                      >
                        <Text style={styles.linkText}>
                          {t("merchant.manageCategories")}
                        </Text>
                      </Pressable>
                    </HStack>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRow}
                    >
                      <AnimatedChip
                        label={t("merchant.uncategorized")}
                        isActive={form.categoryId == null}
                        onPress={() => setForm({ ...form, categoryId: null })}
                      />
                      {categories.map((c) => (
                        <AnimatedChip
                          key={c.id}
                          label={c.name}
                          isActive={form.categoryId === c.id}
                          onPress={() => setForm({ ...form, categoryId: c.id })}
                        />
                      ))}
                    </ScrollView>
                  </VStack>

                  {/* 价格 */}
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.priceLabel")} *
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t("merchant.pricePlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={form.priceInput}
                      onChangeText={(text) =>
                        setForm({ ...form, priceInput: text })
                      }
                      keyboardType="decimal-pad"
                    />
                  </VStack>

                  {/* 折扣 */}
                  <Pressable
                    flexDirection="row"
                    alignItems="center"
                    gap="$sm"
                    onPress={() =>
                      setForm({
                        ...form,
                        hasDiscount: !form.hasDiscount,
                        discountPriceInput: form.hasDiscount
                          ? ""
                          : form.discountPriceInput,
                      })
                    }
                  >
                    <Box
                      w={20}
                      h={20}
                      rounded="$sm"
                      borderWidth={1}
                      style={[{ borderColor: form.hasDiscount ? theme.colors.black : theme.colors.gray200 }, { backgroundColor: form.hasDiscount ? theme.colors.black : theme.colors.white }]}

                      justifyContent="center"
                      alignItems="center"
                    >
                      {form.hasDiscount && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={theme.colors.white}
                        />
                      )}
                    </Box>
                    <Text style={styles.formLabel}>
                      {t("merchant.enableDiscount")}
                    </Text>
                  </Pressable>
                  {form.hasDiscount && (
                    <VStack gap="$xs">
                      <Text style={styles.formLabel}>
                        {t("merchant.discountPriceLabel")}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder={t("merchant.discountPricePlaceholder")}
                        placeholderTextColor={theme.colors.gray200}
                        value={form.discountPriceInput}
                        onChangeText={(text) =>
                          setForm({ ...form, discountPriceInput: text })
                        }
                        keyboardType="decimal-pad"
                      />
                    </VStack>
                  )}

                  {/* 描述 */}
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.productDescription")}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={t("merchant.productDescPlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={form.description}
                      onChangeText={(text) =>
                        setForm({ ...form, description: text })
                      }
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </VStack>

                  {/* 标签 */}
                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.productTags")}
                    </Text>
                    <HStack gap="$sm">
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t("merchant.productTagsPlaceholder")}
                        placeholderTextColor={theme.colors.gray200}
                        value={tagDraft}
                        onChangeText={setTagDraft}
                        onSubmitEditing={addTag}
                        returnKeyType="done"
                      />
                      <Pressable
                        onPress={addTag}
                        style={{ backgroundColor: theme.colors.black }}
                        px="$md"
                        rounded="$sm"
                        justifyContent="center"
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={theme.colors.white}
                        />
                      </Pressable>
                    </HStack>
                    {form.tags.length > 0 && (
                      <HStack flexWrap="wrap" gap="$xs">
                        {form.tags.map((tag, idx) => (
                          <Box
                            key={`${tag}-${idx}`}
                            style={{ backgroundColor: theme.colors.gray100 }}
                            px="$sm"
                            py="$xs"
                            rounded="$xs"
                            flexDirection="row"
                            alignItems="center"
                          >
                            <Text
                              fontSize="$xs"
                              style={[styles.textRegular, { color: theme.colors.black }]}

                            >
                              {tag}
                            </Text>
                            <Pressable
                              ml="$xs"
                              onPress={() => removeTag(idx)}
                            >
                              <Ionicons
                                name="close-circle"
                                size={14}
                                color={theme.colors.gray300}
                              />
                            </Pressable>
                          </Box>
                        ))}
                      </HStack>
                    )}
                  </VStack>

                  {/* 新品 + 状态 */}
                  <Pressable
                    flexDirection="row"
                    alignItems="center"
                    gap="$sm"
                    onPress={() => setForm({ ...form, isNew: !form.isNew })}
                  >
                    <Box
                      w={20}
                      h={20}
                      rounded="$sm"
                      borderWidth={1}
                      style={[{ borderColor: form.isNew ? theme.colors.black : theme.colors.gray200 }, { backgroundColor: form.isNew ? theme.colors.black : theme.colors.white }]}

                      justifyContent="center"
                      alignItems="center"
                    >
                      {form.isNew && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={theme.colors.white}
                        />
                      )}
                    </Box>
                    <Text style={styles.formLabel}>{t("merchant.isNew")}</Text>
                  </Pressable>

                  <VStack gap="$xs">
                    <Text style={styles.formLabel}>
                      {t("merchant.listingStatus")}
                    </Text>
                    <View style={chipRowStyle}>
                      {(
                        [
                          "PUBLISHED",
                          "DRAFT",
                          "HIDDEN",
                          "SOLD_OUT",
                        ] as ProductStatus[]
                      ).map((s) => (
                        <AnimatedChip
                          key={s}
                          label={labelOfStatus(s, t)}
                          isActive={form.status === s}
                          onPress={() => setForm({ ...form, status: s })}
                        />
                      ))}
                    </View>
                  </VStack>
                  <Box h={32} />
                </VStack>
              </ScrollView>
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* 分类管理 */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
            <TouchableWithoutFeedback
              onPress={() => setCategoryModalVisible(false)}
            >
              <Box flex={1} />
            </TouchableWithoutFeedback>
            <Box
              style={{ backgroundColor: theme.colors.white }}
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              maxHeight="80%"
            >
              <HStack
                px="$lg"
                py="$md"
                justifyContent="between"
                alignItems="center"
                borderBottomWidth={1}
                style={{ borderBottomColor: theme.colors.gray100 }}
              >
                <Pressable onPress={() => setCategoryModalVisible(false)}>
                  <Text
                    fontSize="$md"
                    style={[styles.textRegular, { color: theme.colors.gray300 }]}

                  >
                    {t("common.close")}
                  </Text>
                </Pressable>
                <Text
                  fontSize="$lg"
                  fontWeight="$bold"
                  style={[styles.textBold, { color: theme.colors.black }]}

                >
                  {t("merchant.manageCategoriesTitle")}
                </Text>
                <Box w={40} />
              </HStack>

              <ScrollView
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
              >
                <VStack p="$lg" gap="$md">
                  <HStack gap="$sm">
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder={t("merchant.newCategoryPlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      onSubmitEditing={handleAddCategory}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={handleAddCategory}
                      style={{ backgroundColor: theme.colors.black }}
                      px="$lg"
                      rounded="$sm"
                      justifyContent="center"
                      disabled={savingCategory || !newCategoryName.trim()}
                    >
                      {savingCategory ? (
                        <ActivityIndicator color={theme.colors.white} />
                      ) : (
                        <Text style={[styles.textBold, { color: theme.colors.white }]}>
                          {t("merchant.add")}
                        </Text>
                      )}
                    </Pressable>
                  </HStack>

                  <VStack gap="$sm">
                    {categories.length === 0 ? (
                      <Text
                        style={[styles.textRegular, { color: theme.colors.gray300 }]}

                        textAlign="center"
                      >
                        {t("merchant.noCategories")}
                      </Text>
                    ) : (
                      categories.map((c) => (
                        <HStack
                          key={c.id}
                          alignItems="center"
                          justifyContent="space-between"
                          style={{ backgroundColor: theme.colors.gray50 }}
                          rounded="$sm"
                          px="$md"
                          py="$sm"
                        >
                          <VStack flex={1}>
                            <Text
                              fontSize="$md"
                              style={[styles.textBold, { color: theme.colors.black }]}

                            >
                              {c.name}
                            </Text>
                            {c.productCount != null && (
                              <Text
                                fontSize="$xs"
                                style={[styles.textRegular, { color: theme.colors.gray300 }]}

                              >
                                {t("merchant.productCount", {
                                  count: c.productCount,
                                })}
                              </Text>
                            )}
                          </VStack>
                          <Pressable
                            onPress={() => handleDeleteCategory(c)}
                            p="$xs"
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color={theme.colors.error}
                            />
                          </Pressable>
                        </HStack>
                      ))
                    )}
                  </VStack>
                  <Box h={32} />
                </VStack>
              </ScrollView>
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ── 工具 ───────────────────────────────────────────────────────────────────

function labelOfStatus(s: ProductStatus, t: (k: string) => string): string {
  switch (s) {
    case "PUBLISHED":
      return t("merchant.statusPublished");
    case "DRAFT":
      return t("merchant.statusDraft");
    case "HIDDEN":
      return t("merchant.statusHidden");
    case "SOLD_OUT":
      return t("merchant.statusSoldOut");
  }
}

const FONT_REGULAR = "PlayfairDisplay-Regular";
const FONT_BOLD = "PlayfairDisplay-Bold";

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  listContent: {
    paddingHorizontal: t.spacing.md,
    paddingBottom: 24,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: t.colors.text,
    fontFamily: FONT_REGULAR,
  },
  chipRow: {
    paddingVertical: 4,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chipDashed: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: t.colors.gray200,
  },
  productCover: {
    width: 96,
    height: 120,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  cardActionText: {
    fontSize: 11,
    color: t.colors.text,
    fontFamily: FONT_REGULAR,
  },
  pagerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 4,
  },
  pagerText: {
    fontSize: 12,
    color: t.colors.gray400,
    fontFamily: FONT_REGULAR,
  },
  modalScroll: {
    flexGrow: 0,
  },
  formLabel: {
    fontSize: 13,
    color: t.colors.gray400,
    fontFamily: FONT_REGULAR,
  },
  linkText: {
    fontSize: 12,
    color: t.colors.text,
    fontFamily: FONT_REGULAR,
    textDecorationLine: "underline",
  },
  input: {
    backgroundColor: t.colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: t.colors.text,
    fontFamily: FONT_REGULAR,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    position: "relative",
  },
  imageThumbImg: {
    width: "100%",
    height: "100%",
  },
  imageRemoveBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageAddBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: t.colors.gray50,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  textRegular: {
    fontFamily: FONT_REGULAR,
  },
  textBold: {
    fontFamily: FONT_BOLD,
  },
});

export default MerchantProductsScreen;
