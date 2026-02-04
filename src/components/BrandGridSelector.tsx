import React from "react";
import { Dimensions, StyleSheet, View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable } from "./ui";
import { theme } from "../theme";

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
  label = "关联品牌",
  required = false,
}) => {
  const brandWidth = (screenWidth - 48 - 16) / 3;
  const brandHeight = brandWidth * 1.2;

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text color="$gray600" fontSize="$sm">
          {label}
        </Text>
        {required && (
          <Text color="$red500" fontSize="$sm" ml="$xs">
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
                <Image
                  source={{ uri: brand.coverImage }}
                  style={styles.brandImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.brandPlaceholder}>
                  <Text
                    fontFamily="Inter-Bold"
                    fontSize={16}
                    color="$gray400"
                    textAlign="center"
                  >
                    {brand.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.brandInfo}>
                <Text
                  fontFamily="Inter-Bold"
                  fontSize={11}
                  color="$black"
                  numberOfLines={1}
                  style={{ textAlign: "center" }}
                >
                  {brand.name}
                </Text>
                {brand.category && (
                  <Text
                    fontFamily="Inter-Regular"
                    fontSize={10}
                    style={{ color: theme.colors.gray500, marginTop: 2, textAlign: "center" }}
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
            <Text color="$gray400" fontSize="$xs" mt="$xs">
              添加品牌
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
