/**
 * AI 发帖助手 — 预览/编辑屏幕 (V3 #25.4)。
 *
 * 路由参数:
 *   { mode: "QA_TEXT" | "IMAGE_BRIEF",
 *     answers: QAAnswers | ImageBriefAnswers,
 *     imageUrls?: string[] }
 *
 * 进入时第一件事调 `generate` 拿草稿,本地编辑标题 + 正文 + 选择社区。
 *   - 重新生成: 调 `regenerate(log_id)`,每天 ≤ 3 次。
 *   - 删除: 直接 navigation.popToTop() 回到 PublishType。
 *   - 继续编辑: 不直接发帖, 而是把草稿打包成 `aiDraft` 路由参数,
 *     navigation.replace 跳到对应基础发布屏 (Outfit/Lookbook/Review/Forum),
 *     由基础屏负责让用户补完类型独有字段后 createPost。
 *
 * 目标类型 (target post type) 由 perspective / promptChip 自动选,
 * 用户可以点 "更换" 在 ActionSheet 里改成另外 3 种之一。
 *
 * 错误分支:
 *   - 配额超限: Alert + 禁用按钮
 *   - 图片审核拦截: Alert 列出被拦截下标,引导回退到 ImageBrief 屏改图
 *   - LLM 失败: Alert + 提供"重新生成"按钮 (仍计入 quota)
 */

import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput } from "react-native";
import { Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActionSheet,
  Box,
  HStack,
  Pressable,
  ScrollView,
  Text,
  VStack,
  type ActionSheetAction,
} from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import QuotaBadge from "./components/QuotaBadge";
import { useAuthStore } from "../../store/authStore";
import {
  generate,
  regenerate as apiRegenerate,
  translateAIPostError,
  AIPostErrorCode,
  AI_POST_TARGET_ROUTES,
  pickTargetPostType,
  type GenerateRequest,
  type GenerateResponse,
  type AIPostMode,
  type AIPostTargetPostType,
  type AIDraftPrefill,
  type QuotaInfo,
} from "../../services/aiPostService";

interface RouteParams {
  mode: AIPostMode;
  answers: Record<string, unknown>;
  imageUrls?: string[];
}

const AIPostPreviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { mode, answers, imageUrls } = route.params;
  const userId = useAuthStore((s) => s.user?.userId);

  // 生成相关状态
  const [generating, setGenerating] = useState(true);
  const [generatedResp, setGeneratedResp] = useState<GenerateResponse | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // 用户编辑后的内容
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // AI 推荐的首选社区 id, 仅作为下一屏 (基础发布屏) 的默认值透传出去,
  // 这一屏不再展示社区选择 (V3 #25.4): 选社区是基础类型流程的事。
  const [suggestedCommunityId, setSuggestedCommunityId] = useState<number | null>(null);

  const [publishing, setPublishing] = useState(false);

  // 目标基础类型: 由 perspective / promptChip 自动选, 用户可改
  const [targetType, setTargetType] = useState<AIPostTargetPostType>(() =>
    pickTargetPostType({
      perspective: (answers as any)?.perspective ?? null,
      promptChip: (answers as any)?.prompt_chip ?? null,
    }),
  );
  const [showTypeSheet, setShowTypeSheet] = useState(false);

  // 1. 进入页面: 触发 generate (社区列表已不在本屏使用, 不再额外拉取)
  useEffect(() => {
    void runGenerate();
  }, []);

  const runGenerate = async (regen = false) => {
    setGenerating(true);
    try {
      const req: GenerateRequest = {
        mode,
        answers: answers as any,
        image_urls: imageUrls || [],
      };
      const resp = regen && generatedResp
        ? await apiRegenerate(generatedResp.log_id)
        : await generate(req);
      setGeneratedResp(resp);
      setQuota(resp.quota);
      const meta = resp.metadata as any;
      setTitle(meta?.title || "");
      const body = stripTitleFromBody(resp.generated_text, meta?.title || "");
      setContent(body);
      // 记下 AI 推荐的首选社区 id, 透传给下一屏 (基础发布屏) 当默认选中。
      if (resp.suggested_communities[0]) {
        setSuggestedCommunityId(resp.suggested_communities[0].id);
      }
    } catch (err) {
      const friendly = translateAIPostError(err);
      handleGenerateError(friendly.code, friendly.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateError = (code: string, message: string) => {
    if (code === AIPostErrorCode.IMAGE_BLOCKED) {
      RNAlert.alert(t("aiPost.error.imageBlockedTitle"), message, [
        {
          text: t("common.confirm"),
          onPress: () => navigation.goBack(),
        },
      ]);
      return;
    }
    if (code === AIPostErrorCode.QUOTA_EXCEEDED) {
      RNAlert.alert(t("aiPost.error.quotaTitle"), t("aiPost.error.quotaBody"), [
        { text: t("common.confirm"), onPress: () => navigation.popToTop() },
      ]);
      return;
    }
    RNAlert.alert(t("aiPost.error.llmTitle"), message);
  };

  const handleRegenerate = () => {
    if (!quota) return;
    if (quota.daily_regen_used >= quota.daily_regen_limit) {
      RNAlert.alert(t("aiPost.error.regenLimitTitle"), t("aiPost.error.regenLimitBody"));
      return;
    }
    RNAlert.alert(
      t("aiPost.preview.regenerateConfirmTitle"),
      t("aiPost.preview.regenerateConfirmBody", {
        remaining: quota.daily_regen_limit - quota.daily_regen_used,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), onPress: () => runGenerate(true) },
      ],
    );
  };

  const handleDelete = () => {
    RNAlert.alert(
      t("aiPost.preview.deleteConfirmTitle"),
      t("aiPost.preview.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => navigation.popToTop(),
        },
      ],
    );
  };

  /**
   * 「继续编辑」: 不直接发帖, 把 AI 草稿打包成 aiDraft 跳到目标基础发布屏。
   * 用户在那里补完类型独有字段 (穿搭单品 / lookbook 多图 / 测评评分 / 论坛 contentBlocks)
   * 后再走基础屏的 createPost(generatedByAi=true)。
   */
  const handleContinueEdit = () => {
    if (!userId) {
      RNAlert.alert(t("aiPost.preview.loginRequired"));
      return;
    }
    if (!generatedResp) return;
    if (!title.trim() || !content.trim()) {
      RNAlert.alert(t("aiPost.preview.contentRequired"));
      return;
    }

    setPublishing(true);
    const aiDraft: AIDraftPrefill = {
      title: title.trim(),
      contentText: content.trim(),
      imageUrls: imageUrls || [],
      suggestedCommunityId: suggestedCommunityId ?? undefined,
      suggestedTags: generatedResp.suggested_tags,
      generationMetadata: generatedResp.metadata,
    };
    // navigation.replace 把 AI 流程闭合, 用户在基础屏返回时直接回到 PublishType,
    // 不再退回 AI 预览 (避免重复消耗 quota / 与基础屏 state 冲突)。
    navigation.replace(AI_POST_TARGET_ROUTES[targetType], { aiDraft });
  };

  const targetTypeLabel = (type: AIPostTargetPostType) =>
    t(`aiPost.preview.targetType.${type}`);

  const typeSheetActions: ActionSheetAction[] = useMemo(
    () =>
      (Object.keys(AI_POST_TARGET_ROUTES) as AIPostTargetPostType[]).map(
        (type) => ({
          label: targetTypeLabel(type) + (type === targetType ? "  ✓" : ""),
          onPress: () => setTargetType(type),
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetType, t],
  );

  // 如果 generated_text 头部就是 title,正文里去掉重复的 title
  const stripTitleFromBody = (text: string, title: string): string => {
    if (!title) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith(title)) {
      return trimmed.slice(title.length).trim();
    }
    return trimmed;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.preview.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightComponent={<QuotaBadge quota={quota} variant="regenerate" />}
      />

      {generating && !generatedResp ? (
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator color={theme.colors.black} size="large" />
          <Text mt="$md" fontSize="$sm" color="$gray400">
            {t("aiPost.preview.generating")}
          </Text>
        </Box>
      ) : (
        <>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <VStack px="$lg" pt="$md" pb="$xl" gap="$md">
              {/* 标题 */}
              <Box>
                <Text fontSize="$sm" color="$gray400" mb="$xs">
                  {t("aiPost.preview.titleLabel")}
                </Text>
                <Box
                  borderWidth={1}
                  borderColor="$gray100"
                  rounded="$md"
                  p="$md"
                >
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("aiPost.preview.titlePlaceholder") as string}
                    placeholderTextColor={theme.colors.gray200}
                    style={styles.titleInput}
                    maxLength={80}
                  />
                </Box>
              </Box>

              {/* 正文 */}
              <Box>
                <Text fontSize="$sm" color="$gray400" mb="$xs">
                  {t("aiPost.preview.contentLabel")}
                </Text>
                <Box
                  borderWidth={1}
                  borderColor="$gray100"
                  rounded="$md"
                  p="$md"
                  minHeight={200}
                >
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    multiline
                    placeholder={t("aiPost.preview.contentPlaceholder") as string}
                    placeholderTextColor={theme.colors.gray200}
                    style={styles.contentInput}
                  />
                </Box>
              </Box>

              {/* 标签 / 社区在这里不再展示:
                * - tags: 当前帖子模型还没把 tag 字段透到 createPost,展示出来反而误导;
                * - community: 用户在下一屏 (基础发布屏) 才真正选社区。
                * 但 AI 仍然会把 suggested_tags / suggested_communities 通过 aiDraft
                * 透传给基础屏, 由基础屏决定怎么用 (例如默认选中推荐社区)。
                */}

              {/* 目标基础类型展示条 + 更换入口 */}
              <Pressable
                onPress={() => setShowTypeSheet(true)}
                style={styles.targetTypeRow}
              >
                <Box style={styles.targetTypeIcon}>
                  <Ionicons
                    name={
                      targetType === "OUTFIT"
                        ? "shirt-outline"
                        : targetType === "LOOKBOOK"
                          ? "albums-outline"
                          : targetType === "REVIEW"
                            ? "star-outline"
                            : "chatbubbles-outline"
                    }
                    size={18}
                    color={theme.colors.black}
                  />
                </Box>
                <VStack flex={1} ml="$sm">
                  <Text fontSize="$xs" color="$gray400">
                    {t("aiPost.preview.targetType.label")}
                  </Text>
                  <Text fontSize="$sm" fontWeight="$medium" color="$black">
                    {targetTypeLabel(targetType)}
                  </Text>
                </VStack>
                <HStack alignItems="center" gap="$xs">
                  <Text fontSize="$xs" color="$black">
                    {t("aiPost.preview.targetType.change")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.black}
                  />
                </HStack>
              </Pressable>
            </VStack>
          </ScrollView>
          </KeyboardAvoidingView>

          {/* 底部操作栏: 视觉层级 = 次要(丢弃 ghost) < 次要(重新生成 outline) < 主要(发布 solid CTA) */}
          <HStack
            px="$lg"
            py="$md"
            gap="$sm"
            borderTopWidth={1}
            borderTopColor="$gray100"
            bg="$white"
            alignItems="center"
          >
            <Pressable
              onPress={handleDelete}
              disabled={publishing}
              style={[styles.btnGhost, publishing && styles.btnDisabled]}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={theme.colors.gray500}
              />
              <Text
                fontSize="$sm"
                fontWeight="$medium"
                color="$gray500"
                ml="$xs"
              >
                {t("aiPost.preview.delete")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRegenerate}
              disabled={generating || publishing}
              style={[
                styles.btnOutline,
                (generating || publishing) && styles.btnDisabled,
              ]}
            >
              {generating ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.gray500}
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={theme.colors.black}
                />
              )}
              <Text
                fontSize="$sm"
                fontWeight="$medium"
                color="$black"
                ml="$xs"
                numberOfLines={1}
              >
                {t("aiPost.preview.regenerate")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleContinueEdit}
              disabled={publishing || generating}
              style={[
                styles.btnPrimary,
                (publishing || generating) && styles.btnPrimaryDisabled,
              ]}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={theme.colors.white}
                  />
                  <Text
                    fontSize="$sm"
                    fontWeight="$semibold"
                    color="$white"
                    ml="$xs"
                    numberOfLines={1}
                  >
                    {t("aiPost.preview.continueEdit")}
                  </Text>
                </>
              )}
            </Pressable>
          </HStack>
        </>
      )}

      <ActionSheet
        visible={showTypeSheet}
        onClose={() => setShowTypeSheet(false)}
        title={t("aiPost.preview.targetType.sheetTitle")}
        actions={typeSheetActions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  titleInput: {
    fontSize: 17,
    fontWeight: "500",
    color: theme.colors.black,
  },
  contentInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.gray500,
    minHeight: 180,
    textAlignVertical: "top",
  },
  // -- 底部操作栏: 三档视觉层级 --
  // 丢弃: ghost, 文字按钮, 占地最小, 防误触放最左
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  // 重新生成: outline, 次操作, 与丢弃同列但带 border 强调可点
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  // 发布: 主 CTA, 黑底白字 + flex=1.6 抢视觉重量
  btnPrimary: {
    flex: 1.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.black,
  },
  btnPrimaryDisabled: {
    backgroundColor: theme.colors.gray400,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  // 目标基础类型展示条
  targetTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.gray100,
  },
  targetTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.white,
  },
});

export default AIPostPreviewScreen;
