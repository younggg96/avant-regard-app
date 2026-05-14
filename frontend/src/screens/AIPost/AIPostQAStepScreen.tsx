/**
 * AI 发帖助手 4 步问答 — 编辑式布局 (V3 #25.5)。
 *
 * 路由参数: { step: 1..4, answers: Partial<QAAnswers> }
 *
 * 与 V3 #25 的两列大卡相比, 本版改成杂志列表风格:
 *   - 顶部 EditorialHeader (AI STUDIO 品牌 + 1/4 页码胶囊 + 配额徽章)
 *   - 中部 EditorialHero (Playfair 大标题 + zh 副标 + 灰色描述)
 *   - 列表用 OptionListRow, 每步指定 thumbnail 形状:
 *       Q1 风格    → circle + 序号
 *       Q2 品牌    → square portrait
 *       Q3 秀场    → square portrait
 *       Q4 角度    → icon-only 圆 (5 选 1, 描述当 chips)
 *   - 列表底部 AIInsightCard, 视觉收口
 *
 * 历史 (V3 #25): 5 步 → 4 步 (移除 Look 选图), 因秀场 look 覆盖率低。
 * 本次仅改视觉/布局, 4 步问答的步骤组成、配额逻辑、generate 调用均保持不变。
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, Text, ScrollView, VStack } from "../../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../theme";
import EditorialHeader from "./components/EditorialHeader";
import EditorialHero from "./components/EditorialHero";
import OptionListRow, {
  type OptionListThumbVariant,
} from "./components/OptionListRow";
import AIInsightCard from "./components/AIInsightCard";
import QuotaBadge from "./components/QuotaBadge";
import {
  getStylesOptions,
  getBrandsOptions,
  getShowsOptions,
  getPerspectivesOptions,
  getQuota,
  type OptionCard,
  type OptionListResponse,
  type QAAnswers,
  type QuotaInfo,
} from "../../services/aiPostService";

type StepKey = 1 | 2 | 3 | 4;

interface RouteParams {
  step: StepKey;
  answers: QAAnswers;
}

interface StepConfig {
  field: keyof QAAnswers;
  fetch: (answers: QAAnswers) => Promise<OptionListResponse>;
  thumbVariant: OptionListThumbVariant;
  /** 是否在卡片左侧显示数字 01/02/...; 仅 Q1 风格步打开 */
  showIndex: boolean;
  /** Q4 角度步: 没有 cover_url 也没有 description, 用 i18n 的人话替代 */
  perspectiveCopyKey?: (slug: string) => string;
  hero: { titleEnKey: string; titleZhKey: string; descriptionKey: string };
}

const STEP_CONFIG: Record<StepKey, StepConfig> = {
  1: {
    field: "style_id",
    fetch: () => getStylesOptions(),
    thumbVariant: "circle",
    showIndex: true,
    hero: {
      titleEnKey: "aiPost.studio.step1.titleEn",
      titleZhKey: "aiPost.studio.step1.titleZh",
      descriptionKey: "aiPost.studio.step1.description",
    },
  },
  2: {
    field: "brand_id",
    fetch: (a) => getBrandsOptions(a.style_id!),
    thumbVariant: "square",
    showIndex: false,
    hero: {
      titleEnKey: "aiPost.studio.step2.titleEn",
      titleZhKey: "aiPost.studio.step2.titleZh",
      descriptionKey: "aiPost.studio.step2.description",
    },
  },
  3: {
    field: "show_id",
    fetch: (a) => getShowsOptions(a.brand_id!),
    thumbVariant: "square",
    showIndex: false,
    hero: {
      titleEnKey: "aiPost.studio.step3.titleEn",
      titleZhKey: "aiPost.studio.step3.titleZh",
      descriptionKey: "aiPost.studio.step3.description",
    },
  },
  4: {
    field: "perspective",
    fetch: () => getPerspectivesOptions(),
    thumbVariant: "icon",
    showIndex: false,
    perspectiveCopyKey: (slug) => `aiPost.studio.perspective.${slug}`,
    hero: {
      titleEnKey: "aiPost.studio.step4.titleEn",
      titleZhKey: "aiPost.studio.step4.titleZh",
      descriptionKey: "aiPost.studio.step4.description",
    },
  },
};

