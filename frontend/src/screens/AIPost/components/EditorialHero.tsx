/**
 * AI Studio 编辑式 Hero (V3 #25.5)。
 *
 * 杂志页头大标题区, 由 3 段构成:
 *   - titleEn: Playfair 大字 (CHOOSE YOUR STYLE / AI 发帖 / AI LOOKBOOK ...)
 *   - titleZh: 中文副标 + 装饰 ✦
 *   - description: 2 行灰色说明
 *
 * 前两段都接受任意字符 (可以混 CJK/EN), Playfair Display 在 CJK 字符上
 * 会回退到系统中文字, 视觉上不冲突, 与档案页一致。
 */

import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Text, VStack } from "../../../components/ui";
import { playfairFonts, theme } from "../../../theme";

interface EditorialHeroProps {
  titleEn: string;
  titleZh?: string;
  description?: string;
}

const EditorialHero: React.FC<EditorialHeroProps> = ({
  titleEn,
  titleZh,
  description,
}) => {
  return (
    <VStack px="$lg" pt="$lg" pb="$md" gap="$sm">
      <Text style={styles.titleEn}>{titleEn}</Text>
      {titleZh ? (
        <HStack alignItems="center" gap="$xs">
          <Text style={styles.titleZh}>{titleZh}</Text>
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={theme.colors.gray300}
          />
        </HStack>
      ) : null}
      {description ? (
        <Box mt="$xs">
          <Text style={styles.description}>{description}</Text>
        </Box>
      ) : null}
    </VStack>
  );
};

const styles = StyleSheet.create({
  titleEn: {
    fontFamily: playfairFonts.medium,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.5,
    color: theme.colors.black,
  },
  titleZh: {
    fontFamily: playfairFonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.gray400,
  },
  description: {
    fontFamily: playfairFonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.gray300,
  },
});

export default EditorialHero;
