/**
 * CollectionsContent —— 「收藏」一级 tab 的内容区。
 *
 * sub-chip:
 *   - posts    = 帖子收藏 (post_favorites, 复用 tabsData.saved)
 *   - stores   = 买手店收藏 (buyer_store_favorites, 复用 storeActivity.favorites)
 *   - products = 产品收藏 (user_collections 收藏夹 grid + 默认收藏)
 *
 * 产品收藏 tab 里嵌入了 MyCollectionsScreen 的核心 UI:
 *   - 顶部固定一张「默认收藏」卡 (collection_id IS NULL)
 *   - 下方网格列出用户自建收藏夹
 *   - 右上角「+」 创建新收藏夹
 *   - 卡片长按 ActionSheet 提供 重命名 / 删除
 *
 * 帖子 / 买手店分支使用 Profile 已有的卡片样式，保持视觉风格一致。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  theme,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
} from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import { AnimatedChip, chipRowStyle } from "../../../components/ui";
import PostCard, { Post as DisplayPost } from "../../../components/PostCard";
import { splitIntoMasonryColumns } from "../../../utils/masonryLayout";
import { Alert } from "../../../utils/Alert";
import {
  TabData,
  CollectionsSubTab,
} from "../types";
import {
  UserFavoritedStore,
  UserStoreActivity,
} from "../../../services/buyerStoreService";
import {
  createCollection,
  deleteCollection,
  updateCollection,
  type UserCollection,
} from "../../../services/tradingExtrasService";
import { PF } from "../styles";

interface CollectionsContentProps {
  /** 当前激活的 sub-chip */
  collectionsSubTab: CollectionsSubTab;
  setCollectionsSubTab: (sub: CollectionsSubTab) => void;

  // ===== posts =====
  postsFavData: TabData;
  onPostPress: (post: DisplayPost) => void;
  onLike?: (postId: string) => void;

  // ===== stores =====
  storeActivity: UserStoreActivity | null;
  storeActivityLoading: boolean;
  onStorePress: (storeId: string) => void;

  // ===== products =====
  collectionFolders: UserCollection[];
  defaultCollectionTotal: number;
  defaultCollectionCover: string | null;
  collectionsLoading: boolean;
  onProductFolderPress: (collectionId: number | null, title?: string) => void;
  /** 创建/重命名/删除 完成后由外层重新拉取一次数据 */
  onFoldersChanged: () => Promise<void> | void;
}

