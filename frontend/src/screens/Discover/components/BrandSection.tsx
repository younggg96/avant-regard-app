import React, { useState, useEffect, useCallback } from "react";
import { FlatList, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable, OptimizedImage } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../store/authStore";
import {
  unfollowBrand,
  getFollowingBrands,
  FollowingBrand,
} from "../../../services/followService";

const CARD_WIDTH = 180;
const IMAGE_SIZE = 40;

export const BrandSection: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [brands, setBrands] = useState<FollowingBrand[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBrands = useCallback(async () => {
    if (!user?.userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await getFollowingBrands(user.userId);
      setBrands(result);
    } catch (error) {
      console.error("Failed to load following brands:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleUnfollow = useCallback(
    async (brandId: number) => {
      if (!user?.userId) return;
      setBrands((prev) => prev.filter((b) => b.brandId !== brandId));
      try {
        await unfollowBrand({ userId: user.userId, brandId });
      } catch (error) {
        console.error("Unfollow brand failed:", error);
        loadBrands();
      }
    },
    [user?.userId, loadBrands]
  );

  const handleBrandPress = useCallback(
    (brandName: string) => {
      (navigation as any).navigate("BrandDetail", { name: brandName });
    },
    [navigation]
  );

  const handleViewAll = useCallback(() => {
    (navigation as any).navigate("Main", { screen: "Archive" });
  }, [navigation]);

  const formatFollowerCount = (count: number): string => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  if (loading) {
    return (
      <Box h={50} justifyContent="center" alignItems="center">
        <ActivityIndicator size="small" color={theme.colors.gray400} />
      </Box>
    );
  }

  if (brands.length === 0) {
    return (
      <Box pt={14} pb={10} bg="$white" borderBottomWidth={1} borderBottomColor="#F0F0F0">
        <HStack px="$md" mb={10}>
          <Text fontSize="$sm" fontWeight="$bold" color="$gray400">
            {t("discover.followedBrands")}
          </Text>
        </HStack>
        <Pressable
          onPress={handleViewAll}
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          mx="$md"
          py={14}
          rounded="$lg"
          bg="#FAFAFA"
          borderWidth={1}
          borderColor="#F0F0F0"
          sx={{ borderStyle: "dashed" }}
          gap={8}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.gray400} />
          <Text fontSize={13} fontWeight="$medium" color="$gray400">
            {t("discover.goDiscoverBrands")}
          </Text>
        </Pressable>
      </Box>
    );
  }

  const dataWithViewAll = [...brands, null];

  return (
    <Box pt={14} pb={10} bg="$white" borderBottomWidth={1} borderBottomColor="#F0F0F0">
      <HStack px="$md" mb={10} gap={6}>
        <Text fontSize="$sm" fontWeight="$bold" color="$gray400">
          {t("discover.followedBrands")}
        </Text>
        <Text fontSize="$xs" fontWeight="$semibold" color="$gray400">
          {brands.length}
        </Text>
      </HStack>

      <FlatList
        data={dataWithViewAll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        keyExtractor={(item, index) =>
          item ? String(item.brandId) : "view-all"
        }
        renderItem={({ item }) => {
          if (!item) {
            return (
              <Pressable
                onPress={handleViewAll}
                w={100}
                rounded="$md"
                bg="#FAFAFA"
                borderWidth={1}
                borderColor="#F0F0F0"
                sx={{ borderStyle: "dashed" }}
                px={10}
                py={10}
                justifyContent="center"
                alignItems="center"
                gap={6}
              >
                <Box
                  w={IMAGE_SIZE}
                  h={IMAGE_SIZE}
                  rounded={IMAGE_SIZE / 2}
                  bg="#F0F0F0"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Ionicons name="grid-outline" size={18} color={theme.colors.black} />
                </Box>
                <Text fontSize={13} fontWeight="$semibold" color="$black">
                  {t("discover.all")}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              onPress={() => handleBrandPress(item.name)}
              w={CARD_WIDTH}
              rounded="$lg"
              bg="#FAFAFA"
              borderWidth={1}
              borderColor="#F0F0F0"
              px={10}
              py={10}
            >
              <HStack alignItems="center" gap={10}>
                {item.coverImage ? (
                  <OptimizedImage
                    uri={item.coverImage}
                    size={ImageSize.THUMBNAIL}
                    style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: IMAGE_SIZE / 2 }}
                    contentFit="cover"
                    lazy={true}
                  />
                ) : (
                  <Box
                    w={IMAGE_SIZE}
                    h={IMAGE_SIZE}
                    rounded={IMAGE_SIZE / 2}
                    bg="$black"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text fontSize="$md" fontWeight="$bold" color="$white">
                      {item.name?.charAt(0)?.toUpperCase() || "B"}
                    </Text>
                  </Box>
                )}

                <Box flex={1}>
                  <Text fontSize={13} fontWeight="$semibold" color="$black" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text fontSize={11} color="$gray400" mt={2}>
                    {formatFollowerCount(item.followersCount)} {t("discover.followersLabel")}
                  </Text>
                </Box>
              </HStack>

              <Pressable
                onPress={() => handleUnfollow(item.brandId)}
                mt={8}
                py={5}
                rounded={6}
                bg="#F0F0F0"
                alignItems="center"
              >
                <Text fontSize={11} fontWeight="$semibold" color="$gray600">
                  {t("discover.following")}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </Box>
  );
};

export default BrandSection;
