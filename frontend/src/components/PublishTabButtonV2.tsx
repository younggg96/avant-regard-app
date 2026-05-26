import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  Text as RNText,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { useDiscoverTabStore } from "../store/discoverTabStore";
import { useMainBottomTabStore } from "../store/mainBottomTabStore";
import { useAuthStore } from "../store/authStore";
import { usePublishListingStore } from "../store/publishListingStore";

/** 从底部 Tab 的「+」按钮跳到根 Stack 上的发布相关页面 */
type PublishButtonNav = {
  getParent?: () => PublishButtonNav | undefined;
  navigate: (name: string, params?: Record<string, unknown>) => void;
};

function navigateFromPublishButton(
  navigation: PublishButtonNav,
  screen: string,
  params?: Record<string, unknown>,
) {
  const rootNav = navigation.getParent?.() ?? navigation;
  rootNav.navigate(screen, params);
}

type PublishSheetMode = "trading" | "all";

type PublishSheetItemDef = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subtitleKey: string;
};

const TRADING_SHEET_ITEMS: PublishSheetItemDef[] = [
  {
    id: "listing",
    icon: "pricetag-outline",
    titleKey: "trading.publishSheetTrading.listingTitle",
    subtitleKey: "trading.publishSheetTrading.listingSubtitle",
  },
  {
    id: "repost",
    icon: "copy-outline",
    titleKey: "trading.publishSheetTrading.repostTitle",
    subtitleKey: "trading.publishSheetTrading.repostSubtitle",
  },
];

const ALL_SHEET_ITEMS: PublishSheetItemDef[] = [
  {
    id: "composer",
    icon: "create-outline",
    titleKey: "publish.publishSheetAll.composerTitle",
    subtitleKey: "publish.publishSheetAll.composerSubtitle",
  },
  {
    id: "forum",
    icon: "chatbubbles-outline",
    titleKey: "publish.publishSheetAll.forumTitle",
    subtitleKey: "publish.publishSheetAll.forumSubtitle",
  },
  {
    id: "store",
    icon: "storefront-outline",
    titleKey: "publish.publishSheetAll.storeTitle",
    subtitleKey: "publish.publishSheetAll.storeSubtitle",
  },
  {
    id: "listing",
    icon: "pricetag-outline",
    titleKey: "publish.publishSheetAll.listingTitle",
    subtitleKey: "publish.publishSheetAll.listingSubtitle",
  },
  {
    id: "repost",
    icon: "copy-outline",
    titleKey: "publish.publishSheetAll.repostTitle",
    subtitleKey: "publish.publishSheetAll.repostSubtitle",
  },
  {
    id: "brand",
    icon: "ribbon-outline",
    titleKey: "publish.publishSheetAll.brandTitle",
    subtitleKey: "publish.publishSheetAll.brandSubtitle",
  },
  {
    id: "ai",
    icon: "sparkles",
    titleKey: "publish.publishSheetAll.aiTitle",
    subtitleKey: "publish.publishSheetAll.aiSubtitle",
  },
];

/**
 * 发布按钮 V2
 * ------------------------------------------------------------------
 * 与原 `PublishTabButton` 行为差异：
 *   - 原版：永远跳 `PublishType`（六选一聚合屏）。
 *   - V2  ：根据主 Tab / Discover 子 Tab 分流：
 *       · Archive Tab → `SubmitBrand`（上传品牌全屏，对齐 Archive 业务）
 *       · Discover·论坛 → `PublishV2ForumMode`
 *       · Discover·买手店 → `SubmitStore`
 *       · Discover·推荐 / 关注 → `PublishV2Composer`（直接写笔记 / Lookbook）
 *       · Discover·交易 → 双选 Sheet（发布单品 / 从以往帖子转入）
 *       · 未知子 Tab → 全量 Sheet（上述全部入口 + 品牌 + AI 发帖）
 *
 * V2 完全独立于 V1 流程，原 `PublishTypeScreen` 等屏仍然保留并可被
 * 别的入口（例如 PostCard 编辑、AI 预览页）继续 navigate 进去。
 */

