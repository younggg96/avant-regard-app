/**
 * PlusSubscribeScreen —— PRD 模块 8 Plus 订阅与权益。
 *
 * 权益：
 *   - 抽佣折扣 8% → 6%
 *   - 鉴定免费券 / 优惠（接 P5 鉴定流程；当前为占位）
 *   - Archive 数据画像面板解锁
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  getPlusStatus,
  subscribePlus,
  confirmPlusMock,
  cancelPlus,
  PlusStatus,
  PlusPlan,
} from "../../services/archivePlusService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

const BENEFITS: { icon: any; title: string; desc: string }[] = [
  { icon: "trending-down", title: "抽佣折扣", desc: "8% → 6%，每笔订单立省 2 个点" },
  { icon: "shield-checkmark", title: "鉴定优惠", desc: "每月 1 次免费标准鉴定" },
  {
    icon: "stats-chart",
    title: "藏品数据画像",
    desc: "解锁品牌 / 年代 / 价格分布全维面板",
  },
  { icon: "gift", title: "专属客服", desc: "Plus 通道 4 小时响应承诺" },
];

export default function PlusSubscribeScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [plan, setPlan] = useState<PlusPlan>("annual");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getPlusStatus();
      setStatus(s);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const sub = await subscribePlus(plan);
      await confirmPlusMock(sub.id);
      Alert.alert("订阅成功", "Plus 权益已生效");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "订阅失败");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!status?.subscription) return;
    setBusy(true);
    try {
      await cancelPlus(status.subscription.id);
      Alert.alert("已取消", "Plus 将在到期后失效");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>AVANT REGARD Plus</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>AVANT REGARD Plus</Text>
          <Text style={styles.heroSub}>
            为认真对待档案的藏家而设
          </Text>
          {status?.isActive ? (
            <Text style={styles.activeBadge}>
              当前生效中 · 到期 {status.subscription?.periodEnd.slice(0, 10)}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>权益</Text>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefitRow}>
            <Ionicons name={b.icon} size={22} color={theme.colors.text} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}

        {!status?.isActive ? (
          <>
            <Text style={styles.sectionTitle}>选择套餐</Text>
            <View style={styles.planRow}>
              <Pressable
                style={[
                  styles.planCard,
                  plan === "monthly" && styles.planCardActive,
                ]}
                onPress={() => setPlan("monthly")}
              >
                <Text style={styles.planName}>月度</Text>
                <Text style={styles.planPrice}>{formatPrice(2900)}</Text>
                <Text style={styles.planMeta}>¥29 / 月</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.planCard,
                  plan === "annual" && styles.planCardActive,
                ]}
                onPress={() => setPlan("annual")}
              >
                <Text style={styles.planTag}>推荐</Text>
                <Text style={styles.planName}>年度</Text>
                <Text style={styles.planPrice}>{formatPrice(29800)}</Text>
                <Text style={styles.planMeta}>¥24.8 / 月</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {status?.isActive ? (
          <Pressable
            style={[styles.ghostBtn, busy && { opacity: 0.5 }]}
            onPress={cancel}
            disabled={busy}
          >
            <Text style={styles.ghostBtnText}>取消自动续费</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
            onPress={subscribe}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>
                立即订阅（{plan === "monthly" ? "¥29/月" : "¥298/年"}）
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    header: {
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    scroll: { padding: 16, paddingBottom: 120 },
    hero: {
      backgroundColor: t.colors.accent,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    },
    heroTitle: { color: t.colors.plusGold, fontSize: 26, fontWeight: "800" },
    heroSub: { color: t.colors.textInverted, opacity: 0.7, marginTop: 6 },
    activeBadge: {
      color: t.colors.plusGold,
      marginTop: 12,
      fontWeight: "600",
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 10,
      marginBottom: 8,
    },
    benefitTitle: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    benefitDesc: { fontSize: 12, color: t.colors.gray300, marginTop: 2 },
    planRow: { flexDirection: "row", gap: 8 },
    planCard: {
      flex: 1,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      position: "relative",
    },
    planCardActive: { borderColor: t.colors.accent, borderWidth: 2 },
    planTag: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: t.colors.plusGold,
      color: t.mode === "dark" ? "#1A1100" : "#FFFFFF",
      fontSize: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      fontWeight: "700",
      overflow: "hidden",
    },
    planName: {
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
      color: t.colors.text,
    },
    planPrice: { fontSize: 22, fontWeight: "700", color: t.colors.text },
    planMeta: { fontSize: 11, color: t.colors.gray300, marginTop: 4 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 24,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    ghostBtn: {
      paddingVertical: 14,
      borderRadius: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    ghostBtnText: { color: t.colors.gray400, fontWeight: "600" },
  });
