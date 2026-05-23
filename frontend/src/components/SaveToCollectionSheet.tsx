/**
 * SaveToCollectionSheet —— 把商品保存到指定收藏夹的底部抽屉。
 *
 * 设计要点 (PRD 模块三 3.4):
 *   - 顶部一行 "默认收藏" 选项 (collection_id = NULL)
 *   - 下方列出用户自建的收藏夹, 显示 itemCount
 *   - 列表尾部一行 "+ 新建收藏夹"
 *   - 选中即提交; 提交成功后 onSaved(collectionId) 回调
 *   - 抽屉打开时若用户尚未收藏该商品, 也会顺手收藏 (后端 addProductToCollection
 *     已经做了 favorite_product 幂等调用)
 *
 * 与 ActionSheet 风格保持一致 (黑白 + Playfair, 卡片样式)。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  View,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text, VStack } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  addProductToCollection,
  createCollection,
  listMyCollections,
  removeProductFromCollection,
  type UserCollection,
} from "../services/tradingExtrasService";
import {
  favoriteStoreProduct,
  unfavoriteStoreProduct,
} from "../services/storeProductService";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ANIMATION_DURATION = 250;

interface SaveToCollectionSheetProps {
  visible: boolean;
  productId: number;
  onClose: () => void;
  /** 当前是否已收藏 (任意夹) — 用于显示是否需要先收藏 */
  isFavorited?: boolean;
  /** 操作成功后回调, 传出当前所在的 collectionId (null = 默认收藏) */
  onSaved?: (collectionId: number | null) => void;
  /** 取消收藏后回调 */
  onUnsaved?: () => void;
}

