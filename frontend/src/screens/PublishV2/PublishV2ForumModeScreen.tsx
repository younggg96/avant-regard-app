/**
 * V2 发布流程 · 论坛 Tab 入口 Step 1：选择发布方式
 * ------------------------------------------------------------------
 * 用户在 Discover 论坛 Tab 点中央「+」时进入。两条岔路：
 *   - AI 发帖：跳已有 `AIPostEntry`（QA / 图文模式）。AI 会基于用户答案
 *     给出推荐论坛（含风格论坛 / 品牌论坛等扩展项），最终落到论坛屏。
 *   - 论坛发帖：跳 `PublishV2ForumSelect` 让用户先选社区，再进
 *     `PublishForumPost` 填内容。
 *
 * 沿用与 `AIPostEntryScreen` 一致的卡片视觉，避免 V2 风格与原有
 * AI 屏出现割裂。
 */

import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, Text, Pressable, VStack, HStack, ScrollView } from "../../components/ui";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";

interface ModeCard {
  id: "ai" | "manual";
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

const PublishV2ForumModeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);

  const modes: ModeCard[] = [
    {
      id: "ai",
      title: t("publishV2.forumMode.aiTitle"),
      description: t("publishV2.forumMode.aiDesc"),
      icon: "sparkles",
      onPress: () => navigation.replace("AIPostEntry"),
    },
    {
      id: "manual",
      title: t("publishV2.forumMode.manualTitle"),
      description: t("publishV2.forumMode.manualDesc"),
      icon: "chatbubbles",
      // 使用 navigate 保留上一层，便于 ForumSelect 返回到本步骤。
      onPress: () => navigation.navigate("PublishV2ForumSelect"),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("publishV2.forumMode.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <VStack px="$lg" py="$md" gap="$sm">
          <Box mb="$xs">
            <Text fontSize="$md" fontWeight="$medium" color="$black" mb="$xs">
              {t("publishV2.forumMode.heading")}
            </Text>
            <Text fontSize="$xs" color="$gray500">
              {t("publishV2.forumMode.subtitle")}
            </Text>
          </Box>

          {modes.map((mode) => (
            <Pressable
              key={mode.id}
              onPress={mode.onPress}
              bg="$white"
              borderWidth={1}
              borderColor="$gray100"
              rounded="$lg"
              p="$md"
              sx={{
                shadowColor: "$black",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <HStack alignItems="center" gap="$md">
                <Box
                  w={40}
                  h={40}
                  rounded="$md"
                  bg="$gray100"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons
                    name={mode.icon}
                    size={20}
                    color={theme.colors.black}
                  />
                </Box>

                <VStack flex={1}>
                  <Text
                    fontSize="$sm"
                    fontWeight="$medium"
                    color="$black"
                    mb={2}
                  >
                    {mode.title}
                  </Text>
                  <Text fontSize="$xs" color="$gray500">
                    {mode.description}
                  </Text>
                </VStack>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.gray400}
                />
              </HStack>
            </Pressable>
          ))}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
  });

export default PublishV2ForumModeScreen;
