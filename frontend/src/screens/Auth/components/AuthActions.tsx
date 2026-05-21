import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthMode, LoginMethod } from "../types";
import { useAuthStyles } from "../styles";
import {
  theme,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { TermsContent } from "./TermsContent";
import { PrivacyContent } from "./PrivacyContent";
import { CommunityGuidelinesContent } from "./CommunityGuidelinesContent";
import { MinorProtectionContent } from "./MinorProtectionContent";
import { ReportIssueSheet } from "./ReportIssueSheet";

type DocumentType = "terms" | "privacy" | "guidelines" | "minor";

const DOCUMENT_TITLE_KEYS: Record<DocumentType, string> = {
  terms: "settings.termsOfService",
  privacy: "settings.privacyPolicy",
  guidelines: "settings.communityGuidelines",
  minor: "settings.minorProtection",
};

interface AuthActionsProps {
  mode: AuthMode;
  loginMethod: LoginMethod;
  loading: boolean;
  setMode: (mode: AuthMode) => void;
  handleMainAction: () => void;
  isAppleLoginAvailable?: boolean;
  onAppleLogin?: () => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (agreed: boolean) => void;
  reportDefaultContact?: string;
}

const BUTTON_TEXT_KEYS: Record<string, string> = {
  login: "auth.login",
  register: "auth.register",
  forgotPassword: "auth.resetPassword",
  verification: "auth.verifyAndLogin",
};

const DocumentContent: React.FC<{ type: DocumentType }> = ({ type }) => {
  switch (type) {
    case "terms":
      return <TermsContent />;
    case "privacy":
      return <PrivacyContent />;
    case "guidelines":
      return <CommunityGuidelinesContent />;
    case "minor":
      return <MinorProtectionContent />;
  }
};

export const AuthActions: React.FC<AuthActionsProps> = ({
  mode,
  loginMethod,
  loading,
  setMode,
  handleMainAction,
  isAppleLoginAvailable,
  onAppleLogin,
  agreedToTerms,
  setAgreedToTerms,
  reportDefaultContact,
}) => {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const reportStyles = useThemedStyles(makeReportStyles);
  const checkboxStyles = useThemedStyles(makeCheckboxStyles);
  const t_ = useAppTheme();
  const showAppleLogin = false;
  const [viewingDocument, setViewingDocument] = useState<DocumentType | null>(
    null
  );
  const [showReportSheet, setShowReportSheet] = useState(false);

  const showCheckbox =
    mode === "login" || mode === "register" || mode === "verification";
  const needsAgreement = showCheckbox && !agreedToTerms;

  return (
    <View style={styles.actionsContainer}>
      {showCheckbox && (
        <View style={checkboxStyles.container}>
          <TouchableOpacity
            style={checkboxStyles.checkbox}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={agreedToTerms ? "checkbox" : "square-outline"}
              size={20}
              color={agreedToTerms ? theme.colors.black : theme.colors.gray300}
            />
          </TouchableOpacity>
          <Text style={checkboxStyles.text}>
            {t('auth.agreeTerms')}
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("terms")}
            >
              {t('auth.termsLink')}
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("privacy")}
            >
              {t('auth.privacyLink')}
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("minor")}
            >
              {t('auth.minorLink')}
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("guidelines")}
            >
              {t('auth.guidelinesLink')}
            </Text>
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.mainButton,
          (loading || needsAgreement) && styles.mainButtonDisabled,
        ]}
        onPress={handleMainAction}
        disabled={loading || needsAgreement}
      >
        <Text
          style={[
            styles.mainButtonText,
            (loading || needsAgreement) && styles.mainButtonTextDisabled,
          ]}
        >
          {loading ? t('auth.processing') : t(BUTTON_TEXT_KEYS[mode] || 'common.confirm')}
        </Text>
      </TouchableOpacity>

      {showAppleLogin && (
        <>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            style={[styles.appleButton, loading && styles.appleButtonDisabled]}
            onPress={onAppleLogin}
            disabled={loading}
          >
            <Ionicons
              name="logo-apple"
              size={20}
              color={t_.mode === "dark" ? "#000000" : "#FFFFFF"}
            />
            <Text style={styles.appleButtonText}>{t('auth.loginByApple')}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.linksContainer}>
        {mode === "login" && (
          <>
            {loginMethod === "phone" && (
              <TouchableOpacity onPress={() => setMode("verification")}>
                <Text style={styles.linkText}>{t('auth.verificationLogin')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMode("forgotPassword")}>
              <Text style={styles.linkText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          </>
        )}

        {mode !== "login" && (
          <TouchableOpacity onPress={() => setMode("login")}>
            <Text style={styles.linkText}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.switchContainer}>
        {mode === "login" ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth.noAccount')}</Text>
            <TouchableOpacity onPress={() => setMode("register")}>
              <Text style={styles.switchLink}>{t('auth.goRegister')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth.hasAccount')}</Text>
            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.switchLink}>{t('auth.goLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 问题反馈入口 (提示文字已并入弹窗内部) */}
      <View style={reportStyles.container}>
        <TouchableOpacity
          style={reportStyles.button}
          onPress={() => setShowReportSheet(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="megaphone-outline"
            size={16}
            color={theme.colors.black}
          />
          <Text style={reportStyles.buttonText}>{t('auth.reportButton')}</Text>
        </TouchableOpacity>
      </View>

      <ReportIssueSheet
        visible={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        loginMethod={loginMethod}
        defaultContact={reportDefaultContact}
      />

      {/* 协议内容查看 Modal */}
      <Modal
        visible={viewingDocument !== null}
        animationType="fade"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewingDocument(null)}
      >
        <SafeAreaView style={checkboxStyles.modalContainer}>
          <View style={checkboxStyles.modalHeader}>
            <TouchableOpacity
              style={checkboxStyles.modalCloseButton}
              onPress={() => setViewingDocument(null)}
            >
              <Ionicons name="close" size={24} color={theme.colors.black} />
            </TouchableOpacity>
            <Text style={checkboxStyles.modalTitle}>
              {viewingDocument ? t(DOCUMENT_TITLE_KEYS[viewingDocument]) : ""}
            </Text>
            <View style={checkboxStyles.modalCloseButton} />
          </View>
          <ScrollView
            style={checkboxStyles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {viewingDocument && <DocumentContent type={viewingDocument} />}
          </ScrollView>
          <View style={checkboxStyles.modalBottom}>
            <TouchableOpacity
              style={checkboxStyles.modalConfirmButton}
              onPress={() => setViewingDocument(null)}
            >
              <Text style={checkboxStyles.modalConfirmText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const makeReportStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      marginTop: 16,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 6,
    },
    buttonText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      letterSpacing: 0.3,
    },
  });

const makeCheckboxStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 20,
      paddingHorizontal: 4,
    },
    checkbox: {
      marginRight: 8,
      marginTop: 1,
    },
    text: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      flex: 1,
      lineHeight: 20,
    },
    link: {
      color: t.colors.text,
      fontFamily: "PlayfairDisplay-Medium",
    },
    modalContainer: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    modalCloseButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      flex: 1,
      textAlign: "center",
    },
    modalContent: {
      flex: 1,
      paddingHorizontal: 16,
    },
    modalBottom: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    modalConfirmButton: {
      backgroundColor: t.colors.text,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    modalConfirmText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
    },
  });
