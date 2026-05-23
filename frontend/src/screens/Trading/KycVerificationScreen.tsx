/**
 * KycVerificationScreen —— 卖家实名认证（用于解锁提现）。
 *
 * 入口：
 *   - MyWallet → 「实名认证」
 *   - WithdrawRequest 校验失败提示
 *
 * 字段：
 *   - 真实姓名 / 身份证号 / 联系电话（选填）
 *   - 身份证人像面 / 国徽面 / 手持身份证 三张证件照
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import {
  getMyKyc,
  KYCRecord,
  KYCStatus,
  submitKyc,
} from "../../services/kycService";
import { uploadImage } from "../../services/postService";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type PhotoKey = "idFront" | "idBack" | "holderPhoto";

export default function KycVerificationScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [record, setRecord] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [realName, setRealName] = useState("");
  const [idCardNo, setIdCardNo] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<Record<PhotoKey, string | undefined>>({
    idFront: undefined,
    idBack: undefined,
    holderPhoto: undefined,
  });
  const [uploadingKey, setUploadingKey] = useState<PhotoKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rec = await getMyKyc();
      setRecord(rec);
      // 已通过 / 审核中：仍允许「重新提交」，但 UI 中的输入框默认空
      if (rec.idCardFrontUrl) {
        setPhotos((prev) => ({ ...prev, idFront: rec.idCardFrontUrl ?? undefined }));
      }
      if (rec.idCardBackUrl) {
        setPhotos((prev) => ({ ...prev, idBack: rec.idCardBackUrl ?? undefined }));
      }
      if (rec.holderPhotoUrl) {
        setPhotos((prev) => ({
          ...prev,
          holderPhoto: rec.holderPhotoUrl ?? undefined,
        }));
      }
      if (rec.contactPhone) setPhone(rec.contactPhone);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickPhoto = async (key: PhotoKey) => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("common.photoPermissionRequired"));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets?.length) {
        setUploadingKey(key);
        try {
          const url = await uploadImage(res.assets[0].uri);
          setPhotos((prev) => ({ ...prev, [key]: url }));
        } catch (e: any) {
          Alert.alert(t("common.uploadFailed"), e?.message ?? "");
        } finally {
          setUploadingKey(null);
        }
      }
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? "");
    }
  };

  const submit = async () => {
    if (!realName.trim() || !idCardNo.trim()) {
      Alert.alert(t("trading.kyc.fillRequired"));
      return;
    }
    if (!photos.idFront || !photos.idBack || !photos.holderPhoto) {
      Alert.alert(t("trading.kyc.fillRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const rec = await submitKyc({
        realName: realName.trim(),
        idCardNo: idCardNo.trim(),
        idCardFrontUrl: photos.idFront,
        idCardBackUrl: photos.idBack,
        holderPhotoUrl: photos.holderPhoto,
        contactPhone: phone.trim() || undefined,
      });
      setRecord(rec);
      Alert.alert(t("trading.kyc.submitSuccess"), "", [
        { text: t("common.confirm"), onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.kyc.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator
          style={{ marginTop: 48 }}
          color={theme.colors.gray300}
        />
      </SafeAreaView>
    );
  }

  const status: KYCStatus = (record?.status as KYCStatus) || "none";
  const isApproved = status === "approved";
  const isPending = status === "pending";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.kyc.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t("trading.kyc.intro")}</Text>

        <View style={[styles.statusCard, statusColor(status, theme)]}>
          <Ionicons
            name={
              isApproved
                ? "shield-checkmark"
                : isPending
                ? "time-outline"
                : status === "rejected"
                ? "alert-circle-outline"
                : "shield-outline"
            }
            size={20}
            color={theme.colors.text}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {t(`trading.kyc.status${capitalize(status)}`)}
            </Text>
            {isApproved ? (
              <Text style={styles.statusHint}>
                {t("trading.kyc.approvedHint")}
              </Text>
            ) : null}
            {isPending ? (
              <Text style={styles.statusHint}>
                {t("trading.kyc.pendingHint")}
              </Text>
            ) : null}
            {status === "rejected" && record?.rejectReason ? (
              <Text style={styles.statusHint}>
                {t("trading.kyc.rejectReasonTitle")}:{" "}
                {record.rejectReason}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Field label={t("trading.kyc.realNameLabel")}>
            <TextInput
              style={styles.input}
              placeholder={t("trading.kyc.realNamePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={realName}
              onChangeText={setRealName}
              autoCapitalize="none"
              editable={!isApproved && !isPending}
            />
          </Field>
          <Field label={t("trading.kyc.idCardLabel")}>
            <TextInput
              style={styles.input}
              placeholder={t("trading.kyc.idCardPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={idCardNo}
              onChangeText={setIdCardNo}
              autoCapitalize="characters"
              editable={!isApproved && !isPending}
            />
          </Field>
          <Field label={t("trading.kyc.phoneLabel")}>
            <TextInput
              style={styles.input}
              placeholder={t("trading.kyc.phonePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isApproved && !isPending}
            />
          </Field>
        </View>

        <View style={styles.section}>
          <PhotoSlot
            label={t("trading.kyc.idFrontLabel")}
            uri={photos.idFront}
            loading={uploadingKey === "idFront"}
            onPress={() => pickPhoto("idFront")}
            disabled={isApproved || isPending}
          />
          <PhotoSlot
            label={t("trading.kyc.idBackLabel")}
            uri={photos.idBack}
            loading={uploadingKey === "idBack"}
            onPress={() => pickPhoto("idBack")}
            disabled={isApproved || isPending}
          />
          <PhotoSlot
            label={t("trading.kyc.holderPhotoLabel")}
            uri={photos.holderPhoto}
            loading={uploadingKey === "holderPhoto"}
            onPress={() => pickPhoto("holderPhoto")}
            disabled={isApproved || isPending}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryBtn,
            (submitting || isApproved || isPending) && styles.disabled,
          ]}
          onPress={submit}
          disabled={submitting || isApproved || isPending}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isApproved
                ? t("trading.kyc.statusApproved")
                : isPending
                ? t("trading.kyc.statusPending")
                : status === "rejected"
                ? t("trading.kyc.resubmit")
                : t("trading.kyc.submit")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PhotoSlot({
  label,
  uri,
  loading,
  onPress,
  disabled,
}: {
  label: string;
  uri?: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.photoSlot}>
      <Text style={styles.photoLabel}>{label}</Text>
      <Pressable
        style={styles.photoFrame}
        onPress={disabled ? undefined : onPress}
      >
        {uri ? (
          <OptimizedImage
            uri={uri}
            size={ImageSize.MEDIUM}
            style={styles.photoImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            {loading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={theme.colors.gray300}
                />
                <Text style={styles.photoPlaceholderText}>
                  {t("trading.kyc.uploadPhoto")}
                </Text>
              </>
            )}
          </View>
        )}
        {uri && !disabled ? (
          <View style={styles.photoOverlay}>
            <Text style={styles.photoOverlayText}>
              {t("trading.kyc.replacePhoto")}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusColor(status: KYCStatus, t: AppTheme) {
  if (status === "approved") {
    return {
      backgroundColor: t.mode === "dark" ? "#0F1F14" : "#EEFBF2",
    };
  }
  if (status === "pending") {
    return {
      backgroundColor: t.mode === "dark" ? "#2A2410" : "#FFF8E6",
    };
  }
  if (status === "rejected") {
    return {
      backgroundColor: t.mode === "dark" ? "#2A1414" : "#FFF5F5",
    };
  }
  return { backgroundColor: t.colors.cardElevated };
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
    intro: {
      fontSize: 13,
      color: t.colors.gray300,
      marginBottom: 12,
      lineHeight: 20,
    },
    statusCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    statusTitle: { fontSize: 13, fontWeight: "600", color: t.colors.text },
    statusHint: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 4,
      lineHeight: 18,
    },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    field: { marginBottom: 12 },
    fieldLabel: {
      fontSize: 12,
      color: t.colors.gray300,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    photoSlot: { marginBottom: 12 },
    photoLabel: {
      fontSize: 12,
      color: t.colors.gray300,
      marginBottom: 8,
    },
    photoFrame: {
      height: 140,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderStyle: "dashed",
      overflow: "hidden",
      backgroundColor: t.colors.inputBackground,
    },
    photoImage: { width: "100%", height: "100%" },
    photoPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    photoPlaceholderText: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 6,
    },
    photoOverlay: {
      position: "absolute",
      bottom: 8,
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 4,
    },
    photoOverlayText: { color: "#fff", fontSize: 11 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 4,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    disabled: { opacity: 0.5 },
  });
