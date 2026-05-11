/**
 * 「本月抽奖」入口组件.
 *
 * 严格渲染条件 (两者同时满足):
 *   1. 当前浏览的是用户"本人主页"  (由调用方通过 `isOwnProfile` 保证)
 *   2. 用户等级 >= 3
 * 其余场景 (他人主页 / 未达 Lv3) 一律返回 null, 避免泄漏权益入口.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, VStack, Pressable, Text } from "../ui";
import { theme, playfairFonts } from "../../theme";
import {
  CurrentLotteryPayload,
  levelService,
} from "../../services/levelService";
import { MonthlyLotteryDetailModal } from "./MonthlyLotteryDetailModal";

interface Props {
  /** 是否处于"本人主页". 调用方必须显式传, 禁止默认 true. */
  isOwnProfile: boolean;
  /** 当前用户等级 */
  currentLevel: number;
}

const localStyles = StyleSheet.create({
  title: {
    fontFamily: playfairFonts.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: theme.colors.black,
  },
  status: {
    fontFamily: playfairFonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.gray300,
    marginTop: 1,
  },
});

export const MonthlyLotteryEntry: React.FC<Props> = ({
  isOwnProfile,
  currentLevel,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<CurrentLotteryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  const canRender = isOwnProfile && currentLevel >= 3;

  const fetchData = useCallback(async () => {
    if (!canRender) return;
    setLoading(true);
    try {
      const payload = await levelService.getCurrentLottery();
      setData(payload);
    } catch (e) {
      console.warn("[MonthlyLotteryEntry] fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [canRender]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Modal 关闭后重新拉一次, 让卡片状态文字保持最新
  // (如用户在 Modal 打开期间后端正好开奖的极端场景).
  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    fetchData();
  }, [fetchData]);

  if (!canRender) return null;

  const round = data?.round;
  const entry = data?.entry;

  const statusText = (() => {
    if (loading && !data) return t("level.loading");
    if (!round) return "--";
    if (round.status === "DRAWN") {
      return entry?.isWinner
        ? t("level.won", { prize: entry.prizeName ?? "" })
        : t("level.drawn");
    }
    if (round.status === "CLOSED") return t("level.closed");
    return entry?.entered ? t("level.entered") : t("level.autoEnter");
  })();

  return (
    <>
      <Pressable
        bg="$white"
        borderWidth={1}
        borderColor="$gray100"
        px="$md"
        py="$sm"
        mt="$sm"
        mx="$md"
        mb="$sm"
        onPress={() => setDetailVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t("level.monthlyLottery")}
      >
        <HStack alignItems="center" gap="$sm">
          <Box
            w={32}
            h={32}
            rounded={16}
            bg="$black"
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="ticket-outline" size={18} color={theme.colors.white} />
          </Box>
          <VStack flex={1}>
            <Text style={localStyles.title}>
              {t("level.monthlyLottery")} · {round?.month ?? "--"}
            </Text>
            <Text style={localStyles.status} numberOfLines={1}>
              {statusText}
            </Text>
          </VStack>
          {loading && !data ? (
            <ActivityIndicator size="small" color={theme.colors.gray300} />
          ) : (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.gray300}
            />
          )}
        </HStack>
      </Pressable>

      <MonthlyLotteryDetailModal
        visible={detailVisible}
        onClose={handleCloseDetail}
      />
    </>
  );
};
