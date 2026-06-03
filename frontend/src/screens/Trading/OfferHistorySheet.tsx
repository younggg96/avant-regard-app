/**
 * OfferHistorySheet —— 商品详情页「出价记录」浮层 (Bottom Sheet)。
 *
 * 买家收到卖家 offer 后，详情页价格会更新为收到的报价；
 * 这里按时间升序列出整条议价链的所有报价（你 / 卖家），方便买家核对成交价。
 *
 * 设计系统：useAppTheme + Box/HStack/VStack/Text + 主题化；圆角统一 4。
 */
import React from "react";
import { Modal, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  OfferWithDetail,
  formatOfferStatus,
} from "../../services/orderService";
import { useFormatPrice } from "../../utils/currency";

interface Props {
  visible: boolean;
  offers: OfferWithDetail[];
  currency?: string | null;
  onClose: () => void;
  /** 「前往出价中心」入口，可选；不传则不展示底部按钮。 */
  onGoToOffers?: () => void;
}

const OfferHistorySheet: React.FC<Props> = ({
  visible,
  offers,
  currency,
  onClose,
  onGoToOffers,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPriceHook = useFormatPrice();
  const formatPrice = (cents: number) =>
    formatPriceHook(cents, currency ?? undefined);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Box style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <Box style={styles.sheet}>
          <Box style={styles.handle} />

          <HStack alignItems="center" justifyContent="between" style={styles.headerRow}>
            <Text style={styles.title}>{t("trading.offerThread.historyTitle")}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.gray300} />
            </Pressable>
          </HStack>

          {offers.length === 0 ? (
            <Text style={styles.empty}>{t("trading.offerThread.empty")}</Text>
          ) : (
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {offers.map((o) => {
                const fromSeller = o.initiatorRole === "seller";
                const isPending = o.status === "pending";
                return (
                  <HStack key={o.id} style={styles.row} alignItems="center">
                    <VStack flex={1} style={{ minWidth: 0 }}>
                      <HStack alignItems="center" space="xs">
                        <Text style={styles.who}>
                          {fromSeller
                            ? t("trading.offerThread.bySeller")
                            : t("trading.offerThread.byYou")}
                        </Text>
                        <Text
                          style={[
                            styles.statusPill,
                            isPending && styles.statusPillPending,
                          ]}
                        >
                          {formatOfferStatus(o.status)}
                        </Text>
                      </HStack>
                      {o.message ? (
                        <Text style={styles.message} numberOfLines={1}>
                          “{o.message}”
                        </Text>
                      ) : null}
                      {o.createdAt ? (
                        <Text style={styles.meta}>{o.createdAt.slice(0, 16)}</Text>
                      ) : null}
                    </VStack>
                    <Text
                      style={[styles.price, isPending && styles.pricePending]}
                    >
                      {formatPrice(o.priceCents)}
                    </Text>
                  </HStack>
                );
              })}
            </ScrollView>
          )}

          {onGoToOffers ? (
            <Pressable style={styles.primaryBtn} onPress={onGoToOffers}>
              <Text style={styles.primaryBtnText}>
                {t("trading.offerThread.goToOffers")}
              </Text>
            </Pressable>
          ) : null}
        </Box>
      </Box>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    backdropPress: { flex: 1 },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      maxHeight: "75%",
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 4,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    headerRow: { marginBottom: 8 },
    title: { fontSize: 18, fontWeight: "700", color: t.colors.text },
    empty: {
      textAlign: "center",
      color: t.colors.gray300,
      paddingVertical: 32,
    },
    list: { marginTop: 4 },
    row: {
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    who: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    statusPill: {
      fontSize: 11,
      color: t.colors.gray300,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
      overflow: "hidden",
    },
    statusPillPending: {
      color: t.colors.plusGold,
      backgroundColor: t.mode === "dark" ? "#3A2E14" : "#FFF6E0",
    },
    message: { fontSize: 12, color: t.colors.gray400, marginTop: 4 },
    meta: { fontSize: 11, color: t.colors.gray300, marginTop: 4 },
    price: { fontSize: 18, fontWeight: "700", color: t.colors.text },
    pricePending: { color: t.colors.accent },
    primaryBtn: {
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontWeight: "600",
      fontSize: 15,
    },
  });

export default OfferHistorySheet;
