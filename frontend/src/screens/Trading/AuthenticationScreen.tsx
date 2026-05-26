/**
 * AuthenticationScreen —— PRD 模块 5 鉴定服务入口。
 *
 * 流程：
 *   1. 拉取套餐列表（¥99 / 199 / 399）
 *   2. 用户选套餐 + 上传商品照片
 *   3. 创建鉴定订单 + 调 mock 支付
 *   4. 跳转到「我的鉴定」列表
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { useStripe } from "@stripe/stripe-react-native";

import {
  listAuthPackages,
  createAuthOrder,
  payAuthOrderMock,
  listMyAuthOrders,
  AuthenticationPackage,
  AuthenticationOrder,
} from "../../services/aftersalesService";
import { useFormatPrice } from "../../utils/currency";
import { uploadImageFromUri } from "../admin/adminUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { config as envConfig } from "../../config/env";

export default function AuthenticationScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const [packages, setPackages] = useState<AuthenticationPackage[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [brandName, setBrandName] = useState("");
  const [note, setNote] = useState("");
  const [orders, setOrders] = useState<AuthenticationOrder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const pkgs = await listAuthPackages();
        setPackages(pkgs);
        if (pkgs.length && !selectedCode) setSelectedCode(pkgs[0].code);
      } catch {}
    })();
    refreshOrders();
  }, []);

  const refreshOrders = async () => {
    try {
      const res = await listMyAuthOrders();
      setOrders(res.items);
    } catch {}
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (res.canceled) return;
    const uri = res.assets[0].uri;
    try {
      const uploaded = await uploadImageFromUri(uri);
      setPhotos((prev) => [...prev, uploaded]);
    } catch (e) {
      setErrorMsg("图片上传失败");
    }
  };

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const submit = async () => {
    if (!selectedCode) {
      setErrorMsg("请选择套餐");
      return;
    }
    if (!photos.length) {
      setErrorMsg("至少上传一张商品照片");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const o = await createAuthOrder({
        packageCode: selectedCode,
        itemPhotos: photos,
        brandName: brandName.trim() || undefined,
        note: note.trim() || undefined,
      });

      const isRealStripe =
        o.paymentProvider === "stripe" &&
        o.clientSecret &&
        !o.clientSecret.startsWith("stripe_stub_") &&
        !o.clientSecret.startsWith("stripe_err_") &&
        !!envConfig.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (isRealStripe) {
        const initRes = await initPaymentSheet({
          merchantDisplayName: "Avant Regard",
          paymentIntentClientSecret: o.clientSecret!,
          applePay: { merchantCountryCode: "US" },
          googlePay: { merchantCountryCode: "US", testEnv: __DEV__ },
          returnURL: "avantregard://stripe-redirect",
        });
        if (initRes.error) throw new Error(initRes.error.message);
        const presentRes = await presentPaymentSheet();
        if (presentRes.error) {
          if (presentRes.error.code === "Canceled") {
            // 用户取消, 订单留在 pending_payment, 后续可在订单列表里继续支付。
            return;
          }
          throw new Error(presentRes.error.message);
        }
        // 付款成功 → 实际状态推进由 webhook 完成 (auth.confirm_by_intent)。
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        // DEV 联调: 走 mock 支付。生产环境后端 404 会让这里抛错并提示。
        await payAuthOrderMock(o.id);
      }

      setPhotos([]);
      setNote("");
      setBrandName("");
      await refreshOrders();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "下单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.authentication.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>
          {t("trading.authentication.selectPackage")}
        </Text>
        <View style={styles.pkgList}>
          {packages.map((p) => {
            const active = selectedCode === p.code;
            return (
              <Pressable
                key={p.code}
                style={[styles.pkgCard, active && styles.pkgCardActive]}
                onPress={() => setSelectedCode(p.code)}
              >
                <Text style={styles.pkgName}>{p.name}</Text>
                <Text style={styles.pkgPrice}>{formatPrice(p.priceCents)}</Text>
                <Text style={styles.pkgSla}>{p.slaHours}h 出报告</Text>
                <Text style={styles.pkgDesc} numberOfLines={3}>
                  {p.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          {t("trading.authentication.productInfo")}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="品牌（选填）"
          placeholderTextColor={theme.colors.placeholder}
          value={brandName}
          onChangeText={setBrandName}
        />
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="备注（如型号、购买渠道）"
          placeholderTextColor={theme.colors.placeholder}
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={styles.sectionTitle}>
          {t("trading.authentication.productPhotos")}
        </Text>
        <View style={styles.photoGrid}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoCell}>
              <Image source={{ uri }} style={styles.photo} />
              <Pressable
                style={styles.removeBtn}
                onPress={() =>
                  setPhotos((prev) => prev.filter((p) => p !== uri))
                }
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.colors.textInverted}
                />
              </Pressable>
            </View>
          ))}
          {photos.length < 6 ? (
            <Pressable style={styles.photoAdd} onPress={pickPhoto}>
              <Ionicons name="add" size={32} color={theme.colors.gray300} />
            </Pressable>
          ) : null}
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          {t("trading.authentication.myOrders")}
        </Text>
        {orders.length === 0 ? (
          <Text style={styles.empty}>{t("trading.authentication.empty")}</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.authOrderCard}>
              <View style={styles.authOrderHeader}>
                <Text style={styles.authOrderNo}>#{o.orderNo}</Text>
                <Text style={styles.authOrderStatus}>{o.status}</Text>
              </View>
              <Text style={styles.authOrderMeta}>
                {formatPrice(o.priceCents)} · 结果 {o.result}
              </Text>
              {o.expertReport ? (
                <Text style={styles.authOrderReport} numberOfLines={3}>
                  {o.expertReport}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, submitting && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("trading.authentication.submitAndPay")}
            </Text>
          )}
        </Pressable>
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
      marginTop: 12,
      color: t.colors.text,
    },
    pkgList: { flexDirection: "row", gap: 8 },
    pkgCard: {
      flex: 1,
      backgroundColor: t.colors.cardElevated,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    pkgCardActive: { borderColor: t.colors.accent, borderWidth: 2 },
    pkgName: {
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
      color: t.colors.text,
    },
    pkgPrice: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 4,
    },
    pkgSla: { fontSize: 12, color: t.colors.gray300, marginBottom: 8 },
    pkgDesc: { fontSize: 12, color: t.colors.gray400 },
    input: {
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      fontSize: 14,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    photoCell: { position: "relative" },
    photo: { width: 80, height: 80, borderRadius: 8 },
    removeBtn: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: t.colors.accent,
      borderRadius: 12,
    },
    photoAdd: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: t.colors.cardElevated,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    error: { color: t.colors.error, marginTop: 8 },
    empty: { color: t.colors.gray300, marginTop: 8 },
    authOrderCard: {
      backgroundColor: t.colors.cardElevated,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    authOrderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    authOrderNo: { color: t.colors.gray300, fontSize: 12 },
    authOrderStatus: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.text,
    },
    authOrderMeta: { fontSize: 13, color: t.colors.gray400 },
    authOrderReport: { fontSize: 12, color: t.colors.gray400, marginTop: 4 },
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
  });
