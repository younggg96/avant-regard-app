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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
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
                <View
                  style={[styles.radio, active && styles.radioActive]}
                >
                  {active ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={theme.colors.textInverted}
                    />
                  ) : null}
                </View>
                <View style={styles.pkgBody}>
                  <View style={styles.pkgTopRow}>
                    <Text style={styles.pkgName}>{p.name}</Text>
                    <Text style={styles.pkgPrice}>
                      {formatPrice(p.priceCents)}
                    </Text>
                  </View>
                  <View style={styles.slaBadge}>
                    <Ionicons
                      name="time-outline"
                      size={11}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.pkgSla}>{p.slaHours}h 出报告</Text>
                  </View>
                  <Text style={styles.pkgDesc}>{p.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          {t("trading.authentication.productInfo")}
        </Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="品牌（选填）"
            placeholderTextColor={theme.colors.placeholder}
            value={brandName}
            onChangeText={setBrandName}
          />
          <View style={styles.inputDivider} />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="备注（如型号、购买渠道）"
            placeholderTextColor={theme.colors.placeholder}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

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
                  name="close"
                  size={14}
                  color={theme.colors.textInverted}
                />
              </Pressable>
            </View>
          ))}
          {photos.length < 6 ? (
            <Pressable style={styles.photoAdd} onPress={pickPhoto}>
              <Ionicons
                name="camera-outline"
                size={24}
                color={theme.colors.gray300}
              />
              <Text style={styles.photoAddText}>{photos.length}/6</Text>
            </Pressable>
          ) : null}
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle"
              size={15}
              color={theme.colors.error}
            />
            <Text style={styles.error}>{errorMsg}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
          {t("trading.authentication.myOrders")}
        </Text>
        {orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="document-text-outline"
              size={28}
              color={theme.colors.gray200}
            />
            <Text style={styles.empty}>
              {t("trading.authentication.empty")}
            </Text>
          </View>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.authOrderCard}>
              <View style={styles.authOrderHeader}>
                <Text style={styles.authOrderNo}>#{o.orderNo}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.authOrderStatus}>{o.status}</Text>
                </View>
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
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 12,
      marginTop: 20,
      color: t.colors.gray300,
    },
    pkgList: { gap: 10 },
    pkgCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: t.colors.cardElevated,
      padding: 16,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    pkgCardActive: { borderColor: t.colors.accent },
    radio: {
      width: 22,
      height: 22,
      borderRadius: t.borderRadius.full,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
      marginTop: 1,
    },
    radioActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    pkgBody: { flex: 1 },
    pkgTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    pkgName: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
    },
    pkgPrice: {
      fontSize: 18,
      fontWeight: "800",
      color: t.colors.text,
    },
    slaBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
      marginBottom: 6,
    },
    pkgSla: { fontSize: 12, color: t.colors.gray300 },
    pkgDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.gray400,
    },
    inputGroup: {
      backgroundColor: t.colors.inputBackground,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      overflow: "hidden",
    },
    input: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: t.colors.text,
    },
    inputMultiline: { minHeight: 88, textAlignVertical: "top" },
    inputDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.inputBorder,
      marginHorizontal: 16,
    },
    photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    photoCell: { position: "relative" },
    photo: { width: 84, height: 84, borderRadius: t.borderRadius.sm },
    removeBtn: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: t.borderRadius.full,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    photoAdd: {
      width: 84,
      height: 84,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.cardElevated,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    photoAddText: { fontSize: 11, color: t.colors.gray300 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
    },
    error: { color: t.colors.error, fontSize: 13 },
    emptyBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 28,
      gap: 8,
    },
    empty: { color: t.colors.gray300, fontSize: 13 },
    authOrderCard: {
      backgroundColor: t.colors.cardElevated,
      padding: 16,
      borderRadius: t.borderRadius.sm,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    authOrderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    authOrderNo: { color: t.colors.gray300, fontSize: 13, fontWeight: "600" },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.full,
      backgroundColor: t.colors.surface,
    },
    authOrderStatus: {
      fontSize: 11,
      fontWeight: "700",
      color: t.colors.text,
    },
    authOrderMeta: { fontSize: 14, color: t.colors.gray400 },
    authOrderReport: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.gray400,
      marginTop: 6,
    },
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
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });
