/**
 * AI 发帖助手 4 步问答 — 通用步骤屏幕。
 *
 * 路由参数: { step: 1..4, answers: Partial<QAAnswers> }
 *
 * 每步逻辑由 STEP_CONFIG 驱动:
 *   - title: 顶部问句 (i18n key)
 *   - field: 把选中 id 写到 answers 的哪个字段
 *   - fetch: 拉选项接口
 *   - next: 下一步路由
 *
 * 选完即跳下一步,不需要"下一步"按钮。Q4 选完跳预览页 + 调 generate。
 *
 * 历史: V3 原本是 5 步 (含 Q4 Look 选图),但秀场 look 图覆盖率低,
 * 即便走 fallback 文字输入对最终文案帮助也有限,反而打断流程,
 * 因此整步移除,只保留 style/brand/show/perspective 4 步。
 */

import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, HStack, Text, VStack, ScrollView, Pressable } from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import OptionCard from "./components/OptionCard";
import StepProgressBar from "./components/StepProgressBar";
import {
  getStylesOptions,
  getBrandsOptions,
  getShowsOptions,
  getPerspectivesOptions,
  type OptionListResponse,
  type QAAnswers,
} from "../../services/aiPostService";

type StepKey = 1 | 2 | 3 | 4;

interface RouteParams {
  step: StepKey;
  answers: QAAnswers;
}

interface StepConfig {
  titleKey: string;
  field: keyof QAAnswers;
  fetch: (answers: QAAnswers) => Promise<OptionListResponse>;
  /** 选完后下一步 (4 = 跳到 Preview)。 */
  nextRoute: string;
}

const STEP_CONFIG: Record<StepKey, StepConfig> = {
  1: {
    titleKey: "aiPost.qa.step1Title",
    field: "style_id",
    fetch: () => getStylesOptions(),
    nextRoute: "AIPostQAStep",
  },
  2: {
    titleKey: "aiPost.qa.step2Title",
    field: "brand_id",
    fetch: (a) => getBrandsOptions(a.style_id!),
    nextRoute: "AIPostQAStep",
  },
  3: {
    titleKey: "aiPost.qa.step3Title",
    field: "show_id",
    fetch: (a) => getShowsOptions(a.brand_id!),
    nextRoute: "AIPostQAStep",
  },
  4: {
    titleKey: "aiPost.qa.step4Title",
    field: "perspective",
    fetch: () => getPerspectivesOptions(),
    nextRoute: "AIPostPreview",
  },
};

const TOTAL_STEPS = 4;

const AIPostQAStepScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { step, answers } = route.params;

  const config = STEP_CONFIG[step];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OptionListResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  }, [step]);

  const handlePick = (
    chosenId: number | string,
    chosenSlug?: string | null,
  ) => {
    // perspective 用 slug (枚举字符串),其他用 id (id 可能是 ObjectId 字符串,见 OptionCard 注释)
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

  const isListLayout = step === 4;

  const cardRows = useMemo(() => {
    if (!data || isListLayout) return [];
    const rows: Array<typeof data.options> = [];
    for (let i = 0; i < data.options.length; i += 2) {
      rows.push(data.options.slice(i, i + 2));
    }
    return rows;
  }, [data, isListLayout]);

  const isZh = i18n.language?.startsWith("zh");

  const renderOptions = () => {
    if (!data) return null;

    if (isListLayout) {
      return (
        <Box mt="$md" borderTopWidth={1} borderColor="$gray100" rounded="$md" overflow="hidden">
          {data.options.map((card) => {
            const displayName = isZh && card.name_zh ? card.name_zh : card.name;
            const subtitle = isZh && card.name_zh ? card.name : card.name_zh || card.subtitle;
            return (
              <Pressable key={card.id} onPress={() => handlePick(card.id, card.slug)}>
                <HStack
                  alignItems="center"
                  justifyContent="space-between"
                  px="$md"
                  py="$md"
                  bg="$white"
                  borderBottomWidth={1}
                  borderColor="$gray100"
                >
                  <Box flex={1}>
                    <Text fontSize="$md" fontWeight="$medium" color="$black" numberOfLines={1}>
                      {displayName}
                    </Text>
                    {subtitle ? (
                      <Text fontSize="$xs" color="$gray400" mt={2} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </Box>
                  <Text fontSize="$md" color="$gray300" ml="$sm">›</Text>
                </HStack>
              </Pressable>
            );
          })}
        </Box>
      );
    }

    return (
      <VStack gap="$md" mt="$md">
        {cardRows.map((row, rowIdx) => (
          <HStack key={rowIdx} gap="$md">
            {row.map((card) => (
              <OptionCard
                key={card.id}
                data={card}
                onPress={() => handlePick(card.id, card.slug)}
              />
            ))}
            {row.length === 1 ? <Box flex={1} /> : null}
          </HStack>
        ))}
      </VStack>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.qa.headerTitle", { step, total: TOTAL_STEPS })}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <VStack px="$lg" pt="$md" pb="$xl">
          <Text fontSize="$xl" fontWeight="$medium" color="$black" style={styles.textHero}>
            {t(config.titleKey)}
          </Text>

          {loading ? (
            <Box alignItems="center" py="$xl">
              <ActivityIndicator color={theme.colors.black} />
            </Box>
          ) : errorMsg ? (
            <Box p="$md" bg="$gray100" rounded="$md">
              <Text fontSize="$sm" color="$gray500">
                {errorMsg}
              </Text>
            </Box>
          ) : data && data.options.length === 0 ? (
            <Box p="$md" bg="$gray100" rounded="$md">
              <Text fontSize="$sm" color="$gray500">
                {t("aiPost.qa.noOptions")}
              </Text>
            </Box>
          ) : (
            renderOptions()
          )}
        </VStack>
      </ScrollView>

      <StepProgressBar current={step} total={TOTAL_STEPS} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  textHero: {
    lineHeight: 32,
  },
});

export default AIPostQAStepScreen;
