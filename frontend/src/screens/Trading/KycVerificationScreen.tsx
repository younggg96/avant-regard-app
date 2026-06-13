/**
 * KycVerificationScreen —— 卖家实名认证（用于解锁提现）。
 *
 * 北美版(IS_NA)：走 Stripe Identity 托管验证流程。
 * 国内版：手动上传身份证三张照片。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

import ScreenHeader from "../../components/ScreenHeader";
import {
  makeWalletScreenStyles,
  TradingFormField,
  TradingFormInput,
  TradingFormSection,
} from "../../components/trading/TradingFormShared";
import { IS_NA } from "../../config/env";
import {
  getMyKyc,
  KYCRecord,
  KYCStatus,
  submitKyc,
  startIdentitySession,
  refreshIdentitySession,
} from "../../services/kycService";
import { uploadImage } from "../../services/postService";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type PhotoKey = "idFront" | "idBack" | "holderPhoto";

function resolveAppScheme(): string {
  const expoCfg = (Constants.expoConfig ??
    (Constants as { manifest?: unknown }).manifest) as
    | { scheme?: string | string[] }
    | undefined;
  const s = expoCfg?.scheme;
  if (Array.isArray(s) && s.length > 0) return String(s[0]);
  if (typeof s === "string" && s.length > 0) return s;
  return "avantregard";
}

export default function KycVerificationScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();

  const [record, setRecord] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

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

  const startUsVerification = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const appScheme = resolveAppScheme();
      const session = await startIdentitySession({ region: "US", appScheme });
      if (session.url) {
        await WebBrowser.openAuthSessionAsync(
          session.url,
          `${appScheme}://kyc/return`,
        );
      }
      const fresh = await refreshIdentitySession();
      await load();
      if (fresh.kycStatus === "approved") {
        Alert.alert(t("trading.kyc.us.verifiedTitle"), "", [
          { text: t("common.confirm"), onPress: () => navigation.goBack() },
        ]);
      } else if (fresh.kycStatus === "rejected") {
        Alert.alert(t("trading.kyc.us.failedTitle"));
      }
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? t("trading.kyc.us.startFailed"));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader title={t("trading.kyc.headerTitle")} showBack />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.gray300} />
        </View>
      </SafeAreaView>
    );
  }

  const status: KYCStatus = (record?.status as KYCStatus) || "none";
  const isApproved = status === "approved";
  const isPending = status === "pending";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.kyc.headerTitle")} showBack />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}>
        <Text style={styles.intro}>
          {t(IS_NA ? "trading.kyc.us.intro" : "trading.kyc.intro")}
        </Text>

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
                {t("trading.kyc.rejectReasonTitle")}: {record.rejectReason}
              </Text>
            ) : null}
          </View>
        </View>

        {IS_NA ? (
          <View style={styles.section}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={styles.usStep}>
                <View style={styles.usStepBadge}>
                  <Text style={styles.usStepBadgeText}>{n}</Text>
                </View>
                <Text style={styles.usStepText}>
                  {t(`trading.kyc.us.step${n}`)}
                </Text>
              </View>
            ))}
            <Text style={styles.usPrivacy}>{t("trading.kyc.us.privacy")}</Text>
          </View>
        ) : (
          <>
            <TradingFormSection title={t("trading.kyc.headerTitle")}>
              <TradingFormField label={t("trading.kyc.realNameLabel")}>
                <TradingFormInput
                  placeholder={t("trading.kyc.realNamePlaceholder")}
                  value={realName}
                  onChangeText={setRealName}
                  editable={!isApproved && !isPending}
                />
              </TradingFormField>
              <TradingFormField label={t("trading.kyc.idCardLabel")}>
                <TradingFormInput
                  placeholder={t("trading.kyc.idCardPlaceholder")}
                  value={idCardNo}
                  onChangeText={setIdCardNo}
                  autoCapitalize="characters"
                  editable={!isApproved && !isPending}
                />
              </TradingFormField>
              <TradingFormField label={t("trading.kyc.phoneLabel")}>
                <TradingFormInput
                  placeholder={t("trading.kyc.phonePlaceholder")}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isApproved && !isPending}
                />
              </TradingFormField>
            </TradingFormSection>

            <TradingFormSection title={t("trading.kyc.idFrontLabel")}>
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
            </TradingFormSection>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {IS_NA ? (
          <Pressable
            style={[
              styles.primaryBtn,
              (verifying || isApproved) && styles.primaryBtnDisabled,
            ]}
            onPress={startUsVerification}
            disabled={verifying || isApproved}
          >
            {verifying ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isApproved
                  ? t("trading.kyc.statusApproved")
                  : isPending
                  ? t("trading.kyc.us.continueCta")
                  : status === "rejected"
                  ? t("trading.kyc.us.retryCta")
                  : t("trading.kyc.us.startCta")}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.primaryBtn,
              (submitting || isApproved || isPending) && styles.primaryBtnDisabled,
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
        )}
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
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={{
          height: 140,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderStyle: "dashed",
          overflow: "hidden",
          backgroundColor: theme.colors.inputBackground,
        }}
        onPress={disabled ? undefined : onPress}
      >
        {uri ? (
          <OptimizedImage
            uri={uri}
            size={ImageSize.MEDIUM}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={theme.colors.gray300}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "PlayfairDisplay-Regular",
                    color: theme.colors.gray300,
                    marginTop: 6,
                  }}
                >
                  {t("trading.kyc.uploadPhoto")}
                </Text>
              </>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusColor(status: KYCStatus, t: AppTheme) {
  if (status === "approved") {
    return { backgroundColor: t.mode === "dark" ? "#0F1F14" : "#EEFBF2" };
  }
  if (status === "pending") {
    return { backgroundColor: t.mode === "dark" ? "#2A2410" : "#FFF8E6" };
  }
  if (status === "rejected") {
    return { backgroundColor: t.mode === "dark" ? "#2A1414" : "#FFF5F5" };
  }
  return { backgroundColor: t.colors.cardElevated };
}
