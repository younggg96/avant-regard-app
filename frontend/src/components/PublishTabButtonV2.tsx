import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  Text as RNText,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { theme, useThemedStyles, type AppTheme } from "../theme";
import { useDiscoverTabStore } from "../store/discoverTabStore";
import { useMainBottomTabStore } from "../store/mainBottomTabStore";
import { useAuthStore } from "../store/authStore";
import { usePublishListingStore } from "../store/publishListingStore";

/**
 * 发布按钮 V2
 * ------------------------------------------------------------------
 * 与原 `PublishTabButton` 行为差异：
 *   - 原版：永远跳 `PublishType`（六选一聚合屏）。
 *   - V2  ：根据主 Tab / Discover 子 Tab 分流：
 *       · Archive Tab → `SubmitBrand`（上传品牌全屏，对齐 Archive 业务）
 *       · Discover·论坛 → `PublishV2ForumMode`
 *       · Discover·买手店 → `SubmitStore`
 *       · 其它 → `PublishV2Composer`
 *
 * V2 完全独立于 V1 流程，原 `PublishTypeScreen` 等屏仍然保留并可被
 * 别的入口（例如 PostCard 编辑、AI 预览页）继续 navigate 进去。
 */

const PublishTabButtonV2: React.FC<{ onPress?: (event: unknown) => void }> = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [sheetVisible, setSheetVisible] = useState(false);
  // 「交易」Tab 下打开的是双选 Sheet（发布单品 / 从以往帖子转入），
  // 其它 Tab 仍走 4 选 Sheet。用一个本地状态记录打开瞬间的模式，
  // 避免用户在 Sheet 展开期间又切 Tab 导致选项闪烁。
  const [sheetMode, setSheetMode] = useState<"full" | "tradingOnly">("full");

  // 中央「+」按钮触发：买手店 Tab 是上传新店；Archive Tab 是上传品牌；
  // 交易 Tab 弹「发布单品 / 从以往帖子转入」双选；
  // 其它情形（论坛 / 推荐 / 关注）弹 PRD 1.1 完整四选 Action Sheet。
  const handlePress = () => {
    const mainTab = useMainBottomTabStore.getState().activeMainTab;
    if (mainTab === "Archive") {
      const { user } = useAuthStore.getState();
      if (!user?.userId) {
        Alert.alert(t("common.hint"), t("archive.loginToSubmitBrand"));
        return;
      }
      // @ts-expect-error - navigation types
      navigation.navigate("SubmitBrand");
      return;
    }

    const { activeTab } = useDiscoverTabStore.getState();
    if (activeTab === "buyer") {
      // @ts-expect-error - navigation types
      navigation.navigate("SubmitStore");
      return;
    }
    setSheetMode(activeTab === "trading" ? "tradingOnly" : "full");
    setSheetVisible(true);
  };

  const handleSelectListing = () => {
    setSheetVisible(false);
    const { user } = useAuthStore.getState();
    if (!user?.userId) {
      Alert.alert(t("common.hint"), t("trading.publishSheet.loginRequired"));
      return;
    }
    // 重置 Wizard 状态后跳到 Step 1
    usePublishListingStore.getState().reset({ sellerKind: "individual" });
    // @ts-expect-error - navigation types
    navigation.navigate("PublishListingStep1");
  };

  // PDF p.13 设计要点：从以往帖子转入 —— 让卖家把已有论坛帖 / Lookbook 一键转单品
  const handleSelectRepost = () => {
    setSheetVisible(false);
    const { user } = useAuthStore.getState();
    if (!user?.userId) {
      Alert.alert(t("common.hint"), t("trading.publishSheet.loginRequired"));
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("PublishFromPostPicker");
  };

  const handleSelectPost = () => {
    setSheetVisible(false);
    // @ts-expect-error - navigation types
    navigation.navigate("PublishV2Composer");
  };

  const handleSelectShow = () => {
    setSheetVisible(false);
    const { user } = useAuthStore.getState();
    if (!user?.userId) {
      Alert.alert(t("common.hint"), t("archive.loginToSubmitBrand"));
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("SubmitBrand");
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.button}>
          <Ionicons name="add" size={28} color={theme.colors.textInverted} />
        </View>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={sheetVisible}
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSheetVisible(false)}
        >
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {sheetMode === "tradingOnly" ? (
              <>
                <SheetItem
                  icon="pricetag-outline"
                  title={t("trading.publishSheetTrading.listingTitle")}
                  subtitle={t("trading.publishSheetTrading.listingSubtitle")}
                  onPress={handleSelectListing}
                />
                <SheetItem
                  icon="copy-outline"
                  title={t("trading.publishSheetTrading.repostTitle")}
                  subtitle={t("trading.publishSheetTrading.repostSubtitle")}
                  onPress={handleSelectRepost}
                />
              </>
            ) : (
              <>
                <SheetItem
                  icon="pricetag-outline"
                  title={t("trading.publishSheet.listingTitle")}
                  subtitle={t("trading.publishSheet.listingSubtitle")}
                  onPress={handleSelectListing}
                />
                <SheetItem
                  icon="copy-outline"
                  title={t("trading.publishSheet.repostTitle")}
                  subtitle={t("trading.publishSheet.repostSubtitle")}
                  onPress={handleSelectRepost}
                />
                <SheetItem
                  icon="create-outline"
                  title={t("trading.publishSheet.noteTitle")}
                  subtitle={t("trading.publishSheet.noteSubtitle")}
                  onPress={handleSelectPost}
                />
                <SheetItem
                  icon="albums-outline"
                  title={t("trading.publishSheet.showTitle")}
                  subtitle={t("trading.publishSheet.showSubtitle")}
                  onPress={handleSelectShow}
                />
              </>
            )}
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setSheetVisible(false)}
            >
              <View style={styles.sheetCancelInner}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const SheetItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.sheetItem} onPress={onPress}>
      <View style={styles.sheetItemIcon}>
        <Ionicons name={icon} size={22} color={theme.colors.text} />
      </View>
      <View style={styles.sheetItemBody}>
        <RNText style={styles.sheetItemTitle}>{title}</RNText>
        <RNText style={styles.sheetItemSubtitle}>{subtitle}</RNText>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      top: -10,
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: t.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      justifyContent: "flex-end",
    },
    sheetContainer: {
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 28,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    sheetItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    sheetItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    sheetItemBody: { flex: 1 },
    sheetItemTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    sheetItemSubtitle: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    sheetCancel: { marginTop: 8, alignItems: "center" },
    sheetCancelInner: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    sheetItemTitleRow: {},
    sheetItemTitleWrap: {},
    sheetItemTitleInner: {},
    sheetItemTitleBlock: {},
    sheetItemArrow: {},
  });

export default PublishTabButtonV2;