const PublishTabButtonV2: React.FC<{ onPress?: (event: unknown) => void }> = () => {
  const navigation = useNavigation() as PublishButtonNav;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<PublishSheetMode>("trading");
  const discoverActiveTab = useDiscoverTabStore((s) => s.activeTab);

  const openSheet = (mode: PublishSheetMode) => {
    setSheetMode(mode);
    setSheetVisible(true);
  };

  const closeSheet = () => setSheetVisible(false);

  const ensureLoggedIn = (messageKey: string): boolean => {
    const { user } = useAuthStore.getState();
    if (!user?.userId) {
      Alert.alert(t("common.hint"), t(messageKey));
      return false;
    }
    return true;
  };

  // 中央「+」按钮：按当前 Discover 子 Tab 分流到对应发布流程。
  const handlePress = () => {
    const mainTab = useMainBottomTabStore.getState().activeMainTab;
    if (mainTab === "Archive") {
      const { user } = useAuthStore.getState();
      if (!user?.userId) {
        Alert.alert(t("common.hint"), t("archive.loginToSubmitBrand"));
        return;
      }
      navigateFromPublishButton(navigation, "SubmitBrand");
      return;
    }

    const activeTab = discoverActiveTab;
    if (activeTab === "buyer") {
      navigateFromPublishButton(navigation, "SubmitStore");
      return;
    }
    if (activeTab === "forum") {
      const { user } = useAuthStore.getState();
      if (!user?.userId) {
        Alert.alert(t("common.hint"), t("publish.loginRequired"));
        return;
      }
      navigateFromPublishButton(navigation, "PublishV2ForumMode");
      return;
    }
    if (activeTab === "recommend" || activeTab === "following") {
      const { user } = useAuthStore.getState();
      if (!user?.userId) {
        Alert.alert(t("common.hint"), t("publish.loginRequired"));
        return;
      }
      navigateFromPublishButton(navigation, "PublishV2Composer");
      return;
    }
    if (activeTab === "trading") {
      openSheet("trading");
      return;
    }
    // 兜底：未知子 Tab → 展示全部可发布入口
    openSheet("all");
  };

  const handleSheetItemPress = (id: string) => {
    closeSheet();
    switch (id) {
      case "composer":
        if (!ensureLoggedIn("publish.loginRequired")) return;
        navigateFromPublishButton(navigation, "PublishV2Composer");
        break;
      case "forum":
        if (!ensureLoggedIn("publish.loginRequired")) return;
        navigateFromPublishButton(navigation, "PublishV2ForumMode");
        break;
      case "store":
        navigateFromPublishButton(navigation, "SubmitStore");
        break;
      case "listing":
        if (!ensureLoggedIn("trading.publishSheet.loginRequired")) return;
        usePublishListingStore.getState().reset({ sellerKind: "individual" });
        navigateFromPublishButton(navigation, "PublishListingStep1");
        break;
      case "repost":
        if (!ensureLoggedIn("trading.publishSheet.loginRequired")) return;
        navigateFromPublishButton(navigation, "PublishFromPostPicker");
        break;
      case "brand":
        if (!ensureLoggedIn("archive.loginToSubmitBrand")) return;
        navigateFromPublishButton(navigation, "SubmitBrand");
        break;
      case "ai":
        if (!ensureLoggedIn("publish.loginRequired")) return;
        navigateFromPublishButton(navigation, "AIPostEntry");
        break;
      default:
        break;
    }
  };

  const sheetItems =
    sheetMode === "trading" ? TRADING_SHEET_ITEMS : ALL_SHEET_ITEMS;

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
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {sheetMode === "all" ? (
              <RNText style={styles.sheetTitle}>
                {t("publish.publishSheetAll.title")}
              </RNText>
            ) : null}
            <ScrollView
              style={sheetMode === "all" ? styles.sheetScroll : undefined}
              bounces={false}
              showsVerticalScrollIndicator={sheetMode === "all"}
            >
              {sheetItems.map((item) => (
                <SheetItem
                  key={item.id}
                  icon={item.icon}
                  title={t(item.titleKey)}
                  subtitle={t(item.subtitleKey)}
                  onPress={() => handleSheetItemPress(item.id)}
                />
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={closeSheet}>
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
  const theme = useAppTheme();
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
      borderRadius: 4,
      backgroundColor: t.colors.text,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
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
    sheetTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 4,
    },
    sheetScroll: {
      maxHeight: 420,
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
  });

export default PublishTabButtonV2;
