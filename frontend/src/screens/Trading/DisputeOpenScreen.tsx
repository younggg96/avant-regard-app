/**
 * DisputeOpenScreen —— 发起售后争议（PRD 模块 5）。
 *
 * 入口：OrderDetailScreen 上的「申请售后」按钮。
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { openDispute, DisputeReason } from "../../services/aftersalesService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

const REASONS: { code: DisputeReason; label: string }[] = [
  { code: "not_as_described", label: "与描述不符" },
  { code: "damaged", label: "商品破损" },
  { code: "not_received", label: "未收到货" },
  { code: "fake", label: "怀疑非正品" },
  { code: "other", label: "其他" },
];

type RouteParams = { DisputeOpen: { orderId: number } };

export default function DisputeOpenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "DisputeOpen">>();
  const { orderId } = route.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [reason, setReason] = useState<DisputeReason>("not_as_described");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await openDispute({ orderId, reason, description });
      navigation.goBack();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>申请售后</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>原因</Text>
        {REASONS.map((r) => (
          <Pressable
            key={r.code}
            style={[styles.reasonRow, reason === r.code && styles.reasonActive]}
            onPress={() => setReason(r.code)}
          >
            <Text style={styles.reasonText}>{r.label}</Text>
            {reason === r.code ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.text}
              />
            ) : null}
          </Pressable>
        ))}

        <Text style={[styles.label, { marginTop: 16 }]}>详细描述</Text>
        <TextInput
          style={styles.textarea}
          multiline
          placeholder="说明问题、附上凭证..."
          placeholderTextColor={theme.colors.placeholder}
          value={description}
          onChangeText={setDescription}
        />

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>提交售后</Text>
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
    label: {
      fontSize: 13,
      fontWeight: "600",
      marginVertical: 8,
      color: t.colors.text,
    },
    reasonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 8,
      marginBottom: 8,
    },
    reasonActive: { borderWidth: 1, borderColor: t.colors.accent },
    reasonText: { color: t.colors.text },
    textarea: {
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      minHeight: 120,
      textAlignVertical: "top",
      fontSize: 14,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    error: { color: t.colors.error, marginTop: 12 },
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
