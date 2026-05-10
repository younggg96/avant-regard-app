import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { theme } from "../theme";
import { useDiscoverTabStore } from "../store/discoverTabStore";

/**
 * 发布按钮 V2
 * ------------------------------------------------------------------
 * 与原 `PublishTabButton` 行为差异：
 *   - 原版：永远跳 `PublishType`（六选一聚合屏）。
 *   - V2  ：根据用户在 Discover 里所处的子 Tab 走不同入口：
 *       · 论坛 Tab    → `PublishV2ForumMode`（AI 发帖 / 论坛发帖）
 *       · 买手店 Tab  → `SubmitStore`（用户提交买手店申请，复用既有屏）
 *       · 推荐 / 关注 / 其它屏 → `PublishV2Composer`
 *           （单屏：媒体 + 类型切换 + 类型对应字段，默认 Lookbook）
 *
 * V2 完全独立于 V1 流程，原 `PublishTypeScreen` 等屏仍然保留并可被
 * 别的入口（例如 PostCard 编辑、AI 预览页）继续 navigate 进去。
 */

const PublishTabButtonV2: React.FC<{ onPress?: (event: unknown) => void }> = () => {
  const navigation = useNavigation();

  const handlePress = () => {
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
        <Ionicons name="add" size={28} color={theme.colors.white} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    top: -10,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
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
