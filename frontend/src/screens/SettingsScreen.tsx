import React, { useState, useEffect, useCallback } from "react";
import { Switch, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Image as ExpoImage } from "expo-image";
import {
  theme,
  resolveThemeMode,
  getThemeByMode,
  useThemedStyles,
  type AppTheme,
  type ThemePreference,
} from "../theme";
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
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  HStack,
  VStack,
  Button,
  ActionSheet,
} from "../components/ui";
import { Modal } from "../components/ui/modal";

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
  const { user, logout, updateUser } = useAuthStore();
  const systemColorScheme = useColorScheme();
  const styles = useThemedStyles(makeStyles);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    (user?.preferredTheme as ThemePreference) ?? "system"
  );
  const resolvedThemeMode = resolveThemeMode(themePreference, systemColorScheme);
  const activeTheme = getThemeByMode(resolvedThemeMode);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const currentLang = (i18n.language?.startsWith("zh") ? "zh" : "en") as SupportedLanguage;

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await setStoredLanguage(lang);
    setShowLanguageModal(false);
    if (user?.userId) {
      userInfoService.updateLanguagePreference(user.userId, lang).catch((err) =>
        console.error("Error saving language preference:", err)
      );
    }
  };

  const [privacySettings, setPrivacySettings] =
    useState<UserPrivacySettings | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState<string | null>(null);

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementType, setAgreementType] = useState<"terms" | "privacy" | "guidelines" | "minor">("terms");

  const showAgreement = (type: "terms" | "privacy" | "guidelines" | "minor") => {
    setAgreementType(type);
    setShowAgreementModal(true);
  };

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

  const syncLanguageFromServer = useCallback(async () => {
    if (!user?.userId) return;
    const revAtStart = useAuthStore.getState().themePreferenceRevision;
    try {
      const info = await userInfoService.getUserInfo(user.userId);
      if (info.preferredLanguage && info.preferredLanguage !== currentLang) {
        await setStoredLanguage(info.preferredLanguage as SupportedLanguage);
      }
      if (
        useAuthStore.getState().themePreferenceRevision === revAtStart &&
        info.preferredTheme &&
        (info.preferredTheme === "system" ||
          info.preferredTheme === "light" ||
          info.preferredTheme === "dark")
      ) {
        setThemePreference(info.preferredTheme);
        updateUser({ preferredTheme: info.preferredTheme });
      }
    } catch (error) {
      console.error("Error syncing language preference:", error);
    }
  }, [user?.userId, currentLang, updateUser]);

  useEffect(() => {
    loadPrivacySettings();
    syncLanguageFromServer();
  }, [loadPrivacySettings, syncLanguageFromServer]);

  useEffect(() => {
    if (
      user?.preferredTheme === "system" ||
      user?.preferredTheme === "light" ||
      user?.preferredTheme === "dark"
    ) {
      setThemePreference(user.preferredTheme);
    }
  }, [user?.preferredTheme]);

  useFocusEffect(
    useCallback(() => {
      loadPrivacySettings();
    }, [loadPrivacySettings])
  );

  const handlePrivacyToggle = async (
    key: "hideFollowing" | "hideFollowers" | "hideLikes" | "hideWishlist",
    value: boolean
  ) => {
    if (!user?.userId || updatingPrivacy) return;
    setUpdatingPrivacy(key);

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
      setPrivacySettings((prev) =>
        prev ? { ...prev, [key]: !value } : null
      );
      Alert.show(t("privacy.updateFailed"));
    } finally {
      setUpdatingPrivacy(null);
    }
  };

  const getThemeOptionLabel = (pref: ThemePreference) => {
    if (pref === "light") return t("settings.themeLight");
    if (pref === "dark") return t("settings.themeDark");
    return t("settings.themeSystem");
  };

  const handleThemeChange = async (nextTheme: ThemePreference) => {
    setThemePreference(nextTheme);
    setShowThemeModal(false);
    updateUser({ preferredTheme: nextTheme });
    if (!user?.userId) return;
    try {
      await userInfoService.updateThemePreference(user.userId, nextTheme);
    } catch (error) {
      console.error("Error saving theme preference:", error);
      Alert.show(t("settings.themeSaveFailed"));
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

  // 图片缓存清理
  // ----------------
  // expo-image 在 iOS 底层走 SDWebImage，磁盘缓存默认落在 app sandbox 里
  // (`Library/Caches/com.hackemist.SDImageCache/`)。这部分目录会跨 app
  // 进程共存活，只在「卸载重装」时才会被系统清掉，与用户报告的现象
  //   1. 用一段时间后帖子封面出现 8x8 马赛克
  //   2. 退到桌面再重新打开 app，糊的封面依然糊
  //   3. 卸载重装后立刻恢复清晰
  // 一一对应。我们把入口暴露在设置里，既是给用户的应急止血按钮（点
  // 一下就能让所有糊掉的封面重新拉一份干净的字节），也是我们诊断
  // 「问题就在 SDImageCache 磁盘缓存」这条假设最直接的检验工具。
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleClearImageCache = useCallback(async () => {
    if (clearingCache) return;
    setClearingCache(true);
    try {
      // 内存缓存先清，避免 disk 清完后 UI 仍展示老的解码 bitmap，
      // 让用户「按下按钮 -> 立即看到效果」的体感更强（也方便调试）。
      await ExpoImage.clearMemoryCache();
      await ExpoImage.clearDiskCache();
      Alert.show(t("settings.imageCacheCleared"));
    } catch (error) {
      console.warn("[Settings] clear image cache failed:", error);
      Alert.show(t("settings.imageCacheClearFailed"));
    } finally {
      setClearingCache(false);
      setShowClearCacheModal(false);
    }
  }, [clearingCache, t]);

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
        {
          id: "appearance",
          label: t("settings.appearance"),
          icon: "contrast-outline",
          onPress: () => setShowThemeModal(true),
          rightText: getThemeOptionLabel(themePreference),
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
        {
          // PRD 模块一：个人卖家 / 买手店通用的"我的在售"入口
          id: "sellerListings",
          label: t("settings.myListings"),
          icon: "pricetag-outline",
          onPress: () => (navigation as any).navigate("SellerListings"),
        },
        {
          // PRD 模块二：交易大厅
          id: "marketplace",
          label: t("settings.marketplace"),
          icon: "cart-outline",
          onPress: () => (navigation as any).navigate("Marketplace"),
        },
        {
          // PRD 模块三：我的收藏 (默认收藏 + 自建收藏夹)
          id: "myCollections",
          label: t("settings.myCollections"),
          icon: "bookmark-outline",
          onPress: () => (navigation as any).navigate("MyCollections"),
        },
        {
          // PRD 模块四：买家订单
          id: "myOrders",
          label: t("settings.myOrders"),
          icon: "receipt-outline",
          onPress: () => (navigation as any).navigate("MyOrders"),
        },
        {
          // PRD 模块四：卖家销售
          id: "mySales",
          label: t("settings.mySales"),
          icon: "cash-outline",
          onPress: () => (navigation as any).navigate("MySales"),
        },
        {
          // PRD 模块四：出价
          id: "myOffers",
          label: t("settings.myOffers"),
          icon: "swap-horizontal-outline",
          onPress: () => (navigation as any).navigate("MyOffers"),
        },
        {
          // PRD 模块五：鉴定
          id: "authentication",
          label: t("settings.authentication"),
          icon: "shield-checkmark-outline",
          onPress: () => (navigation as any).navigate("Authentication"),
        },
        {
          // PRD 模块六：My Archive
          id: "myArchive",
          label: t("settings.myArchive"),
          icon: "albums-outline",
          onPress: () => (navigation as any).navigate("MyArchive"),
        },
        {
          // PRD 模块八：Plus 订阅
          id: "plusSubscribe",
          label: t("settings.plusSubscribe"),
          icon: "star-outline",
          onPress: () => (navigation as any).navigate("PlusSubscribe"),
        },
      ],
    },
    {
      title: t("settings.support"),
      items: [
        {
          // PDF p.10 设计要点：售后/退款统一走「联系客服」IM
          id: "contactSupport",
          label: t("trading.support.contactSupport"),
          icon: "headset-outline",
          onPress: async () => {
            try {
              const { contactSupportGeneral } = await import(
                "../services/aftersalesService"
              );
              const res = await contactSupportGeneral();
              (navigation as any).navigate("Chat", {
                conversationId: res.conversationId,
                otherUserId: res.csUserId,
              });
            } catch (e) {
              console.warn("[settings] contact support failed", e);
            }
          },
        },
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
      title: t("settings.storage"),
      items: [
        {
          id: "clearImageCache",
          label: t("settings.clearImageCache"),
          icon: "images-outline",
          onPress: () => setShowClearCacheModal(true),
          rightText: t("settings.clearImageCacheHint"),
          rightColor: activeTheme.colors.gray300,
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
          rightColor: activeTheme.colors.error,
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
            rightColor: activeTheme.colors.error,
          },
        ],
      },
      ...baseSections,
    ]
    : baseSections;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: activeTheme.colors.background }]}
      edges={["top"]}
    >
      <ScreenHeader title={t("settings.title")} showBack={true} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {settingSections.map((section) => (
          <Box key={section.title} style={{ paddingVertical: theme.spacing.md }}>
            <Text
              style={{
                ...theme.typography.caption,
                color: activeTheme.colors.gray300,
                letterSpacing: 1,
                paddingHorizontal: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              {section.title}
            </Text>

            {section.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                disabled={item.toggle}
                style={[styles.settingItem, { borderBottomColor: activeTheme.colors.border }]}
              >
                <HStack space="md" style={{ flex: 1 }}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={activeTheme.colors.gray300}
                  />
                  <Text style={{ ...theme.typography.body, color: activeTheme.colors.text }}>
                    {item.label}
                  </Text>
                </HStack>

                <Box style={{ alignItems: "center" }}>
                  {item.toggle ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{
                        false: activeTheme.colors.gray200,
                        true: activeTheme.colors.accent,
                      }}
                      thumbColor={activeTheme.colors.white}
                    />
                  ) : item.rightText ? (
                    <Text
                      style={{
                        ...theme.typography.caption,
                        fontWeight: "500",
                        color: item.rightColor,
                      }}
                    >
                      {item.rightText}
                    </Text>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={activeTheme.colors.gray300}
                    />
                  )}
                </Box>
              </Pressable>
            ))}
          </Box>
        ))}

        <Button
          variant="outline"
          onPress={handleLogout}
          leftIcon={
            <Ionicons name="log-out-outline" size={20} color={activeTheme.colors.error} />
          }
          style={{
            marginHorizontal: theme.spacing.md,
            marginTop: theme.spacing.lg,
            borderColor: activeTheme.colors.error,
            backgroundColor: activeTheme.colors.card,
          }}
        >
          <Text style={{ color: activeTheme.colors.error, fontWeight: "500" }}>
            {t("settings.logout")}
          </Text>
        </Button>

        <VStack alignItems="center" style={{ paddingVertical: theme.spacing.xxl }}>
          <Text
            style={{
              ...theme.typography.caption,
              color: activeTheme.colors.gray300,
              marginBottom: 2,
            }}
          >
            Avant Regard v1.0.0
          </Text>
          <Text style={{ ...theme.typography.caption, color: activeTheme.colors.gray300 }}>
            {t("settings.copyright")}
          </Text>
        </VStack>
      </ScrollView>

      {/* Clear image cache confirmation */}
      <ActionSheet
        visible={showClearCacheModal}
        onClose={() => !clearingCache && setShowClearCacheModal(false)}
      >
        <VStack alignItems="center" style={{ padding: 24 }}>
          <Ionicons
            name="images-outline"
            size={48}
            color={activeTheme.colors.text}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.dialogTitle, { color: activeTheme.colors.text }]}>
            {t("settings.clearImageCacheTitle")}
          </Text>
          <Text style={[styles.dialogMessage, { color: activeTheme.colors.gray400 }]}>
            {t("settings.clearImageCacheMessage")}
          </Text>
          <Button
            onPress={handleClearImageCache}
            isLoading={clearingCache}
            disabled={clearingCache}
            style={{ width: "100%" }}
          >
            {t("settings.clearImageCacheConfirm")}
          </Button>
        </VStack>
      </ActionSheet>

      {/* Theme selector */}
      <ActionSheet
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      >
        <VStack style={{ padding: 24 }} space="sm">
          <Text style={[styles.dialogTitle, { marginBottom: 4, color: activeTheme.colors.text }]}>
            {t("settings.appearance")}
          </Text>
          {(["system", "light", "dark"] as ThemePreference[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => handleThemeChange(option)}
              style={[
                styles.languageOption,
                {
                  borderColor:
                    themePreference === option
                      ? activeTheme.colors.accent
                      : activeTheme.colors.gray200,
                  backgroundColor:
                    themePreference === option
                      ? activeTheme.colors.gray100
                      : activeTheme.colors.card,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: activeTheme.colors.text,
                  fontWeight: themePreference === option ? "600" : "400",
                }}
              >
                {getThemeOptionLabel(option)}
              </Text>
              {themePreference === option && (
                <Ionicons name="checkmark" size={20} color={activeTheme.colors.accent} />
              )}
            </Pressable>
          ))}
        </VStack>
      </ActionSheet>

      {/* Delete account confirmation */}
      <ActionSheet
        visible={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
      >
        <VStack alignItems="center" style={{ padding: 24 }}>
          <Ionicons
            name="warning-outline"
            size={48}
            color={activeTheme.colors.error}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.dialogTitle, { color: activeTheme.colors.text }]}>
            {t("deleteAccount.title")}
          </Text>
          <Text style={[styles.dialogMessage, { color: activeTheme.colors.gray400 }]}>
            {t("deleteAccount.message")}
          </Text>
          <Button
            colorScheme="error"
            onPress={confirmDeleteAccount}
            isLoading={deletingAccount}
            disabled={deletingAccount}
            style={{ width: "100%" }}
          >
            {t("deleteAccount.confirm")}
          </Button>
        </VStack>
      </ActionSheet>

      {/* Language selector */}
      <ActionSheet
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      >
        <VStack style={{ padding: 24 }} space="sm">
          <Text style={[styles.dialogTitle, { marginBottom: 4, color: activeTheme.colors.text }]}>
            {t("settings.selectLanguage")}
          </Text>
          <Pressable
            onPress={() => handleLanguageChange("zh")}
            style={[
              styles.languageOption,
              {
                borderColor:
                  currentLang === "zh"
                    ? activeTheme.colors.accent
                    : activeTheme.colors.gray200,
                backgroundColor:
                  currentLang === "zh"
                    ? activeTheme.colors.gray100
                    : activeTheme.colors.card,
              },
              currentLang === "zh" && styles.languageOptionActive,
            ]}
          >
            <Text
              style={{
                fontSize: 16,
                color: activeTheme.colors.text,
                fontWeight: currentLang === "zh" ? "600" : "400",
              }}
            >
              中文
            </Text>
            {currentLang === "zh" && (
              <Ionicons name="checkmark" size={20} color={activeTheme.colors.accent} />
            )}
          </Pressable>
          <Pressable
            onPress={() => handleLanguageChange("en")}
            style={[
              styles.languageOption,
              {
                borderColor:
                  currentLang === "en"
                    ? activeTheme.colors.accent
                    : activeTheme.colors.gray200,
                backgroundColor:
                  currentLang === "en"
                    ? activeTheme.colors.gray100
                    : activeTheme.colors.card,
              },
              currentLang === "en" && styles.languageOptionActive,
            ]}
          >
            <Text
              style={{
                fontSize: 16,
                color: activeTheme.colors.text,
                fontWeight: currentLang === "en" ? "600" : "400",
              }}
            >
              English
            </Text>
            {currentLang === "en" && (
              <Ionicons name="checkmark" size={20} color={activeTheme.colors.accent} />
            )}
          </Pressable>
        </VStack>
      </ActionSheet>

      {/* Agreement content viewer */}
      <Modal
        visible={showAgreementModal}
        animationType="fade"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAgreementModal(false)}
      >
        <SafeAreaView
          style={[styles.agreementContainer, { backgroundColor: activeTheme.colors.background }]}
        >
          <HStack
            justifyContent="between"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: activeTheme.colors.border,
            }}
          >
            <Pressable
              onPress={() => setShowAgreementModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={activeTheme.colors.text} />
            </Pressable>
            <Text
              style={{
                fontSize: 17,
                fontFamily: "PlayfairDisplay-Bold",
                color: activeTheme.colors.text,
              }}
            >
              {agreementType === "terms"
                ? t("settings.termsOfService")
                : agreementType === "privacy"
                ? t("settings.privacyPolicy")
                : agreementType === "guidelines"
                ? t("settings.communityGuidelines")
                : t("settings.minorProtection")}
            </Text>
            <Box style={styles.modalCloseButton} />
          </HStack>
          <ScrollView
            style={{ paddingHorizontal: 16 }}
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    settingItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    agreementContainer: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    modalCloseButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    dialogTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
      marginBottom: 12,
    },
    dialogMessage: {
      fontSize: 14,
      color: t.colors.gray600,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    languageOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    languageOptionActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.gray100,
    },
  });

export default SettingsScreen;
