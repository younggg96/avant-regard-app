/**
 * AI 发帖助手 — 预览/编辑/发布屏幕。
 *
 * 路由参数:
 *   { mode: "QA_TEXT" | "IMAGE_BRIEF",
 *     answers: QAAnswers | ImageBriefAnswers,
 *     imageUrls?: string[] }
 *
 * 进入时第一件事调 `generate` 拿草稿,本地编辑标题 + 正文 + 选择社区。
 *   - 重新生成: 调 `regenerate(log_id)`,每天 ≤ 3 次。
 *   - 删除: 直接 navigation.popToTop() 回到 PublishType。
 *   - 发布: postService.createPost(generatedByAi=true, generationMetadata=...)
 *
 * 错误分支:
 *   - 配额超限: Alert + 禁用按钮
 *   - 图片审核拦截: Alert 列出被拦截下标,引导回退到 ImageBrief 屏改图
 *   - LLM 失败: Alert + 提供"重新生成"按钮 (仍计入 quota)
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
  Box,
  Button,
  ButtonText,
  HStack,
  Pressable,
  ScrollView,
  Text,
  VStack,
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
  type GenerateRequest,
  type GenerateResponse,
  type AIPostMode,
  type SuggestedCommunity,
  type QuotaInfo,
} from "../../services/aiPostService";
import { createPost } from "../../services/postService";
import {
  getCommunities,
  type Community,
} from "../../services/communityService";

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
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [publishing, setPublishing] = useState(false);

  // 1. 进入页面: 同步触发 generate + 拉社区列表
  useEffect(() => {
    void runGenerate();
    void fetchCommunities();
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
      // 默认选中第一个建议社区
      if (resp.suggested_communities[0] && !selectedCommunityId) {
        setSelectedCommunityId(resp.suggested_communities[0].id);
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

  const fetchCommunities = async () => {
    try {
      const list = await getCommunities();
      // 把热门 + 全部 + 已关注合并去重
      const map = new Map<number, Community>();
      for (const c of [...list.following, ...list.popular, ...list.all]) {
        map.set(c.id, c);
      }
      setAllCommunities(Array.from(map.values()));
    } catch {
      setAllCommunities([]);
    }
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

  const handlePublish = async () => {
    if (!userId) {
      RNAlert.alert(t("aiPost.preview.loginRequired"));
      return;
    }
    if (!generatedResp) return;
    if (!title.trim() || !content.trim()) {
      RNAlert.alert(t("aiPost.preview.contentRequired"));
      return;
    }
    if (!selectedCommunityId) {
      RNAlert.alert(t("aiPost.preview.communityRequired"));
      return;
    }

    setPublishing(true);
    try {
      await createPost({
        userId,
        postType: "ARTICLES",
        postStatus: "PUBLISHED",
        title: title.trim(),
        contentText: content.trim(),
        imageUrls: imageUrls || [],
        communityId: selectedCommunityId,
        generatedByAi: true,
        generationMetadata: generatedResp.metadata,
      });
      RNAlert.alert(t("aiPost.preview.publishSuccess"), "", [
        {
          text: t("common.confirm"),
          onPress: () => navigation.popToTop(),
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.unknownError");
      RNAlert.alert(t("aiPost.preview.publishFailed"), msg);
    } finally {
      setPublishing(false);
    }
  };

  // 如果 generated_text 头部就是 title,正文里去掉重复的 title
  const stripTitleFromBody = (text: string, title: string): string => {
    if (!title) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith(title)) {
      return trimmed.slice(title.length).trim();
    }
    return trimmed;
  };

  const communityOptions = useMemo<SuggestedCommunity[]>(() => {
    // 优先放 LLM 建议的, 其次放全部社区
    if (!generatedResp) return [];
    const suggestedIds = new Set(
      generatedResp.suggested_communities.map((c) => c.id),
    );
    const rest: SuggestedCommunity[] = allCommunities
      .filter((c) => !suggestedIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
    return [...generatedResp.suggested_communities, ...rest];
  }, [generatedResp, allCommunities]);

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
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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

              {/* 标签 (建议) */}
              {generatedResp && generatedResp.suggested_tags.length > 0 ? (
                <Box>
                  <Text fontSize="$sm" color="$gray400" mb="$xs">
                    {t("aiPost.preview.tagsLabel")}
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {generatedResp.suggested_tags.map((tag) => (
                      <Box
                        key={tag}
                        px="$sm"
                        py={4}
                        rounded={12}
                        bg="$gray100"
                      >
                        <Text fontSize="$xs" color="$gray500">{tag}</Text>
                      </Box>
                    ))}
                  </HStack>
                </Box>
              ) : null}

              {/* 社区选择 */}
              <Box>
                <Text fontSize="$sm" color="$gray400" mb="$xs">
                  {t("aiPost.preview.communityLabel")}
                </Text>
                <HStack flexWrap="wrap" gap="$xs">
                  {communityOptions.map((c) => {
                    const selected = c.id === selectedCommunityId;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedCommunityId(c.id)}
                        bg={selected ? "$black" : "$white"}
                        borderWidth={1}
                        borderColor={selected ? "$black" : "$gray100"}
                        px="$sm"
                        py={6}
                        rounded={14}
                      >
                        <Text
                          fontSize="$xs"
                          color={selected ? "$white" : "$gray500"}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </HStack>
              </Box>
            </VStack>
          </ScrollView>

          {/* 底部三个按钮 */}
          <HStack
            px="$lg"
            py="$md"
            gap="$sm"
            borderTopWidth={1}
            borderTopColor="$gray100"
            bg="$white"
          >
            <Button
              flex={1}
              variant="outline"
              borderColor="$gray200"
              onPress={handleDelete}
            >
              <ButtonText color="$gray500">
                {t("aiPost.preview.delete")}
              </ButtonText>
            </Button>
            <Button
              flex={1}
              variant="outline"
              borderColor="$gray200"
              onPress={handleRegenerate}
              disabled={generating}
            >
              <ButtonText color="$gray500">
                {t("aiPost.preview.regenerate")}
              </ButtonText>
            </Button>
            <Button
              flex={1.4}
              bg="$black"
              onPress={handlePublish}
              disabled={publishing || generating}
            >
              <ButtonText color="$white">
                {publishing ? t("common.loading") : t("aiPost.preview.publish")}
              </ButtonText>
            </Button>
          </HStack>
        </>
      )}
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
});

export default AIPostPreviewScreen;
