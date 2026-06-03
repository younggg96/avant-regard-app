/**
 * UploadArchiveItemScreen —— PDF p.21「独立上传 MY ARCHIVE」。
 *
 * 复用 TradingFormShared（字段 / 输入 / 主按钮 / 图片网格），
 * 颜色与圆角全部走 theme tokens，兼容 light / dark。
 */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Text as RNText,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import {
  makeTradingFormStyles,
  TradingFormField,
  TradingFormInput,
  TradingFormTextArea,
} from "../../components/trading/TradingFormShared";
import { useAppTheme, useThemedStyles } from "../../theme";
import { Alert } from "../../utils/Alert";
import { uploadImageFromUri } from "../admin/adminUtils";
import { createArchiveItem } from "../../services/archivePlusService";

const UploadArchiveItemScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [priceText, setPriceText] = useState("");
  const [note, setNote] = useState("");
  const [storage, setStorage] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    if (photos.length >= 9) {
      Alert.show(t("trading.uploadArchive.maxPhotos"));
      return;
    }
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("trading.uploadArchive.permissionAlbum"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 9 - photos.length,
    });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of res.assets) {
        const url = await uploadImageFromUri(asset.uri);
        if (url) urls.push(url);
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.uploadArchive.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!title.trim()) {
      Alert.show(t("trading.uploadArchive.titleRequired"));
      return;
    }
    if (photos.length === 0) {
      Alert.show(t("trading.uploadArchive.photoRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const priceCents = priceText.trim()
        ? Math.round(parseFloat(priceText) * 100)
        : undefined;
      await createArchiveItem({
        title: title.trim(),
        brandName: brand.trim() || undefined,
        size: size.trim() || undefined,
        color: color.trim() || undefined,
        acquiredPriceCents: priceCents,
        acquiredAt: acquiredAt.trim() || undefined,
        note: note.trim() || undefined,
        storageLocation: storage.trim() || undefined,
        photos,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.uploadArchive.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.uploadArchive.headerTitle")} showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <RNText style={styles.mutedText}>
            {t("trading.uploadArchive.privacyHint")}
          </RNText>

          <View style={styles.photoGrid}>
            {photos.map((uri, idx) => (
              <View key={uri + idx} style={styles.photoWrap}>
                <RNImage source={{ uri }} style={styles.photoThumb} />
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => removePhoto(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.delete")}
                >
                  <Ionicons
                    name="close"
                    size={14}
                    color={theme.colors.textInverted}
                  />
                </Pressable>
              </View>
            ))}
            {photos.length < 9 ? (
              <Pressable style={styles.photoAdd} onPress={pickImage}>
                {uploading ? (
                  <ActivityIndicator color={theme.colors.text} />
                ) : (
                  <Ionicons name="add" size={28} color={theme.colors.gray300} />
                )}
              </Pressable>
            ) : null}
          </View>

          <TradingFormField label={t("trading.uploadArchive.titleLabel")}>
            <TradingFormInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("trading.uploadArchive.titlePlaceholder")}
            />
          </TradingFormField>

          <TradingFormField label={t("trading.uploadArchive.brandLabel")}>
            <TradingFormInput
              value={brand}
              onChangeText={setBrand}
              placeholder={t("trading.uploadArchive.brandPlaceholder")}
            />
          </TradingFormField>

          <HStack space="md">
            <Box flex={1}>
              <TradingFormField label={t("trading.uploadArchive.sizeLabel")}>
                <TradingFormInput
                  value={size}
                  onChangeText={setSize}
                  placeholder={t("trading.uploadArchive.sizePlaceholder")}
                />
              </TradingFormField>
            </Box>
            <Box flex={1}>
              <TradingFormField label={t("trading.uploadArchive.colorLabel")}>
                <TradingFormInput
                  value={color}
                  onChangeText={setColor}
                  placeholder={t("trading.uploadArchive.colorPlaceholder")}
                />
              </TradingFormField>
            </Box>
          </HStack>

          <TradingFormField label={t("trading.uploadArchive.acquiredAtLabel")}>
            <TradingFormInput
              value={acquiredAt}
              onChangeText={setAcquiredAt}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
              autoCorrect={false}
            />
          </TradingFormField>

          <TradingFormField label={t("trading.uploadArchive.priceLabel")}>
            <TradingFormInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
              keyboardType="decimal-pad"
            />
          </TradingFormField>

          <TradingFormField label={t("trading.uploadArchive.storageLabel")}>
            <TradingFormInput
              value={storage}
              onChangeText={setStorage}
              placeholder={t("trading.uploadArchive.storagePlaceholder")}
            />
          </TradingFormField>

          <TradingFormField label={t("trading.uploadArchive.noteLabel")}>
            <TradingFormTextArea
              value={note}
              onChangeText={setNote}
              placeholder={t("trading.uploadArchive.notePlaceholder")}
            />
          </TradingFormField>

          <Box style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.stickyFooter}>
          <Pressable
            style={[
              styles.stickyFooterPrimary,
              submitting && styles.stickyFooterPrimaryDisabled,
            ]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <RNText style={styles.primaryBtnText}>
                {t("trading.uploadArchive.submitBtn")}
              </RNText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default UploadArchiveItemScreen;