export const CollectionsContent: React.FC<CollectionsContentProps> = ({
  collectionsSubTab,
  setCollectionsSubTab,
  postsFavData,
  onPostPress,
  onLike,
  storeActivity,
  storeActivityLoading,
  onStorePress,
  collectionFolders,
  defaultCollectionTotal,
  defaultCollectionCover,
  collectionsLoading,
  onProductFolderPress,
  onFoldersChanged,
}) => {
  const { t } = useTranslation();
  const appTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  // 编辑 / 长按 状态 —— 与原 MyCollectionsScreen 行为一致。
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorTarget, setEditorTarget] = useState<UserCollection | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorSubmitting, setEditorSubmitting] = useState(false);
  const [actionTarget, setActionTarget] = useState<UserCollection | null>(null);

  const postsCount = postsFavData.count;
  const storesCount = storeActivity?.favoritesTotal ?? 0;
  // 产品收藏总数 = 默认收藏件数 + 所有自建收藏夹件数。
  const productsCount = useMemo(() => {
    const folderTotal = collectionFolders.reduce(
      (sum, c) => sum + (c.itemCount ?? 0),
      0,
    );
    return defaultCollectionTotal + folderTotal;
  }, [collectionFolders, defaultCollectionTotal]);

  const subTabs: { id: CollectionsSubTab; label: string; count: number }[] = [
    { id: "posts", label: t("profileCollections.posts"), count: postsCount },
    { id: "stores", label: t("profileCollections.stores"), count: storesCount },
    {
      id: "products",
      label: t("profileCollections.products"),
      count: productsCount,
    },
  ];

  // ===== Posts 子分支 =====
  const renderPosts = () => {
    if (postsFavData.isLoading && !postsFavData.hasLoaded) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
        </VStack>
      );
    }
    if (postsFavData.posts.length === 0) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name="bookmark-outline" size={24} color={appTheme.colors.gray300} />
          <Text style={[{ fontFamily: PF.regular, textAlign: "center" }, { color: appTheme.colors.gray400 }]} mt="$md">
            {t("profileCollections.noPosts")}
          </Text>
        </VStack>
      );
    }
    const cols = splitIntoMasonryColumns(
      postsFavData.posts,
      (post) => post.content?.images?.[0] || post.image,
    );
    return (
      <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
        {cols.map((column, colIndex) => (
          <VStack key={colIndex} flex={1} space="sm">
            {column.map((post) => (
              <Pressable key={post.id} onPress={() => onPostPress(post)}>
                <PostCard post={post} onPress={() => onPostPress(post)} onLike={onLike} />
              </Pressable>
            ))}
          </VStack>
        ))}
      </HStack>
    );
  };

  // ===== Stores 子分支 =====
  const renderStoreRow = (item: UserFavoritedStore) => (
    <Pressable
      key={item.storeId}
      style={styles.storeCard}
      onPress={() => onStorePress(item.storeId)}
    >
      {item.storeImage ? (
        <OptimizedImage uri={item.storeImage} style={styles.storeImage} />
      ) : (
        <View style={[styles.storeImage, styles.storePlaceholder]}>
          <Ionicons name="storefront-outline" size={24} color={appTheme.colors.gray300} />
        </View>
      )}
      <View style={styles.storeBody}>
        <RNText style={styles.storeName} numberOfLines={1}>{item.storeName}</RNText>
        <RNText style={styles.storeLocation} numberOfLines={1}>
          {[item.storeCity, item.storeCountry].filter(Boolean).join(", ")}
        </RNText>
        <View style={styles.storeMetaRow}>
          <Ionicons name="heart" size={12} color={appTheme.colors.error} />
          <RNText style={styles.storeMetaText}>{formatDate(item.createdAt)}</RNText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={appTheme.colors.gray300} />
    </Pressable>
  );

  const renderStores = () => {
    if (storeActivityLoading && !storeActivity) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
        </VStack>
      );
    }
    const list = storeActivity?.favorites ?? [];
    if (list.length === 0) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name="heart-outline" size={24} color={appTheme.colors.gray300} />
          <Text style={[{ fontFamily: PF.regular, textAlign: "center" }, { color: appTheme.colors.gray400 }]} mt="$md">
            {t("profileCollections.noStores")}
          </Text>
        </VStack>
      );
    }
    return <VStack py="$sm">{list.map(renderStoreRow)}</VStack>;
  };

  // ===== Products 子分支：收藏夹 grid =====
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
      await onFoldersChanged();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("collections.saveFailed"));
    } finally {
      setEditorSubmitting(false);
    }
  }, [editorName, editorTarget, onFoldersChanged, t]);

  const handleDeleteFolder = useCallback(
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
                await onFoldersChanged();
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
    [onFoldersChanged, t],
  );

  const folderCards = useMemo(() => {
    type Card =
      | { type: "default"; total: number; cover: string | null }
      | { type: "folder"; collection: UserCollection };
    const list: Card[] = [];
    list.push({
      type: "default",
      total: defaultCollectionTotal,
      cover: defaultCollectionCover,
    });
    for (const c of collectionFolders) list.push({ type: "folder", collection: c });
    return list;
  }, [collectionFolders, defaultCollectionCover, defaultCollectionTotal]);

  const renderFolderCard = (
    item: (typeof folderCards)[number],
    idx: number,
  ) => {
    const key =
      item.type === "default" ? "__default__" : `c-${item.collection.id}-${idx}`;
    if (item.type === "default") {
      return (
        <Pressable
          key={key}
          style={styles.folderCard}
          onPress={() =>
            onProductFolderPress(null, t("collections.defaultCollection"))
          }
        >
          {item.cover ? (
            <OptimizedImage uri={item.cover} style={styles.folderCover} />
          ) : (
            <View style={[styles.folderCover, styles.folderCoverPlaceholder]}>
              <Ionicons name="bookmark" size={28} color={appTheme.colors.gray300} />
            </View>
          )}
          <RNText style={styles.folderTitle} numberOfLines={1}>
            {t("collections.defaultCollection")}
          </RNText>
          <RNText style={styles.folderSubtitle}>
            {t("collections.itemCountShort", { count: item.total })}
          </RNText>
        </Pressable>
      );
    }
    const c = item.collection;
    return (
      <Pressable
        key={key}
        style={styles.folderCard}
        onPress={() => onProductFolderPress(c.id, c.name)}
        onLongPress={() => setActionTarget(c)}
      >
        <View style={[styles.folderCover, styles.folderCoverPlaceholder]}>
          <Ionicons
            name={c.coverProductId ? "folder" : "folder-outline"}
            size={28}
            color={appTheme.colors.gray300}
          />
        </View>
        <RNText style={styles.folderTitle} numberOfLines={1}>{c.name}</RNText>
        <RNText style={styles.folderSubtitle}>
          {t("collections.itemCountShort", { count: c.itemCount ?? 0 })}
        </RNText>
      </Pressable>
    );
  };

  const renderProducts = () => {
    if (collectionsLoading && collectionFolders.length === 0) {
      return (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
        </VStack>
      );
    }
    return (
      <View style={styles.foldersWrap}>
        {/* 工具栏 —— 复用 chip 行的左对齐排版，右侧塞「新建收藏夹」按钮 */}
        <View style={styles.toolbar}>
          <RNText style={styles.toolbarLabel}>
            {t("collections.title")}
          </RNText>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={openCreate}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={appTheme.colors.text} />
            <RNText style={styles.toolbarBtnText}>
              {t("collections.newCollection")}
            </RNText>
          </TouchableOpacity>
        </View>
        <View style={styles.folderGrid}>
          {folderCards.map((c, i) => renderFolderCard(c, i))}
        </View>
        {folderCards.length === 1 && defaultCollectionTotal === 0 && !collectionsLoading && (
          <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 120 }}>
            <Ionicons
              name="bookmark-outline"
              size={24}
              color={appTheme.colors.gray300}
            />
            <Text
              style={[
                { fontFamily: PF.regular, textAlign: "center", paddingHorizontal: 24 },
                { color: appTheme.colors.gray400 },
              ]}
              mt="$md"
            >
              {t("profileCollections.noProducts")}
            </Text>
          </VStack>
        )}
      </View>
    );
  };

  return (
    <VStack>
      <View
        style={{
          paddingHorizontal: appTheme.spacing.md,
          paddingVertical: 10,
        }}
      >
        <View style={chipRowStyle}>
          {subTabs.map((st) => (
            <AnimatedChip
              key={st.id}
              label={st.label}
              count={st.count}
              showZeroCount
              isActive={collectionsSubTab === st.id}
              onPress={() => setCollectionsSubTab(st.id)}
            />
          ))}
        </View>
      </View>

      {collectionsSubTab === "posts"
        ? renderPosts()
        : collectionsSubTab === "stores"
          ? renderStores()
          : renderProducts()}

      {/* 长按收藏夹 ActionSheet —— 重命名 / 删除 */}
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
                color={appTheme.colors.text}
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
                color={appTheme.colors.error}
              />
            ),
            onPress: () => {
              if (actionTarget) handleDeleteFolder(actionTarget);
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
            <RNText style={styles.modalTitle}>
              {editorTarget
                ? t("collections.renameTitle")
                : t("collections.createTitle")}
            </RNText>
            <TextInput
              style={styles.modalInput}
              value={editorName}
              onChangeText={setEditorName}
              placeholder={t("collections.namePlaceholder") as string}
              placeholderTextColor={appTheme.colors.placeholder}
              maxLength={32}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setEditorVisible(false)}
                disabled={editorSubmitting}
              >
                <RNText style={styles.modalBtnGhostText}>
                  {t("common.cancel")}
                </RNText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleSubmitEditor}
                disabled={editorSubmitting}
              >
                {editorSubmitting ? (
                  <ActivityIndicator size="small" color={appTheme.colors.textInverted} />
                ) : (
                  <RNText style={styles.modalBtnPrimaryText}>
                    {editorTarget ? t("common.save") : t("collections.create")}
                  </RNText>
                )}
              </TouchableOpacity>
            </View>
          </Box>
        </View>
      </Modal>
    </VStack>
  );
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    // ===== 买手店 row 卡片 =====
    storeCard: {
      flexDirection: "row",
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.gray200,
      gap: 12,
      alignItems: "center",
    },
    storeImage: {
      width: 60,
      height: 60,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.gray100,
    },
    storePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    storeBody: {
      flex: 1,
      gap: 4,
    },
    storeName: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      fontFamily: PF.medium,
    },
    storeLocation: {
      fontSize: 12,
      color: t.colors.gray400,
      fontFamily: PF.regular,
    },
    storeMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    storeMetaText: {
      fontSize: 11,
      color: t.colors.gray400,
      fontFamily: PF.regular,
    },

    // ===== 收藏夹 grid =====
    foldersWrap: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 16,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    toolbarLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray400,
      fontFamily: PF.medium,
    },
    toolbarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
    },
    toolbarBtnText: {
      fontSize: 12,
      fontWeight: "500",
      color: t.colors.text,
      fontFamily: PF.medium,
    },
    folderGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    folderCard: {
      width: "48%",
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    folderCover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    folderCoverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    folderTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 8,
      fontFamily: PF.medium,
    },
    folderSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
      fontFamily: PF.regular,
    },

    // ===== 创建 / 重命名 弹窗 =====
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
      borderRadius: t.borderRadius.sm,
      padding: 20,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
      fontFamily: PF.medium,
    },
    modalInput: {
      backgroundColor: t.colors.surface,
      color: t.colors.text,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    modalBtnRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: t.borderRadius.sm,
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
      fontFamily: PF.medium,
    },
    modalBtnGhost: {
      backgroundColor: t.colors.surface,
    },
    modalBtnGhostText: {
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "500",
      fontFamily: PF.regular,
    },
  });

export default CollectionsContent;
