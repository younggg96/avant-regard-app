/**
 * 活动报名按钮 · 等级身份识别核心组件
 *
 * PRD 要求:
 *   - Lv4 用户且持有免费门票权益 (remaining > 0): 展示「使用免费门票报名」
 *   - 其他情况: 展示「支付报名」
 *
 * 识别逻辑集中在 store, 未来的活动报名页只要引这一个按钮即可,
 * 避免各业务页自行判断等级/配额的散乱重复 (DRY).
 *
 * 按钮点击流程:
 *   - Free ticket 分支: 直接调 /api/benefits/free-ticket/redeem 核销
 *   - Pay 分支: 调用方通过 `onPay` 回调接管 (走现有支付流程)
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { useLevelStore } from "../../store/levelStore";
import { levelService } from "../../services/levelService";
import { Alert } from "../../utils/Alert";

interface Props {
  /** 活动 ID, 会写到核销流水的 redeemed_object_id */
  eventId: string;
  /** 付费分支: 用户点击后走现有支付流程 */
  onPay: () => void;
  /** 核销成功回调: 上层据此跳转到"报名成功"页 */
  onRedeemed?: (remaining: number) => void;
  /** 禁用态 (活动已满/未开启时上层透传) */
  disabled?: boolean;
  style?: ViewStyle;
}

const FREE_TICKET_TYPE = "FREE_TICKET_LV4";

export const EventRegistrationButton: React.FC<Props> = ({
  eventId,
  onPay,
  onRedeemed,
  disabled,
  style,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const status = useLevelStore((s) => s.status);
  const refresh = useLevelStore((s) => s.refresh);
  const [submitting, setSubmitting] = useState(false);

  const freeTicket = useMemo(
    () =>
      status?.benefits?.find(
        (b) =>
          b.benefitType === FREE_TICKET_TYPE && b.remaining > 0
      ) ?? null,
    [status]
  );

  const canUseFreeTicket =
    (status?.currentLevel ?? 0) >= 4 && !!freeTicket;

  const handlePress = useCallback(async () => {
    if (disabled || submitting) return;

    if (!canUseFreeTicket) {
      onPay();
      return;
    }

    setSubmitting(true);
    try {
      const res = await levelService.redeemFreeTicket({
        objectType: "EVENT",
        objectId: eventId,
      });
      Alert.show(t("level.registerSuccess", { remaining: res.remaining }));
      await refresh();
      onRedeemed?.(res.remaining);
    } catch (e: any) {
      Alert.show(e?.message ?? t("level.redeemFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [
    canUseFreeTicket,
    disabled,
    eventId,
    onPay,
    onRedeemed,
    refresh,
    submitting,
  ]);

  const label = canUseFreeTicket ? t("level.useFreeTicket") : t("level.payToRegister");

  return (
    <Pressable
      style={[
        styles.btn,
        (disabled || submitting) && styles.btnDisabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || submitting}
    >
      {submitting ? (
        <ActivityIndicator color={theme.colors.white} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  btn: {
    backgroundColor: t.colors.text,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    backgroundColor: t.colors.gray200,
  },
  label: {
    ...t.typography.button,
    color: t.colors.textInverted,
    letterSpacing: 2,
  },
});
