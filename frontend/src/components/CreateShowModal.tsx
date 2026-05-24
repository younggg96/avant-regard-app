import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { showService, CreateShowParams } from "../services/showService";
import { useSharedStyles } from "../screens/admin/adminStyles";
import { pickAndUploadImage } from "../screens/admin/adminUtils";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { AnimatedChip, chipRowStyle, Input } from "./ui";

const SEASONS = [
  "Spring/Summer", "Fall/Winter", "Autumn/Winter",
  "Resort", "Pre-Fall",
  "Printemps/Été", "Automne/Hiver",
  "Primavera/Estate", "Autunno/Inverno",
];
const CATEGORIES = [
  "Ready-to-Wear", "Couture", "Menswear", "Womenswear",
  "Co-Ed", "Accessories", "Beauty", "Bridal", "Kids Wear",
];

interface Props {
  visible: boolean;
  brandName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateShowModal = ({ visible, brandName, onClose, onSuccess }: Props) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const sharedStyles = useSharedStyles();
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [designer, setDesigner] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setYear(new Date().getFullYear().toString());
    setSeason("");
    setCategory("");
    setDesigner("");
    setDescription("");
    setCoverImage("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleUploadCover = async () => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([16, 9]);
      if (url) {
        setCoverImage(url);
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.imageUploadFailed"));
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t("common.hint"), t("createShow.titleRequired"));
      return;
    }
    const yearNum = parseInt(year, 10);
    if (!year || isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      Alert.alert(t("common.hint"), t("createShow.yearInvalid"));
      return;
    }
    if (!season) {
      Alert.alert(t("common.hint"), t("createShow.seasonRequired"));
      return;
    }

    try {
      setSubmitting(true);
      const params: CreateShowParams = {
        brand: brandName,
        title: title.trim(),
        year: yearNum,
        season,
        category: category || undefined,
        designer: designer.trim() || undefined,
        description: description.trim() || undefined,
        coverImage: coverImage || undefined,
      };
      await showService.createShow(params);
      Alert.alert(t("createShow.submitSuccess"), t("createShow.submitSuccessMsg"), [
        {
          text: t("common.confirm"),
          onPress: () => {
            resetForm();
            onClose();
            onSuccess();
          },
        },
      ]);
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("createShow.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={sharedStyles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[sharedStyles.modalContent, styles.modalSize]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={sharedStyles.modalTitle}>{t("brand.uploadShow")}</Text>
            <Text style={styles.brandLabel}>{brandName}</Text>

            <Text style={sharedStyles.formLabel}>{t("admin.coverImage")}</Text>
            {coverImage ? (
              <OptimizedImage
                uri={coverImage}
                size={ImageSize.MEDIUM}
                style={styles.coverPreview}
                contentFit="cover"
                lazy={true}
              />
            ) : (
              <View style={[styles.coverPreview, styles.coverPlaceholder]}>
                <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
              </View>
            )}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleUploadCover}
              disabled={imageUploading}
              activeOpacity={0.8}
            >
              {imageUploading ? (
                <ActivityIndicator color={theme.colors.textInverted} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.textInverted} />
                  <Text style={styles.uploadButtonText}>
                    {coverImage ? t("admin.changeCover") : t("admin.uploadCover")}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={sharedStyles.formLabel}>{t("admin.showTitleRequired")}</Text>
            <Input
              size="sm"
              placeholder={t("admin.showTitlePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={title}
              onChangeText={setTitle}
              sx={styles.input}
            />

            <Text style={sharedStyles.formLabel}>{t("admin.yearRequired")}</Text>
            <Input
              size="sm"
              placeholder={t("admin.yearPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
              sx={styles.input}
            />

            <Text style={sharedStyles.formLabel}>{t("admin.seasonRequired")}</Text>
            <View style={[chipRowStyle, styles.chipSection]}>
              {SEASONS.map((s) => (
                <AnimatedChip
                  key={s}
                  label={s}
                  isActive={season === s}
                  onPress={() => setSeason(s)}
                />
              ))}
            </View>

            <Text style={sharedStyles.formLabel}>{t("admin.category")}</Text>
            <View style={[chipRowStyle, styles.chipSection]}>
              {CATEGORIES.map((c) => (
                <AnimatedChip
                  key={c}
                  label={c}
                  isActive={category === c}
                  onPress={() => setCategory(category === c ? "" : c)}
                />
              ))}
            </View>

            <Text style={sharedStyles.formLabel}>{t("admin.chiefDesigner")}</Text>
            <Input
              size="sm"
              placeholder={t("common.optional")}
              placeholderTextColor={theme.colors.placeholder}
              value={designer}
              onChangeText={setDesigner}
              sx={styles.input}
            />

            <Text style={sharedStyles.formLabel}>{t("admin.showDescription")}</Text>
            <Input
              size="sm"
              placeholder={t("createShow.descriptionPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              sx={{ ...styles.input, ...styles.textArea }}
            />

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={[styles.footerButton, styles.cancelButton]}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.submitButton]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.textInverted} size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>{t("storeSubmit.submit")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    modalSize: {
      height: "85%",
      width: "92%",
      maxWidth: 420,
      padding: t.spacing.lg,
    },
    brandLabel: {
      ...t.typography.caption,
      color: t.colors.gray400,
      marginBottom: t.spacing.sm,
      marginTop: -t.spacing.sm,
    },
    coverPreview: {
      width: "100%",
      height: 140,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.gray100,
      marginBottom: t.spacing.sm,
    },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    uploadButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.text,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.borderRadius.sm,
      marginBottom: t.spacing.md,
      gap: t.spacing.xs,
    },
    uploadButtonText: {
      ...t.typography.bodySmall,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    input: {
      marginBottom: t.spacing.sm,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    chipSection: {
      marginBottom: t.spacing.sm,
    },
    footerButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: t.spacing.sm,
      marginTop: t.spacing.lg,
    },
    footerButton: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.sm,
      minWidth: 80,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: t.colors.gray100,
    },
    cancelButtonText: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    submitButton: {
      backgroundColor: t.colors.text,
    },
    submitButtonText: {
      ...t.typography.bodySmall,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
  });

export default CreateShowModal;
