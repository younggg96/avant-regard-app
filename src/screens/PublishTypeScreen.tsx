import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
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

const publishTypes: PublishType[] = [
  {
    id: "lookbook",
    title: "发布Lookbook",
    description: "分享时装系列或造型集合",
    icon: "albums",
    color: "#000000",
    route: "PublishLookbook",
  },
  {
    id: "outfit",
    title: "分享搭配",
    description: "展示个人穿搭或搭配建议",
    icon: "shirt",
    color: "#000000",
    route: "PublishOutfit",
  },
  {
    id: "review",
    title: "单品评价",
    description: "对时尚单品进行专业点评",
    icon: "star",
    color: "#000000",
    route: "PublishReview",
  },
  {
    id: "article",
    title: "时尚文章",
    description: "发表时尚观点或趋势分析",
    icon: "document-text",
    color: "#000000",
    route: "PublishArticle",
  },
  {
    id: "store",
    title: "提交买手店",
    description: "分享发现的宝藏买手店",
    icon: "storefront",
    color: "#000000",
    route: "SubmitStore",
  },
];

const PublishTypeScreen = () => {
  const navigation = useNavigation();

  const handleSelectType = (type: PublishType) => {
    // @ts-ignore - navigation types
    navigation.replace(type.route);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="选择发布"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <VStack flex={1} px="$lg" py="$lg" gap="$md">
        <Box mb="$md">
          <Text fontSize="$lg" fontWeight="$medium" color="$black" mb="$xs">
            创作内容
          </Text>
          <Text fontSize="$sm" color="$gray500">
            选择适合您内容的发布类型
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
