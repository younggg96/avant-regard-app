import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, VStack, HStack } from "../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

interface PublishType {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}

const PublishTypeScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);

  const publishTypes: PublishType[] = [
    {
      // AI 发帖助手 (V3 #25) — 放在第一张, 鼓励首贴用户走 AI 引导。
      // 实际生成、配额、社区选择都在 AIPost stack 内部, 与普通发帖完全隔离。
      id: "ai_post",
      title: t("aiPost.entryCard.qaTitle"),
      description: t("aiPost.entryCard.qaDesc"),
      icon: "sparkles",
      color: "#000000",
      route: "AIPostEntry",
    },
    {
      id: "forum",
      title: t("publish.typeForumTitle"),
      description: t("publish.typeForumDesc"),
      icon: "chatbubbles",
      color: "#000000",
      route: "PublishForumPost",
    },
    {
      id: "lookbook",
      title: t("publish.typeLookbookTitle"),
      description: t("publish.typeLookbookDesc"),
      icon: "albums",
      color: "#000000",
      route: "PublishLookbook",
    },
    {
      id: "outfit",
      title: t("publish.typeOutfitTitle"),
      description: t("publish.typeOutfitDesc"),
      icon: "shirt",
      color: "#000000",
      route: "PublishOutfit",
    },
    {
      id: "review",
      title: t("publish.typeReviewTitle"),
      description: t("publish.typeReviewDesc"),
      icon: "star",
      color: "#000000",
      route: "PublishReview",
    },
    {
      id: "store",
      title: t("publish.typeStoreTitle"),
      description: t("publish.typeStoreDesc"),
      icon: "storefront",
      color: "#000000",
      route: "SubmitStore",
    },
  ];

  const handleSelectType = (type: PublishType) => {
    // @ts-ignore - navigation types
    navigation.replace(type.route);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("publish.selectType")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <VStack px="$lg" py="$lg" gap="$md">
          <Box mb="$md">
            <Text fontSize="$lg" fontWeight="$medium" style={{ color: theme.colors.black }} mb="$xs">
              {t("publish.createContent")}
            </Text>
            <Text fontSize="$sm" style={{ color: theme.colors.gray500 }}>
              {t("publish.selectTypeHint")}
            </Text>
          </Box>

          {publishTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => handleSelectType(type)}
              style={[{ backgroundColor: theme.colors.white }, { borderColor: theme.colors.gray100 }]}
              borderWidth={1}

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
                  style={{ backgroundColor: theme.colors.gray100 }}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons
                    name={type.icon}
                    size={28}
                    color={theme.colors.black}
                  />
                </Box>

                <VStack flex={1}>
                  <Text
                    fontSize="$lg"
                    fontWeight="$medium"
                    style={{ color: theme.colors.black }}
                    mb="$xs"
                  >
                    {type.title}
                  </Text>
                  <Text fontSize="$sm" style={{ color: theme.colors.gray500 }}>
                    {type.description}
                  </Text>
                </VStack>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.gray400}
                />
              </HStack>
            </Pressable>
          ))}
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

export default PublishTypeScreen;
