import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { showService, CreateShowParams } from "../services/showService";
import { sharedStyles } from "../screens/admin/adminStyles";
import { pickAndUploadImage } from "../screens/admin/adminUtils";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

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
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, styles.modalSize]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={sharedStyles.modalTitle}>{t("brand.uploadShow")}</Text>
            <Text style={styles.brandLabel}>{brandName}</Text>

            {/* Cover Image */}
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
                <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
              </View>
            )}
            <TouchableOpacity style={sharedStyles.uploadImageButton} onPress={handleUploadCover} disabled={imageUploading}>
              {imageUploading ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
                  <Text style={sharedStyles.uploadImageButtonText}>
                    {coverImage ? t("admin.changeCover") : t("admin.uploadCover")}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Text style={sharedStyles.formLabel}>{t("admin.showTitleRequired")}</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder="例如: Spring 2025 Ready-to-Wear"
              placeholderTextColor={theme.colors.gray300}
              value={title}
              onChangeText={setTitle}
            />

            {/* Year */}
            <Text style={sharedStyles.formLabel}>{t("admin.yearRequired")}</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder="例如: 2025"
              placeholderTextColor={theme.colors.gray300}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />

            {/* Season */}
            <Text style={sharedStyles.formLabel}>{t("admin.seasonRequired")}</Text>
            <View style={sharedStyles.linkTypeContainer}>
              {SEASONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[sharedStyles.linkTypeButton, season === s && sharedStyles.linkTypeButtonActive]}
                  onPress={() => setSeason(s)}
                >
                  <Text style={[sharedStyles.linkTypeButtonText, season === s && sharedStyles.linkTypeButtonTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category */}
            <Text style={sharedStyles.formLabel}>{t("admin.category")}</Text>
            <View style={sharedStyles.linkTypeContainer}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[sharedStyles.linkTypeButton, category === c && sharedStyles.linkTypeButtonActive]}
                  onPress={() => setCategory(category === c ? "" : c)}
                >
                  <Text style={[sharedStyles.linkTypeButtonText, category === c && sharedStyles.linkTypeButtonTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Designer */}
            <Text style={sharedStyles.formLabel}>{t("admin.chiefDesigner")}</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder={t("common.optional")}
              placeholderTextColor={theme.colors.gray300}
              value={designer}
              onChangeText={setDesigner}
            />

            {/* Description */}
            <Text style={sharedStyles.formLabel}>{t("admin.showDescription")}</Text>
            <TextInput
              style={[sharedStyles.modalInput, { minHeight: 80 }]}
              placeholder={t("createShow.descriptionPlaceholder")}
              placeholderTextColor={theme.colors.gray300}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Buttons */}
            <View style={sharedStyles.modalButtons}>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={handleClose}>
                <Text style={sharedStyles.modalCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sharedStyles.modalButton, sharedStyles.modalConfirmButton, { backgroundColor: theme.colors.black }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={sharedStyles.modalConfirmText}>{t("storeSubmit.submit")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSize: {
    height: "85%",
    width: "92%",
    padding: theme.spacing.lg,
  },
  brandLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginBottom: theme.spacing.sm,
    marginTop: -theme.spacing.sm,
  },
  coverPreview: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    marginBottom: theme.spacing.sm,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CreateShowModal;
