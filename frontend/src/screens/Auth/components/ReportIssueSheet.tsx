import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Alert } from "../../../utils/Alert";
import {
  authReportService,
  AuthIssueType,
  AuthContactType,
} from "../../../services/authReportService";
import { LoginMethod } from "../types";

interface ReportIssueSheetProps {
  visible: boolean;
  onClose: () => void;
  loginMethod: LoginMethod;
  defaultContact?: string;
}

interface IssueOption {
  value: AuthIssueType;
  label: string;
}

const ISSUE_OPTION_KEYS: { value: AuthIssueType; labelKey: string }[] = [
  { value: "OTP_NOT_RECEIVED", labelKey: "auth.issueOtpNotReceived" },
  { value: "REGISTER_FAILED", labelKey: "auth.issueRegisterFailed" },
  { value: "LOGIN_FAILED", labelKey: "auth.issueLoginFailed" },
  { value: "OTHER", labelKey: "auth.issueOther" },
];

const MAX_DESCRIPTION = 500;

const validateEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validatePhoneLoose = (value: string) =>
  /^[+\d][\d\s\-]{5,19}$/.test(value.trim());

export const ReportIssueSheet: React.FC<ReportIssueSheetProps> = ({
  visible,
  onClose,
  loginMethod,
  defaultContact,
}) => {
  const { t } = useTranslation();
  const [issueType, setIssueType] = useState<AuthIssueType>("OTP_NOT_RECEIVED");
  const [contactValue, setContactValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const contactType: AuthContactType = useMemo(
    () => (loginMethod === "email" ? "EMAIL" : "PHONE"),
    [loginMethod]
  );

  useEffect(() => {
    if (visible) {
      setContactValue(defaultContact?.trim() || "");
      setDescription("");
      setIssueType("OTP_NOT_RECEIVED");
    }
  }, [visible, defaultContact]);

  const handleSubmit = async () => {
    const trimmedContact = contactValue.trim();
    if (!trimmedContact) {
      Alert.show(
        contactType === "EMAIL"
          ? t('auth.fillEmail')
          : t('auth.fillPhone')
      );
      return;
    }
    if (contactType === "EMAIL" && !validateEmail(trimmedContact)) {
      Alert.show(t('auth.invalidEmail'));
      return;
    }
    if (contactType === "PHONE" && !validatePhoneLoose(trimmedContact)) {
      Alert.show(t('auth.invalidPhone'));
      return;
    }

    setSubmitting(true);
    try {
      await authReportService.reportAuthIssue({
        issueType,
        contactType,
        contactValue: trimmedContact,
        description,
      });
      Alert.show(t('auth.feedbackSuccess'), "", 1500);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('auth.feedbackFailed');
      Alert.show(t('auth.feedbackFailedMsg', { message }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={submitting ? undefined : onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrapper}
        >
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.reportTitle')}</Text>
              <TouchableOpacity
                onPress={onClose}
                disabled={submitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.hint}>
                {t('auth.reportIssueHint')}
              </Text>

              <Text style={styles.sectionLabel}>{t('auth.issueType')}</Text>
              <View style={styles.optionGroup}>
                {ISSUE_OPTION_KEYS.map((option) => {
                  const active = option.value === issueType;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                      onPress={() => setIssueType(option.value)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          active && styles.optionChipTextActive,
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>
                {contactType === "EMAIL" ? t('auth.contactEmail') : t('auth.contactPhone')}
              </Text>
              <TextInput
                style={styles.input}
                value={contactValue}
                onChangeText={setContactValue}
                placeholder={
                  contactType === "EMAIL"
                    ? t('auth.contactEmailPlaceholder')
                    : t('auth.contactPhonePlaceholder')
                }
                placeholderTextColor={theme.colors.gray200}
                keyboardType={
                  contactType === "EMAIL" ? "email-address" : "phone-pad"
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />

              <Text style={styles.sectionLabel}>
                {t('auth.issueDescription')}<Text style={styles.sectionLabelOptional}>{t('auth.issueDescriptionOptional')}</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={(v) =>
                  setDescription(v.slice(0, MAX_DESCRIPTION))
                }
                placeholder={t('auth.issueDescriptionPlaceholder')}
                placeholderTextColor={theme.colors.gray200}
                multiline
                editable={!submitting}
              />
              <Text style={styles.charCount}>
                {description.length}/{MAX_DESCRIPTION}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{t('auth.submitFeedback')}</Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    width: "100%",
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
  },
  body: {
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray400,
    backgroundColor: "#F7F7F7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.black,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  sectionLabelOptional: {
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  optionChipText: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.gray300,
  },
  optionChipTextActive: {
    color: theme.colors.white,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.black,
    marginBottom: 20,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingTop: 12,
    marginBottom: 4,
  },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
});

export default ReportIssueSheet;
