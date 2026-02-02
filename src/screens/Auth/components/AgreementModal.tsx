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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
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
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>用户协议与隐私政策</Text>
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
              用户协议
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
              隐私政策
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
            点击下方按钮即表示您已阅读并同意上述协议
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
                我已阅读并同意，继续注册
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter-Bold",
    color: theme.colors.black,
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
    backgroundColor: "#F5F5F5",
  },
  tabActive: {
    backgroundColor: theme.colors.black,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray500,
  },
  tabTextActive: {
    color: theme.colors.white,
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
    borderTopColor: "#E8E8E8",
    backgroundColor: theme.colors.white,
  },
  agreementHint: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    marginBottom: 12,
  },
  confirmButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "#E8E8E8",
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: theme.colors.white,
  },
});
