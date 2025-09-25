import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useAlert } from "../components/AlertProvider";
import ScreenHeader from "../components/ScreenHeader";

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
  const { showAlert, showConfirm } = useAlert();

  const settingSections: { title: string; items: SettingItem[] }[] = [
    {
      title: "账户",
      items: [
        {
          id: "profile",
          label: "编辑个人资料",
          icon: "person-outline",
          onPress: () => showAlert("即将推出", "个人资料编辑功能即将上线"),
        },
        {
          id: "phone",
          label: "手机号管理",
          icon: "call-outline",
          onPress: () => showAlert("手机号管理", "手机号管理功能即将上线"),
          rightText: user?.phone
            ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
            : "",
          rightColor: theme.colors.gray400,
        },
        {
          id: "password",
          label: "修改密码",
          icon: "lock-closed-outline",
          onPress: () => (navigation as any).navigate("ChangePassword"),
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
          onPress: () => showAlert("服务条款", "服务条款即将上线"),
        },
        {
          id: "privacy",
          label: "隐私政策",
          icon: "shield-outline",
          onPress: () => showAlert("隐私政策", "隐私政策即将上线"),
        },
      ],
    },
  ];

  const handleDeleteAccount = () => {
    showConfirm("删除账户", "确定要删除您的账户吗？此操作无法撤销。", () => {
      showAlert("账户已删除", "您的账户已被删除。", [
        { text: "确定", onPress: logout },
      ]);
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="设置" />
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

        <View style={styles.dangerZone}>
          <Text style={styles.sectionTitle}>危险操作</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.deleteButtonText}>删除账户</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Avant Regard v1.0.0</Text>
          <Text style={styles.footerText}>© 2024 时装档案</Text>
        </View>
      </ScrollView>
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
  dangerZone: {
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  deleteButtonText: {
    ...theme.typography.body,
    color: theme.colors.error,
    marginLeft: theme.spacing.md,
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
});

export default SettingsScreen;
