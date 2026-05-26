/**
 * TradeReviewScreen —— PRD 模块 5 双盲互评 + MY ARCHIVE 召唤（PDF p.9）。
 *
 * 三步式向导：
 *   1. 综合评分
 *   2. 子维度评分
 *   3. 文字评论
 *   完成后展示 MY ARCHIVE 召唤页 (恭喜收到喜欢的单品...)。
 *
 * 视觉系统：ScreenHeader + useAppTheme，与 PublishListing 一致。
 */
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
import { submitTradeReview } from "../../services/aftersalesService";
import { uploadImage } from "../../services/postService";


const MAX_REVIEW_PHOTOS = 3;

type RouteParams = {
  TradeReview: {
    orderId: number;
    productId?: number;
    productTitle?: string;
    productCover?: string;
  };
};

const TradeReviewScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "TradeReview">>();
  const { t } = useTranslation();
  const { orderId, productTitle, productCover } = route.params;

  const DIMENSIONS = useMemo(
    () => [
      { key: "asDescribed", label: t("trading.review.dimAsDescribed") },
      { key: "communication", label: t("trading.review.dimCommunication") },
      { key: "packaging", label: t("trading.review.dimPackaging") },
      { key: "shipping", label: t("trading.review.dimShipping") },
    ],
    [t]
  );

  const RATING_HINT = useMemo(
    () => [
      t("trading.review.rating1"),
      t("trading.review.rating2"),
      t("trading.review.rating3"),
      t("trading.review.rating4"),
      t("trading.review.rating5"),
    ],
    [t]
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rating, setRating] = useState(5);
  const [dimRatings, setDimRatings] = useState<Record<string, number>>({
    asDescribed: 5,
    communication: 5,
    packaging: 5,
    shipping: 5,
  });
  const [comment, setComment] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pickAndUploadPhoto = async () => {
    if (photoUrls.length >= MAX_REVIEW_PHOTOS) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("common.error"), t("trading.review.photoPermissionDenied"));
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
      setPhotoUrls((prev) => [...prev, url].slice(0, MAX_REVIEW_PHOTOS));
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.message ?? t("trading.review.photoUploadFailed"),
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
    setLoading(true);
    try {
      await submitTradeReview({
        orderId,
        rating,
        payload: dimRatings,
        comment: comment.trim() || undefined,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      setStep(4);
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.review.submitFailed"));
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- celebration ----------------------
  if (step === 4) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("trading.review.headerDoneTitle")} />

        <VStack style={styles.celebrateWrap} space="md">
          <Box style={styles.celebrateMedal}>
            <Ionicons
              name="ribbon"
              size={48}
              color={theme.colors.textInverted}
            />
          </Box>
          <Text style={styles.celebrateTitle}>
            {t("trading.review.celebrateTitle")}
          </Text>
          <Text style={styles.celebrateSubtitle}>
            {t("trading.review.celebrateSubtitle")}
          </Text>

          {productCover ? (
            <RNImage
              source={{ uri: productCover }}
              style={styles.celebrateCover}
            />
          ) : null}
          {productTitle ? (
            <Text style={styles.celebrateProduct}>{productTitle}</Text>
          ) : null}

          <Pressable
            style={styles.primary}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: "MainTabs" }, { name: "MyArchive" }] as any,
              })
            }
          >
            <HStack space="xs" alignItems="center">
              <Ionicons
                name="albums"
                size={18}
                color={theme.colors.textInverted}
              />
              <Text style={styles.primaryText}>
                {t("trading.review.addToArchive")}
              </Text>
            </HStack>
          </Pressable>

          <Pressable
            style={styles.ghostCenter}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.ghostCenterText}>
              {t("trading.review.later")}
            </Text>
          </Pressable>
        </VStack>
      </SafeAreaView>
    );
  }

  // ---------------------- 1-3 步向导 ----------------------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("trading.review.headerTitle")}
        showBack
        onBackPress={() =>
          step === 1
            ? navigation.goBack()
            : setStep(((step as number) - 1) as 1 | 2 | 3)
        }
      />

      {/* 进度条 */}
      <HStack style={styles.progressRow} space="xs" justifyContent="center">
        {[1, 2, 3].map((n) => (
          <Box
            key={n}
            style={[styles.progressDot, n <= step && styles.progressDotActive]}
          />
        ))}
      </HStack>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <VStack style={styles.stepCenter} space="sm">
              <Text style={styles.stepTitle}>
                {t("trading.review.step1Title")}
              </Text>
              <Text style={styles.muted}>{t("trading.review.step1Hint")}</Text>
              <Stars value={rating} onChange={setRating} size={48} />
              <Text style={styles.ratingHint}>{RATING_HINT[rating - 1]}</Text>
            </VStack>
          )}

          {step === 2 && (
            <VStack space="sm">
              <Text style={styles.stepTitle}>
                {t("trading.review.step2Title")}
              </Text>
              {DIMENSIONS.map((d) => (
                <HStack
                  key={d.key}
                  style={styles.dimRow}
                  justifyContent="between"
                  alignItems="center"
                >
                  <Text style={styles.dimLabel}>{d.label}</Text>
                  <Stars
                    value={dimRatings[d.key] ?? 5}
                    onChange={(v) =>
                      setDimRatings((prev) => ({ ...prev, [d.key]: v }))
                    }
                    size={22}
                  />
                </HStack>
              ))}
            </VStack>
          )}

          {step === 3 && (
            <VStack space="sm">
              <Text style={styles.stepTitle}>
                {t("trading.review.step3Title")}
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder={t("trading.review.commentPlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />

              {/* 图片上传 · 最多 3 张 */}
              <Text style={styles.photosLabel}>
                {t("trading.review.photosLabel", {
                  count: photoUrls.length,
                  max: MAX_REVIEW_PHOTOS,
                })}
              </Text>
              <HStack space="sm">
                {photoUrls.map((url) => (
                  <Box key={url} style={styles.photoTile}>
                    <RNImage source={{ uri: url }} style={styles.photoImage} />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      onPress={() => removePhoto(url)}
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={theme.colors.textInverted}
                      />
                    </Pressable>
                  </Box>
                ))}
                {photoUrls.length < MAX_REVIEW_PHOTOS ? (
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
              </HStack>
            </VStack>
          )}

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        </ScrollView>

        <Box style={styles.footer}>
          <Pressable
            style={[styles.primary, loading && styles.primaryDisabled]}
            onPress={() => {
              if (step < 3) setStep(((step as number) + 1) as 1 | 2 | 3);
              else submit();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryText}>
                {step === 3
                  ? t("trading.review.submit")
                  : t("trading.review.next")}
              </Text>
            )}
          </Pressable>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Stars: React.FC<{
  value: number;
  onChange: (v: number) => void;
  size: number;
}> = ({ value, onChange, size }) => {
  const theme = useAppTheme();
  return (
    <HStack space="xs" alignSelf="center">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={n <= value ? theme.colors.starRated : theme.colors.gray200}
          />
        </Pressable>
      ))}
    </HStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    progressRow: {
      paddingVertical: 12,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    progressDot: {
      width: 24,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
    },
    progressDotActive: { backgroundColor: t.colors.accent },
    scroll: { padding: 16, paddingBottom: 32 },
    stepCenter: { alignItems: "center", marginTop: 32 },
    stepTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
    },
    muted: {
      color: t.colors.gray300,
      fontSize: 12,
      textAlign: "center",
    },
    ratingHint: { color: t.colors.text, fontWeight: "500", marginTop: 8 },
    dimRow: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    dimLabel: { fontSize: 14, color: t.colors.text },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    textarea: { minHeight: 160 },
    photosLabel: {
      fontSize: 13,
      color: t.colors.gray300,
      marginTop: 16,
      marginBottom: 10,
    },
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
    error: { color: t.colors.error, marginTop: 12 },

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

    // ---------- 庆祝页 ----------
    celebrateWrap: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 48,
      alignItems: "center",
    },
    celebrateMedal: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    celebrateTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
    },
    celebrateSubtitle: {
      fontSize: 13,
      color: t.colors.gray300,
      textAlign: "center",
      lineHeight: 20,
    },
    celebrateCover: {
      width: 160,
      height: 160,
      borderRadius: 12,
      marginTop: 24,
      backgroundColor: t.colors.skeleton,
    },
    celebrateProduct: {
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "600",
      textAlign: "center",
    },
    ghostCenter: { marginTop: 12, padding: 12 },
    ghostCenterText: { color: t.colors.gray300, fontSize: 13 },
  });

export default TradeReviewScreen;
