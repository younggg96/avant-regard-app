/**
 * AI 发帖助手入口 (V3 #25)。
 *
 * 用户从 PublishTypeScreen 「AI 帮我发帖」卡片进来,在这里选两条路:
 *   - 文字问答模式 → AIPostQAStep step 1
 *   - 图片+简述模式 → AIPostImageBrief
 *
 * 顺手把当前配额拉一下,展示在右上角徽章。配额耗尽时禁用入口。
 */

import React, { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, VStack, HStack, ScrollView } from "../../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import QuotaBadge from "./components/QuotaBadge";
import { getQuota, type QuotaInfo } from "../../services/aiPostService";

interface ModeCard {
  id: "qa" | "image";
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  comingSoon?: boolean;
}

const AIPostEntryScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // 用 useFocusEffect 而不是 useEffect: 用户在 Preview/QA 屏完成生成后,
  // 后端 daily_count 已变,但本屏可能还在 Stack 缓存里 (例如 navigation.goBack
  // 回到 Entry 而不是 replace)。focus 时重拉一遍配额,保证徽章总是反映最新消耗,
  // 避免「退出再进来还显示原来的剩余次数」。
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

  const exhausted =
    quota != null && quota.daily_generate_used >= quota.daily_generate_limit;

  // 「图片+简述」入口暂时下线,卡片仍展示但标记 Coming soon 并禁用点击。
  const modes: ModeCard[] = [
    {
      id: "qa",
      title: t("aiPost.entry.qaTitle"),
      description: t("aiPost.entry.qaDesc"),
      icon: "chatbubble-ellipses-outline",
      onPress: () =>
        navigation.replace("AIPostQAStep", { step: 1, answers: {} }),
    },
    {
      id: "image",
      title: t("aiPost.entry.imageTitle"),
      description: t("aiPost.entry.imageDesc"),
      icon: "images-outline",
      onPress: () => navigation.replace("AIPostImageBrief"),
      comingSoon: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.entry.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightComponent={<QuotaBadge quota={quota} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <VStack px="$lg" py="$md" gap="$sm">
          <Box mb="$xs">
            <Text fontSize="$md" fontWeight="$medium" style={{ color: theme.colors.black }} mb="$xs">
              {t("aiPost.entry.heading")}
            </Text>
            <Text fontSize="$xs" style={{ color: theme.colors.gray500 }}>
              {t("aiPost.entry.subheading")}
            </Text>
          </Box>

          {modes.map((mode) => {
            const disabled = exhausted || !!mode.comingSoon;
            return (
              <Pressable
                key={mode.id}
                onPress={disabled ? undefined : mode.onPress}
                opacity={disabled ? 0.4 : 1}
                style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray100 }]}
                borderWidth={1}

                rounded="$lg"
                p="$md"
                sx={{
                  shadowColor: "$black",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <HStack alignItems="center" gap="$md">
                  <Box
                    w={40}
                    h={40}
                    rounded="$md"
                    style={{ backgroundColor: theme.colors.gray100 }}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons name={mode.icon} size={20} color={theme.colors.black} />
                  </Box>
                  <VStack flex={1}>
                    <HStack alignItems="center" gap="$xs" mb={2} flexWrap="wrap">
                      <Text fontSize="$sm" fontWeight="$medium" style={{ color: theme.colors.black }}>
                        {mode.title}
                      </Text>
                      {mode.comingSoon ? (
                        <Box
                          px="$xs"
                          py={1}
                          rounded="$sm"
                          style={[{ backgroundColor: theme.colors.gray100 }, { borderColor: theme.colors.gray200 }]}
                          borderWidth={1}

                        >
                          <Text fontSize="$2xs" style={{ color: theme.colors.gray500 }} fontWeight="$medium">
                            {t("aiPost.entry.comingSoon")}
                          </Text>
                        </Box>
                      ) : null}
                    </HStack>
                    <Text fontSize="$xs" style={{ color: theme.colors.gray500 }}>
                      {mode.description}
                    </Text>
                  </VStack>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.gray400}
                  />
                </HStack>
              </Pressable>
            );
          })}

          {exhausted ? (
            <Box mt="$sm" p="$md" style={{ backgroundColor: theme.colors.gray100 }} rounded="$md">
              <Text fontSize="$xs" style={{ color: theme.colors.gray400 }}>
                {t("aiPost.entry.exhaustedHint")}
              </Text>
            </Box>
          ) : null}
        </VStack>
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

export default AIPostEntryScreen;
