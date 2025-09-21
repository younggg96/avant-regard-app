import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();

  const [notifications, setNotifications] = React.useState({
    newCollections: true,
    priceAlerts: true,
    followedDesigners: true,
    marketingEmails: false,
  });

  const settingSections = [
    {
      title: "Account",
      items: [
        {
          id: "profile",
          label: "Edit Profile",
          icon: "person-outline",
          onPress: () =>
            Alert.alert(
              "Coming Soon",
              "Profile editing will be available soon"
            ),
        },
        {
          id: "email",
          label: "Email Verification",
          icon: "mail-outline",
          onPress: () =>
            (navigation as any).navigate("EmailVerification", {
              email: user?.email,
            }),
          rightText: user?.isVerified ? "Verified" : "Verify",
          rightColor: user?.isVerified
            ? theme.colors.accent
            : theme.colors.error,
        },
        {
          id: "password",
          label: "Change Password",
          icon: "lock-closed-outline",
          onPress: () => (navigation as any).navigate("ChangePassword"),
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          id: "newCollections",
          label: "New Collections",
          icon: "notifications-outline",
          toggle: true,
          value: notifications.newCollections,
          onToggle: (value: boolean) =>
            setNotifications({ ...notifications, newCollections: value }),
        },
        {
          id: "priceAlerts",
          label: "Price Alerts",
          icon: "pricetag-outline",
          toggle: true,
          value: notifications.priceAlerts,
          onToggle: (value: boolean) =>
            setNotifications({ ...notifications, priceAlerts: value }),
        },
        {
          id: "followedDesigners",
          label: "Followed Designers",
          icon: "heart-outline",
          toggle: true,
          value: notifications.followedDesigners,
          onToggle: (value: boolean) =>
            setNotifications({ ...notifications, followedDesigners: value }),
        },
        {
          id: "marketingEmails",
          label: "Marketing Emails",
          icon: "mail-outline",
          toggle: true,
          value: notifications.marketingEmails,
          onToggle: (value: boolean) =>
            setNotifications({ ...notifications, marketingEmails: value }),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          label: "Help Center",
          icon: "help-circle-outline",
          onPress: () =>
            Alert.alert("Help", "Help center will be available soon"),
        },
        {
          id: "feedback",
          label: "Send Feedback",
          icon: "chatbubble-outline",
          onPress: () =>
            Alert.alert("Feedback", "Feedback form will be available soon"),
        },
        {
          id: "terms",
          label: "Terms of Service",
          icon: "document-text-outline",
          onPress: () =>
            Alert.alert("Terms", "Terms of service will be available soon"),
        },
        {
          id: "privacy",
          label: "Privacy Policy",
          icon: "shield-outline",
          onPress: () =>
            Alert.alert("Privacy", "Privacy policy will be available soon"),
        },
      ],
    },
  ];

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert("Account Deleted", "Your account has been deleted.", [
              { text: "OK", onPress: logout },
            ]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>

        <Text style={styles.title}>Settings</Text>
      </View>

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
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Avant Regard v1.0.0</Text>
          <Text style={styles.footerText}>© 2024 Fashion Archive</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.black,
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
