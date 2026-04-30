import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import { Alert } from "../utils/Alert";
import {
  userInfoService,
  UserPrivacySettings,
} from "../services/userInfoService";
import {
  TermsContent,
  PrivacyContent,
  CommunityGuidelinesContent,
  MinorProtectionContent,
} from "./Auth/components";
import { setStoredLanguage, type SupportedLanguage } from "../i18n";

interface SettingItem {
  id: string;
  label: string;
  icon: string;
  onPress?: () => void;
  rightText?: string;
  rightColor?: string;
  toggle?: boolean;
  value?: boolean;
  onToggle?: (value: boolean) => void;
}

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();

  // Language modal
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const currentLang = (i18n.language?.startsWith("zh") ? "zh" : "en") as SupportedLanguage;

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await setStoredLanguage(lang);
    setShowLanguageModal(false);
  };

  // 隐私设置状态
  const [privacySettings, setPrivacySettings] =
    useState<UserPrivacySettings | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState<string | null>(null);

  // 协议 Modal 状态
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementType, setAgreementType] = useState<"terms" | "privacy" | "guidelines" | "minor">("terms");

  const showAgreement = (type: "terms" | "privacy" | "guidelines" | "minor") => {
    setAgreementType(type);
    setShowAgreementModal(true);
  };

  // 加载隐私设置
  const loadPrivacySettings = useCallback(async () => {
    if (!user?.userId) return;
    setPrivacyLoading(true);
    try {
      const settings = await userInfoService.getPrivacySettings(user.userId);
      setPrivacySettings(settings);
    } catch (error) {
      console.error("Error loading privacy settings:", error);
    } finally {
      setPrivacyLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadPrivacySettings();
  }, [loadPrivacySettings]);

  useFocusEffect(
    useCallback(() => {
      loadPrivacySettings();
    }, [loadPrivacySettings])
  );

  // 更新隐私设置
  const handlePrivacyToggle = async (
    key: "hideFollowing" | "hideFollowers" | "hideLikes" | "hideWishlist",
    value: boolean
  ) => {
    if (!user?.userId || updatingPrivacy) return;
    setUpdatingPrivacy(key);

    // 乐观更新
    setPrivacySettings((prev) =>
      prev ? { ...prev, [key]: value } : null
    );

    try {
      const updated = await userInfoService.updatePrivacySettings(user.userId, {
        [key]: value,
      });
      setPrivacySettings(updated);
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      // 回滚
      setPrivacySettings((prev) =>
        prev ? { ...prev, [key]: !value } : null
      );
      Alert.show(t("privacy.updateFailed"));
    } finally {
      setUpdatingPrivacy(null);
    }
  };

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    Alert.show(t("settings.loggingOut"));
    setTimeout(() => {
      logout();
    }, 500);
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (!user?.userId || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await userInfoService.deleteAccount(user.userId);
      setShowDeleteAccountModal(false);
      Alert.show(t("deleteAccount.success"));
      setTimeout(() => {
        logout();
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("deleteAccount.failed");
      Alert.show(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const baseSections: { title: string; items: SettingItem[] }[] = [
    {
      title: t("settings.account"),
      items: [
        {
          id: "profile",
          label: t("settings.editProfile"),
          icon: "person-outline",
          onPress: () => (navigation as any).navigate("EditProfile"),
        },
        {
          id: "myLevel",
          label: t("settings.myLevel"),
          icon: "trophy-outline",
          onPress: () => (navigation as any).navigate("MyLevel"),
        },
        {
          id: "myTitles",
          label: t("settings.myTitles"),
          icon: "ribbon-outline",
          onPress: () => (navigation as any).navigate("MyTitles"),
        },
        {
          id: "myComments",
          label: t("settings.myComments"),
          icon: "chatbubble-ellipses-outline",
          onPress: () => (navigation as any).navigate("MyComments"),
        },
        {
          id: "myLikes",
          label: t("settings.myLikes"),
          icon: "heart-outline",
          onPress: () => (navigation as any).navigate("MyLikes"),
        },
        {
          id: "language",
          label: t("settings.language"),
          icon: "language-outline",
          onPress: () => setShowLanguageModal(true),
          rightText: currentLang === "zh" ? "中文" : "English",
        },
      ],
    },
    {
      title: t("settings.privacy"),
      items: [
        {
          id: "hideFollowing",
          label: t("settings.hideFollowing"),
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideFollowing ?? false,
          onToggle: (value) => handlePrivacyToggle("hideFollowing", value),
        },
        {
          id: "hideFollowers",
          label: t("settings.hideFollowers"),
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideFollowers ?? false,
          onToggle: (value) => handlePrivacyToggle("hideFollowers", value),
        },
        {
          id: "hideLikes",
          label: t("settings.hideLikes"),
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideLikes ?? false,
          onToggle: (value) => handlePrivacyToggle("hideLikes", value),
        },
        {
          id: "hideWishlist",
          label: t("settings.hideWishlist"),
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideWishlist ?? false,
          onToggle: (value) => handlePrivacyToggle("hideWishlist", value),
        },
        {
          id: "blockedUsers",
          label: t("settings.blockedUsers"),
          icon: "ban-outline",
          onPress: () => (navigation as any).navigate("BlockedUsers"),
        },
        {
          id: "myReports",
          label: t("settings.myReports"),
          icon: "flag-outline",
          onPress: () => (navigation as any).navigate("MyReports"),
        },
      ],
    },
    {
      title: t("settings.merchantCenter"),
      items: [
        {
          id: "merchant",
          label: t("settings.myStores"),
          icon: "storefront-outline",
          onPress: () => (navigation as any).navigate("MyMerchantStores"),
          rightText: t("settings.merchantEntry"),
          rightColor: "#F57C00",
        },
      ],
    },
    {
      title: t("settings.support"),
      items: [
        {
          id: "terms",
          label: t("settings.termsOfService"),
          icon: "document-text-outline",
          onPress: () => showAgreement("terms"),
        },
        {
          id: "privacy",
          label: t("settings.privacyPolicy"),
          icon: "shield-outline",
          onPress: () => showAgreement("privacy"),
        },
        {
          id: "guidelines",
          label: t("settings.communityGuidelines"),
          icon: "megaphone-outline",
          onPress: () => showAgreement("guidelines"),
        },
        {
          id: "minor",
          label: t("settings.minorProtection"),
          icon: "people-outline",
          onPress: () => showAgreement("minor"),
        },
      ],
    },
    {
      title: t("settings.accountManagement"),
      items: [
        {
          id: "changePassword",
          label: t("settings.changePassword"),
          icon: "lock-closed-outline",
          onPress: () => (navigation as any).navigate("ChangePassword"),
        },
        {
          id: "deleteAccount",
          label: t("settings.deleteAccount"),
          icon: "trash-outline",
          onPress: handleDeleteAccount,
          rightText: t("settings.permanentDelete"),
          rightColor: theme.colors.error,
        },
      ],
    },
  ];

  const settingSections = user?.is_admin
    ? [
      {
        title: t("settings.admin"),
        items: [
          {
            id: "admin",
            label: t("settings.adminPanel"),
            icon: "shield-checkmark-outline",
            onPress: () => (navigation as any).navigate("Admin"),
            rightText: "Admin",
            rightColor: theme.colors.error,
          },
        ],
      },
      ...baseSections,
    ]
    : baseSections;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("settings.title")} showBack={true} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingItem}
                onPress={item.onPress}
                disabled={item.toggle}
              >
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={theme.colors.gray400}
                  />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>

                <View style={styles.settingRight}>
                  {item.toggle ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{
                        false: theme.colors.gray200,
                        true: theme.colors.accent,
                      }}
                      thumbColor={theme.colors.white}
                    />
                  ) : item.rightText ? (
                    <Text
                      style={[styles.rightText, { color: item.rightColor }]}
                    >
                      {item.rightText}
                    </Text>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.gray300}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutText}>{t("settings.logout")}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Avant Regard v1.0.0</Text>
          <Text style={styles.footerText}>© 2024 时装档案</Text>
        </View>
      </ScrollView>

      {/* 注销账户确认 Modal */}
      <Modal
        visible={showDeleteAccountModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteDialog}>
            <Ionicons
              name="warning-outline"
              size={48}
              color={theme.colors.error}
              style={{ alignSelf: "center", marginBottom: 12 }}
            />
            <Text style={styles.deleteTitle}>{t("deleteAccount.title")}</Text>
            <Text style={styles.deleteMessage}>
              {t("deleteAccount.message")}
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, deletingAccount && { opacity: 0.6 }]}
                onPress={confirmDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.deleteConfirmText}>{t("deleteAccount.confirm")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language selector modal */}
      <Modal
        visible={showLanguageModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteTitle}>{t("settings.selectLanguage")}</Text>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLang === "zh" && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange("zh")}
              >
                <Text style={[
                  styles.languageOptionText,
                  currentLang === "zh" && styles.languageOptionTextActive,
                ]}>
                  中文
                </Text>
                {currentLang === "zh" && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLang === "en" && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange("en")}
              >
                <Text style={[
                  styles.languageOptionText,
                  currentLang === "en" && styles.languageOptionTextActive,
                ]}>
                  English
                </Text>
                {currentLang === "en" && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.deleteCancelButton, { marginTop: 16 }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.deleteCancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAgreementModal}
        animationType="fade"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAgreementModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAgreementModal(false)}
            >
              <Ionicons name="close" size={24} color={theme.colors.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {agreementType === "terms"
                ? t("settings.termsOfService")
                : agreementType === "privacy"
                ? t("settings.privacyPolicy")
                : agreementType === "guidelines"
                ? t("settings.communityGuidelines")
                : t("settings.minorProtection")}
            </Text>
            <View style={styles.modalCloseButton} />
          </View>
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {agreementType === "terms" ? (
              <TermsContent />
            ) : agreementType === "privacy" ? (
              <PrivacyContent />
            ) : agreementType === "guidelines" ? (
              <CommunityGuidelinesContent />
            ) : (
              <MinorProtectionContent />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingVertical: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    marginLeft: theme.spacing.md,
  },
  settingRight: {
    alignItems: "center",
  },
  rightText: {
    ...theme.typography.caption,
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.white,
  },
  logoutText: {
    ...theme.typography.body,
    color: theme.colors.error,
    fontWeight: "500",
    marginLeft: theme.spacing.sm,
  },
  footer: {
    alignItems: "center",
    paddingVertical: theme.spacing.xxl,
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginBottom: 2,
  },
  // Modal 样式
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
    borderBottomColor: theme.colors.gray100,
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
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  deleteDialog: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 24,
    width: "100%",
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.black,
    textAlign: "center" as const,
    marginBottom: 12,
  },
  deleteMessage: {
    fontSize: 14,
    color: theme.colors.gray600,
    textAlign: "center" as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: "row" as const,
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center" as const,
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.black,
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: "center" as const,
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.white,
  },
  languageOption: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  languageOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.gray100,
  },
  languageOptionText: {
    fontSize: 16,
    color: theme.colors.black,
  },
  languageOptionTextActive: {
    fontWeight: "600" as const,
  },
});

export default SettingsScreen;