const TOTAL_STEPS = 4;

const AIPostQAStepScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const styles = useThemedStyles(makeStyles);
  const { step, answers } = route.params;

  const config = STEP_CONFIG[step];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OptionListResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // 用 useFocusEffect: 用户从 Preview 屏 goBack 回到本屏时, daily_count
  // 已变, 这里跟 AIPostEntryScreen 同样的语义重拉一次配额, 避免徽章过期。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getQuota()
        .then((r) => {
          if (!cancelled) setQuota(r.quota);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    config
      .fetch(answers)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setErrorMsg(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handlePick = (
    chosenId: number | string,
    chosenSlug?: string | null,
  ) => {
    // perspective 用 slug (枚举字符串), 其他用 id (id 可能是 ObjectId 字符串)
    const value: any = config.field === "perspective" ? chosenSlug : chosenId;
    const nextAnswers = { ...answers, [config.field]: value } as QAAnswers;

    if (step === TOTAL_STEPS) {
      navigation.replace("AIPostPreview", {
        mode: "QA_TEXT",
        answers: nextAnswers,
      });
    } else {
      navigation.push("AIPostQAStep", {
        step: (step + 1) as StepKey,
        answers: nextAnswers,
      });
    }
  };

  /** Q4 角度卡: 后端返回的 OptionCard 没图也没 description, 这里覆写 description
   *  为 i18n 提供的人话, 让 OptionListRow 自然展示。 */
  const decorateForRender = (card: OptionCard): OptionCard => {
    if (!config.perspectiveCopyKey || !card.slug) return card;
    const desc = t(config.perspectiveCopyKey(card.slug));
    return { ...card, description: card.description || desc };
  };

  const perspectiveIcon = (slug?: string | null) => {
    switch (slug) {
      case "OUTFIT":
        return "shirt-outline" as const;
      case "COLLECTION":
        return "albums-outline" as const;
      case "REVIEW":
        return "star-outline" as const;
      case "RANT":
        return "flame-outline" as const;
      case "INSPIRATION":
      default:
        return "sparkles-outline" as const;
    }
  };

  const renderedRows = useMemo(() => {
    if (!data) return null;
    return data.options.map((card, idx) => {
      const decorated = decorateForRender(card);
      const isLast = idx === data.options.length - 1;
      return (
        <OptionListRow
          key={`${card.id}-${idx}`}
          data={decorated}
          variant={config.thumbVariant}
          index={config.showIndex ? idx + 1 : 0}
          iconName={
            config.thumbVariant === "icon"
              ? perspectiveIcon(card.slug)
              : undefined
          }
          showDivider={!isLast}
          onPress={() => handlePick(card.id, card.slug)}
        />
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, config]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <EditorialHeader
        current={step}
        total={TOTAL_STEPS}
        onBack={() => navigation.goBack()}
        rightComponent={<QuotaBadge quota={quota} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <EditorialHero
          titleEn={t(config.hero.titleEnKey)}
          titleZh={t(config.hero.titleZhKey)}
          description={t(config.hero.descriptionKey)}
        />

        {loading ? (
          <Box alignItems="center" py="$xl">
            <ActivityIndicator color={theme.colors.black} />
          </Box>
        ) : errorMsg ? (
          <Box mx="$lg" my="$md" p="$md" style={{ backgroundColor: theme.colors.gray100 }} rounded="$md">
            <Text fontSize="$xs" style={{ color: theme.colors.gray500 }}>
              {errorMsg}
            </Text>
          </Box>
        ) : data && data.options.length === 0 ? (
          <Box mx="$lg" my="$md" p="$md" style={{ backgroundColor: theme.colors.gray100 }} rounded="$md">
            <Text fontSize="$xs" style={{ color: theme.colors.gray500 }}>
              {t("aiPost.qa.noOptions")}
            </Text>
          </Box>
        ) : (
          <VStack mt="$xs">{renderedRows}</VStack>
        )}

        <AIInsightCard />
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
  });

export default AIPostQAStepScreen;
