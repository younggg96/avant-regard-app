import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService, BroadcastNotificationResult } from "../../services/adminService";

const PAGE_OPTIONS = [
  { value: "", label: "请选择页面" },
  { value: "PostDetail", label: "帖子详情", paramLabel: "帖子ID (postId)" },
  { value: "UserProfile", label: "用户主页", paramLabel: "用户ID (userId)" },
  { value: "BrandDetail", label: "品牌详情", paramLabel: "品牌ID (brandId)" },
  { value: "CollectionDetail", label: "秀场详情", paramLabel: "秀场ID (id)" },
  { value: "CommunityDetail", label: "社区详情", paramLabel: "社区ID (communityId)" },
  { value: "StoreDetail", label: "店铺详情", paramLabel: "店铺ID (storeId)" },
  { value: "Discover", label: "发现页", paramLabel: "" },
  { value: "Profile", label: "个人中心", paramLabel: "" },
];

const BroadcastTab = () => {
  const [title, setTitle] = useState("");
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
      return `外部链接: ${externalUrl}`;
    } else if (linkType === "PAGE" && navigateTo) {
      const selectedPage = PAGE_OPTIONS.find((p) => p.value === navigateTo);
      const pageName = selectedPage?.label || navigateTo;
      return navigateParam.trim() ? `跳转到: ${pageName} (${navigateParam})` : `跳转到: ${pageName}`;
    }
    return "无跳转";
  };

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入通知标题");
      return;
    }
    if (!message.trim()) {
      Alert.alert("提示", "请输入通知内容");
      return;
    }
    if (linkType === "URL" && !externalUrl.trim()) {
      Alert.alert("提示", "请输入外部链接地址");
      return;
    }
    if (linkType === "PAGE" && !navigateTo) {
      Alert.alert("提示", "请选择要跳转的页面");
      return;
    }

    const linkDesc = getLinkDescription();
    Alert.alert("确认发送", `确定要向所有用户发送此通知吗？\n\n标题：${title}\n内容：${message}\n${linkDesc}`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定发送",
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
              "发送完成",
              `成功发送：${res.successCount} 人\n失败：${res.failCount} 人\n总用户数：${res.totalUsers} 人`,
              [{
                text: "确定",
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
            Alert.alert("错误", error instanceof Error ? error.message : "发送通知失败");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.broadcastContainer}>
        <View style={styles.broadcastHeader}>
          <Ionicons name="megaphone" size={32} color={theme.colors.black} />
          <Text style={styles.broadcastHeaderTitle}>发送广播通知</Text>
          <Text style={styles.broadcastHeaderSubtitle}>向所有用户发送系统通知和推送消息</Text>
        </View>

        <View style={styles.broadcastForm}>
          <View style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>通知标题 *</Text>
            <TextInput
              style={styles.broadcastInput}
              placeholder="请输入通知标题（最多100字）"
              placeholderTextColor={theme.colors.gray300}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.broadcastCharCount}>{title.length}/100</Text>
          </View>

          <View style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>通知内容 *</Text>
            <TextInput
              style={[styles.broadcastInput, styles.broadcastTextarea]}
              placeholder="请输入通知内容（最多500字）"
              placeholderTextColor={theme.colors.gray300}
              value={message}
              onChangeText={setMessage}
              maxLength={500}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.broadcastCharCount}>{message.length}/500</Text>
          </View>

          <View style={styles.broadcastInputGroup}>
            <Text style={styles.broadcastLabel}>点击跳转（可选）</Text>
            <View style={styles.broadcastLinkTypeRow}>
              {(["NONE", "PAGE", "URL"] as const).map((type) => {
                const iconMap = { NONE: "close-circle-outline", PAGE: "phone-portrait-outline", URL: "link-outline" } as const;
                const labelMap = { NONE: "无跳转", PAGE: "应用内页面", URL: "外部链接" };
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.broadcastLinkTypeBtn, linkType === type && styles.broadcastLinkTypeBtnActive]}
                    onPress={() => setLinkType(type)}
                  >
                    <Ionicons name={iconMap[type]} size={18} color={linkType === type ? theme.colors.white : theme.colors.black} />
                    <Text style={[styles.broadcastLinkTypeBtnText, linkType === type && styles.broadcastLinkTypeBtnTextActive]}>
                      {labelMap[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {linkType === "PAGE" && (
              <View style={styles.broadcastLinkPageContainer}>
                <Text style={styles.broadcastLinkSubLabel}>选择页面</Text>
                <View style={styles.broadcastPageOptions}>
                  {PAGE_OPTIONS.filter((p) => p.value).map((page) => (
                    <TouchableOpacity
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
                    </TouchableOpacity>
                  ))}
                </View>

                {navigateTo && (
                  <View style={styles.broadcastLinkParamContainer}>
                    {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel ? (
                      <>
                        <Text style={styles.broadcastLinkSubLabel}>
                          {PAGE_OPTIONS.find((p) => p.value === navigateTo)?.paramLabel}
                        </Text>
                        <TextInput
                          style={styles.broadcastInput}
                          placeholder="请输入参数值"
                          placeholderTextColor={theme.colors.gray300}
                          value={navigateParam}
                          onChangeText={setNavigateParam}
                        />
                      </>
                    ) : (
                      <Text style={styles.broadcastLinkHint}>此页面无需参数</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {linkType === "URL" && (
              <View style={styles.broadcastLinkUrlContainer}>
                <Text style={styles.broadcastLinkSubLabel}>链接地址</Text>
                <TextInput
                  style={styles.broadcastInput}
                  placeholder="https://example.com"
                  placeholderTextColor={theme.colors.gray300}
                  value={externalUrl}
                  onChangeText={setExternalUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.broadcastLinkHint}>用户点击通知后将在浏览器中打开此链接</Text>
              </View>
            )}
          </View>

          {(title || message) && (
            <View style={styles.broadcastPreview}>
              <Text style={styles.broadcastPreviewLabel}>预览</Text>
              <View style={styles.broadcastPreviewCard}>
                <View style={styles.broadcastPreviewIcon}>
                  <Ionicons name="notifications" size={20} color={theme.colors.white} />
                </View>
                <View style={styles.broadcastPreviewContent}>
                  <Text style={styles.broadcastPreviewTitle} numberOfLines={1}>{title || "通知标题"}</Text>
                  <Text style={styles.broadcastPreviewMessage} numberOfLines={2}>{message || "通知内容"}</Text>
                  {linkType !== "NONE" && (
                    <View style={styles.broadcastPreviewLink}>
                      <Ionicons name={linkType === "URL" ? "open-outline" : "chevron-forward"} size={14} color={theme.colors.accent} />
                      <Text style={styles.broadcastPreviewLinkText} numberOfLines={1}>{getLinkDescription()}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.broadcastSendButton, (!title.trim() || !message.trim() || loading) && styles.broadcastSendButtonDisabled]}
            onPress={handleSend}
            disabled={!title.trim() || !message.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={theme.colors.white} />
                <Text style={styles.broadcastSendButtonText}>发送给所有用户</Text>
              </>
            )}
          </TouchableOpacity>

          {result && (
            <View style={styles.broadcastResultCard}>
              <Text style={styles.broadcastResultTitle}>上次发送结果</Text>
              <View style={styles.broadcastResultRow}>
                <View style={styles.broadcastResultItem}>
                  <Text style={styles.broadcastResultNumber}>{result.successCount}</Text>
                  <Text style={styles.broadcastResultLabel}>成功</Text>
                </View>
                <View style={styles.broadcastResultItem}>
                  <Text style={[styles.broadcastResultNumber, { color: theme.colors.error }]}>{result.failCount}</Text>
                  <Text style={styles.broadcastResultLabel}>失败</Text>
                </View>
                <View style={styles.broadcastResultItem}>
                  <Text style={styles.broadcastResultNumber}>{result.totalUsers}</Text>
                  <Text style={styles.broadcastResultLabel}>总用户</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.broadcastTips}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.gray400} />
            <Text style={styles.broadcastTipsText}>
              广播通知将同时保存到用户的通知列表并发送推送消息。请谨慎使用，避免打扰用户。
            </Text>
          </View>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  broadcastContainer: {
    padding: theme.spacing.lg,
  },
  broadcastHeader: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
  },
  broadcastHeaderTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
  },
  broadcastHeaderSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  broadcastForm: {
    gap: theme.spacing.lg,
  },
  broadcastInputGroup: {
    gap: theme.spacing.xs,
  },
  broadcastLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  broadcastInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.typography.body,
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  broadcastTextarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  broadcastCharCount: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    textAlign: "right",
  },
  broadcastLinkTypeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  broadcastLinkTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  broadcastLinkTypeBtnActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  broadcastLinkTypeBtnText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontWeight: "500",
  },
  broadcastLinkTypeBtnTextActive: {
    color: theme.colors.white,
  },
  broadcastLinkPageContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
  },
  broadcastLinkSubLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  broadcastPageOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  broadcastPageOption: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  broadcastPageOptionActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  broadcastPageOptionText: {
    ...theme.typography.caption,
    color: theme.colors.black,
  },
  broadcastPageOptionTextActive: {
    color: theme.colors.white,
  },
  broadcastLinkParamContainer: {
    marginTop: theme.spacing.md,
  },
  broadcastLinkHint: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: theme.spacing.xs,
    fontStyle: "italic",
  },
  broadcastLinkUrlContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
  },
  broadcastPreview: {
    marginTop: theme.spacing.md,
  },
  broadcastPreviewLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  broadcastPreviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.black,
  },
  broadcastPreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  broadcastPreviewContent: {
    flex: 1,
  },
  broadcastPreviewTitle: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  broadcastPreviewMessage: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: 2,
  },
  broadcastPreviewLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  broadcastPreviewLinkText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  broadcastSendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  broadcastSendButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  broadcastSendButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
  },
  broadcastResultCard: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  broadcastResultTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    textAlign: "center",
    marginBottom: theme.spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  broadcastResultRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  broadcastResultItem: {
    alignItems: "center",
  },
  broadcastResultNumber: {
    ...theme.typography.h2,
    color: theme.colors.black,
  },
  broadcastResultLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  broadcastTips: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  broadcastTipsText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    flex: 1,
    lineHeight: 18,
  },
});

export default BroadcastTab;
