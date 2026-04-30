import React from "react";
import { View, Text as RNText, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { FollowingBrand } from "../../../services/followService";
import { styles } from "../styles";

interface FollowedBrandsProps {
  brands: FollowingBrand[];
  onBrandPress: (name: string) => void;
}

export const FollowedBrands = ({ brands, onBrandPress }: FollowedBrandsProps) => {
  const { t } = useTranslation();

  if (brands.length === 0) return null;

  return (
    <View style={styles.followedBrandsSection}>
      <View style={styles.followedBrandsHeader}>
        <RNText style={styles.followedBrandsTitle}>{t("profile.followedBrands")}</RNText>
        <RNText style={styles.followedBrandsCount}>{brands.length}</RNText>
      </View>
      <FlatList
        data={brands}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        keyExtractor={(item) => String(item.brandId)}
        renderItem={({ item }) => (
          <Pressable
            style={styles.brandChip}
            onPress={() => onBrandPress(item.name)}
          >
            {item.coverImage ? (
              <OptimizedImage
                uri={item.coverImage}
                size={ImageSize.THUMBNAIL}
                style={styles.brandChipImage}
                contentFit="cover"
                lazy
              />
            ) : (
              <View style={styles.brandChipImagePlaceholder}>
                <RNText style={styles.brandChipInitial}>
                  {item.name?.charAt(0)?.toUpperCase() || "B"}
                </RNText>
              </View>
            )}
            <RNText style={styles.brandChipName} numberOfLines={1}>
              {item.name}
            </RNText>
          </Pressable>
        )}
      />
    </View>
  );
};
