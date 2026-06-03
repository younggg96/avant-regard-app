/**
 * SellerAfterSalesScreen —— 卖家端「买家售后」列表 + 响应（PRD 模块 5 · 买卖分流）。
 *
 * 入口：
 *   - 订单详情（卖家视角）的「查看买家售后」按钮
 *   - 个人主页「交易」tab 卖家订单卡片的「查看售后」
 *
 * 与买家端（DisputeOpenScreen 提交售后）分流：
 *   - 卖家在这里看到所有买家提交的售后请求，逐条做出响应：
 *       · 同意退款 → 订单立即退款
 *       · 拒绝并申诉 → 提交说明 + 凭证，转交客服仲裁
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  Modal,
  TextInput,
  ScrollView,
  Image as RNImage,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import ScreenHeader from "../../components/ScreenHeader";
import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useFormatPrice } from "../../utils/currency";
import {
  listSellerDisputes,
  sellerRespondDispute,
  type Dispute,
  type DisputeStatus,
  type SellerResponseAction,
} from "../../services/aftersalesService";
import { uploadImage } from "../../services/postService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

const MAX_PHOTOS = 4;

type FilterKey = "all" | "open" | "investigating" | "resolved";

const FILTERS: { key: FilterKey; labelKey: string; status?: DisputeStatus }[] = [
  { key: "all", labelKey: "trading.aftersales.seller.filterAll" },
  { key: "open", labelKey: "trading.aftersales.seller.filterOpen", status: "open" },
  {
    key: "investigating",
    labelKey: "trading.aftersales.seller.filterInvestigating",
    status: "investigating",
  },
  {
    key: "resolved",
    labelKey: "trading.aftersales.seller.filterResolved",
    status: "resolved_refund",
  },
];

function statusTone(
  status: DisputeStatus,
  theme: AppTheme,
): string {
  switch (status) {
    case "open":
      return theme.colors.error;
    case "investigating":
      return theme.colors.text;
    case "resolved_refund":
    case "resolved_release":
      return theme.colors.success;
    default:
      return theme.colors.gray300;
  }
}

export default function SellerAfterSalesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const formatPrice = useFormatPrice();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Dispute | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = FILTERS.find((f) => f.key === filter)?.status;
      const res = await listSellerDisputes({ status, pageSize: 50 });
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onResponded = useCallback((updated: Dispute) => {
    setActive(null);
    setItems((prev) =>
      prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
    );
    // 重新拉取，保证过滤后的列表与最新状态一致
    load();
  }, [load]);

  const renderCard = ({ item }: { item: Dispute }) => {
    const responded = !!item.sellerResponseAction;
    const canRespond =
      (item.status === "open" || item.status === "investigating") &&
      !responded &&
      item.openerRole === "buyer";
    const displayStatusKey =
      item.status === "open" && item.sellerResponseAction === "reject"
        ? "seller_rejected"
        : item.status;
    const tone = statusTone(item.status, theme);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {item.productImage ? (
            <OptimizedImage
              uri={item.productImage}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={20}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.productTitle ??
                t("trading.orders.productLabel", { id: item.productId ?? 0 })}
            </Text>
            {item.orderNo ? (
              <Text style={styles.cardOrderNo} numberOfLines={1}>
                {item.orderNo}
              </Text>
            ) : null}
            {item.paidPriceCents != null ? (
              <Text style={styles.cardPrice}>
                {formatPrice(item.paidPriceCents, item.currency ?? "CNY")}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone + "1A" }]}>
            <Text style={[styles.statusBadgeText, { color: tone }]}>
              {t(`trading.aftersales.statuses.${displayStatusKey}`)}
            </Text>
          </View>
        </View>

        <View style={styles.reasonBlock}>
          <Text style={styles.reasonLabel}>
            {t("trading.aftersales.seller.reasonLabel")}
          </Text>
          <Text style={styles.reasonValue}>
            {t(`trading.aftersales.reasons.${item.reason}`)}
          </Text>
        </View>
        {item.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        {item.evidencePhotos && item.evidencePhotos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.evidenceRow}>
              {item.evidencePhotos.map((uri, idx) => (
                <View key={`${item.id}-ev-${idx}`} style={styles.evidenceTile}>
                  <OptimizedImage
                    uri={uri}
                    size={ImageSize.THUMBNAIL}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {responded ? (
          <View style={styles.responseBlock}>
            <Text style={styles.responseLabel}>
              {t("trading.aftersales.seller.myResponse")}:{" "}
              {item.sellerResponseAction === "agree_refund"
                ? t("trading.aftersales.seller.responseAgreeRefund")
                : t("trading.aftersales.seller.responseReject")}
            </Text>
            {item.sellerResponse ? (
              <Text style={styles.responseText}>{item.sellerResponse}</Text>
            ) : null}
          </View>
        ) : null}

        {item.createdAt ? (
          <Text style={styles.submittedAt}>
            {t("trading.aftersales.seller.submittedAt", {
              date: item.createdAt.replace("T", " ").slice(0, 16),
            })}
          </Text>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable
            style={styles.detailBtn}
            onPress={() =>
              navigation.navigate("OrderDetail", { orderId: item.orderId })
            }
          >
            <Text style={styles.detailBtnText}>
              {t("trading.aftersales.seller.viewDetail")}
            </Text>
          </Pressable>
          {canRespond ? (
            <Pressable style={styles.respondBtn} onPress={() => setActive(item)}>
              <Text style={styles.respondBtnText}>
                {t("trading.aftersales.seller.respond")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("trading.aftersales.seller.title")}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const activeChip = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.chip, activeChip && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, activeChip && styles.chipTextActive]}>
                {t(f.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.gray400} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.scroll}
          renderItem={renderCard}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Ionicons
                name="cube-outline"
                size={28}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>
                {t("trading.aftersales.seller.empty")}
              </Text>
            </View>
          }
        />
      )}

      <RespondModal
        dispute={active}
        onClose={() => setActive(null)}
        onDone={onResponded}
      />
    </SafeAreaView>
  );
}

function RespondModal({
  dispute,
  onClose,
  onDone,
}: {
  dispute: Dispute | null;
  onClose: () => void;
  onDone: (d: Dispute) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [action, setAction] = useState<SellerResponseAction>("agree_refund");
  const [message, setMessage] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);

  // 每次打开重置表单
  useEffect(() => {
    if (dispute) {
      setAction("agree_refund");
      setMessage("");
      setPhotoUrls([]);
    }
  }, [dispute]);

  const pickAndUploadPhoto = async () => {
    if (photoUrls.length >= MAX_PHOTOS) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("common.error"),
          t("trading.aftersales.request.photoPermissionDenied"),
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setUploadingPhoto(true);
      const url = await uploadImage(res.assets[0].uri);
      setPhotoUrls((prev) => [...prev, url].slice(0, MAX_PHOTOS));
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.message ?? t("trading.aftersales.request.photoUploadFailed"),
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const doSubmit = useCallback(async () => {
    if (!dispute) return;
    if (action === "reject" && !message.trim()) {
      Alert.alert(
        t("common.error"),
        t("trading.aftersales.seller.messageRequired"),
      );
      return;
    }
    setLoading(true);
    try {
      const updated = await sellerRespondDispute(dispute.id, {
        action,
        message: message.trim() || undefined,
        evidencePhotos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      Alert.alert(
        t("common.success"),
        t("trading.aftersales.seller.respondSuccess"),
      );
      onDone(updated);
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.aftersales.seller.respondFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [dispute, action, message, photoUrls, onDone, t]);

  const confirmSubmit = () => {
    if (!dispute) return;
    if (action === "agree_refund") {
      Alert.alert(
        t("trading.aftersales.seller.agreeRefundConfirmTitle"),
        t("trading.aftersales.seller.agreeRefundConfirmMessage", {
          orderNo: dispute.orderNo ?? "",
        }),
        [
          { text: t("trading.aftersales.seller.cancel"), style: "cancel" },
          {
            text: t("trading.aftersales.seller.confirm"),
            style: "destructive",
            onPress: doSubmit,
          },
        ],
      );
    } else {
      Alert.alert(
        t("trading.aftersales.seller.rejectConfirmTitle"),
        t("trading.aftersales.seller.rejectConfirmMessage"),
        [
          { text: t("trading.aftersales.seller.cancel"), style: "cancel" },
          {
            text: t("trading.aftersales.seller.confirm"),
            onPress: doSubmit,
          },
        ],
      );
    }
  };

  return (
    <Modal
      visible={!!dispute}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {t("trading.aftersales.seller.respondTitle")}
          </Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={[
                styles.optionRow,
                action === "agree_refund" && styles.optionActive,
              ]}
              onPress={() => setAction("agree_refund")}
            >
              <Ionicons
                name={
                  action === "agree_refund"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={
                  action === "agree_refund"
                    ? theme.colors.accent
                    : theme.colors.gray300
                }
              />
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>
                  {t("trading.aftersales.seller.actionAgreeRefund")}
                </Text>
                <Text style={styles.optionHint}>
                  {t("trading.aftersales.seller.actionAgreeRefundHint")}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.optionRow,
                action === "reject" && styles.optionActive,
              ]}
              onPress={() => setAction("reject")}
            >
              <Ionicons
                name={
                  action === "reject" ? "radio-button-on" : "radio-button-off"
                }
                size={20}
                color={
                  action === "reject" ? theme.colors.accent : theme.colors.gray300
                }
              />
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>
                  {t("trading.aftersales.seller.actionReject")}
                </Text>
                <Text style={styles.optionHint}>
                  {t("trading.aftersales.seller.actionRejectHint")}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.modalLabel}>
              {action === "reject"
                ? t("trading.aftersales.seller.messageRejectLabel")
                : t("trading.aftersales.seller.messageLabel")}
            </Text>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder={t("trading.aftersales.seller.messagePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>
              {t("trading.aftersales.seller.evidenceUploadLabel", {
                count: photoUrls.length,
                max: MAX_PHOTOS,
              })}
            </Text>
            <View style={styles.photoRow}>
              {photoUrls.map((url) => (
                <View key={url} style={styles.photoTile}>
                  <RNImage source={{ uri: url }} style={styles.photoImage} />
                  <Pressable
                    style={styles.photoRemoveBtn}
                    onPress={() =>
                      setPhotoUrls((prev) => prev.filter((u) => u !== url))
                    }
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photoUrls.length < MAX_PHOTOS ? (
                <Pressable
                  style={[styles.photoTile, styles.photoAddBtn]}
                  onPress={pickAndUploadPhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color={theme.colors.gray300} />
                  ) : (
                    <Ionicons
                      name="add"
                      size={28}
                      color={theme.colors.gray300}
                    />
                  )}
                </Pressable>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalBtnGhost} onPress={onClose}>
              <Text style={styles.modalBtnGhostText}>
                {t("trading.aftersales.seller.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtnPrimary, loading && { opacity: 0.5 }]}
              onPress={confirmSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>
                  {t("trading.aftersales.seller.confirm")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: t.colors.cardElevated,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    chipText: { fontSize: 13, color: t.colors.text },
    chipTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    scroll: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 10,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    thumb: { width: 56, height: 56, borderRadius: 8 },
    thumbPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      lineHeight: 19,
    },
    cardOrderNo: { fontSize: 11, color: t.colors.gray300, marginTop: 3 },
    cardPrice: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 3,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusBadgeText: { fontSize: 11, fontWeight: "600" },
    reasonBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
    reasonLabel: { fontSize: 12, color: t.colors.gray300 },
    reasonValue: { fontSize: 13, color: t.colors.text, fontWeight: "500", flex: 1 },
    description: {
      fontSize: 13,
      color: t.colors.gray400,
      lineHeight: 19,
    },
    evidenceRow: { flexDirection: "row", gap: 8 },
    evidenceTile: {
      width: 60,
      height: 60,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    responseBlock: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    responseLabel: { fontSize: 12, fontWeight: "600", color: t.colors.text },
    responseText: { fontSize: 12, color: t.colors.gray400, lineHeight: 17 },
    submittedAt: { fontSize: 11, color: t.colors.gray300 },
    cardActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 2,
    },
    detailBtn: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    detailBtnText: { fontSize: 13, color: t.colors.text },
    respondBtn: {
      paddingVertical: 9,
      paddingHorizontal: 18,
      borderRadius: 6,
      backgroundColor: t.colors.accent,
    },
    respondBtnText: { fontSize: 13, color: t.colors.textInverted, fontWeight: "600" },
    emptyBlock: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      gap: 10,
    },
    emptyText: { fontSize: 13, color: t.colors.gray400 },

    // ---------- respond modal ----------
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 32,
    },
    modalHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 16,
      color: t.colors.text,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 10,
    },
    optionActive: { borderColor: t.colors.accent },
    optionTextWrap: { flex: 1 },
    optionTitle: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    optionHint: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 3,
      lineHeight: 17,
    },
    modalLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 12,
      marginBottom: 8,
    },
    textarea: {
      backgroundColor: t.colors.inputBackground,
      borderRadius: 10,
      padding: 12,
      minHeight: 90,
      fontSize: 14,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    photoTile: {
      width: 64,
      height: 64,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      position: "relative",
    },
    photoImage: { width: "100%", height: "100%" },
    photoAddBtn: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.inputBackground,
    },
    photoRemoveBtn: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 16,
    },
    modalBtnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
    modalBtnGhostText: { color: t.colors.gray300, fontSize: 14 },
    modalBtnPrimary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 8,
      minWidth: 120,
      alignItems: "center",
    },
    modalBtnPrimaryText: { color: t.colors.textInverted, fontWeight: "600" },
  });
