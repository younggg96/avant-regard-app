import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthMode, LoginMethod } from "../types";
import { styles } from "../styles";
import { theme } from "../../../theme";
import { TermsContent } from "./TermsContent";
import { PrivacyContent } from "./PrivacyContent";
import { CommunityGuidelinesContent } from "./CommunityGuidelinesContent";
import { MinorProtectionContent } from "./MinorProtectionContent";
import { ReportIssueSheet } from "./ReportIssueSheet";

type DocumentType = "terms" | "privacy" | "guidelines" | "minor";

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  terms: "软件许可服务协议",
  privacy: "隐私政策",
  guidelines: "平台自律公约",
  minor: "未成年人个人信息保护规则",
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

const getButtonText = (mode: AuthMode, loading: boolean): string => {
  if (loading) return "处理中...";

  switch (mode) {
    case "login":
      return "登录";
    case "register":
      return "注册";
    case "forgotPassword":
      return "重置密码";
    case "verification":
      return "验证并登录";
    default:
      return "确定";
  }
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
            我已阅读并同意
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("terms")}
            >
              《软件许可服务协议》
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("privacy")}
            >
              《隐私政策》
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("minor")}
            >
              《未成年人个人信息保护规则》
            </Text>
            <Text
              style={checkboxStyles.link}
              onPress={() => setViewingDocument("guidelines")}
            >
              《平台自律公约》
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
        <Text style={styles.mainButtonText}>
          {getButtonText(mode, loading)}
        </Text>
      </TouchableOpacity>

      {showAppleLogin && (
        <>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            style={[styles.appleButton, loading && styles.appleButtonDisabled]}
            onPress={onAppleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={styles.appleButtonText}>通过 Apple 登录</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.linksContainer}>
        {mode === "login" && (
          <>
            {loginMethod === "phone" && (
              <TouchableOpacity onPress={() => setMode("verification")}>
                <Text style={styles.linkText}>验证码登录</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMode("forgotPassword")}>
              <Text style={styles.linkText}>忘记密码？</Text>
            </TouchableOpacity>
          </>
        )}

        {mode !== "login" && (
          <TouchableOpacity onPress={() => setMode("login")}>
            <Text style={styles.linkText}>返回登录</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.switchContainer}>
        {mode === "login" ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>还没有账户？</Text>
            <TouchableOpacity onPress={() => setMode("register")}>
              <Text style={styles.switchLink}>立即注册</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>已有账户？</Text>
            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.switchLink}>立即登录</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 问题反馈入口 */}
      <View style={reportStyles.container}>
        <Text style={reportStyles.hint}>
          若您收不到验证码，或注册/登录出现问题，请点击下方按钮提交反馈，
          工作人员会尽快与您联系。
        </Text>
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
          <Text style={reportStyles.buttonText}>问题反馈 / Report</Text>
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
        animationType="slide"
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
              {viewingDocument ? DOCUMENT_TITLES[viewingDocument] : ""}
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
              <Text style={checkboxStyles.modalConfirmText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const reportStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
    textAlign: "center",
    marginBottom: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 6,
  },
  buttonText: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.black,
    letterSpacing: 0.3,
  },
});

const checkboxStyles = StyleSheet.create({
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
    color: theme.colors.gray400,
    flex: 1,
    lineHeight: 20,
  },
  link: {
    color: theme.colors.black,
    fontFamily: "PlayfairDisplay-Medium",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
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
    color: theme.colors.black,
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
    borderTopColor: "#E8E8E8",
  },
  modalConfirmButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.white,
  },
});
