import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService, BroadcastNotificationResult } from "../../services/adminService";
import { Box, HStack, VStack, Text, Input, Pressable, ScrollView } from "../../components/ui";

const BroadcastTab = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState("");

  const PAGE_OPTIONS = useMemo(() => [
    { value: "", label: t("admin.broadcastSelectPage") },
    { value: "PostDetail", label: t("admin.broadcastPostDetail"), paramLabel: "postId (postId)" },
    { value: "UserProfile", label: t("admin.broadcastUserProfile"), paramLabel: "userId (userId)" },
    { value: "BrandDetail", label: t("admin.broadcastBrandDetail"), paramLabel: "brandId (brandId)" },
    { value: "CollectionDetail", label: t("admin.broadcastShowDetail"), paramLabel: "id (id)" },
    { value: "CommunityDetail", label: t("admin.broadcastCommunityDetail"), paramLabel: "communityId (communityId)" },
    { value: "StoreDetail", label: t("admin.broadcastStoreDetail"), paramLabel: "storeId (storeId)" },
    { value: "Discover", label: t("admin.broadcastDiscover"), paramLabel: "" },
    { value: "Profile", label: t("admin.broadcastProfile"), paramLabel: "" },
  ], [t]);
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
          const paramKey = selectedPage.paramLabel.match(/\((\w+)\)/)?.[1] || "id";
          actionData.navigateParams = { [paramKey]: navigateParam.trim() };
        }
      }
    }
    return Object.keys(actionData).length > 0 ? actionData : undefined;
  };

  const getLinkDescription = () => {
    if (linkType === "URL" && externalUrl.trim()) {
      return `${t("admin.broadcastExternalLink")}: ${externalUrl}`;
    } else if (linkType === "PAGE" && navigateTo) {
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
    Alert.alert(t("admin.broadcastConfirmSend"), `${title}\n${message}\n${linkDesc}`, [
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
              [{
                text: t("common.confirm"),
                onPress: () => {
                  setTitle("");
                  setMessage("");
                  setLinkType("NONE");
                  setNavigateTo("");
                  setNavigateParam("");
                  setExternalUrl("");
                },
              }]
            );
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.broadcastSendFailed"));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Box style={styles.broadcastContainer}>
        <VStack style={styles.broadcastHeader}>
          <Ionicons name="megaphone" size={32} color={theme.colors.black} />
          <Text style={styles.broadcastHeaderTitle}>{t("admin.broadcastTitle")}</Text>
          <Text style={styles.broadcastHeaderSubtitle}>{t("admin.broadcastSubtitle")}</Text>
        </VStack>

        <VStack style={styles.broadcastForm}>
          <VStack style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>{t("admin.broadcastTitleLabel")}</Text>
            <Input
              style={styles.broadcastInput}
              placeholder={t("admin.broadcastTitlePlaceholder")}
              placeholderTextColor={theme.colors.gray300}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              variant="outline"
              size="md"
            />
            <Text style={styles.broadcastCharCount}>{title.length}/100</Text>
          </VStack>

          <VStack style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>{t("admin.broadcastContentLabel")}</Text>
            <Input
              style={[styles.broadcastInput, styles.broadcastTextarea]}
              placeholder={t("admin.broadcastContentPlaceholder")}
              placeholderTextColor={theme.colors.gray300}
              value={message}
              onChangeText={setMessage}
              maxLength={500}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              variant="outline"
              size="md"
            />
            <Text style={styles.broadcastCharCount}>{message.length}/500</Text>
          </VStack>

          <VStack style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>{t("admin.broadcastLinkLabel")}</Text>
            <HStack style={styles.broadcastLinkTypeRow}>
              {(["NONE", "PAGE", "URL"] as const).map((type) => {
                const iconMap = { NONE: "close-circle-outline", PAGE: "phone-portrait-outline", URL: "link-outline" } as const;
                const labelMap = { NONE: t("admin.broadcastNoLink"), PAGE: t("admin.broadcastInAppPage"), URL: t("admin.broadcastExternalLink") };
                return (
                  <Pressable
                    key={type}
                    style={[styles.broadcastLinkTypeBtn, linkType === type && styles.broadcastLinkTypeBtnActive]}
                    onPress={() => setLinkType(type)}
                  >
                    <Ionicons name={iconMap[type]} size={18} color={linkType === type ? theme.colors.white : theme.colors.black} />
                    <Text style={[styles.broadcastLinkTypeBtnText, linkType === type && styles.broadcastLinkTypeBtnTextActive]}>
                      {labelMap[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>

            {linkType === "PAGE" && (
              <Box style={styles.broadcastLinkPageContainer}>
                <Text style={styles.broadcastLinkSubLabel}>{t("admin.broadcastSelectPageLabel")}</Text>
                <Box style={styles.broadcastPageOptions}>
                  {PAGE_OPTIONS.filter((p) => p.value).map((page) => (
                    <Pressable
                      key={page.value}
                      style={[styles.broadcastPageOption, navigateTo === page.value && styles.broadcastPageOptionActive]}
                      onPress={() => {
                        setNavigateTo(page.value);
                        setNavigateParam("");
                      }}
                    >
                      <Text style={[styles.broadcastPageOptionText, navigateTo === page.value && styles.broadcastPageOptionTextActive]}>
                        {page.label}
                      </Text>
                    </Pressable>
                  ))}
                </Box>

                {navigateTo && (
                  <Box style={styles.broadcastLinkParamContainer}>
                    {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel ? (
                      <>
                        <Text style={styles.broadcastLinkSubLabel}>
                          {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel}
                        </Text>
                        <Input
                          style={styles.broadcastInput}
                          placeholder={t("admin.broadcastParamPlaceholder")}
                          placeholderTextColor={theme.colors.gray300}
                          value={navigateParam}
                          onChangeText={setNavigateParam}
                          variant="outline"
                          size="md"
                        />
                      </>
                    ) : (
                      <Text style={styles.broadcastLinkHint}>{t("admin.broadcastNoParamNeeded")}</Text>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {linkType === "URL" && (
              <Box style={styles.broadcastLinkUrlContainer}>
                <Text style={styles.broadcastLinkSubLabel}>{t("admin.broadcastUrlLabel")}</Text>
                <Input
                  style={styles.broadcastInput}
                  placeholder="https://example.com"
                  placeholderTextColor={theme.colors.gray300}
                  value={externalUrl}
                  onChangeText={setExternalUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  variant="outline"
                  size="md"
                />
                <Text style={styles.broadcastLinkHint}>{t("admin.broadcastUrlHint")}</Text>
              </Box>
            )}
          </VStack>

          {(title || message) && (
            <Box style={styles.broadcastPreview}>
              <Text style={styles.broadcastPreviewLabel}>{t("admin.broadcastPreview")}</Text>
              <HStack style={styles.broadcastPreviewCard}>
                <Box style={styles.broadcastPreviewIcon}>
                  <Ionicons name="notifications" size={20} color={theme.colors.white} />
                </Box>
                <Box style={styles.broadcastPreviewContent}>
                  <Text style={styles.broadcastPreviewTitle} numberOfLines={1}>{title || t("admin.broadcastNotifTitle")}</Text>
                  <Text style={styles.broadcastPreviewMessage} numberOfLines={2}>{message || t("admin.broadcastNotifContent")}</Text>
                  {linkType !== "NONE" && (
                    <HStack style={styles.broadcastPreviewLink}>
                      <Ionicons name={linkType === "URL" ? "open-outline" : "chevron-forward"} size={14} color={theme.colors.accent} />
                      <Text style={styles.broadcastPreviewLinkText} numberOfLines={1}>{getLinkDescription()}</Text>
                    </HStack>
                  )}
                </Box>
              </HStack>
            </Box>
          )}

          <Pressable
            style={[styles.broadcastSendButton, (!title.trim() || !message.trim() || loading) && styles.broadcastSendButtonDisabled]}
            onPress={handleSend}
            disabled={!title.trim() || !message.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={theme.colors.white} />
                <Text style={styles.broadcastSendButtonText}>{t("admin.broadcastSendAll")}</Text>
              </>
            )}
          </Pressable>

          {result && (
            <Box style={styles.broadcastResultCard}>
              <Text style={styles.broadcastResultTitle}>{t("admin.broadcastLastResult")}</Text>
              <HStack style={styles.broadcastResultRow}>
                <Box style={styles.broadcastResultItem}>
                  <Text style={styles.broadcastResultNumber}>{result.successCount}</Text>
                  <Text style={styles.broadcastResultLabel}>{t("common.success")}</Text>
                </Box>
                <Box style={styles.broadcastResultItem}>
                  <Text style={[styles.broadcastResultNumber, { color: theme.colors.error }]}>{result.failCount}</Text>
                  <Text style={styles.broadcastResultLabel}>{t("common.failed")}</Text>
                </Box>
                <Box style={styles.broadcastResultItem}>
                  <Text style={styles.broadcastResultNumber}>{result.totalUsers}</Text>
                  <Text style={styles.broadcastResultLabel}>{t("admin.broadcastTotalUsers")}</Text>
                </Box>
              </HStack>
            </Box>
          )}

          <HStack style={styles.broadcastTips}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.gray400} />
            <Text style={styles.broadcastTipsText}>
              {t("admin.broadcastTips")}
            </Text>
          </HStack>
        </VStack>
      </Box>
      <Box style={{ height: 40 }} />
    </ScrollView>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: {
    flex: 1,
    padding: t.spacing.md,
  },
  broadcastContainer: {
    padding: t.spacing.lg,
  },
  broadcastHeader: {
    alignItems: "center",
    marginBottom: t.spacing.xl,
    paddingVertical: t.spacing.lg,
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.lg,
  },
  broadcastHeaderTitle: {
    ...t.typography.h3,
    color: t.colors.text,
    marginTop: t.spacing.md,
  },
  broadcastHeaderSubtitle: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
    marginTop: t.spacing.xs,
    textAlign: "center",
  },
  broadcastForm: {
    gap: t.spacing.lg,
  },
  broadcastInputGroup: {
    gap: t.spacing.xs,
  },
  broadcastLabel: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "600",
  },
  broadcastInput: {
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    ...t.typography.body,
    color: t.colors.text,
    backgroundColor: t.colors.card,
  },
  broadcastTextarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  broadcastCharCount: {
    ...t.typography.caption,
    color: t.colors.gray300,
    textAlign: "right",
  },
  broadcastLinkTypeRow: {
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  broadcastLinkTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    backgroundColor: t.colors.card,
  },
  broadcastLinkTypeBtnActive: {
    backgroundColor: t.colors.text,
    borderColor: t.colors.text,
  },
  broadcastLinkTypeBtnText: {
    ...t.typography.caption,
    color: t.colors.text,
    fontWeight: "500",
  },
  broadcastLinkTypeBtnTextActive: {
    color: t.colors.textInverted,
  },
  broadcastLinkPageContainer: {
    marginTop: t.spacing.md,
    padding: t.spacing.md,
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.md,
  },
  broadcastLinkSubLabel: {
    ...t.typography.caption,
    color: t.colors.gray500,
    fontWeight: "600",
    marginBottom: t.spacing.sm,
  },
  broadcastPageOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.xs,
  },
  broadcastPageOption: {
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    backgroundColor: t.colors.card,
  },
  broadcastPageOptionActive: {
    backgroundColor: t.colors.text,
    borderColor: t.colors.text,
  },
  broadcastPageOptionText: {
    ...t.typography.caption,
    color: t.colors.text,
  },
  broadcastPageOptionTextActive: {
    color: t.colors.textInverted,
  },
  broadcastLinkParamContainer: {
    marginTop: t.spacing.md,
  },
  broadcastLinkHint: {
    ...t.typography.caption,
    color: t.colors.gray300,
    marginTop: t.spacing.xs,
    fontStyle: "italic",
  },
  broadcastLinkUrlContainer: {
    marginTop: t.spacing.md,
    padding: t.spacing.md,
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.md,
  },
  broadcastPreview: {
    marginTop: t.spacing.md,
  },
  broadcastPreviewLabel: {
    ...t.typography.caption,
    color: t.colors.gray400,
    marginBottom: t.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  broadcastPreviewCard: {
    alignItems: "flex-start",
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: t.colors.text,
  },
  broadcastPreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginRight: t.spacing.sm,
  },
  broadcastPreviewContent: {
    flex: 1,
  },
  broadcastPreviewTitle: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "600",
  },
  broadcastPreviewMessage: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
    marginTop: 2,
  },
  broadcastPreviewLink: {
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  broadcastPreviewLinkText: {
    ...t.typography.caption,
    color: t.colors.accent,
  },
  broadcastSendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },
  broadcastSendButtonDisabled: {
    backgroundColor: t.colors.gray300,
  },
  broadcastSendButtonText: {
    ...t.typography.body,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  broadcastResultCard: {
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.lg,
    marginTop: t.spacing.lg,
  },
  broadcastResultTitle: {
    ...t.typography.caption,
    color: t.colors.gray400,
    textAlign: "center",
    marginBottom: t.spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  broadcastResultRow: {
    justifyContent: "space-around",
  },
  broadcastResultItem: {
    alignItems: "center",
  },
  broadcastResultNumber: {
    ...t.typography.h2,
    color: t.colors.text,
  },
  broadcastResultLabel: {
    ...t.typography.caption,
    color: t.colors.gray400,
  },
  broadcastTips: {
    alignItems: "flex-start",
    gap: t.spacing.sm,
    backgroundColor: t.colors.gray50,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginTop: t.spacing.lg,
  },
  broadcastTipsText: {
    ...t.typography.caption,
    color: t.colors.gray400,
    flex: 1,
    lineHeight: 18,
  },
});

export default BroadcastTab;
