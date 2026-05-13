import React from "react";
import { View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { theme, useThemedStyles, type AppTheme } from "../theme";
import { useDiscoverTabStore } from "../store/discoverTabStore";
import { useMainBottomTabStore } from "../store/mainBottomTabStore";
import { useAuthStore } from "../store/authStore";

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
    if (activeTab === "forum") {
      // @ts-expect-error - navigation types
      navigation.navigate("PublishV2ForumMode");
      return;
    }
    if (activeTab === "buyer") {
      // 买手店 Tab：直接复用既有的「用户提交买手店」屏。
      // @ts-expect-error - navigation types
      navigation.navigate("SubmitStore");
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("PublishV2Composer");
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.button}>
        <Ionicons name="add" size={28} color={theme.colors.textInverted} />
      </View>
    </TouchableOpacity>
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });

export default PublishTabButtonV2;
