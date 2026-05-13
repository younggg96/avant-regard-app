import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { brandService, SubmitBrandParams } from "../services/brandService";
import { uploadImage } from "../services/postService";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

export type SubmitBrandFormVariant = "modal" | "screen";

interface SubmitBrandFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  variant?: SubmitBrandFormVariant;
}

const SubmitBrandForm: React.FC<SubmitBrandFormProps> = ({
  onClose,
  onSuccess,
  variant = "modal",
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [founder, setFounder] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"success" | "error" | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = () => {
    setName("");
    setCategory("");
    setFoundedYear("");
    setFounder("");
    setCountry("");
    setWebsite("");
    setCoverImageUri(null);
    setSubmitResult(null);
    setErrorMessage("");
  };

  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setErrorMessage(t("imageUploader.galleryAccessRequired"));
      setSubmitResult("error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canSubmit =
    name.trim().length > 0 && !!coverImageUri && !isSubmitting && !isUploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      let coverImageUrl: string | undefined;

      if (coverImageUri) {
        setIsUploading(true);
        try {
          coverImageUrl = await uploadImage(coverImageUri);
        } catch {
          setSubmitResult("error");
          setErrorMessage(t("submitBrand.uploadFailed"));
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      const params: SubmitBrandParams = {
        name: name.trim(),
      };
      if (category.trim()) params.category = category.trim();
      if (foundedYear.trim()) params.foundedYear = foundedYear.trim();
      if (founder.trim()) params.founder = founder.trim();
      if (country.trim()) params.country = country.trim();
      if (website.trim()) params.website = website.trim();
      if (coverImageUrl) params.coverImage = coverImageUrl;

      await brandService.submitBrand(params);
      setSubmitResult("success");
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : undefined;
      setSubmitResult("error");
      setErrorMessage(msg || t("submitBrand.submitFailed"));
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const renderSuccessView = () => (
    <View style={styles.resultContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={56} color={theme.colors.black} />
      </View>
      <Text style={styles.resultTitle}>{t("submitBrand.submitSuccess")}</Text>
      <Text style={styles.resultText}>
        {t("submitBrand.submitSuccessMessage")}
      </Text>
      <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
        <Text style={styles.doneButtonText}>{t("common.done")}</Text>
      </TouchableOpacity>
    </View>
  );

  const formScroll = (
    <ScrollView
      style={[
        styles.form,
        variant === "screen" && styles.formScreen,
      ]}
      contentContainerStyle={
        variant === "screen" ? styles.formScreenContent : undefined
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          {t("submitBrand.brandName")}{" "}
          <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder={t("submitBrand.brandName")}
          placeholderTextColor={theme.colors.gray300}
          value={name}
          onChangeText={setName}
          autoFocus={variant === "modal"}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          {t("submitBrand.brandImage")} <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.imagePickerButton}
          onPress={handlePickImage}
          activeOpacity={0.7}
        >
          {coverImageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <OptimizedImage
                uri={coverImageUri}
                size={ImageSize.MEDIUM}
                style={styles.imagePreview}
                contentFit="cover"
                lazy={true}
              />
              <TouchableOpacity
                style={styles.imageRemoveButton}
                onPress={() => setCoverImageUri(null)}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={theme.colors.black}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={28}
                color={theme.colors.gray300}
              />
              <Text style={styles.imagePlaceholderText}>
                {t("submitBrand.addBrandImage")}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t("submitBrand.category")}</Text>
        <TextInput
          style={styles.input}
          placeholder=""
          placeholderTextColor={theme.colors.gray300}
          value={category}
          onChangeText={setCategory}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t("submitBrand.founder")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("submitBrand.founder")}
          placeholderTextColor={theme.colors.gray300}
          value={founder}
          onChangeText={setFounder}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.halfField]}>
          <Text style={styles.label}>{t("submitBrand.foundedYear")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("submitBrand.foundedYear")}
            placeholderTextColor={theme.colors.gray300}
            value={foundedYear}
            onChangeText={setFoundedYear}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={[styles.fieldGroup, styles.halfField]}>
          <Text style={styles.label}>{t("submitBrand.country")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("submitBrand.country")}
            placeholderTextColor={theme.colors.gray300}
            value={country}
            onChangeText={setCountry}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t("submitBrand.officialWebsite")}</Text>
        <TextInput
          style={styles.input}
          placeholder="https://"
          placeholderTextColor={theme.colors.gray300}
          value={website}
          onChangeText={setWebsite}
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {submitResult === "error" && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#D32F2F" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <View style={styles.submitLoadingRow}>
            <ActivityIndicator size="small" color={theme.colors.white} />
            <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
              {isUploading
                ? t("submitBrand.uploadingImage")
                : t("submitBrand.submitting")}
            </Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>{t("submitBrand.submitBrand")}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const body =
    submitResult === "success" ? renderSuccessView() : formScroll;

  if (variant === "screen") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.screenKeyboard}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }

  return body;
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screenKeyboard: {
      flex: 1,
    },
    form: {
      paddingHorizontal: t.spacing.lg,
    },
    formScreen: {
      flex: 1,
    },
    formScreenContent: {
      paddingBottom: t.spacing.xxl,
    },
    fieldGroup: {
      marginBottom: t.spacing.lg,
    },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: t.colors.gray500,
      marginBottom: 8,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
    },
    required: {
      color: "#D32F2F",
    },
    input: {
      fontSize: 15,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: t.borderRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: t.colors.inputBackground,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    },
    imagePickerButton: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.inputBackground,
      overflow: "hidden",
    },
    imagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
      gap: 8,
    },
    imagePlaceholderText: {
      fontSize: 13,
      color: t.colors.gray300,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    },
    imagePreviewWrapper: {
      position: "relative",
    },
    imagePreview: {
      width: "100%",
      height: 180,
      borderRadius: t.borderRadius.md,
    },
    imageRemoveButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: 12,
    },
    submitLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    halfField: {
      flex: 1,
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFF3F3",
      borderRadius: t.borderRadius.md,
      padding: 12,
      marginBottom: t.spacing.lg,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: "#D32F2F",
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    },
    submitButton: {
      backgroundColor: t.colors.text,
      borderRadius: t.borderRadius.lg,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: t.spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.textInverted,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
    },
    resultContainer: {
      alignItems: "center",
      paddingVertical: t.spacing.xxl,
      paddingHorizontal: t.spacing.xl,
    },
    successIcon: {
      marginBottom: t.spacing.lg,
    },
    resultTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: t.spacing.sm,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
    },
    resultText: {
      fontSize: 14,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: t.spacing.xl,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
    },
    doneButton: {
      backgroundColor: t.colors.text,
      borderRadius: t.borderRadius.lg,
      paddingHorizontal: 48,
      paddingVertical: 14,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.textInverted,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
    },
  });

export default SubmitBrandForm;
