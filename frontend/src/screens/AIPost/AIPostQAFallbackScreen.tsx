/**
 * AI 发帖助手 Q4 fallback — 当指定秀场没有 look 数据时的文字输入兜底。
 *
 * 用户填一句对细节的描述,提交后等价于 Q4 的"未知 look"答案,
 * 后端 RAG 会把这段文字喂给 LLM,而不会编造 look_id。
 */

import React, { useState } from "react";
import { Alert, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, Button, ButtonText, ScrollView, Text, VStack } from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import StepProgressBar from "./components/StepProgressBar";
import type { QAAnswers } from "../../services/aiPostService";

interface RouteParams {
  answers: QAAnswers;
}

const MAX_CHARS = 100;

const AIPostQAFallbackScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { answers } = route.params;
  const [text, setText] = useState("");

  const handleNext = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert(t("aiPost.qa.fallbackEmpty"));
      return;
    }
    navigation.replace("AIPostQAStep", {
      step: 5,
      answers: { ...answers, look_fallback_text: trimmed, look_id: null },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.qa.headerTitle", { step: 4, total: 5 })}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <VStack px="$lg" pt="$md" pb="$xl" gap="$md">
          <Text fontSize="$xl" fontWeight="$medium" color="$black">
            {t("aiPost.qa.fallbackTitle")}
          </Text>
          <Text fontSize="$sm" color="$gray500">
            {t("aiPost.qa.fallbackHint")}
          </Text>

          <Box
            borderWidth={1}
            borderColor="$gray100"
            rounded="$md"
            p="$md"
            bg="$white"
          >
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
              placeholder={t("aiPost.qa.fallbackPlaceholder") as string}
              placeholderTextColor={theme.colors.gray200}
              multiline
              style={styles.input}
            />
            <Text
              fontSize="$xs"
              color="$gray300"
              alignSelf="flex-end"
              mt="$xs"
            >
              {text.length}/{MAX_CHARS}
            </Text>
          </Box>

          <Button onPress={handleNext} bg="$black" rounded="$md">
            <ButtonText color="$white">{t("common.next")}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>

      <StepProgressBar current={4} total={5} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  input: {
    minHeight: 100,
    fontSize: 15,
    color: theme.colors.gray500,
    textAlignVertical: "top",
  },
});

export default AIPostQAFallbackScreen;
