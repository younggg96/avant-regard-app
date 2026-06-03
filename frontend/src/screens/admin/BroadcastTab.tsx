import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService, BroadcastNotificationResult } from "../../services/adminService";
import { useSharedStyles } from "./adminStyles";
import {
  Box,
  HStack,
  Text,
  Input,
  Pressable,
  ScrollView,
  Button,
  ButtonText,
} from "../../components/ui";

const BroadcastTab = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [title, setTitle] = useState("");

  const PAGE_OPTIONS = useMemo(
    () => [
      { value: "", label: t("admin.broadcastSelectPage") },
      {
        value: "PostDetail",
        label: t("admin.broadcastPostDetail"),
        paramLabel: "postId (postId)",
      },
      {
        value: "UserProfile",
        label: t("admin.broadcastUserProfile"),
        paramLabel: "userId (userId)",
      },
      {
        value: "BrandDetail",
        label: t("admin.broadcastBrandDetail"),
        paramLabel: "brandId (brandId)",
      },
      {
        value: "CollectionDetail",
        label: t("admin.broadcastShowDetail"),
        paramLabel: "id (id)",
      },
      {
        value: "CommunityDetail",
        label: t("admin.broadcastCommunityDetail"),
        paramLabel: "communityId (communityId)",
      },
      {
        value: "StoreDetail",
        label: t("admin.broadcastStoreDetail"),
        paramLabel: "storeId (storeId)",
      },
      { value: "Discover", label: t("admin.broadcastDiscover"), paramLabel: "" },
      { value: "Profile", label: t("admin.broadcastProfile"), paramLabel: "" },
    ],
    [t],
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BroadcastNotificationResult | null>(null);
  const [linkType, setLinkType] = useState<"NONE" | "PAGE" | "URL">("NONE");
  const [navigateTo, setNavigateTo] = useState("");
  const [navigateParam, setNavigateParam] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const buildActionData = () => {
    const actionData: Record<string, unknown> = {};
    if (linkType === "URL" && externalUrl.trim()) {
      actionData.externalUrl = externalUrl.trim();
    } else if (linkType === "PAGE" && navigateTo) {
      actionData.navigateTo = navigateTo;
      if (navigateParam.trim()) {
        const selectedPage = PAGE_OPTIONS.find((p) => p.value === navigateTo);
        if (selectedPage && selectedPage.paramLabel) {
          const paramKey =
            selectedPage.paramLabel.match(/\((\w+)\)/)?.[1] || "id";
          actionData.navigateParams = { [paramKey]: navigateParam.trim() };
        }
      }
    }
    return Object.keys(actionData).length > 0 ? actionData : undefined;
  };

  const getLinkDescription = () => {
    if (linkType === "URL" && externalUrl.trim()) {
      return `${t("admin.broadcastExternalLink")}: ${externalUrl}`;
    }
    if (linkType === "PAGE" && navigateTo) {
      const selectedPage = PAGE_OPTIONS.find((p) => p.value === navigateTo);
      const pageName = selectedPage?.label || navigateTo;
      return navigateParam.trim() ? `${pageName} (${navigateParam})` : pageName;
    }
    return t("admin.broadcastNoLink");
  };

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert(t("admin.hint"), t("admin.broadcastEnterTitle"));
      return;
    }
    if (!message.trim()) {
      Alert.alert(t("admin.hint"), t("admin.broadcastEnterContent"));
      return;
    }
    if (linkType === "URL" && !externalUrl.trim()) {
      Alert.alert(t("admin.hint"), t("admin.broadcastEnterUrl"));
      return;
    }
    if (linkType === "PAGE" && !navigateTo) {
      Alert.alert(t("admin.hint"), t("admin.broadcastSelectPageHint"));
      return;
    }

    const linkDesc = getLinkDescription();
    Alert.alert(
      t("admin.broadcastConfirmSend"),
      `${title}\n${message}\n${linkDesc}`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.broadcastConfirmSendBtn"),
          onPress: async () => {
            try {
              setLoading(true);
              setResult(null);
              const actionData = buildActionData();
              const res = await adminService.broadcastNotification({
                title: title.trim(),
                message: message.trim(),
                actionData,
              });
              setResult(res);
              Alert.alert(
                t("admin.broadcastSendDone"),
                `${t("common.success")}：${res.successCount}\n${t("common.failed")}：${res.failCount}\n${t("admin.broadcastTotalUsers")}：${res.totalUsers}`,
                [
                  {
                    text: t("common.confirm"),
                    onPress: () => {
                      setTitle("");
                      setMessage("");
                      setLinkType("NONE");
                      setNavigateTo("");
                      setNavigateParam("");
                      setExternalUrl("");
                    },
                  },
                ],
              );
            } catch (error) {
              Alert.alert(
                t("admin.error"),
                error instanceof Error
                  ? error.message
                  : t("admin.broadcastSendFailed"),
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !loading;

  return (
    <ScrollView
      style={sharedStyles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Box style={styles.formCard}>
        <HStack style={styles.headerRow}>
          <Box style={styles.headerIconWrap}>
            <Ionicons name="megaphone-outline" size={18} color={theme.colors.text} />
          </Box>
          <Text style={styles.headerTitle}>{t("admin.broadcastTitle")}</Text>
        </HStack>
        <Text style={styles.introHint}>{t("admin.broadcastSubtitle")}</Text>

        <Text style={styles.fieldLabel}>{t("admin.broadcastTitleLabel")}</Text>
        <Input
          placeholder={t("admin.broadcastTitlePlaceholder")}
          placeholderTextColor={theme.colors.gray300}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          variant="outline"
          size="sm"
        />
        <Text style={styles.charCount}>{title.length}/100</Text>

        <Text style={styles.fieldLabel}>{t("admin.broadcastContentLabel")}</Text>
        <Input
          style={styles.textarea}
          placeholder={t("admin.broadcastContentPlaceholder")}
          placeholderTextColor={theme.colors.gray300}
          value={message}
          onChangeText={setMessage}
          maxLength={500}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          variant="outline"
          size="sm"
        />
        <Text style={styles.charCount}>{message.length}/500</Text>

        <Text style={styles.fieldLabel}>{t("admin.broadcastLinkLabel")}</Text>
        <HStack style={styles.linkTypeRow}>
          {(["NONE", "PAGE", "URL"] as const).map((type) => {
            const iconMap = {
              NONE: "close-circle-outline",
              PAGE: "phone-portrait-outline",
              URL: "link-outline",
            } as const;
            const labelMap = {
              NONE: t("admin.broadcastNoLink"),
              PAGE: t("admin.broadcastInAppPage"),
              URL: t("admin.broadcastExternalLink"),
            };
            const active = linkType === type;
            return (
              <Pressable
                key={type}
                style={[
                  styles.linkTypeBtn,
                  active && styles.linkTypeBtnActive,
                ]}
                onPress={() => setLinkType(type)}
              >
                <Ionicons
                  name={iconMap[type]}
                  size={14}
                  color={active ? theme.colors.textInverted : theme.colors.gray400}
                />
                <Text
                  style={[
                    styles.linkTypeBtnText,
                    active && styles.linkTypeBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {labelMap[type]}
                </Text>
              </Pressable>
            );
          })}
        </HStack>

        {linkType === "PAGE" && (
          <Box style={styles.linkSection}>
            <Text style={styles.linkSubLabel}>{t("admin.broadcastSelectPageLabel")}</Text>
            <Box style={sharedStyles.linkTypeContainer}>
              {PAGE_OPTIONS.filter((p) => p.value).map((page) => (
                <Pressable
                  key={page.value}
                  style={[
                    sharedStyles.linkTypeButton,
                    navigateTo === page.value && sharedStyles.linkTypeButtonActive,
                  ]}
                  onPress={() => {
                    setNavigateTo(page.value);
                    setNavigateParam("");
                  }}
                >
                  <Text
                    style={[
                      sharedStyles.linkTypeButtonText,
                      navigateTo === page.value &&
                        sharedStyles.linkTypeButtonTextActive,
                    ]}
                  >
                    {page.label}
                  </Text>
                </Pressable>
              ))}
            </Box>

            {navigateTo ? (
              <Box style={{ marginTop: theme.spacing.sm }}>
                {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel ? (
                  <>
                    <Text style={styles.linkSubLabel}>
                      {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel}
                    </Text>
                    <Input
                      placeholder={t("admin.broadcastParamPlaceholder")}
                      placeholderTextColor={theme.colors.gray300}
                      value={navigateParam}
                      onChangeText={setNavigateParam}
                      variant="outline"
                      size="sm"
                    />
                  </>
                ) : (
                  <Text style={sharedStyles.formHint}>
                    {t("admin.broadcastNoParamNeeded")}
                  </Text>
                )}
              </Box>
            ) : null}
          </Box>
        )}

        {linkType === "URL" && (
          <Box style={styles.linkSection}>
            <Text style={styles.linkSubLabel}>{t("admin.broadcastUrlLabel")}</Text>
            <Input
              placeholder="https://example.com"
              placeholderTextColor={theme.colors.gray300}
              value={externalUrl}
              onChangeText={setExternalUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              variant="outline"
              size="sm"
            />
            <Text style={sharedStyles.formHint}>{t("admin.broadcastUrlHint")}</Text>
          </Box>
        )}

        {(title || message) ? (
          <Box style={styles.previewBox}>
            <Text style={styles.previewLabel}>{t("admin.broadcastPreview")}</Text>
            <HStack style={styles.previewCard}>
              <Box style={styles.previewIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={16}
                  color={theme.colors.textInverted}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {title || t("admin.broadcastNotifTitle")}
                </Text>
                <Text style={styles.previewMessage} numberOfLines={2}>
                  {message || t("admin.broadcastNotifContent")}
                </Text>
                {linkType !== "NONE" ? (
                  <HStack style={styles.previewLinkRow}>
                    <Ionicons
                      name={linkType === "URL" ? "open-outline" : "chevron-forward"}
                      size={12}
                      color={theme.colors.accent}
                    />
                    <Text style={styles.previewLinkText} numberOfLines={1}>
                      {getLinkDescription()}
                    </Text>
                  </HStack>
                ) : null}
              </Box>
            </HStack>
          </Box>
        ) : null}

        <Button
          size="sm"
          onPress={handleSend}
          disabled={!canSend}
          isLoading={loading}
          style={styles.sendButton}
          leftIcon={
            !loading ? (
              <Ionicons
                name="send-outline"
                size={16}
                color={theme.colors.textInverted}
              />
            ) : undefined
          }
        >
          <ButtonText style={{ fontSize: 13 }}>
            {t("admin.broadcastSendAll")}
          </ButtonText>
        </Button>
      </Box>

      {result ? (
        <Box style={styles.resultCard}>
          <Text style={styles.resultTitle}>{t("admin.broadcastLastResult")}</Text>
          <HStack style={styles.resultRow}>
            <Box style={styles.resultItem}>
              <Text style={styles.resultNumber}>{result.successCount}</Text>
              <Text style={styles.resultLabel}>{t("common.success")}</Text>
            </Box>
            <Box style={styles.resultItem}>
              <Text style={[styles.resultNumber, { color: theme.colors.error }]}>
                {result.failCount}
              </Text>
              <Text style={styles.resultLabel}>{t("common.failed")}</Text>
            </Box>
            <Box style={styles.resultItem}>
              <Text style={styles.resultNumber}>{result.totalUsers}</Text>
              <Text style={styles.resultLabel}>{t("admin.broadcastTotalUsers")}</Text>
            </Box>
          </HStack>
        </Box>
      ) : null}

      <HStack style={styles.tipsRow}>
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={theme.colors.gray400}
        />
        <Text style={styles.tipsText}>{t("admin.broadcastTips")}</Text>
      </HStack>

      <Box style={{ height: 40 }} />
    </ScrollView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    formCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 10,
      marginBottom: t.spacing.sm,
      ...t.shadows.sm,
    },
    headerRow: {
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    headerIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "600",
      color: t.colors.text,
    },
    introHint: {
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.gray300,
      marginBottom: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    charCount: {
      fontSize: 11,
      color: t.colors.gray300,
      textAlign: "right",
      marginTop: 4,
      marginBottom: 2,
    },
    textarea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    linkTypeRow: {
      gap: 6,
      marginBottom: 6,
    },
    linkTypeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: t.borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    linkTypeBtnActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    linkTypeBtnText: {
      fontSize: 11,
      color: t.colors.gray400,
      fontWeight: "500",
      flexShrink: 1,
    },
    linkTypeBtnTextActive: {
      color: t.colors.textInverted,
    },
    linkSection: {
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 6,
    },
    linkSubLabel: {
      fontSize: 11,
      color: t.colors.gray300,
      fontWeight: "600",
      marginBottom: t.spacing.xs,
    },
    previewBox: {
      marginTop: 6,
      marginBottom: 8,
    },
    previewLabel: {
      fontSize: 11,
      color: t.colors.gray300,
      fontWeight: "600",
      marginBottom: t.spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    previewCard: {
      alignItems: "flex-start",
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.text,
    },
    previewIcon: {
      width: 28,
      height: 28,
      borderRadius: 4,
      backgroundColor: t.colors.text,
      alignItems: "center",
      justifyContent: "center",
      marginRight: t.spacing.sm,
    },
    previewTitle: {
      fontSize: 13,
      lineHeight: 17,
      color: t.colors.text,
      fontWeight: "600",
    },
    previewMessage: {
      fontSize: 12,
      color: t.colors.gray400,
      marginTop: 2,
      lineHeight: 16,
    },
    previewLinkRow: {
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    previewLinkText: {
      fontSize: 11,
      color: t.colors.accent,
      flex: 1,
    },
    sendButton: {
      alignSelf: "stretch",
      marginTop: 4,
    },
    resultCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginBottom: t.spacing.sm,
      ...t.shadows.sm,
    },
    resultTitle: {
      fontSize: 11,
      color: t.colors.gray300,
      textAlign: "center",
      marginBottom: t.spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    resultRow: {
      justifyContent: "space-around",
    },
    resultItem: {
      alignItems: "center",
    },
    resultNumber: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
    },
    resultLabel: {
      fontSize: 11,
      color: t.colors.gray400,
      marginTop: 2,
    },
    tipsRow: {
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: t.borderRadius.md,
      marginTop: 4,
    },
    tipsText: {
      fontSize: 11,
      color: t.colors.gray400,
      flex: 1,
      lineHeight: 16,
    },
  });

export default BroadcastTab;
