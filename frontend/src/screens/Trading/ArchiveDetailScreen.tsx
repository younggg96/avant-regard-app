/**
 * ArchiveDetailScreen —— 单条藏品页。
 *
 * 功能：
 *   - 展示藏品快照
 *   - 一键转卖（生成新 listing 草稿）
 *   - PDF p.22 · 持有记录时间轴 + 新增持有记录
 *
 * 视觉：ScreenHeader + useAppTheme，全部跟随主题。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Image as RNImage,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
} from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  listArchive,
  resellFromArchive,
  ArchiveItem,
  ArchiveHoldingRecord,
  listArchiveHoldings,
  createArchiveHolding,
} from "../../services/archivePlusService";
import {
  formatPrice,
  parsePriceInputToCents,
} from "../../services/storeProductService";

type HoldingStatus = "owned" | "lent" | "transferred" | "resold" | "returned";

type RouteParams = { ArchiveDetail: { archiveId: number } };

const ArchiveDetailScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ArchiveDetail">>();
  const { t } = useTranslation();
  const { archiveId } = route.params;

  const HOLDING_STATUS_LABELS = useMemo<Record<HoldingStatus, string>>(
    () => ({
      owned: t("trading.archiveDetail.statusOwned"),
      lent: t("trading.archiveDetail.statusLent"),
      transferred: t("trading.archiveDetail.statusTransferred"),
      resold: t("trading.archiveDetail.statusResold"),
      returned: t("trading.archiveDetail.statusReturned"),
    }),
    [t]
  );

  const [item, setItem] = useState<ArchiveItem | null>(null);
  const [priceText, setPriceText] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [holdings, setHoldings] = useState<ArchiveHoldingRecord[]>([]);
  const [holdingNote, setHoldingNote] = useState("");
  const [holdingStatus, setHoldingStatus] = useState<HoldingStatus>("owned");

  const reloadHoldings = useCallback(async () => {
    try {
      const list = await listArchiveHoldings(archiveId);
      setHoldings(list);
    } catch (e) {
      console.warn("[ArchiveDetail] load holdings failed", e);
    }
  }, [archiveId]);

  useEffect(() => {
    (async () => {
      const res = await listArchive({ pageSize: 200 });
      const it = res.items.find((i) => i.id === archiveId) ?? null;
      setItem(it);
      if (it?.acquiredPriceCents) {
        setPriceText((it.acquiredPriceCents / 100).toFixed(2));
      }
      setLoading(false);
    })();
    reloadHoldings();
  }, [archiveId, reloadHoldings]);

  const onResell = async () => {
    if (!item) return;
    const cents = parsePriceInputToCents(priceText);
    if (!cents || cents <= 0) {
      Alert.show(t("trading.archiveDetail.invalidPrice"));
      return;
    }
    setSubmitting(true);
    try {
      await resellFromArchive(archiveId, {
        priceCents: cents,
        description: description.trim() || undefined,
      });
      Alert.alert(
        t("trading.archiveDetail.successTitle"),
        t("trading.archiveDetail.successMessage"),
        [
          {
            text: t("trading.archiveDetail.successCta"),
            onPress: () => navigation.navigate("SellerListings"),
          },
          { text: t("trading.archiveDetail.confirm") },
        ],
      );
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const addHolding = async () => {
    try {
      await createArchiveHolding(archiveId, {
        status: holdingStatus,
        note: holdingNote.trim() || undefined,
        heldFrom: new Date().toISOString().slice(0, 10),
      });
      setHoldingNote("");
      setHoldingStatus("owned");
      await reloadHoldings();
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.addHoldingFailed"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("trading.archiveDetail.headerTitle")} showBack />
        <ActivityIndicator
          style={{ marginTop: 32 }}
          color={theme.colors.text}
        />
      </SafeAreaView>
    );
  }
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("trading.archiveDetail.headerTitle")} showBack />
        <Text style={styles.empty}>{t("trading.archiveDetail.notFound")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.archiveDetail.headerTitle")} showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {item.photos?.[0] ? (
            <RNImage source={{ uri: item.photos[0] }} style={styles.cover} />
          ) : (
            <Box style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={48}
                color={theme.colors.gray300}
              />
            </Box>
          )}

          <Text style={styles.title}>{item.title}</Text>
          {item.brandName ? (
            <Text style={styles.brand}>{item.brandName}</Text>
          ) : null}

          <VStack space="xs" style={{ marginTop: 8 }}>
            <InfoRow
              label={t("trading.archiveDetail.sizeLabel")}
              value={item.size ?? "-"}
            />
            <InfoRow
              label={t("trading.archiveDetail.colorLabel")}
              value={item.color ?? "-"}
            />
            <InfoRow
              label={t("trading.archiveDetail.conditionLabel")}
              value={item.condition ?? "-"}
            />
            <InfoRow
              label={t("trading.archiveDetail.acquiredPriceLabel")}
              value={`${formatPrice(item.acquiredPriceCents ?? 0)}${
                item.acquiredAt ? ` · ${item.acquiredAt}` : ""
              }`}
            />
            {item.storageLocation ? (
              <InfoRow
                label={t("trading.archiveDetail.storageLocationLabel")}
                value={item.storageLocation}
              />
            ) : null}
          </VStack>

          {/* PDF p.22 · 持有记录 */}
          <Text style={styles.sectionTitle}>
            {t("trading.archiveDetail.holdingHistoryTitle")}
          </Text>
          {holdings.length === 0 ? (
            <Text style={styles.muted}>
              {t("trading.archiveDetail.noHoldingRecord")}
            </Text>
          ) : (
            <VStack space="xs">
              {holdings.map((h) => (
                <HStack
                  key={h.id}
                  style={styles.holdingRow}
                  space="md"
                  alignItems="flex-start"
                >
                  <Box style={styles.holdingDot} />
                  <VStack flex={1} space="xs">
                    <Text style={styles.holdingTitle}>
                      {HOLDING_STATUS_LABELS[h.status as HoldingStatus] ??
                        h.status}
                      {h.heldFrom ? ` · ${h.heldFrom}` : ""}
                      {h.heldTo ? ` ~ ${h.heldTo}` : ""}
                    </Text>
                    {h.note ? (
                      <Text style={styles.holdingNote}>{h.note}</Text>
                    ) : null}
                    {h.counterpartName ? (
                      <Text style={styles.muted}>
                        {t("trading.archiveDetail.counterpartLabel", {
                          name: h.counterpartName,
                        })}
                      </Text>
                    ) : null}
                  </VStack>
                </HStack>
              ))}
            </VStack>
          )}

          {/* 添加新记录 */}
          <Box style={styles.holdingAddCard}>
            <Text style={styles.holdingAddLabel}>
              {t("trading.archiveDetail.addHoldingTitle")}
            </Text>
            <HStack
              space="xs"
              style={{ flexWrap: "wrap", marginBottom: 8 }}
            >
              {(
                ["owned", "lent", "transferred", "resold", "returned"] as const
              ).map((s) => {
                const active = holdingStatus === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setHoldingStatus(s)}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {HOLDING_STATUS_LABELS[s]}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder={t("trading.archiveDetail.holdingNotePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={holdingNote}
              onChangeText={setHoldingNote}
              multiline
              textAlignVertical="top"
            />
            <Pressable style={styles.smallDarkBtn} onPress={addHolding}>
              <Text style={styles.smallDarkBtnText}>
                {t("trading.archiveDetail.addHoldingBtn")}
              </Text>
            </Pressable>
          </Box>

          {/* 一键转卖 */}
          {item.relistedProductId ? (
            <Box style={styles.banner}>
              <Text style={styles.bannerText}>
                {t("trading.archiveDetail.relistedBanner", {
                  id: item.relistedProductId,
                })}
              </Text>
            </Box>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {t("trading.archiveDetail.resellTitle")}
              </Text>
              <Text style={styles.muted}>
                {t("trading.archiveDetail.resellHint")}
              </Text>
              <HStack style={styles.priceRow} alignItems="center">
                <Text style={styles.currency}>¥</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder={t("trading.archiveDetail.pricePlaceholder")}
                  placeholderTextColor={theme.colors.placeholder}
                  value={priceText}
                  onChangeText={setPriceText}
                  keyboardType="decimal-pad"
                />
              </HStack>
              <TextInput
                style={[styles.input, styles.textareaShort]}
                placeholder={t("trading.archiveDetail.descriptionPlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </>
          )}

          <Box style={{ height: 24 }} />
        </ScrollView>

        {!item.relistedProductId ? (
          <Box style={styles.footer}>
            <Pressable
              style={[styles.primary, submitting && styles.primaryDisabled]}
              onPress={onResell}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.primaryText}>
                  {t("trading.archiveDetail.submitBtn")}
                </Text>
              )}
            </Pressable>
          </Box>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <HStack space="md" alignItems="center">
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </HStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 120 },
    cover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: t.colors.skeleton,
    },
    coverPlaceholder: { alignItems: "center", justifyContent: "center" },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 12,
    },
    brand: { color: t.colors.gray300, marginTop: 4 },
    muted: { color: t.colors.gray300, fontSize: 12 },
    infoLabel: { fontSize: 13, color: t.colors.gray300, width: 60 },
    infoValue: { fontSize: 13, color: t.colors.text, flex: 1 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 24,
      marginBottom: 8,
      letterSpacing: 0.5,
    },

    // ---------- 持有记录 ----------
    holdingRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    holdingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      marginTop: 8,
    },
    holdingTitle: { fontSize: 13, color: t.colors.text, fontWeight: "600" },
    holdingNote: { fontSize: 12, color: t.colors.gray400 },

    holdingAddCard: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    holdingAddLabel: {
      fontSize: 12,
      color: t.colors.gray300,
      marginBottom: 8,
    },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      marginBottom: 4,
    },
    statusChipActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accent,
    },
    statusChipText: { fontSize: 12, color: t.colors.text },
    statusChipTextActive: { color: t.colors.textInverted },
    smallDarkBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: t.colors.accent,
      borderRadius: 16,
      marginTop: 6,
    },
    smallDarkBtnText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontWeight: "600",
    },

    // ---------- 一键转卖 ----------
    banner: {
      backgroundColor: `${t.colors.success}22`,
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    bannerText: { color: t.colors.success, fontWeight: "600" },
    priceRow: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.text,
      paddingVertical: 8,
      marginTop: 12,
    },
    currency: {
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
      marginRight: 8,
    },
    priceInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
    },

    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    textarea: { minHeight: 100 },
    textareaShort: { minHeight: 80, marginTop: 12 },

    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    primary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    primaryDisabled: { opacity: 0.5 },
    primaryText: {
      color: t.colors.textInverted,
      fontSize: 16,
      fontWeight: "600",
    },
    empty: {
      textAlign: "center",
      color: t.colors.gray300,
      marginTop: 32,
    },
  });

export default ArchiveDetailScreen;
