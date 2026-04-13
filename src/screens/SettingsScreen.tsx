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
  const { user, logout } = useAuthStore();

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
      Alert.show("更新失败，请重试");
    } finally {
      setUpdatingPrivacy(null);
    }
  };

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    Alert.show("正在退出...");
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
      Alert.show("账户已永久删除");
      setTimeout(() => {
        logout();
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除账户失败，请稍后重试";
      Alert.show(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  // 基础设置项
  const baseSections: { title: string; items: SettingItem[] }[] = [
    {
      title: "账户",
      items: [
        {
          id: "profile",
          label: "编辑个人资料",
          icon: "person-outline",
          onPress: () => (navigation as any).navigate("EditProfile"),
        },
        {
          id: "myComments",
          label: "我的评论",
          icon: "chatbubble-ellipses-outline",
          onPress: () => (navigation as any).navigate("MyComments"),
        },
        {
          id: "myLikes",
          label: "我的点赞",
          icon: "heart-outline",
          onPress: () => (navigation as any).navigate("MyLikes"),
        },
      ],
    },
    {
      title: "隐私设置",
      items: [
        {
          id: "hideFollowing",
          label: "隐藏关注列表",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideFollowing ?? false,
          onToggle: (value) => handlePrivacyToggle("hideFollowing", value),
        },
        {
          id: "hideFollowers",
          label: "隐藏粉丝列表",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideFollowers ?? false,
          onToggle: (value) => handlePrivacyToggle("hideFollowers", value),
        },
        {
          id: "hideLikes",
          label: "隐藏点赞列表",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideLikes ?? false,
          onToggle: (value) => handlePrivacyToggle("hideLikes", value),
        },
        {
          id: "hideWishlist",
          label: "隐藏愿望单",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideWishlist ?? false,
          onToggle: (value) => handlePrivacyToggle("hideWishlist", value),
        },
        {
          id: "blockedUsers",
          label: "屏蔽用户管理",
          icon: "ban-outline",
          onPress: () => (navigation as any).navigate("BlockedUsers"),
        },
        {
          id: "myReports",
          label: "我的举报",
          icon: "flag-outline",
          onPress: () => (navigation as any).navigate("MyReports"),
        },
      ],
    },
    {
      title: "商家中心",
      items: [
        {
          id: "merchant",
          label: "我的店铺",
          icon: "storefront-outline",
          onPress: () => (navigation as any).navigate("MyMerchantStores"),
          rightText: "商家入口",
          rightColor: "#F57C00",
        },
      ],
    },
    {
      title: "支持",
      items: [
        {
          id: "terms",
          label: "软件许可服务协议",
          icon: "document-text-outline",
          onPress: () => showAgreement("terms"),
        },
        {
          id: "privacy",
          label: "隐私政策",
          icon: "shield-outline",
          onPress: () => showAgreement("privacy"),
        },
        {
          id: "guidelines",
          label: "平台自律公约",
          icon: "megaphone-outline",
          onPress: () => showAgreement("guidelines"),
        },
        {
          id: "minor",
          label: "未成年人个人信息保护规则",
          icon: "people-outline",
          onPress: () => showAgreement("minor"),
        },
      ],
    },
    {
      title: "账户管理",
      items: [
        {
          id: "changePassword",
          label: "修改密码",
          icon: "lock-closed-outline",
          onPress: () => (navigation as any).navigate("ChangePassword"),
        },
        {
          id: "deleteAccount",
          label: "注销账户",
          icon: "trash-outline",
          onPress: handleDeleteAccount,
          rightText: "永久删除",
          rightColor: theme.colors.error,
        },
      ],
    },
  ];

  // 如果用户是管理员，添加管理员设置项
  const settingSections = user?.is_admin
    ? [
      {
        title: "管理员",
        items: [
          {
            id: "admin",
            label: "管理员后台",
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
      <ScreenHeader title="设置" showBack={true} />
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

        {/* 退出登录按钮 */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.logoutText}>退出登录</Text>
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
            <Text style={styles.deleteTitle}>确认注销账户</Text>
            <Text style={styles.deleteMessage}>
              此操作不可撤销。您的所有数据（包括发布的内容、评论、关注关系等）将被永久删除，且无法恢复。
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setShowDeleteAccountModal(false)}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, deletingAccount && { opacity: 0.6 }]}
                onPress={confirmDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.deleteConfirmText}>确认注销</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 用户协议和隐私政策 Modal */}
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
                ? "软件许可服务协议"
                : agreementType === "privacy"
                ? "隐私政策"
                : agreementType === "guidelines"
                ? "平台自律公约"
                : "未成年人个人信息保护规则"}
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
});

export default SettingsScreen;
