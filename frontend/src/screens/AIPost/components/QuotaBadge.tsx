/**
 * AI 发帖助手 — 配额徽章。
 *
 * 显示「今日剩余 N/M 次」。配额由调用方传入,本组件只渲染。
 * 余量 = 0 时整体变灰 + 警告色文案。
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, HStack, Text } from "../../../components/ui";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { QuotaInfo } from "../../../services/aiPostService";

interface QuotaBadgeProps {
  quota: QuotaInfo | null;
  /** 是否在重新生成场景下显示（默认显示生成余量） */
  variant?: "generate" | "regenerate";
}

const QuotaBadge: React.FC<QuotaBadgeProps> = ({ quota, variant = "generate" }) => {
  const { t } = useTranslation();
  if (!quota) return null;

  const used = variant === "regenerate" ? quota.daily_regen_used : quota.daily_generate_used;
  const limit = variant === "regenerate" ? quota.daily_regen_limit : quota.daily_generate_limit;
  const remaining = Math.max(0, limit - used);
  const exhausted = remaining === 0;

  return (
    <HStack
      alignItems="center"
      gap={4}
      px="$sm"
      py={4}
      rounded={12}
      bg={exhausted ? "$gray100" : "rgba(0,0,0,0.06)"}
    >
      <Ionicons
        name={exhausted ? "alert-circle-outline" : "sparkles-outline"}
        size={12}
        color={exhausted ? theme.colors.error : theme.colors.gray400}
      />
      <Text
        fontSize="$xs"
        color={exhausted ? "$error" : "$gray400"}
        numberOfLines={1}
      >
        {exhausted
          ? t("aiPost.quota.exhausted")
          : t("aiPost.quota.remaining", { count: remaining })}
      </Text>
    </HStack>
  );
};

export default QuotaBadge;
