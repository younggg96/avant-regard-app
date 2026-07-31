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
  Alert as RNAlert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  theme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { Alert } from "../../../utils/Alert";
import {
  authReportService,
  AuthIssueType,
  AuthContactType,
} from "../../../services/authReportService";
import { clearLocalCacheKeepingPreferences } from "../../../utils/cacheUtils";
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
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // home indicator 安全区只补到刚够避开手势条, 不再额外加 margin,
  // 避免底部出现一块大空白.
  const safePaddingBottom = Math.max(insets.bottom, 12);
  const [issueType, setIssueType] = useState<AuthIssueType>("OTP_NOT_RECEIVED");
  const [contactValue, setContactValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

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

  const performClearCache = async () => {
    setClearingCache(true);
    try {
      const { removedKeys, imageCacheCleared } =
        await clearLocalCacheKeepingPreferences();
      Alert.show(
        imageCacheCleared
          ? t("auth.clearCacheSuccess", { count: removedKeys })
          : t("auth.clearCacheSuccessPartial", { count: removedKeys }),
        "",
        1500,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      Alert.show(t("auth.clearCacheFailed", { message }));
    } finally {
      setClearingCache(false);
    }
  };

  const handleClearCache = () => {
    if (clearingCache || submitting) return;
    RNAlert.alert(
      t("auth.clearCacheConfirmTitle"),
      t("auth.clearCacheConfirmMessage"),
      [
        { text: t("auth.clearCacheCancel"), style: "cancel" },
        {
          text: t("auth.clearCacheConfirm"),
          style: "destructive",
          onPress: performClearCache,
        },
      ],
      { cancelable: true },
    );
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
          <View style={[styles.sheet, { paddingBottom: safePaddingBottom }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.reportTitle')}</Text>
              <TouchableOpacity
                onPress={onClose}
                disabled={submitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={theme.colors.gray400}
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
              disabled={submitting || clearingCache}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{t('auth.submitFeedback')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.toolsDivider} />

            <View style={styles.toolsBlock}>
              <Text style={styles.toolsHelp}>{t("auth.clearCacheHelp")}</Text>
              <TouchableOpacity
                style={[
                  styles.clearCacheButton,
                  (submitting || clearingCache) && styles.clearCacheButtonDisabled,
                ]}
                onPress={handleClearCache}
                disabled={submitting || clearingCache}
                activeOpacity={0.7}
              >
                {clearingCache ? (
                  <ActivityIndicator size="small" color={theme.colors.gray400} />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.gray400}
                  />
                )}
                <Text style={styles.clearCacheText}>
                  {t("auth.clearCacheLabel")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: t.colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetWrapper: {
      width: "100%",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
      maxHeight: "90%",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: -4 },
      shadowRadius: 12,
      elevation: 12,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.colors.divider,
      marginTop: 6,
      marginBottom: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    title: {
      fontSize: 22,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      letterSpacing: 0.2,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.gray100,
    },
    body: {
      marginBottom: 8,
    },
    hint: {
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      backgroundColor: t.colors.gray100,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      marginBottom: 22,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray300,
      marginBottom: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    sectionLabelOptional: {
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray200,
      textTransform: "none",
      letterSpacing: 0,
    },
    optionGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 22,
    },
    optionChip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.colors.divider,
    },
    optionChipActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    optionChipText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
    },
    optionChipTextActive: {
      color: t.colors.textInverted,
    },
    input: {
      backgroundColor: t.colors.gray100,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
      marginBottom: 22,
    },
    textarea: {
      minHeight: 104,
      textAlignVertical: "top",
      paddingTop: 12,
      marginBottom: 4,
    },
    charCount: {
      alignSelf: "flex-end",
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray200,
      marginBottom: 18,
    },
    submitButton: {
      backgroundColor: t.colors.text,
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 4,
      marginBottom: 0,
    },
    submitButtonDisabled: {
      backgroundColor: t.colors.gray100,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
      letterSpacing: 0.5,
    },
    toolsDivider: {
      height: 1,
      backgroundColor: t.colors.divider,
      marginTop: 14,
      marginBottom: 10,
    },
    toolsBlock: {
      alignItems: "center",
      marginBottom: 0,
    },
    toolsHelp: {
      fontSize: 11,
      lineHeight: 16,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray200,
      textAlign: "center",
      marginBottom: 8,
      paddingHorizontal: 6,
    },
    clearCacheButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 6,
    },
    clearCacheButtonDisabled: {
      opacity: 0.5,
    },
    clearCacheText: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
      letterSpacing: 0.3,
    },
  });

export default ReportIssueSheet;
