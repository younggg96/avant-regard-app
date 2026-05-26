/**
 * AddressBookScreen —— 用户常用收货地址簿(PRD 模块四 · 支付环节地址管理)。
 *
 * 业务规则:
 *   - 同时只能有一条 is_default(由后端 unique index 保证)。
 *   - 软删除:后端 deleted_at,删除后历史订单的地址快照仍可读。
 *   - 第一条地址自动置为默认(后端 service 层处理)。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  createAddress,
  deleteAddress,
  listMyAddresses,
  setDefaultAddress,
  updateAddress,
  UserAddress,
  UserAddressCreate,
} from "../services/addressService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

type FormMode =
  | { kind: "create" }
  | { kind: "edit"; address: UserAddress };

export default function AddressBookScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [items, setItems] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyAddresses();
      setItems(list);
    } catch (e: any) {
      Alert.alert(t("trading.addressBook.loadFailed"), e?.message ?? "");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSetDefault = async (id: number) => {
    try {
      await setDefaultAddress(id);
      await load();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? "");
    }
  };

  const onDelete = (item: UserAddress) => {
    Alert.alert(
      t("trading.addressBook.deleteConfirmTitle"),
      t("trading.addressBook.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trading.addressBook.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAddress(item.id);
              await load();
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.message ?? "");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("trading.addressBook.title")}</Text>
        <Pressable
          onPress={() => setEditing({ kind: "create" })}
          hitSlop={8}
          style={styles.headerAction}
        >
          <Ionicons name="add" size={26} color={theme.colors.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="location-outline"
            size={42}
            color={theme.colors.gray300}
          />
          <Text style={styles.emptyTitle}>
            {t("trading.addressBook.empty")}
          </Text>
          <Text style={styles.emptyHint}>
            {t("trading.addressBook.emptyHint")}
          </Text>
          <Pressable
            onPress={() => setEditing({ kind: "create" })}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {t("trading.addressBook.addNew")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {items.map((it) => (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.nameRow}>
                  <Text style={styles.receiverName}>{it.receiverName}</Text>
                  <Text style={styles.phone}>{it.phone}</Text>
                  {it.label ? (
                    <View style={styles.labelChip}>
                      <Text style={styles.labelChipText}>{it.label}</Text>
                    </View>
                  ) : null}
                </View>
                {it.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>
                      {t("trading.addressBook.defaultBadge")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.fullText} numberOfLines={3}>
                {it.fullText}
              </Text>
              <View style={styles.actions}>
                {!it.isDefault ? (
                  <Pressable
                    onPress={() => onSetDefault(it.id)}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionText}>
                      {t("trading.addressBook.setDefault")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setEditing({ kind: "edit", address: it })}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>
                    {t("trading.addressBook.edit")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDelete(it)}
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                >
                  <Text style={[styles.actionText, styles.actionTextDanger]}>
                    {t("trading.addressBook.delete")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <AddressForm
        visible={editing !== null}
        mode={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </SafeAreaView>
  );
}

/* ---------------------- 新建 / 编辑表单 ---------------------- */

function AddressForm({
  visible,
  mode,
  onClose,
  onSaved,
}: {
  visible: boolean;
  mode: FormMode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const existing = mode?.kind === "edit" ? mode.address : null;

  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [fullText, setFullText] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReceiverName(existing?.receiverName ?? "");
    setPhone(existing?.phone ?? "");
    setFullText(existing?.fullText ?? "");
    setLabel(existing?.label ?? "");
    setIsDefault(existing?.isDefault ?? false);
  }, [visible, existing]);

  const canSave =
    receiverName.trim().length > 0 &&
    phone.trim().length >= 5 &&
    fullText.trim().length > 0 &&
    !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: UserAddressCreate = {
        receiverName: receiverName.trim(),
        phone: phone.trim(),
        fullText: fullText.trim(),
        label: label.trim() || undefined,
        isDefault,
      };
      if (existing) {
        await updateAddress(existing.id, payload);
      } else {
        await createAddress(payload);
      }
      onSaved();
    } catch (e: any) {
      Alert.alert(t("trading.addressBook.saveFailed"), e?.message ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons
                name="close"
                size={26}
                color={theme.colors.text}
              />
            </Pressable>
            <Text style={styles.headerTitle}>
              {existing
                ? t("trading.addressBook.edit")
                : t("trading.addressBook.addNew")}
            </Text>
            <Pressable onPress={save} disabled={!canSave} hitSlop={8}>
              {saving ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.saveText,
                    !canSave && { opacity: 0.4 },
                  ]}
                >
                  {t("common.save")}
                </Text>
              )}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formScroll}>
            <TextInput
              style={styles.input}
              placeholder={t("trading.checkout.receiverName")}
              placeholderTextColor={theme.colors.placeholder}
              value={receiverName}
              onChangeText={setReceiverName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder={t("trading.checkout.phone")}
              placeholderTextColor={theme.colors.placeholder}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder={t("trading.addressBook.fullTextPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={fullText}
              onChangeText={setFullText}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder={t("trading.addressBook.labelHint")}
              placeholderTextColor={theme.colors.placeholder}
              value={label}
              onChangeText={setLabel}
              maxLength={20}
            />
            <Pressable
              style={styles.defaultRow}
              onPress={() => setIsDefault((v) => !v)}
            >
              <View style={[styles.checkbox, isDefault && styles.checkboxOn]}>
                {isDefault ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={theme.colors.textInverted}
                  />
                ) : null}
              </View>
              <Text style={styles.defaultRowText}>
                {t("trading.addressBook.setDefault")}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    headerAction: { minWidth: 26, alignItems: "flex-end" },
    headerTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    saveText: { color: t.colors.accent, fontWeight: "600" },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emptyTitle: {
      marginTop: 12,
      fontSize: 15,
      color: t.colors.text,
      fontWeight: "600",
    },
    emptyHint: {
      marginTop: 6,
      fontSize: 12,
      color: t.colors.gray300,
      textAlign: "center",
    },
    primaryBtn: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 12,
      backgroundColor: t.colors.accent,
      borderRadius: 4,
    },
    primaryBtnText: { color: t.colors.textInverted, fontWeight: "600" },
    scroll: { padding: 16 },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },
    receiverName: {
      fontSize: 15,
      color: t.colors.text,
      fontWeight: "600",
    },
    phone: { fontSize: 13, color: t.colors.gray300 },
    labelChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
    },
    labelChipText: { fontSize: 11, color: t.colors.gray300 },
    defaultBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: t.colors.accent,
      borderRadius: 4,
    },
    defaultBadgeText: {
      fontSize: 11,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    fullText: {
      fontSize: 13,
      color: t.colors.text,
      lineHeight: 19,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      paddingTop: 10,
    },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    actionBtnDanger: {},
    actionText: { fontSize: 13, color: t.colors.accent },
    actionTextDanger: { color: t.colors.error },
    formScroll: { padding: 16, gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    inputMultiline: { minHeight: 88 },
    defaultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.colors.inputBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    defaultRowText: { fontSize: 14, color: t.colors.text },
  });
