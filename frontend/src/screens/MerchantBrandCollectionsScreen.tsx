/**
 * MerchantBrandCollectionsScreen —— App 商家后台 · 品牌图集管理（migration 057）。
 *
 * 商家为店铺主营品牌上传封面图，消费者端 BuyerTab 渲染成
 * "BRAND COLLECTIONS" 横向画廊，点开展开该品牌下的单品。
 *
 * 功能：
 *   - 列出全部品牌图集（含 HIDDEN）；
 *   - 新建 / 编辑（品牌名 + 封面图 + 可选描述 + 排序 + 状态）；
 *   - PUBLISHED ↔ HIDDEN 一键切换；删除。
 *
 * 路由参数：merchantId（来自 MerchantManage 快捷入口）。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import ScreenHeader from "../components/ScreenHeader";
import { useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import { uploadImageFromUri } from "./admin/adminUtils";
import {
  StoreBrandCollection,
  createBrandCollection,
  deleteBrandCollection,
  getMerchantBrandCollections,
  updateBrandCollection,
} from "../services/storeProductService";

type RouteParams = {
  MerchantBrandCollections: {
    merchantId: number;
  };
};

interface CollectionForm {
  brandName: string;
  coverImage: string;
  description: string;
}

const EMPTY_FORM: CollectionForm = {
  brandName: "",
  coverImage: "",
  description: "",
};

const MerchantBrandCollectionsScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "MerchantBrandCollections">>();
  const merchantId = route.params?.merchantId;

  const [collections, setCollections] = useState<StoreBrandCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<StoreBrandCollection | null>(null);
  const [form, setForm] = useState<CollectionForm>(EMPTY_FORM);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCollections = useCallback(async () => {
    if (!merchantId) return;
    try {
      const list = await getMerchantBrandCollections(merchantId);
      setCollections(list);
    } catch (err: any) {
      Alert.show(err?.message || t("merchant.loadFailed"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [merchantId, t]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadCollections();
  }, [loadCollections]);

  const openCreateModal = useCallback(() => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowEditModal(true);
  }, []);

  const openEditModal = useCallback((item: StoreBrandCollection) => {
    setEditItem(item);
    setForm({
      brandName: item.brandName,
      coverImage: item.coverImage,
      description: item.description ?? "",
    });
    setShowEditModal(true);
  }, []);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadImageFromUri(result.assets[0].uri);
      setForm((prev) => ({ ...prev, coverImage: url }));
    } catch (err: any) {
      Alert.show(err?.message || t("merchant.uploadImageFailed"));
    } finally {
      setIsUploadingImage(false);
    }
  }, [t]);

  const handleSubmit = useCallback(async () => {
    if (!merchantId) return;
    const brandName = form.brandName.trim();
    if (!brandName) {
      Alert.show(t("merchant.brandNameRequired"));
      return;
    }
    if (!form.coverImage) {
      Alert.show(t("merchant.brandCoverRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      if (editItem) {
        const updated = await updateBrandCollection(editItem.id, {
          brandName,
          coverImage: form.coverImage,
          description: form.description.trim() || undefined,
        });
        setCollections((prev) =>
          prev.map((c) => (c.id === editItem.id ? { ...c, ...updated } : c))
        );
      } else {
        await createBrandCollection(merchantId, {
          brandName,
          coverImage: form.coverImage,
          description: form.description.trim() || undefined,
          sortOrder: collections.length,
        });
        await loadCollections();
      }
      setShowEditModal(false);
    } catch (err: any) {
      Alert.show(err?.message || t("merchant.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }, [merchantId, form, editItem, collections.length, loadCollections, t]);

  const handleToggleStatus = useCallback(
    async (item: StoreBrandCollection) => {
      const nextStatus = item.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
      try {
        const updated = await updateBrandCollection(item.id, {
          status: nextStatus,
        });
        setCollections((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, ...updated } : c))
        );
      } catch (err: any) {
        Alert.show(err?.message || t("merchant.saveFailed"));
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    (item: StoreBrandCollection) => {
      Alert.alert(
        t("merchant.deleteBrandCollectionTitle"),
        t("merchant.deleteBrandCollectionMessage", { brand: item.brandName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteBrandCollection(item.id);
                setCollections((prev) => prev.filter((c) => c.id !== item.id));
              } catch (err: any) {
                Alert.show(err?.message || t("merchant.deleteFailed"));
              }
            },
          },
        ]
      );
    },
    [t]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScreenHeader
        title={t("merchant.brandCollections")}
        showBack
        onBackPress={() => navigation.goBack()}
        rightActions={[
          { icon: "add", onPress: openCreateModal, style: "primary" },
        ]}
      />

      {isLoading ? (
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator size="small" color={theme.colors.gray300} />
        </Box>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {collections.length === 0 ? (
            <Box alignItems="center" py="$xl" mt="$xl">
              <Ionicons
                name="images-outline"
                size={32}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyTitle} mt="$sm">
                {t("merchant.noBrandCollections")}
              </Text>
              <Text style={styles.emptyHint} mt="$xs">
                {t("merchant.noBrandCollectionsHint")}
              </Text>
              <Pressable onPress={openCreateModal} style={styles.emptyCta} mt="$md">
                <Text style={styles.emptyCtaText}>
                  {t("merchant.addBrandCollection")}
                </Text>
              </Pressable>
            </Box>
          ) : (
            collections.map((item) => (
              <HStack key={item.id} style={styles.card} alignItems="center">
                <Box style={styles.cardImageWrap}>
                  <OptimizedImage
                    uri={item.coverImage}
                    size={ImageSize.THUMBNAIL}
                    style={styles.cardImage}
                    contentFit="cover"
                    lazy
                  />
                </Box>
                <VStack flex={1} minWidth={0} ml="$sm">
                  <Text style={styles.cardBrand} numberOfLines={1}>
                    {item.brandName}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {t("merchant.brandProductCount", {
                      count: item.productCount ?? 0,
                    })}
                  </Text>
                  <Box
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === "PUBLISHED"
                            ? "#E8F5E9"
                            : theme.colors.gray100,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            item.status === "PUBLISHED"
                              ? "#27AE60"
                              : theme.colors.gray300,
                        },
                      ]}
                    >
                      {item.status === "PUBLISHED"
                        ? t("merchant.published")
                        : t("merchant.hidden")}
                    </Text>
                  </Box>
                </VStack>
                <HStack gap={4}>
                  <Pressable
                    onPress={() => handleToggleStatus(item)}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name={
                        item.status === "PUBLISHED"
                          ? "eye-off-outline"
                          : "eye-outline"
                      }
                      size={17}
                      color={theme.colors.gray400}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => openEditModal(item)}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color={theme.colors.gray400}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={17} color="#E74C3C" />
                  </Pressable>
                </HStack>
              </HStack>
            ))
          )}
        </ScrollView>
      )}

      {/* 创建 / 编辑弹窗 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEditModal(false)}
          />
          <Box style={styles.modalSheet}>
            <HStack alignItems="center" justifyContent="space-between" mb="$md">
              <Text style={styles.modalTitle}>
                {editItem
                  ? t("merchant.editBrandCollection")
                  : t("merchant.addBrandCollection")}
              </Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </HStack>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>
                {t("merchant.brandNameLabel")}
              </Text>
              <TextInput
                style={styles.input}
                value={form.brandName}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, brandName: text }))
                }
                placeholder={t("merchant.brandNamePlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                maxLength={200}
              />

              <Text style={styles.fieldLabel}>
                {t("merchant.brandCoverLabel")}
              </Text>
              <Pressable
                onPress={handlePickImage}
                style={styles.coverPicker}
                disabled={isUploadingImage}
              >
                {form.coverImage ? (
                  <OptimizedImage
                    uri={form.coverImage}
                    size={ImageSize.MEDIUM}
                    style={styles.coverPreview}
                    contentFit="cover"
                  />
                ) : (
                  <VStack alignItems="center" gap={6}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={26}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.coverHint}>
                      {t("merchant.brandCoverHint")}
                    </Text>
                  </VStack>
                )}
                {isUploadingImage && (
                  <Box style={styles.coverUploading}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </Box>
                )}
              </Pressable>

              <Text style={styles.fieldLabel}>
                {t("merchant.brandDescriptionLabel")}
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.description}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, description: text }))
                }
                placeholder={t("merchant.brandDescriptionPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                multiline
              />

              <Pressable
                onPress={handleSubmit}
                style={[
                  styles.submitButton,
                  (isSubmitting || isUploadingImage) && { opacity: 0.5 },
                ]}
                disabled={isSubmitting || isUploadingImage}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {t("common.save")}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Box>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.text,
  },
  emptyHint: {
    fontSize: 12,
    color: t.colors.gray300,
  },
  emptyCta: {
    backgroundColor: t.colors.text,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  emptyCtaText: {
    color: t.colors.textInverted,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    backgroundColor: t.colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  cardImageWrap: {
    width: 64,
    height: 80,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    flexShrink: 0,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
  },
  cardMeta: {
    fontSize: 11,
    color: t.colors.gray400,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: t.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: t.colors.text,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.gray400,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.colors.text,
    backgroundColor: t.colors.gray50,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  coverPicker: {
    height: 180,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.gray50,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coverPreview: {
    width: "100%",
    height: "100%",
  },
  coverHint: {
    fontSize: 12,
    color: t.colors.gray300,
  },
  coverUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: t.colors.text,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: t.colors.textInverted,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default MerchantBrandCollectionsScreen;
