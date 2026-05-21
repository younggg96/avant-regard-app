import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  theme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { TermsContent } from "./TermsContent";
import { PrivacyContent } from "./PrivacyContent";

interface AgreementModalProps {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({
  visible,
  loading,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("auth.agreementTitle")}</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "terms" && styles.tabActive]}
            onPress={() => setActiveTab("terms")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "terms" && styles.tabTextActive,
              ]}
            >
              {t("auth.termsOfService")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "privacy" && styles.tabActive]}
            onPress={() => setActiveTab("privacy")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "privacy" && styles.tabTextActive,
              ]}
            >
              {t("auth.privacyPolicy")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 协议内容 */}
        <ScrollView
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "terms" ? <TermsContent /> : <PrivacyContent />}
        </ScrollView>

        {/* 确认按钮 */}
        <View style={styles.bottomContainer}>
          <Text style={styles.agreementHint}>
            {t("auth.agreementHint")}
          </Text>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              loading && styles.confirmButtonDisabled,
            ]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>
                {t("auth.agreeAndContinue")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
    },
    tabActive: {
      backgroundColor: t.colors.text,
    },
    tabText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray500,
    },
    tabTextActive: {
      color: t.colors.textInverted,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
    },
    bottomContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    agreementHint: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      textAlign: "center",
      marginBottom: 12,
    },
    confirmButton: {
      backgroundColor: t.colors.text,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    confirmButtonDisabled: {
      backgroundColor: t.colors.gray100,
    },
    confirmButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
    },
  });
