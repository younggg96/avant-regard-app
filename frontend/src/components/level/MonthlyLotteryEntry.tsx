/**
 * 「本月抽奖」入口组件.
 *
 * 严格渲染条件 (两者同时满足):
 *   1. 当前浏览的是用户"本人主页"  (由调用方通过 `isOwnProfile` 保证)
 *   2. 用户等级 >= 3
 * 其余场景 (他人主页 / 未达 Lv3) 一律返回 null, 避免泄漏权益入口.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Box, HStack, VStack, Pressable, Text } from "../ui";
import { theme } from "../../theme";
import {
  CurrentLotteryPayload,
  levelService,
} from "../../services/levelService";

interface Props {
  /** 是否处于"本人主页". 调用方必须显式传, 禁止默认 true. */
  isOwnProfile: boolean;
  /** 当前用户等级 */
  currentLevel: number;
}

export const MonthlyLotteryEntry: React.FC<Props> = ({
  isOwnProfile,
  currentLevel,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<CurrentLotteryPayload | null>(null);
  const [loading, setLoading] = useState(false);

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
    <Pressable
      bg="$white"
      borderWidth={1}
      borderColor="$gray100"
      p="$md"
      mx="$md"
      mt="$md"
      onPress={() => navigation.navigate("MyLevel", { focus: "lottery" })}
    >
      <HStack alignItems="center" gap="$md">
        <Box
          w={40}
          h={40}
          rounded={20}
          bg="$black"
          alignItems="center"
          justifyContent="center"
          mr="$md"
        >
          <Ionicons name="ticket-outline" size={22} color={theme.colors.white} />
        </Box>
        <VStack flex={1}>
          <Text fontSize={16} fontWeight="$semibold" color="$black" lineHeight={22}>
            {t("level.monthlyLottery")} · {round?.month ?? "--"}
          </Text>
          <Text
            fontSize={12}
            color="$gray300"
            lineHeight={16}
            mt={2}
            numberOfLines={1}
          >
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
  );
};
