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
  const [agreementType, setAgreementType] = useState<"terms" | "privacy">("terms");

  // 显示协议 Modal
  const showAgreement = (type: "terms" | "privacy") => {
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
    key: "hideFollowing" | "hideFollowers" | "hideLikes",
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

  const handleLogout = () => {
    Alert.show("正在退出...");
    setTimeout(() => {
      logout();
    }, 500);
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
          value: privacySettings?.hideFollowing ?? true,
          onToggle: (value) => handlePrivacyToggle("hideFollowing", value),
        },
        {
          id: "hideFollowers",
          label: "隐藏粉丝列表",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideFollowers ?? true,
          onToggle: (value) => handlePrivacyToggle("hideFollowers", value),
        },
        {
          id: "hideLikes",
          label: "隐藏点赞列表",
          icon: "eye-off-outline",
          toggle: true,
          value: privacySettings?.hideLikes ?? true,
          onToggle: (value) => handlePrivacyToggle("hideLikes", value),
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
          label: "服务条款",
          icon: "document-text-outline",
          onPress: () => showAgreement("terms"),
        },
        {
          id: "privacy",
          label: "隐私政策",
          icon: "shield-outline",
          onPress: () => showAgreement("privacy"),
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
              {agreementType === "terms" ? "服务条款" : "隐私政策"}
            </Text>
            <View style={styles.modalCloseButton} />
          </View>
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {agreementType === "terms" ? <TermsContent /> : <PrivacyContent />}
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
    fontFamily: "Inter-Bold",
    color: theme.colors.black,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export default SettingsScreen;
