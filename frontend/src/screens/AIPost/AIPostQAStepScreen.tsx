/**
 * AI 发帖助手 5 步问答 — 通用步骤屏幕。
 *
 * 路由参数: { step: 1..5, answers: Partial<QAAnswers> }
 *
 * 每步逻辑由 STEP_CONFIG 驱动:
 *   - title: 顶部问句 (i18n key)
 *   - field: 把选中 id 写到 answers 的哪个字段
 *   - fetch: 拉选项接口
 *   - next: 下一步路由
 *   - fallbackTo: 接口返回 has_fallback=true 时改跳转到的路由
 *
 * 选完即跳下一步,不需要"下一步"按钮。Q5 选完跳预览页 + 调 generate。
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
import { Box, HStack, Text, VStack, ScrollView } from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import OptionCard from "./components/OptionCard";
import StepProgressBar from "./components/StepProgressBar";
import {
  getStylesOptions,
  getDesignersOptions,
  getShowsOptions,
  getLooksOptions,
  getPerspectivesOptions,
  type OptionListResponse,
  type QAAnswers,
} from "../../services/aiPostService";

type StepKey = 1 | 2 | 3 | 4 | 5;

interface RouteParams {
  step: StepKey;
  answers: QAAnswers;
}

interface StepConfig {
  titleKey: string;
  field: keyof QAAnswers;
  fetch: (answers: QAAnswers) => Promise<OptionListResponse>;
  /** 选完后下一步 (5 = 跳到 Preview)。 */
  nextRoute: string;
  /** 后端 has_fallback=true 时改跳哪条路由。 */
  fallbackRoute?: string;
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
    field: "designer_id",
    fetch: (a) => getDesignersOptions(a.style_id!),
    nextRoute: "AIPostQAStep",
  },
  3: {
    titleKey: "aiPost.qa.step3Title",
    field: "show_id",
    fetch: (a) => getShowsOptions(a.designer_id!),
    nextRoute: "AIPostQAStep",
  },
  4: {
    titleKey: "aiPost.qa.step4Title",
    field: "look_id",
    fetch: (a) => getLooksOptions(a.show_id!),
    nextRoute: "AIPostQAStep",
    // 后端无 look 时 has_fallback=true → 进文字输入屏
    fallbackRoute: "AIPostQAFallback",
  },
  5: {
    titleKey: "aiPost.qa.step5Title",
    field: "perspective",
    fetch: () => getPerspectivesOptions(),
    nextRoute: "AIPostPreview",
  },
};

const TOTAL_STEPS = 5;

const AIPostQAStepScreen: React.FC = () => {
  const { t } = useTranslation();
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
        // 命中 fallback (例如 Q4 无 look) → 立刻跳到 fallback 屏
        if (res.has_fallback && config.fallbackRoute) {
          navigation.replace(config.fallbackRoute, { answers });
        }
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

  const handlePick = (chosenId: number, chosenSlug?: string | null) => {
    // perspective 用 slug (枚举字符串),其他用 id
    const value: any = config.field === "perspective" ? chosenSlug : chosenId;
    const nextAnswers = { ...answers, [config.field]: value } as QAAnswers;

    if (step === 5) {
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

  // 2 列等宽布局
  const cardRows = useMemo(() => {
    if (!data) return [];
    const rows: Array<typeof data.options> = [];
    for (let i = 0; i < data.options.length; i += 2) {
      rows.push(data.options.slice(i, i + 2));
    }
    return rows;
  }, [data]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.qa.headerTitle", { step, total: TOTAL_STEPS })}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <VStack px="$lg" pt="$md" pb="$xl" gap="$md">
          <Text fontSize="$xl" fontWeight="$medium" color="$black">
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
            cardRows.map((row, rowIdx) => (
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
            ))
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
});

export default AIPostQAStepScreen;
