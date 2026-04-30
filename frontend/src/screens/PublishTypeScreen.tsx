import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, VStack, HStack } from "../components/ui";
import { theme } from "../theme";
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
  const { t } = useTranslation();
  const navigation = useNavigation();

  const publishTypes: PublishType[] = [
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
            <Text fontSize="$lg" fontWeight="$medium" color="$black" mb="$xs">
              {t("publish.createContent")}
            </Text>
            <Text fontSize="$sm" color="$gray500">
              {t("publish.selectTypeHint")}
            </Text>
          </Box>

          {publishTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => handleSelectType(type)}
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
                    color="$black"
                    mb="$xs"
                  >
                    {type.title}
                  </Text>
                  <Text fontSize="$sm" color="$gray500">
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
});

export default PublishTypeScreen;
