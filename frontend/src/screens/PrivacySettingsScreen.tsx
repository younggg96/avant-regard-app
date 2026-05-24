import React, { useCallback, useState } from "react";
import { Switch, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../components/ScreenHeader";
import { Alert } from "../utils/Alert";
import { useAuthStore } from "../store/authStore";
import {
  userInfoService,
  type UserPrivacySettings,
} from "../services/userInfoService";
import { Box, Text, ScrollView } from "../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

type PrivacyKey = keyof Pick<
  UserPrivacySettings,
  "hideFollowing" | "hideFollowers" | "hideLikes" | "hideWishlist" | "hideSales"
>;

const PRIVACY_ITEMS: { id: PrivacyKey; labelKey: string }[] = [
  { id: "hideFollowing", labelKey: "settings.hideFollowing" },
  { id: "hideFollowers", labelKey: "settings.hideFollowers" },
  { id: "hideLikes", labelKey: "settings.hideLikes" },
  { id: "hideWishlist", labelKey: "settings.hideWishlist" },
  { id: "hideSales", labelKey: "settings.hideSales" },
];

const PrivacySettingsScreen = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const appTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [privacySettings, setPrivacySettings] =
    useState<UserPrivacySettings | null>(null);
  const [updatingPrivacy, setUpdatingPrivacy] = useState<PrivacyKey | null>(null);

  const loadPrivacySettings = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const settings = await userInfoService.getPrivacySettings(user.userId);
      setPrivacySettings(settings);
    } catch (error) {
      console.error("Error loading privacy settings:", error);
    }
  }, [user?.userId]);

  useFocusEffect(
    useCallback(() => {
      loadPrivacySettings();
    }, [loadPrivacySettings]),
  );

  const handlePrivacyToggle = async (key: PrivacyKey, value: boolean) => {
    if (!user?.userId || updatingPrivacy) return;
    setUpdatingPrivacy(key);
    setPrivacySettings((prev) => (prev ? { ...prev, [key]: value } : null));

    try {
      const updated = await userInfoService.updatePrivacySettings(user.userId, {
        [key]: value,
      });
      setPrivacySettings(updated);
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      setPrivacySettings((prev) =>
        prev ? { ...prev, [key]: !value } : null,
      );
      Alert.show(t("privacy.updateFailed"));
    } finally {
      setUpdatingPrivacy(null);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: appTheme.colors.background }]}
      edges={["top"]}
    >
      <ScreenHeader title={t("settings.privacy")} showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Box style={styles.card}>
          {PRIVACY_ITEMS.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.row,
                idx < PRIVACY_ITEMS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: appTheme.colors.border,
                },
              ]}
            >
              <Box style={styles.rowLeft}>
                <Ionicons
                  name="eye-off-outline"
                  size={20}
                  color={appTheme.colors.text}
                  style={styles.icon}
                />
                <Text style={styles.label}>{t(item.labelKey)}</Text>
              </Box>
              <Switch
                value={privacySettings?.[item.id] ?? false}
                onValueChange={(value) => handlePrivacyToggle(item.id, value)}
                disabled={updatingPrivacy === item.id}
                trackColor={{
                  false: appTheme.colors.gray200,
                  true: appTheme.colors.accent,
                }}
                thumbColor={appTheme.colors.white}
              />
            </View>
          ))}
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
    },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: t.spacing.md,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingRight: t.spacing.sm,
    },
    icon: {
      marginRight: 12,
    },
    label: {
      fontSize: 15,
      color: t.colors.text,
      flex: 1,
    },
  });

export default PrivacySettingsScreen;
