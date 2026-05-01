import React from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../../theme";
import { ProfileForm } from "./ProfileForm";
import { FormData, BrandOption } from "../types";

interface ProfileModalProps {
  visible: boolean;
  loading: boolean;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  showLocationPicker: boolean;
  setShowLocationPicker: (show: boolean) => void;
  showAgePicker: boolean;
  setShowAgePicker: (show: boolean) => void;
  showBrandPicker: boolean;
  setShowBrandPicker: (show: boolean) => void;
  brandOptions: BrandOption[];
  loadingBrands: boolean;
  loadingMoreBrands: boolean;
  hasMoreBrands: boolean;
  brandSearchKeyword: string;
  onBrandSearch: (keyword: string) => void;
  onBrandSearchSubmit: () => void;
  onLoadMoreBrands: () => void;
  onComplete: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  loading,
  formData,
  setFormData,
  showLocationPicker,
  setShowLocationPicker,
  showAgePicker,
  setShowAgePicker,
  showBrandPicker,
  setShowBrandPicker,
  brandOptions,
  loadingBrands,
  loadingMoreBrands,
  hasMoreBrands,
  brandSearchKeyword,
  onBrandSearch,
  onBrandSearchSubmit,
  onLoadMoreBrands,
  onComplete,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Modal 标题 */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.completeProfile')}</Text>
              <Text style={styles.subtitle}>{t('auth.completeProfileSubtitle')}</Text>
            </View>

            <ProfileForm
              formData={formData}
              setFormData={setFormData}
              showLocationPicker={showLocationPicker}
              setShowLocationPicker={setShowLocationPicker}
              showAgePicker={showAgePicker}
              setShowAgePicker={setShowAgePicker}
              showBrandPicker={showBrandPicker}
              setShowBrandPicker={setShowBrandPicker}
              brandOptions={brandOptions}
              loadingBrands={loadingBrands}
              loadingMoreBrands={loadingMoreBrands}
              hasMoreBrands={hasMoreBrands}
              brandSearchKeyword={brandSearchKeyword}
              onBrandSearch={onBrandSearch}
              onBrandSearchSubmit={onBrandSearchSubmit}
              onLoadMoreBrands={onLoadMoreBrands}
            />

            {/* 完成按钮 */}
            <TouchableOpacity
              style={[styles.completeButton, loading && styles.completeButtonDisabled]}
              onPress={onComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.completeButtonText}>{t('auth.completeAndEnter')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray400,
    letterSpacing: 0.5,
  },
  completeButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 20,
  },
  completeButtonDisabled: {
    backgroundColor: "#E8E8E8",
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
});
