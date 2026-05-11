import React from "react";
import { Dimensions, StyleSheet, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable, OptimizedImage } from "./ui";
import { ImageSize } from "../utils/imageUtils";
import { playfairFonts, theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

export interface SelectedBrand {
  id: number;
  name: string;
  coverImage?: string;
  category?: string;
  country?: string;
}

interface BrandGridSelectorProps {
  selectedBrands: SelectedBrand[];
  onBrandPress: (brand: SelectedBrand, index: number) => void;
  onRemoveBrand: (index: number) => void;
  onAddBrand: () => void;
  maxBrands?: number;
  label?: string;
  required?: boolean;
}

const BrandGridSelector: React.FC<BrandGridSelectorProps> = ({
  selectedBrands,
  onBrandPress,
  onRemoveBrand,
  onAddBrand,
  maxBrands = 6,
  label,
  required = false,
}) => {
  const { t } = useTranslation();
  const displayLabel = label || t("publish.linkBrand");
  const brandWidth = (screenWidth - 48 - 16) / 3;
  const brandHeight = brandWidth * 1.2;

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text
          color="$gray600"
          fontSize="$sm"
          style={{ fontFamily: playfairFonts.regular }}
        >
          {displayLabel}
        </Text>
        {required && (
          <Text
            color="$red500"
            fontSize="$sm"
            ml="$xs"
            style={{ fontFamily: playfairFonts.regular }}
          >
            *
          </Text>
        )}
      </HStack>

      <HStack flexWrap="wrap" gap="$sm" pl="$sm">
        {selectedBrands.map((brand, index) => (
          <View key={`brand-${index}`} style={{ width: brandWidth, position: "relative" }}>
            <TouchableOpacity
              style={[styles.brandCard, { height: brandHeight }]}
              onPress={() => onBrandPress(brand, index)}
              activeOpacity={0.8}
            >
              {brand.coverImage ? (
                <OptimizedImage
                  uri={brand.coverImage}
                  size={ImageSize.THUMBNAIL}
                  style={styles.brandImage}
                  contentFit="cover"
                  lazy={true}
                />
              ) : (
                <View style={styles.brandPlaceholder}>
                  <Text
                    fontSize={16}
                    color="$gray400"
                    textAlign="center"
                    style={{ fontFamily: playfairFonts.bold }}
                  >
                    {brand.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.brandInfo}>
                <Text
                  fontSize={11}
                  color="$black"
                  numberOfLines={1}
                  style={{ textAlign: "center", fontFamily: playfairFonts.bold }}
                >
                  {brand.name}
                </Text>
                {brand.category && (
                  <Text
                    fontSize={10}
                    style={{
                      color: theme.colors.gray500,
                      marginTop: 2,
                      textAlign: "center",
                      fontFamily: playfairFonts.regular,
                    }}
                    numberOfLines={1}
                  >
                    {brand.category}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={22}
              h={22}
              rounded="$sm"
              bg="rgba(0,0,0,0.7)"
              alignItems="center"
              justifyContent="center"
              onPress={() => onRemoveBrand(index)}
            >
              <Ionicons name="close" size={12} color={theme.colors.white} />
            </Pressable>
          </View>
        ))}

        {selectedBrands.length < maxBrands && (
          <Pressable
            w={brandWidth}
            h={brandHeight}
            rounded="$md"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            onPress={onAddBrand}
          >
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={theme.colors.gray400}
            />
            <Text
              color="$gray400"
              fontSize="$sm"
              mt="$xs"
              style={{ fontFamily: playfairFonts.regular }}
            >
              {t("brandSelector.addBrand")}
            </Text>
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  brandCard: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: theme.colors.gray100,
  },
  brandImage: {
    width: "100%",
    height: "70%",
    backgroundColor: theme.colors.gray100,
  },
  brandPlaceholder: {
    width: "100%",
    height: "70%",
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  brandInfo: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
});

export default BrandGridSelector;
