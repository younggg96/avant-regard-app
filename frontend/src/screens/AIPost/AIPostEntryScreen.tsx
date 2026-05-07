/**
 * AI 发帖助手入口 (V3 #25)。
 *
 * 用户从 PublishTypeScreen 「AI 帮我发帖」卡片进来,在这里选两条路:
 *   - 文字问答模式 → AIPostQAStep step 1
 *   - 图片+简述模式 → AIPostImageBrief
 *
 * 顺手把当前配额拉一下,展示在右上角徽章。配额耗尽时禁用入口。
 */

import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, VStack, HStack, ScrollView } from "../../components/ui";
import { theme } from "../../theme";
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
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuota()
      .then((r) => {
        if (!cancelled) setQuota(r.quota);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
        <VStack px="$lg" py="$lg" gap="$md">
          <Box mb="$sm">
            <Text fontSize="$lg" fontWeight="$medium" color="$black" mb="$xs">
              {t("aiPost.entry.heading")}
            </Text>
            <Text fontSize="$sm" color="$gray500">
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
                bg="$white"
                borderWidth={1}
                borderColor="$gray100"
                rounded="$lg"
                p="$lg"
                sx={{
                  shadowColor: "$black",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <HStack alignItems="center" gap="$md">
                  <Box
                    w={56}
                    h={56}
                    rounded="$md"
                    bg="$gray100"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons name={mode.icon} size={28} color={theme.colors.black} />
                  </Box>
                  <VStack flex={1}>
                    <HStack alignItems="center" gap="$xs" mb="$xs" flexWrap="wrap">
                      <Text fontSize="$lg" fontWeight="$medium" color="$black">
                        {mode.title}
                      </Text>
                      {mode.comingSoon ? (
                        <Box
                          px="$xs"
                          py={2}
                          rounded="$sm"
                          bg="$gray100"
                          borderWidth={1}
                          borderColor="$gray200"
                        >
                          <Text fontSize="$xs" color="$gray500" fontWeight="$medium">
                            {t("aiPost.entry.comingSoon")}
                          </Text>
                        </Box>
                      ) : null}
                    </HStack>
                    <Text fontSize="$sm" color="$gray500">
                      {mode.description}
                    </Text>
                  </VStack>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.gray400}
                  />
                </HStack>
              </Pressable>
            );
          })}

          {exhausted ? (
            <Box mt="$md" p="$md" bg="$gray100" rounded="$md">
              <Text fontSize="$sm" color="$gray400">
                {t("aiPost.entry.exhaustedHint")}
              </Text>
            </Box>
          ) : null}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
});

export default AIPostEntryScreen;
