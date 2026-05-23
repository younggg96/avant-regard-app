/**
 * MyCollectionsScreen —— "我的收藏" 总入口 (PRD 模块三 3.4)。
 *
 * 顶部固定一张 "默认收藏" 卡片 (未分组的所有 favorite, collection_id IS NULL),
 * 下方网格列出用户自建的收藏夹 (如 Rick Owens 收藏夹), 显示封面 / 件数。
 *
 * 右上 "+" 创建新收藏夹; 收藏夹卡片长按弹出 ActionSheet 提供重命名 / 删除。
 *
 * 收藏夹的核心价值:
 *   1. 找回 — 这里就是入口
 *   2. 状态提醒 — 由后端 notification_service 推送到通知中心
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import ScreenHeader from "../components/ScreenHeader";
import { ActionSheet } from "../components/ui/ActionSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  createCollection,
  deleteCollection,
  listMyCollections,
  updateCollection,
  type UserCollection,
} from "../services/tradingExtrasService";
import {
  listMyFavoritedStoreProducts,
  type StoreProduct,
} from "../services/storeProductService";

interface DefaultBucketState {
  total: number;
  cover: string | null;
}

const MyCollectionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [defaultBucket, setDefaultBucket] = useState<DefaultBucketState>({
    total: 0,
    cover: null,
  });
  const [loading, setLoading] = useState(false);

  // 创建 / 重命名 弹窗
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorTarget, setEditorTarget] = useState<UserCollection | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorSubmitting, setEditorSubmitting] = useState(false);

  // 长按 ActionSheet
  const [actionTarget, setActionTarget] = useState<UserCollection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, defaultRes] = await Promise.all([
        listMyCollections(),
        listMyFavoritedStoreProducts(1, 1, { onlyDefault: true }),
      ]);
      setCollections(cols);
      const firstProduct: StoreProduct | undefined = defaultRes.products?.[0];
      setDefaultBucket({
        total: defaultRes.total || 0,
        cover: firstProduct?.images?.[0] ?? null,
      });
    } catch (e) {
      console.error("[MyCollectionsScreen] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // ====== 创建 / 重命名 ======

  const openCreate = useCallback(() => {
    setEditorTarget(null);
    setEditorName("");
    setEditorVisible(true);
  }, []);

  const openRename = useCallback((target: UserCollection) => {
    setEditorTarget(target);
    setEditorName(target.name);
    setEditorVisible(true);
  }, []);

  const handleSubmitEditor = useCallback(async () => {
    const name = editorName.trim();
    if (!name) {
      Alert.show(t("collections.nameRequired"));
      return;
    }
    setEditorSubmitting(true);
    try {
      if (editorTarget) {
        await updateCollection(editorTarget.id, { name });
        Alert.show(t("collections.renamed"));
      } else {
        await createCollection({ name });
        Alert.show(t("collections.created"));
      }
      setEditorVisible(false);
      await load();
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("collections.saveFailed"),
      );
    } finally {
      setEditorSubmitting(false);
    }
  }, [editorName, editorTarget, load, t]);

  const handleDelete = useCallback(
    (target: UserCollection) => {
      Alert.alert(
        t("collections.confirmDeleteTitle"),
        t("collections.confirmDeleteMessage", { name: target.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteCollection(target.id);
                Alert.show(t("collections.deleted"));
                await load();
              } catch (e) {
                Alert.show(
                  e instanceof Error ? e.message : t("collections.deleteFailed"),
                );
              }
            },
          },
        ],
      );
    },
    [load, t],
  );

  // ====== 渲染 ======

  const cards = useMemo(() => {
    type Card =
      | { type: "default"; total: number; cover: string | null }
      | { type: "folder"; collection: UserCollection };
    const list: Card[] = [];
    list.push({
      type: "default",
      total: defaultBucket.total,
      cover: defaultBucket.cover,
    });
    for (const c of collections) {
      list.push({ type: "folder", collection: c });
    }
    return list;
  }, [collections, defaultBucket]);

  const renderItem = ({ item }: { item: (typeof cards)[number] }) => {
    if (item.type === "default") {
      return (
        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate("UserCollectionDetail", {
              collectionId: null,
              title: t("collections.defaultCollection"),
            })
          }
        >
          {item.cover ? (
            <OptimizedImage uri={item.cover} style={styles.cover} />
          ) : (
            <Box style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons
                name="bookmark"
                size={32}
                color={theme.colors.gray300}
              />
            </Box>
          )}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {t("collections.defaultCollection")}
          </Text>
          <Text style={styles.cardSubtitle}>
            {t("collections.itemCountShort", { count: item.total })}
          </Text>
        </Pressable>
      );
    }
    const c = item.collection;
    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate("UserCollectionDetail", {
            collectionId: c.id,
            title: c.name,
          })
        }
        onLongPress={() => setActionTarget(c)}
      >
        {c.coverProductId ? (
          // 后端 cover_product_id 仅是 FK, 这里不解析具体图; 先用 placeholder.
          <Box style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons
              name="folder"
              size={32}
              color={theme.colors.gray300}
            />
          </Box>
        ) : (
          <Box style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons
              name="folder-outline"
              size={32}
              color={theme.colors.gray300}
            />
          </Box>
        )}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {c.name}
        </Text>
        <Text style={styles.cardSubtitle}>
          {t("collections.itemCountShort", { count: c.itemCount ?? 0 })}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("collections.title")}
        showBack
        rightActions={[
          {
            icon: "add",
            style: "ghost",
            onPress: openCreate,
          },
        ]}
      />

      <FlatList
        data={cards}
        keyExtractor={(item, idx) =>
          item.type === "default" ? "__default__" : `c-${item.collection.id}-${idx}`
        }
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.colors.text}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="bookmark-outline"
                size={48}
                color={theme.colors.gray200}
              />
              <Text style={styles.emptyText}>{t("collections.empty")}</Text>
            </View>
          )
        }
      />

      {/* 长按 ActionSheet */}
      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.name}
        actions={[
          {
            label: t("collections.rename"),
            icon: (
              <Ionicons
                name="create-outline"
                size={20}
                color={theme.colors.text}
              />
            ),
            onPress: () => {
              if (actionTarget) openRename(actionTarget);
            },
          },
          {
            label: t("common.delete"),
            destructive: true,
            icon: (
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.colors.error}
              />
            ),
            onPress: () => {
              if (actionTarget) handleDelete(actionTarget);
            },
          },
        ]}
      />

      {/* 创建 / 重命名 弹窗 */}
      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Box style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editorTarget
                ? t("collections.renameTitle")
                : t("collections.createTitle")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editorName}
              onChangeText={setEditorName}
              placeholder={t("collections.namePlaceholder") as string}
              placeholderTextColor={theme.colors.placeholder}
              maxLength={32}
              autoFocus
            />
            <HStack space="md" style={{ marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setEditorVisible(false)}
                disabled={editorSubmitting}
              >
                <Text style={styles.modalBtnGhostText}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleSubmitEditor}
                disabled={editorSubmitting}
              >
                {editorSubmitting ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textInverted}
                  />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>
                    {editorTarget ? t("common.save") : t("collections.create")}
                  </Text>
                )}
              </TouchableOpacity>
            </HStack>
          </Box>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    listContent: { padding: 12, paddingBottom: 32 },
    columnWrapper: { justifyContent: "space-between" },
    card: {
      width: "48%",
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 8,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
    },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 8,
    },
    cardSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 64,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 13,
      color: t.colors.gray300,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    modalCard: {
      width: "100%",
      backgroundColor: t.colors.card,
      borderRadius: 12,
      padding: 20,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    modalInput: {
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnPrimary: {
      backgroundColor: t.colors.accent,
    },
    modalBtnPrimaryText: {
      color: t.colors.textInverted,
      fontSize: 14,
      fontWeight: "600",
    },
    modalBtnGhost: {
      backgroundColor: t.colors.surface,
    },
    modalBtnGhostText: {
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
  });

export default MyCollectionsScreen;
