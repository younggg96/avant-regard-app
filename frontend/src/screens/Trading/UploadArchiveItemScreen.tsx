/**
 * UploadArchiveItemScreen —— PDF p.21「独立上传 MY ARCHIVE」。
 *
 * 完全跟随项目设计系统：
 *   - ScreenHeader 顶栏 + showBack
 *   - useThemedStyles 主题化所有样式
 *   - FieldRow + 与 PublishListingStep1Screen 同款输入
 *   - 主 CTA 跟随 t.colors.accent / textInverted
 */
import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
import { Alert } from "../../utils/Alert";
import { uploadImageFromUri } from "../admin/adminUtils";
import { createArchiveItem } from "../../services/archivePlusService";

const UploadArchiveItemScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.uploadArchive.headerTitle")} showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.muted}>
            {t("trading.uploadArchive.privacyHint")}
          </Text>

          {/* 图片网格 */}
          <HStack style={styles.photoGrid} space="sm">
            {photos.map((uri, idx) => (
              <Box key={uri + idx} style={styles.photoWrap}>
                <RNImage source={{ uri }} style={styles.photo} />
                <Pressable
                  style={styles.photoX}
                  onPress={() => removePhoto(idx)}
                >
                  <Ionicons
                    name="close"
                    size={14}
                    color={theme.colors.textInverted}
                  />
                </Pressable>
              </Box>
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
          </HStack>

          <FieldRow label={t("trading.uploadArchive.titleLabel")}>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t("trading.uploadArchive.titlePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
            />
          </FieldRow>

          <FieldRow label={t("trading.uploadArchive.brandLabel")}>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder={t("trading.uploadArchive.brandPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
            />
          </FieldRow>

          <HStack space="md">
            <Box flex={1}>
              <FieldRow label={t("trading.uploadArchive.sizeLabel")}>
                <TextInput
                  style={styles.input}
                  value={size}
                  onChangeText={setSize}
                  placeholder={t("trading.uploadArchive.sizePlaceholder")}
                  placeholderTextColor={theme.colors.placeholder}
                />
              </FieldRow>
            </Box>
            <Box flex={1}>
              <FieldRow label={t("trading.uploadArchive.colorLabel")}>
                <TextInput
                  style={styles.input}
                  value={color}
                  onChangeText={setColor}
                  placeholder={t("trading.uploadArchive.colorPlaceholder")}
                  placeholderTextColor={theme.colors.placeholder}
                />
              </FieldRow>
            </Box>
          </HStack>

          <FieldRow label={t("trading.uploadArchive.acquiredAtLabel")}>
            <TextInput
              style={styles.input}
              value={acquiredAt}
              onChangeText={setAcquiredAt}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              autoCorrect={false}
            />
          </FieldRow>

          <FieldRow label={t("trading.uploadArchive.priceLabel")}>
            <TextInput
              style={styles.input}
              value={priceText}
              onChangeText={setPriceText}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="decimal-pad"
            />
          </FieldRow>

          <FieldRow label={t("trading.uploadArchive.storageLabel")}>
            <TextInput
              style={styles.input}
              value={storage}
              onChangeText={setStorage}
              placeholder={t("trading.uploadArchive.storagePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
            />
          </FieldRow>

          <FieldRow label={t("trading.uploadArchive.noteLabel")}>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={note}
              onChangeText={setNote}
              placeholder={t("trading.uploadArchive.notePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              multiline
              textAlignVertical="top"
            />
          </FieldRow>

          <Box style={{ height: 24 }} />
        </ScrollView>

        <Box style={styles.footer}>
          <Pressable
            style={[styles.primary, submitting && styles.primaryDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryText}>
                {t("trading.uploadArchive.submitBtn")}
              </Text>
            )}
          </Pressable>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const FieldRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <VStack style={styles.fieldRow} space="xs">
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </VStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 32 },
    muted: { color: t.colors.gray300, fontSize: 12, marginBottom: 16 },

    photoGrid: {
      flexWrap: "wrap",
      marginBottom: 16,
    },
    photoWrap: { width: 72, height: 72, position: "relative", marginBottom: 8 },
    photo: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
    },
    photoX: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.card,
      marginBottom: 8,
    },

    fieldRow: { marginBottom: 18 },
    fieldLabel: {
      fontSize: 13,
      color: t.colors.gray300,
      marginBottom: 6,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    textarea: { minHeight: 96 },

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
  });

export default UploadArchiveItemScreen;
