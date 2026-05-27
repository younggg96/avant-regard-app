/**
 * AddressBookScreen —— 用户常用收货地址簿(PRD 模块四 · 支付环节地址管理)。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
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
import { ApiError } from "../services/http";
import ScreenHeader from "../components/ScreenHeader";
import { Text } from "../components/ui";
import {
  makeTradingFormStyles,
  ShippingAddressFields,
  TradingFormDefaultToggle,
  TRADING_FORM_PADDING,
} from "../components/trading/TradingFormShared";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

type FormMode =
  | { kind: "create" }
  | { kind: "edit"; address: UserAddress };

export default function AddressBookScreen() {
  const theme = useAppTheme();
  const formStyles = useThemedStyles(makeTradingFormStyles);
  const styles = useThemedStyles(makeScreenStyles);
  const { t } = useTranslation();

  const [items, setItems] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyAddresses();
      setItems(list);
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError && e.status === 404
          ? t("trading.addressBook.serviceUnavailable")
          : e instanceof Error
            ? e.message
            : "";
      Alert.alert(t("trading.addressBook.loadFailed"), msg);
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader
        title={t("trading.addressBook.title")}
        showBack
        rightActions={[
          {
            icon: "add",
            style: "ghost",
            onPress: () => setEditing({ kind: "create" }),
          },
        ]}
      />

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
          <Text style={formStyles.emptyTitle}>
            {t("trading.addressBook.empty")}
          </Text>
          <Text style={formStyles.emptyHint}>
            {t("trading.addressBook.emptyHint")}
          </Text>
          <Pressable
            onPress={() => setEditing({ kind: "create" })}
            style={[formStyles.primaryBtn, { marginTop: 24 }]}
          >
            <Text style={formStyles.primaryBtnText}>
              {t("trading.addressBook.addNew")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {items.map((it) => (
            <View key={it.id} style={formStyles.card}>
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
                  <View style={formStyles.defaultBadge}>
                    <Text style={formStyles.defaultBadgeText}>
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
                    <Text style={formStyles.linkText}>
                      {t("trading.addressBook.setDefault")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setEditing({ kind: "edit", address: it })}
                  style={styles.actionBtn}
                >
                  <Text style={formStyles.linkText}>
                    {t("trading.addressBook.edit")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDelete(it)}
                  style={styles.actionBtn}
                >
                  <Text style={[formStyles.linkText, styles.actionTextDanger]}>
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
  const formStyles = useThemedStyles(makeTradingFormStyles);
  const styles = useThemedStyles(makeScreenStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.safe,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ScreenHeader
          title={
            existing
              ? t("trading.addressBook.editAddress")
              : t("trading.addressBook.addNew")
          }
          showCloseButton
          onBackPress={onClose}
          rightComponent={
            saving ? (
              <ActivityIndicator color={theme.colors.accent} size="small" />
            ) : (
              <Pressable onPress={save} disabled={!canSave} hitSlop={8}>
                <Text
                  style={[
                    formStyles.linkText,
                    !canSave && { opacity: 0.4 },
                  ]}
                >
                  {t("common.save")}
                </Text>
              </Pressable>
            )
          }
        />
        <KeyboardAvoidingView
          style={styles.formBody}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            contentContainerStyle={formStyles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ShippingAddressFields
              receiverName={receiverName}
              phone={phone}
              fullText={fullText}
              label={label}
              showLabelField
              onChangeReceiverName={setReceiverName}
              onChangePhone={setPhone}
              onChangeFullText={setFullText}
              onChangeLabel={setLabel}
            />

            <TradingFormDefaultToggle
              checked={isDefault}
              label={t("trading.addressBook.setDefault")}
              onToggle={() => setIsDefault((v) => !v)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeScreenStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: TRADING_FORM_PADDING * 2,
    },
    scroll: { padding: TRADING_FORM_PADDING, paddingBottom: 32 },
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
      flexWrap: "wrap",
    },
    receiverName: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    phone: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    labelChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    labelChipText: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    fullText: {
      ...t.typography.bodySmall,
      color: t.colors.text,
      lineHeight: 20,
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
    actionTextDanger: { color: t.colors.error },
    formBody: { flex: 1 },
  });
