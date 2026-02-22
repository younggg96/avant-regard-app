import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  GestureResponderEvent,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../theme";
import { brandService, SubmitBrandParams } from "../services/brandService";
import { uploadImage } from "../services/postService";

interface SubmitBrandModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SubmitBrandModal: React.FC<SubmitBrandModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
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
      setErrorMessage("需要相册访问权限才能选择图片");
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
          setErrorMessage("图片上传失败，请重试");
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
    } catch (err: any) {
      setSubmitResult("error");
      setErrorMessage(err?.message || "提交失败，请稍后重试");
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
      <Text style={styles.resultTitle}>提交成功</Text>
      <Text style={styles.resultText}>
        品牌已提交，将在管理员审核通过后添加到列表中
      </Text>
      <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
        <Text style={styles.doneButtonText}>完成</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
      transparent={true}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e: GestureResponderEvent) => e.stopPropagation()}
          >
            <View style={styles.handleBar} />
            {/* <SafeAreaView style={styles.container} edges={["bottom"]}> */}
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>提交新品牌</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.gray600}
                />
              </TouchableOpacity>
            </View>

            {submitResult === "success" ? (
              renderSuccessView()
            ) : (
              <ScrollView
                style={styles.form}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Brand Name (required) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    品牌名称 <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="品牌名称"
                    placeholderTextColor={theme.colors.gray300}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                </View>

                  {/* Cover Image */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      品牌图片 <Text style={styles.required}>*</Text>
                    </Text>
                  <TouchableOpacity
                    style={styles.imagePickerButton}
                    onPress={handlePickImage}
                    activeOpacity={0.7}
                  >
                    {coverImageUri ? (
                      <View style={styles.imagePreviewWrapper}>
                        <Image
                          source={{ uri: coverImageUri }}
                          style={styles.imagePreview}
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
                          点击添加品牌图片
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>分类</Text>
                  <TextInput
                    style={styles.input}
                    placeholder=""
                    placeholderTextColor={theme.colors.gray300}
                    value={category}
                    onChangeText={setCategory}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>创始人</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="创始人"
                    placeholderTextColor={theme.colors.gray300}
                    value={founder}
                    onChangeText={setFounder}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.fieldGroup, styles.halfField]}>
                    <Text style={styles.label}>创立年份</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="创立年份"
                      placeholderTextColor={theme.colors.gray300}
                      value={foundedYear}
                      onChangeText={setFoundedYear}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <View style={[styles.fieldGroup, styles.halfField]}>
                    <Text style={styles.label}>国家</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="国家"
                      placeholderTextColor={theme.colors.gray300}
                      value={country}
                      onChangeText={setCountry}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>官方网站</Text>
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
                    <Ionicons
                      name="alert-circle"
                      size={16}
                      color="#D32F2F"
                    />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    !canSubmit && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <View style={styles.submitLoadingRow}>
                      <ActivityIndicator size="small" color={theme.colors.white} />
                      <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                        {isUploading ? "上传图片中..." : "提交中..."}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>提交品牌</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            )}
            {/* </SafeAreaView> */}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray300,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  container: {
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    // paddingVertical: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  closeButton: {
    padding: 4,
  },
  form: {
    paddingHorizontal: theme.spacing.lg,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray500,
    marginBottom: 8,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  required: {
    color: "#D32F2F",
  },
  input: {
    fontSize: 15,
    color: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.gray50,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray50,
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
    color: theme.colors.gray300,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  imagePreviewWrapper: {
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: theme.borderRadius.md,
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
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: theme.spacing.lg,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#D32F2F",
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  submitButton: {
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.white,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  hint: {
    fontSize: 12,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  resultContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
  },
  successIcon: {
    marginBottom: theme.spacing.lg,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  resultText: {
    fontSize: 14,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  doneButton: {
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.white,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
});

export default SubmitBrandModal;
