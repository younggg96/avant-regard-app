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
  const { user } = useAuthStore();

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
      ],
    },
    {
      title: "支持",
      items: [
        {
          id: "terms",
          label: "服务条款",
          icon: "document-text-outline",
          onPress: () => (navigation as any).navigate("Terms"),
        },
        {
          id: "privacy",
          label: "隐私政策",
          icon: "shield-outline",
          onPress: () => (navigation as any).navigate("Privacy"),
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
