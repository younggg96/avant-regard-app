/**
 * AddressPickerSheet —— Checkout / OfferModal 用的地址选择底部弹窗。
 *
 * 设计:
 *   - 进入即拉取 listMyAddresses(),默认地址在最上;
 *   - 用户点选一条 → onSelect(address) → 父组件填入表单;
 *   - 列表底部固定"管理地址"按钮,跳 AddressBook 屏幕(可新增/编辑);
 *   - 关闭后父组件用 useFocusEffect 自动刷新已选项(可选)。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { listMyAddresses, UserAddress } from "../services/addressService";
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
  const styles = useThemedStyles(makeStyles);
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={["bottom"]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {t("trading.checkout.selectAddress")}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
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
                  <Text style={styles.emptyText}>
                    {t("trading.checkout.noSavedAddresses")}
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
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                {t("trading.addressBook.defaultBadge")}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.full} numberOfLines={2}>
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
              <Text style={styles.manageBtnText}>
                {t("trading.addressBook.title")}
              </Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "78%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "600", color: t.colors.text },
    scroll: { maxHeight: 420 },
    center: { padding: 32, alignItems: "center" },
    emptyText: { marginTop: 8, color: t.colors.gray300 },
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
    name: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    phone: { fontSize: 12, color: t.colors.gray300 },
    defaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: t.colors.accent,
      borderRadius: 4,
    },
    defaultBadgeText: {
      fontSize: 10,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    full: { fontSize: 12, color: t.colors.text, lineHeight: 17 },
    manageBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    manageBtnText: { color: t.colors.accent, fontWeight: "600" },
  });
