/**
 * AI 发帖助手 — 配额徽章。
 *
 * 顶栏右上角的"今日还能发几次 AI 帖"指示器,所有 AI 屏 (Entry / ImageBrief /
 * Preview) 共用同一计数语义 = `daily_generate_*`,避免跨屏跳转时数字割裂。
 * 重新生成 (regen) 的剩余次数由预览屏的 `regenerateConfirmBody` 弹窗承担,
 * 不在徽章里展示,以免「同一徽章读两个不同计数器」造成用户错觉。
 *
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
}

const QuotaBadge: React.FC<QuotaBadgeProps> = ({ quota }) => {
  const { t } = useTranslation();
  if (!quota) return null;

  const remaining = Math.max(
    0,
    quota.daily_generate_limit - quota.daily_generate_used,
  );
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
