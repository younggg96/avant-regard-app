/**
 * SaveToCollectionSheet —— 「加入收藏夹」底部抽屉 (PRD 模块三 3.4)。
 *
 * 设计参考截图 (零售类应用通用样式):
 *   - 顶部: 「加入收藏夹」标题 + 右侧「新建收藏夹」按钮
 *   - 列表: 默认收藏 + 自建收藏夹 / 每行 cover + 名称 + 「N 件·公开/私密」+ 单选 radio
 *   - 底部: 「设为公开」visibility 开关 + 「完成」黑色主按钮
 *
 * 交互:
 *   - 单选模式: 默认勾选商品当前所在的收藏夹 (没收藏则默认勾「默认收藏」)
 *   - 「设为公开」开关只影响选中的自建收藏夹的 visibility (默认收藏不可更改可见性)
 *   - 「完成」点击后:
 *       1) 若未收藏 → favoriteStoreProduct
 *       2) 把商品从其他自建收藏夹挪出, 加入选中的收藏夹 (默认收藏 = 不属于任何收藏夹)
 *       3) 若选中的是自建收藏夹且 visibility 与现状不一致 → updateCollection
 *   - 顶部「新建收藏夹」: 进入 inline 输入模式, 创建后自动选中新建的夹
 *   - 「取消收藏」: 已收藏状态时, 列表底部展示红色按钮提供取消入口
 *
 * 已收藏状态的初始选中:
 *   出现 sheet 时若已 favorited, 在 collections 里 best-effort 反查
 *   (后端没有直接 "is in collection X" 的 API, 这里以 cover_product_id 命中或者
 *   通过 listCollectionItems 验证; 简化版只默认勾默认收藏, 由用户主动改).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ScrollView,
  View,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  addProductToCollection,
  createCollection,
  listMyCollections,
  removeProductFromCollection,
  updateCollection,
  type UserCollection,
} from "../services/tradingExtrasService";
import {
  favoriteStoreProduct,
  listMyFavoritedStoreProducts,
  unfavoriteStoreProduct,
  type StoreProduct,
} from "../services/storeProductService";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ANIMATION_DURATION = 250;
/** 单选状态; -1 代表「默认收藏」, 其余为 collection_id */
const DEFAULT_COLLECTION_ID = -1;

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
  const [submitting, setSubmitting] = useState(false);

  /** 当前选中的 collection id; DEFAULT_COLLECTION_ID = 默认收藏 */
  const [selectedId, setSelectedId] = useState<number>(DEFAULT_COLLECTION_ID);
  /** 「设为公开」开关 —— 选中自建收藏夹时同步该 folder 的 visibility */
  const [makePublic, setMakePublic] = useState(false);

  // 新建收藏夹的 inline 状态
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  /**
   * 加载收藏夹列表并尝试还原商品当前所在夹:
   *   - 走 listMyFavoritedStoreProducts({ onlyDefault: true }) 检查商品是否在「默认收藏」
   *   - 对每个自建收藏夹 listCollectionItems → 找到包含 productId 的那个
   * 这一步是 best-effort, 失败时回退到默认收藏。
   */
  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyCollections();
      setCollections(list);
      // 还原选中态: 已收藏且在某个 folder 里则定位过去
      if (isFavorited && list.length > 0) {
        try {
          const defaultRes = await listMyFavoritedStoreProducts(1, 200, {
            onlyDefault: true,
          });
          const inDefault = (defaultRes.products || []).some(
            (p: StoreProduct) => p.id === productId,
          );
          if (inDefault) {
            setSelectedId(DEFAULT_COLLECTION_ID);
            setMakePublic(false);
            return;
          }
          for (const c of list) {
            const res = await listMyFavoritedStoreProducts(1, 200, {
              collectionId: c.id,
            });
            const hit = (res.products || []).some(
              (p: StoreProduct) => p.id === productId,
            );
            if (hit) {
              setSelectedId(c.id);
              setMakePublic(c.visibility === "public");
              return;
            }
          }
        } catch {
          // ignore — fall back to default
        }
      }
      setSelectedId(DEFAULT_COLLECTION_ID);
      setMakePublic(false);
    } catch (e) {
      console.error("[SaveToCollectionSheet] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [isFavorited, productId]);

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

  // 切换选中夹时, 同步「设为公开」初值 (默认收藏不参与)。
  useEffect(() => {
    if (selectedId === DEFAULT_COLLECTION_ID) {
      setMakePublic(false);
      return;
    }
    const target = collections.find((c) => c.id === selectedId);
    setMakePublic(target?.visibility === "public");
  }, [selectedId, collections]);

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedId),
    [collections, selectedId],
  );

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 1) 未收藏 → 先 favorite (后端 idempotent)
      if (!isFavorited) {
        await favoriteStoreProduct(productId);
      }

      if (selectedId === DEFAULT_COLLECTION_ID) {
        // 选「默认收藏」: 把商品从所有自建收藏夹移出 (collection_id 置 null)
        for (const c of collections) {
          try {
            await removeProductFromCollection(c.id, productId);
          } catch {
            // 商品可能不在该 folder, 忽略
          }
        }
      } else {
        // 选自建收藏夹: 直接 add (后端会更新 collection_id 到指定夹)
        await addProductToCollection(selectedId, productId);
        // 同步 visibility
        if (selectedCollection) {
          const desired: "public" | "private" = makePublic ? "public" : "private";
          if (selectedCollection.visibility !== desired) {
            try {
              await updateCollection(selectedId, { visibility: desired });
            } catch (e) {
              console.warn("[SaveToCollectionSheet] visibility update failed", e);
            }
          }
        }
      }

      onSaved?.(selectedId === DEFAULT_COLLECTION_ID ? null : selectedId);
      Alert.show(
        selectedId === DEFAULT_COLLECTION_ID
          ? t("collections.savedToDefault")
          : t("collections.saved"),
      );
      onClose();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("collections.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [
    collections,
    isFavorited,
    makePublic,
    onClose,
    onSaved,
    productId,
    selectedCollection,
    selectedId,
    submitting,
    t,
  ]);

  const handleRemoveFavorite = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await unfavoriteStoreProduct(productId);
      onUnsaved?.();
      Alert.show(t("collections.removed"));
      onClose();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("collections.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [onClose, onUnsaved, productId, submitting, t]);

  const handleCreateAndSelect = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      Alert.show(t("collections.nameRequired"));
      return;
    }
    setCreateSubmitting(true);
    try {
      const created = await createCollection({ name });
      setCollections((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setMakePublic(created.visibility === "public");
      setCreating(false);
      setNewName("");
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("collections.createFailed"));
    } finally {
      setCreateSubmitting(false);
    }
  }, [newName, t]);

  const totalDefault = useMemo(() => {
    // 没有现成的 default 总数; 先显示 0 - 上层若关心可在 onSaved 后再拉一次
    // (sheet 本身不依赖这个数据驱动逻辑, 仅展示)。
    return 0;
  }, []);

  const isPublicAllowed = selectedId !== DEFAULT_COLLECTION_ID;

  // ===== 列表项 =====
  type Row =
    | { kind: "default"; total: number }
    | { kind: "folder"; collection: UserCollection };

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [{ kind: "default", total: totalDefault }];
    for (const c of collections) list.push({ kind: "folder", collection: c });
    return list;
  }, [collections, totalDefault]);

  const renderRow = (row: Row) => {
    if (row.kind === "default") {
      const isSelected = selectedId === DEFAULT_COLLECTION_ID;
      return (
        <TouchableOpacity
          key="__default__"
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => setSelectedId(DEFAULT_COLLECTION_ID)}
        >
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="bookmark" size={20} color={theme.colors.text} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {t("collections.defaultCollection")}
            </Text>
            <Text style={styles.rowSubtitle}>
              {t("collections.defaultDescription")}
            </Text>
          </View>
          <View style={[styles.radio, isSelected && styles.radioActive]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      );
    }
    const c = row.collection;
    const isSelected = selectedId === c.id;
    return (
      <TouchableOpacity
        key={`c-${c.id}`}
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => setSelectedId(c.id)}
      >
        <View style={[styles.cover, styles.coverPlaceholder]}>
          {c.coverProductId ? (
            <Ionicons name="folder" size={20} color={theme.colors.text} />
          ) : (
            <Ionicons name="folder-outline" size={20} color={theme.colors.text} />
          )}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.rowSubtitle}>
            {t("collections.itemCountShort", { count: c.itemCount ?? 0 })}
            <Text style={styles.rowSubtitle}> · </Text>
            {c.visibility === "public"
              ? t("collections.visibilityPublic")
              : t("collections.visibilityPrivate")}
          </Text>
        </View>
        <View style={[styles.radio, isSelected && styles.radioActive]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>
    );
  };

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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        pointerEvents="box-none"
      >
      <Animated.View
        style={[
          styles.sheetOuter,
          { paddingBottom: insets.bottom || 16 },
          { transform: [{ translateY }] },
        ]}
      >
        <Box style={styles.sheet}>
          {/* 抓手 */}
          <View style={styles.grabber} />

          {/* 标题 + 「新建收藏夹」 */}
          <HStack
            alignItems="center"
            justifyContent="between"
            style={styles.headerRow}
          >
            <Text style={styles.title}>{t("collections.sheetTitle")}</Text>
            {!creating ? (
              <TouchableOpacity
                onPress={() => setCreating(true)}
                style={styles.newBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.newBtnText}>
                  {t("collections.newCollection")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </HStack>

          {/* inline 创建输入 */}
          {creating && (
            <View style={styles.createRow}>
              <Box style={[styles.cover, styles.coverPlaceholder]}>
                <Ionicons name="add" size={20} color={theme.colors.text} />
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
                onPress={() => {
                  setCreating(false);
                  setNewName("");
                }}
                style={styles.createCancelBtn}
                disabled={createSubmitting}
              >
                <Text style={styles.createCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateAndSelect}
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
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.colors.text} />
            </View>
          ) : (
            <ScrollView
              style={styles.listScroll}
              showsVerticalScrollIndicator={false}
            >
              {rows.map(renderRow)}
              {/* 已收藏 → 提供取消收藏入口 */}
              {isFavorited && (
                <TouchableOpacity
                  style={styles.removeRow}
                  onPress={handleRemoveFavorite}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeText}>
                    {t("collections.removeFavorite")}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* 底部固定区: 公开开关 + 完成按钮 */}
          {!loading && (
            <View style={styles.footer}>
              <View style={styles.footerSwitchRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={
                    isPublicAllowed ? theme.colors.text : theme.colors.gray300
                  }
                />
                <Text
                  style={[
                    styles.footerSwitchLabel,
                    !isPublicAllowed && { color: theme.colors.gray300 },
                  ]}
                >
                  {t("collections.setPublic")}
                </Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={makePublic}
                  onValueChange={setMakePublic}
                  disabled={!isPublicAllowed}
                  trackColor={{
                    false: theme.colors.gray200,
                    true: theme.colors.text,
                  }}
                  thumbColor={theme.colors.card}
                />
              </View>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={handleConfirm}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textInverted}
                  />
                ) : (
                  <Text style={styles.doneBtnText}>
                    {t("collections.confirm")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Box>
      </Animated.View>
      </KeyboardAvoidingView>
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
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    sheetOuter: {
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      overflow: "hidden",
      maxHeight: SCREEN_HEIGHT * 0.85,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.gray200,
      alignSelf: "center",
      marginTop: 8,
    },
    headerRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: t.colors.text,
    },
    newBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
    },
    newBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: t.colors.text,
    },
    loadingWrap: { paddingVertical: 48, alignItems: "center" },
    listScroll: { maxHeight: SCREEN_HEIGHT * 0.5 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    rowBody: { flex: 1, marginLeft: 12 },
    rowTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    cover: {
      width: 44,
      height: 44,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      overflow: "hidden",
    },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: t.colors.text,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: t.colors.text,
    },
    removeRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
    },
    removeText: {
      fontSize: 14,
      fontWeight: "500",
      color: t.colors.error,
    },
    createRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
      gap: 6,
    },
    input: {
      flex: 1,
      marginLeft: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      fontSize: 14,
    },
    createCancelBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
    },
    createCancelText: {
      fontSize: 12,
      color: t.colors.text,
    },
    createConfirmBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.accent,
    },
    createConfirmText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.divider,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    footerSwitchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    footerSwitchLabel: {
      fontSize: 13,
      color: t.colors.text,
      fontWeight: "500",
    },
    doneBtn: {
      marginTop: 12,
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    doneBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default SaveToCollectionSheet;
