import React from "react";
import {
  View,
  ScrollView as RNScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { Brand } from "@/services/brandService";
import { useThemedStyles, type AppTheme } from "../../theme";

interface RelatedBrandsProps {
  brands: Brand[];
  onBrandPress: (brand: Brand) => void;
}

export const RelatedBrands: React.FC<RelatedBrandsProps> = ({
  brands,
  onBrandPress,
}) => {
  const styles = useThemedStyles(makeStyles);
  if (!brands || brands.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* 标题区域 - 带有精致的分割线 */}
      <View style={styles.headerSection}>
        <View style={styles.headerLine} />
        <Text style={styles.headerTitle}>
          BRANDS
        </Text>
        <View style={styles.headerLine} />
      </View>

      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {brands.map((brand, index) => (
          <TouchableOpacity
            key={`brand-${brand.id || index}`}
            style={styles.brandCard}
            onPress={() => onBrandPress(brand)}
            activeOpacity={0.9}
          >
            {brand.coverImage ? (
              <OptimizedImage
                uri={brand.coverImage}
                size={ImageSize.MEDIUM}
                style={styles.brandImage}
                contentFit="cover"
                lazy={true}
              />
            ) : (
              <View style={styles.brandPlaceholder}>
                <Text style={styles.brandInitials}>
                  {brand.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.brandInfo}>
              <Text style={styles.brandText} numberOfLines={1}>
                {brand.name}
              </Text>
              {brand.category && (
                <Text style={styles.categoryText} numberOfLines={1}>
                  {brand.category}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </RNScrollView>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 20,
    },
    headerSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    headerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.gray100,
    },
    headerTitle: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray300,
      letterSpacing: 3,
      marginHorizontal: 16,
    },
    scrollContent: {
      paddingHorizontal: 20,
    },
    brandCard: {
      width: 120,
      marginRight: 12,
      backgroundColor: t.colors.card,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    brandImage: {
      width: "100%",
      height: 100,
      backgroundColor: t.colors.gray100,
    },
    brandPlaceholder: {
      width: "100%",
      height: 100,
      backgroundColor: t.colors.gray100,
      alignItems: "center",
      justifyContent: "center",
    },
    brandInitials: {
      fontSize: 24,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.gray400,
    },
    brandInfo: {
      padding: 10,
      alignItems: "center",
    },
    brandText: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      letterSpacing: 0.3,
      textAlign: "center",
    },
    categoryText: {
      fontSize: 10,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      marginTop: 2,
      textAlign: "center",
    },
  });
