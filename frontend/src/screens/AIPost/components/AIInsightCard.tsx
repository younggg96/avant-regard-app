/**
 * AI Studio 编辑式底部「AI INSIGHT」卡 (V3 #25.5)。
 *
 * 设计稿固定的 footer 卡片, 出现在每一步 Q&A 列表底部:
 *   ✦  AI INSIGHT
 *      基于你的偏好与趋势数据, AI 将为你生成更专业, 更具代表性的时尚内容。
 *      [→]
 *
 * 视觉只是说明性, 不绑业务逻辑 (没下一屏要跳)。给个 onPress 兜底,
 * 调用方可以选择关掉点击 (默认 noop)。圆形箭头与列表行的箭头视觉一致。
 */

import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, HStack, Pressable, Text, VStack } from "../../../components/ui";
import { playfairFonts, theme, useThemedStyles, type AppTheme, useAppTheme } from "../../../theme";

interface AIInsightCardProps {
  onPress?: () => void;
}

const AIInsightCard: React.FC<AIInsightCardProps> = ({ onPress }) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  // 没传 onPress 也保持 Pressable 包裹, 行为退化为不可点击 (无 ripple),
  // 视觉与可点态一致, 避免两套样式分支。
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <HStack
        mx="$lg"
        my="$md"
        p="$md"
        gap="$md"
        alignItems="center"
        style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray100 }]}
        borderWidth={1}

        rounded="$lg"
      >
        <Box style={styles.icon}>
          <Ionicons
            name="sparkles-outline"
            size={16}
            color={theme.colors.gray400}
          />
        </Box>
        <VStack flex={1} gap="$xs">
          <Text style={styles.title}>{t("aiPost.studio.insight.title")}</Text>
          <Text style={styles.body}>{t("aiPost.studio.insight.body")}</Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.gray100,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontFamily: playfairFonts.medium,
      fontSize: 11,
      letterSpacing: 2,
      color: t.colors.text,
    },
    body: {
      fontFamily: playfairFonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: t.colors.gray300,
    },
    arrowBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default AIInsightCard;
