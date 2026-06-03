/**
 * DisputeOpenScreen —— 买家端「申请售后」结构化表单（PRD 模块 5 · 买卖分流）。
 *
 * 入口：OrderDetailScreen 上买家的「申请售后」按钮。
 *
 * 设计：买家在这里选择售后原因 + 填写描述 + 上传凭证图，提交后生成一条
 * 结构化售后请求（disputes 记录）。卖家可在「买家售后」列表里看到并响应。
 * 这与卖家端逻辑（SellerAfterSalesScreen）分流：买家=提交，卖家=处理。
 */
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image as RNImage,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { Pressable, Text } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import {
  openDispute,
  contactSupportForOrder,
  DisputeReason,
} from "../../services/aftersalesService";
import { getCustomerServiceChatParams } from "../../utils/chatNavigationUtils";
import { uploadImage } from "../../services/postService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

const MAX_PHOTOS = 4;

/** 买家端售后原因（与订单详情「选择售后类型」一致）。 */
const BUYER_REASONS: DisputeReason[] = [
  "no_logistics_update",
  "delivered_not_received",
  "quality_issue",
  "listing_delisted",
  "other",
];

type RouteParams = {
  DisputeOpen: { orderId: number; initialReason?: DisputeReason };
};

export default function DisputeOpenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "DisputeOpen">>();
  const { orderId, initialReason } = route.params;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [reason, setReason] = useState<DisputeReason | null>(
    initialReason ?? null,
  );
  const [description, setDescription] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const removePhoto = (url: string) => {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
  };

  const submit = async () => {
    setErrorMsg(null);
    if (!reason) {
      setErrorMsg(t("trading.aftersales.request.reasonRequired"));
      return;
    }
    setLoading(true);
    try {
      await openDispute({
        orderId,
        reason,
        description: description.trim() || undefined,
        evidencePhotos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      Alert.alert(
        t("common.success"),
        t("trading.aftersales.request.submitSuccess"),
      );
      navigation.goBack();
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.aftersales.request.submitFailed"));
    } finally {
      setLoading(false);
    }
  };

  const contactCs = async () => {
    try {
      setLoading(true);
      const res = await contactSupportForOrder(orderId);
      navigation.navigate(
        "Chat",
        getCustomerServiceChatParams(res.conversationId, res.csUserId, t),
      );
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? t("trading.aftersales.openFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader
        title={t("trading.aftersales.request.title")}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>
            {t("trading.aftersales.request.reasonLabel")}
          </Text>
          {BUYER_REASONS.map((code) => {
            const active = reason === code;
            return (
              <Pressable
                key={code}
                style={[styles.reasonRow, active && styles.reasonActive]}
                onPress={() => setReason(code)}
              >
                <Text style={styles.reasonText}>
                  {t(`trading.aftersales.reasons.${code}`)}
                </Text>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={active ? theme.colors.accent : theme.colors.gray300}
                />
              </Pressable>
            );
          })}

          <Text style={[styles.label, { marginTop: 20 }]}>
            {t("trading.aftersales.request.descriptionLabel")}
          </Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder={t("trading.aftersales.request.descriptionPlaceholder")}
            placeholderTextColor={theme.colors.placeholder}
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            textAlignVertical="top"
          />

          <Text style={[styles.label, { marginTop: 20 }]}>
            {t("trading.aftersales.request.photosLabel", {
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
                  onPress={() => removePhoto(url)}
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
                  <Ionicons name="add" size={28} color={theme.colors.gray300} />
                )}
              </Pressable>
            ) : null}
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <Pressable style={styles.csLink} onPress={contactCs} disabled={loading}>
            <Ionicons
              name="chatbubbles-outline"
              size={16}
              color={theme.colors.gray300}
            />
            <Text style={styles.csLinkText}>
              {t("trading.aftersales.request.contactCsHint")}
            </Text>
          </Pressable>
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
              <Text style={styles.primaryBtnText}>
                {t("trading.aftersales.request.submit")}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 120 },
    label: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 10,
      color: t.colors.text,
    },
    reasonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    reasonActive: { borderColor: t.colors.accent },
    reasonText: { color: t.colors.text, fontSize: 14, flex: 1, marginRight: 8 },
    textarea: {
      backgroundColor: t.colors.inputBackground,
      borderRadius: 10,
      padding: 12,
      minHeight: 120,
      fontSize: 14,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    photoTile: {
      width: 72,
      height: 72,
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
    error: { color: t.colors.error, marginTop: 14, fontSize: 13 },
    csLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 24,
      padding: 8,
    },
    csLinkText: { color: t.colors.gray300, fontSize: 13 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 28,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });
