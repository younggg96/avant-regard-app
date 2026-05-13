/**
 * V2 发布流程 · Step 2：选择发布类型（图片优先流程的第二步）
 * ------------------------------------------------------------------
 * 用户已经在 Step 1 选好了一组图片 / 视频，本屏让 ta 选择最终落到哪个
 * 现有发布表单：
 *   - Lookbook（默认选中）
 *   - 穿搭分享 (DAILY_SHARE → PublishOutfit)
 *   - 单品测评 (ITEM_REVIEW → PublishReview)
 *   - 论坛帖子 (ARTICLES → PublishForumPost)
 *
 * 选定后 `navigation.replace` 跳目标屏，并把 `prefilledMedia` 透传过去
 * 让目标屏自动填入 images（与 AI 草稿预填同套机制，互斥）。
 */

import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, Text, ScrollView, VStack, HStack, Pressable } from "../../components/ui";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";

type PublishV2TypeSelectRouteParams = {
  prefilledMedia: string[];
};

type TypeOption = {
  id: "lookbook" | "outfit" | "review" | "forum";
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const PublishV2TypeSelectScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route =
    useRoute<RouteProp<{ params: PublishV2TypeSelectRouteParams }, "params">>();
  const styles = useThemedStyles(makeStyles);

  const prefilledMedia = route.params?.prefilledMedia ?? [];

  const [selected, setSelected] = useState<TypeOption["id"]>("lookbook");

  const options: TypeOption[] = [
    {
      id: "lookbook",
      title: t("publish.typeLookbookTitle"),
      description: t("publish.typeLookbookDesc"),
      icon: "albums",
      route: "PublishLookbook",
    },
    {
      id: "outfit",
      title: t("publish.typeOutfitTitle"),
      description: t("publish.typeOutfitDesc"),
      icon: "shirt",
      route: "PublishOutfit",
    },
    {
      id: "review",
      title: t("publish.typeReviewTitle"),
      description: t("publish.typeReviewDesc"),
      icon: "star",
      route: "PublishReview",
    },
    {
      id: "forum",
      title: t("publish.typeForumTitle"),
      description: t("publish.typeForumDesc"),
      icon: "chatbubbles",
      route: "PublishForumPost",
    },
  ];

  const handleConfirm = () => {
    const target = options.find((o) => o.id === selected);
    if (!target) return;
    // 论坛帖子表单使用 `coverImage` 而非 `images` 数组：取首张作为封面预填，
    // 其余暂不带过去（与现有 AI 草稿对论坛屏的处理一致）。
    if (target.id === "forum") {
      navigation.replace(target.route, {
        prefilledMedia,
      });
      return;
    }
    navigation.replace(target.route, {
      prefilledMedia,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("publishV2.typeSelect.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <VStack px="$lg" py="$lg" gap="$md">
          <Box mb="$xs">
            <Text fontSize="$lg" fontWeight="$medium" color="$black" mb="$xs">
              {t("publishV2.typeSelect.heading")}
            </Text>
            <Text fontSize="$sm" color="$gray500">
              {t("publishV2.typeSelect.subtitle")}
            </Text>
          </Box>

          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelected(option.id)}
                bg="$white"
                borderWidth={1}
                borderColor={isSelected ? "$black" : "$gray100"}
                rounded="$lg"
                p="$lg"
              >
                <HStack alignItems="center" gap="$md">
                  <Box
                    w={48}
                    h={48}
                    rounded="$md"
                    bg="$gray100"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={theme.colors.black}
                    />
                  </Box>

                  <VStack flex={1}>
                    <HStack alignItems="center" gap="$xs" flexWrap="wrap" mb="$xs">
                      <Text
                        fontSize="$md"
                        fontWeight="$medium"
                        color="$black"
                      >
                        {option.title}
                      </Text>
                      {option.id === "lookbook" ? (
                        <Box
                          px="$xs"
                          py={2}
                          rounded="$sm"
                          bg="$gray100"
                          borderWidth={1}
                          borderColor="$gray200"
                        >
                          <Text
                            fontSize="$xs"
                            color="$gray500"
                            fontWeight="$medium"
                          >
                            {t("publishV2.typeSelect.defaultBadge")}
                          </Text>
                        </Box>
                      ) : null}
                    </HStack>
                    <Text fontSize="$sm" color="$gray500">
                      {option.description}
                    </Text>
                  </VStack>

                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={theme.colors.white}
                      />
                    ) : null}
                  </View>
                </HStack>
              </Pressable>
            );
          })}
        </VStack>
      </ScrollView>

      <Box
        px="$lg"
        pt="$md"
        pb="$md"
        borderTopWidth={1}
        borderTopColor="$gray100"
        bg="$white"
      >
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.8}
        >
          <Text color="$white" fontSize="$md" fontWeight="$medium">
            {t("publishV2.typeSelect.confirm")}
          </Text>
        </TouchableOpacity>
      </Box>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.colors.gray300,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    confirmBtn: {
      height: 48,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default PublishV2TypeSelectScreen;