export const SaveToCollectionSheet: React.FC<SaveToCollectionSheetProps> = ({
  visible,
  productId,
  onClose,
  isFavorited = false,
  onSaved,
  onUnsaved,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdrop] = useState(() => new Animated.Value(0));

  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<number | "default" | null>(null);

  // 新建收藏夹的 inline 输入区
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyCollections();
      setCollections(list);
    } catch (e) {
      console.error("[SaveToCollectionSheet] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadCollections();
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
      setCreating(false);
      setNewName("");
    }
  }, [visible, backdrop, translateY, loadCollections]);

  const handleSaveToDefault = useCallback(async () => {
    if (submitting) return;
    setSubmitting("default");
    try {
      // 已收藏的话, 后端 removeProductFromCollection 会把 collection_id 置为 null
      // 即"回到默认收藏夹"; 未收藏先 favorite 一次
      if (!isFavorited) {
        await favoriteStoreProduct(productId);
      }
      // 找到当前所在的夹 (如果有) 并清掉 collection_id; 没有也是 noop
      // 简化: 直接调任一夹的 remove 都会把 collection_id 置 null (后端实现如此)
      // 但更安全是先 query, 这里乐观直接 fallback
      for (const c of collections) {
        try {
          await removeProductFromCollection(c.id, productId);
        } catch {
          // ignore — 商品可能并不在这个夹里
        }
      }
      onSaved?.(null);
      Alert.show(t("collections.savedToDefault"));
      onClose();
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("collections.saveFailed"),
      );
    } finally {
      setSubmitting(null);
    }
  }, [collections, isFavorited, onClose, onSaved, productId, submitting, t]);

  const handleSaveToCollection = useCallback(
    async (collectionId: number) => {
      if (submitting) return;
      setSubmitting(collectionId);
      try {
        await addProductToCollection(collectionId, productId);
        onSaved?.(collectionId);
        Alert.show(t("collections.saved"));
        onClose();
      } catch (e) {
        Alert.show(
          e instanceof Error ? e.message : t("collections.saveFailed"),
        );
      } finally {
        setSubmitting(null);
      }
    },
    [onClose, onSaved, productId, submitting, t],
  );

  const handleRemoveFavorite = useCallback(async () => {
    if (submitting) return;
    setSubmitting("default");
    try {
      await unfavoriteStoreProduct(productId);
      onUnsaved?.();
      Alert.show(t("collections.removed"));
      onClose();
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("collections.saveFailed"),
      );
    } finally {
      setSubmitting(null);
    }
  }, [onClose, onUnsaved, productId, submitting, t]);

  const handleCreateAndSave = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      Alert.show(t("collections.nameRequired"));
      return;
    }
    setCreateSubmitting(true);
    try {
      const created = await createCollection({ name });
      // 自动把当前商品放进去
      await addProductToCollection(created.id, productId);
      onSaved?.(created.id);
      Alert.show(t("collections.savedToNew", { name }));
      onClose();
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("collections.createFailed"),
      );
    } finally {
      setCreateSubmitting(false);
    }
  }, [newName, onClose, onSaved, productId, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          { paddingBottom: insets.bottom || 16 },
          { transform: [{ translateY }] },
        ]}
      >
        <Box style={styles.sheet}>
          <HStack
            alignItems="center"
            justifyContent="between"
            style={styles.headerRow}
          >
            <Text style={styles.title}>{t("collections.sheetTitle")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </HStack>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.colors.text} />
            </View>
          ) : (
            <>
              {/* 默认收藏 */}
              <TouchableOpacity
                style={styles.row}
                onPress={handleSaveToDefault}
                disabled={!!submitting}
                activeOpacity={0.7}
              >
                <Box style={styles.thumbDefault}>
                  <Ionicons
                    name="bookmark-outline"
                    size={20}
                    color={theme.colors.text}
                  />
                </Box>
                <VStack flex={1} style={{ marginLeft: 12 }}>
                  <Text style={styles.rowTitle}>
                    {t("collections.defaultCollection")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("collections.defaultDescription")}
                  </Text>
                </VStack>
                {submitting === "default" ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.gray300}
                  />
                )}
              </TouchableOpacity>

              {/* 自建收藏夹 */}
              {collections.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.row}
                  onPress={() => handleSaveToCollection(c.id)}
                  disabled={!!submitting}
                  activeOpacity={0.7}
                >
                  <Box style={styles.thumbDefault}>
                    <Ionicons
                      name="folder-outline"
                      size={20}
                      color={theme.colors.text}
                    />
                  </Box>
                  <VStack flex={1} style={{ marginLeft: 12 }}>
                    <Text style={styles.rowTitle}>{c.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      {t("collections.itemCountShort", {
                        count: c.itemCount ?? 0,
                      })}
                    </Text>
                  </VStack>
                  {submitting === c.id ? (
                    <ActivityIndicator size="small" color={theme.colors.text} />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={theme.colors.gray300}
                    />
                  )}
                </TouchableOpacity>
              ))}

              {/* 新建收藏夹 */}
              {creating ? (
                <View style={styles.createRow}>
                  <Box style={styles.thumbDefault}>
                    <Ionicons
                      name="add"
                      size={20}
                      color={theme.colors.text}
                    />
                  </Box>
                  <TextInput
                    style={styles.input}
                    placeholder={t("collections.namePlaceholder") as string}
                    placeholderTextColor={theme.colors.placeholder}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                    maxLength={32}
                  />
                  <TouchableOpacity
                    onPress={handleCreateAndSave}
                    disabled={createSubmitting}
                    style={styles.createConfirmBtn}
                  >
                    {createSubmitting ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.textInverted}
                      />
                    ) : (
                      <Text style={styles.createConfirmText}>
                        {t("collections.create")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setCreating(true)}
                  activeOpacity={0.7}
                >
                  <Box style={styles.thumbDefault}>
                    <Ionicons
                      name="add"
                      size={20}
                      color={theme.colors.text}
                    />
                  </Box>
                  <Text
                    style={[
                      styles.rowTitle,
                      { marginLeft: 12, flex: 1, fontWeight: "600" },
                    ]}
                  >
                    {t("collections.newCollection")}
                  </Text>
                </TouchableOpacity>
              )}

              {/* 已收藏 — 提供取消收藏入口 */}
              {isFavorited && (
                <TouchableOpacity
                  style={[styles.row, styles.removeRow]}
                  onPress={handleRemoveFavorite}
                  disabled={!!submitting}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.colors.error, textAlign: "center", flex: 1 },
                    ]}
                  >
                    {t("collections.removeFavorite")}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Box>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
    },
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 10,
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderRadius: 12,
      overflow: "hidden",
      maxHeight: SCREEN_HEIGHT * 0.7,
    },
    headerRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    loadingWrap: { paddingVertical: 36, alignItems: "center" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
    },
    removeRow: {
      justifyContent: "center",
      paddingVertical: 14,
    },
    thumbDefault: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: "500",
      color: t.colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    createRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
    },
    input: {
      flex: 1,
      marginLeft: 12,
      marginRight: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      fontSize: 14,
    },
    createConfirmBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: t.colors.accent,
    },
    createConfirmText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
  });

export default SaveToCollectionSheet;
