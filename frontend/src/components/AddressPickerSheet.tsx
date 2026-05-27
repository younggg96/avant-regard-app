/**
 * AddressPickerSheet —— Checkout / OfferModal 用的地址选择底部弹窗。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { listMyAddresses, UserAddress } from "../services/addressService";
import { Text } from "./ui";
import { makeTradingFormStyles } from "./trading/TradingFormShared";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

interface Props {
  visible: boolean;
  selectedId?: number | null;
  onSelect: (address: UserAddress) => void;
  onClose: () => void;
}

export function AddressPickerSheet({
  visible,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const theme = useAppTheme();
  const formStyles = useThemedStyles(makeTradingFormStyles);
  const styles = useThemedStyles(makeSheetStyles);
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyAddresses();
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleManage = () => {
    onClose();
    navigation.navigate("AddressBook");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={["bottom"]} style={styles.safe}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {t("trading.checkout.selectAddress")}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.scroll}>
              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.colors.accent} />
                </View>
              ) : items.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons
                    name="location-outline"
                    size={36}
                    color={theme.colors.gray300}
                  />
                  <Text style={formStyles.emptyTitle}>
                    {t("trading.checkout.noSavedAddresses")}
                  </Text>
                  <Text style={formStyles.emptyHint}>
                    {t("trading.addressBook.emptyHint")}
                  </Text>
                </View>
              ) : (
                items.map((it) => {
                  const selected = it.id === selectedId;
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => onSelect(it)}
                      style={[styles.row, selected && styles.rowSelected]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{it.receiverName}</Text>
                          <Text style={styles.phone}>{it.phone}</Text>
                          {it.isDefault ? (
                            <View style={formStyles.defaultBadge}>
                              <Text style={formStyles.defaultBadgeText}>
                                {t("trading.addressBook.defaultBadge")}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={formStyles.bodyText} numberOfLines={2}>
                          {it.fullText}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={theme.colors.accent}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={22}
                          color={theme.colors.gray300}
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable style={styles.manageBtn} onPress={handleManage}>
              <Ionicons
                name="settings-outline"
                size={18}
                color={theme.colors.accent}
              />
              <Text style={formStyles.linkText}>
                {t("trading.addressBook.title")}
              </Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeSheetStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      maxHeight: "78%",
    },
    safe: { flexGrow: 0 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    scroll: { maxHeight: 420 },
    center: { padding: 32, alignItems: "center" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowSelected: {
      backgroundColor: t.colors.skeleton,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
      flexWrap: "wrap",
    },
    name: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    phone: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    manageBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  });
