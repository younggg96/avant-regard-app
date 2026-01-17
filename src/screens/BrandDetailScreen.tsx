import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { brandService, Brand } from "../services/brandService";
import { showService, Show } from "../services/showService";

const { width: screenWidth } = Dimensions.get("window");

interface RouteParams {
  id?: string;
  name?: string;
  brandId?: string;
  brandName?: string;
}

const BrandDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as RouteParams;

  // Handle different param formats
  const brandId = params.id || params.brandId;
  const brandName = params.name || params.brandName;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandShows, setBrandShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载品牌和秀场数据
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loadedBrand: Brand | null = null;

      // 通过 ID 或名称获取品牌
      if (brandId) {
        loadedBrand = await brandService.getBrandById(parseInt(brandId));
      } else if (brandName) {
        loadedBrand = await brandService.getBrandByName(brandName);
      }

      if (!loadedBrand) {
        setError("未找到品牌信息");
        return;
      }

      setBrand(loadedBrand);

      // 获取该品牌的秀场
      const shows = await showService.getShowsByBrand(loadedBrand.name);
      setBrandShows(shows);
    } catch (err) {
      console.error("Failed to load brand data:", err);
      setError("加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }, [brandId, brandName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleWebsitePress = useCallback(async () => {
    if (brand?.website) {
      try {
        await Linking.openURL(brand.website);
      } catch (error) {
        console.log("Failed to open website:", error);
      }
    }
  }, [brand]);

  const handleVoguePress = useCallback(async () => {
    if (brand?.vogueUrl) {
      try {
        await Linking.openURL(brand.vogueUrl);
      } catch (error) {
        console.log("Failed to open Vogue URL:", error);
      }
    }
  }, [brand]);

  const handleShowPress = useCallback(
    (show: Show) => {
      // Navigate to CollectionDetail
      (navigation.navigate as any)("CollectionDetail", {
        collection: {
          id: show.showUrl,
          title: show.brand,
          season: show.season,
          year: show.year?.toString() || "",
          coverImage: show.coverImage,
          imageCount: 0,
          showUrl: show.showUrl,
        },
        brandName: show.brand,
      });
    },
    [navigation]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !brand) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.gray400}
          />
          <Text style={styles.errorText}>{error || "未找到设计师信息"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const coverImage = brand.coverImage || brandShows[0]?.coverImage;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.placeholderCover]}>
              <Text style={styles.placeholderInitial}>
                {brand.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.heroGradient}
          />
          <SafeAreaView style={styles.heroContent} edges={["top"]}>
            <TouchableOpacity
              style={styles.backButtonHero}
              onPress={handleBack}
            >
              <View style={styles.backButtonCircle}>
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={theme.colors.white}
                />
              </View>
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <Text style={styles.brandName}>{brand.name}</Text>
            {brand.latestSeason && (
              <Text style={styles.latestSeason}>{brand.latestSeason}</Text>
            )}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {/* Quick Info */}
          <View style={styles.quickInfo}>
            {brand.country && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>{brand.country}</Text>
              </View>
            )}
            {brand.foundedYear && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>创立于 {brand.foundedYear}</Text>
              </View>
            )}
            {brand.category && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>{brand.category}</Text>
              </View>
            )}
          </View>

          {/* Founder */}
          {brand.founder && (
            <View style={styles.founderSection}>
              <Text style={styles.sectionLabel}>创始人/设计师</Text>
              <Text style={styles.founderName}>{brand.founder}</Text>
            </View>
          )}

          {/* Links */}
          <View style={styles.linksSection}>
            {brand.website && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleWebsitePress}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.linkText}>官方网站</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            )}
            {brand.vogueUrl && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleVoguePress}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.linkText}>Vogue 专页</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Shows Section */}
        {brandShows.length > 0 && (
          <View style={styles.showsSection}>
            <Text style={styles.sectionTitle}>秀场</Text>
            <Text style={styles.showsCount}>{brandShows.length} 场秀</Text>

            <View style={styles.showsGrid}>
              {brandShows.map((show, index) => (
                <TouchableOpacity
                  key={`${show.showUrl}-${index}`}
                  style={styles.showCard}
                  onPress={() => handleShowPress(show)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: show.coverImage }}
                    style={styles.showImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.6)"]}
                    style={styles.showGradient}
                  />
                  <View style={styles.showInfo}>
                    <Text style={styles.showSeason} numberOfLines={1}>
                      {show.season}
                    </Text>
                    <Text style={styles.showCategory}>{show.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State for Shows */}
        {brandShows.length === 0 && (
          <View style={styles.emptyShows}>
            <Ionicons
              name="images-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyText}>暂无时装秀数据</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray400,
    fontFamily: "Inter-Regular",
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray500,
    fontFamily: "Inter-Regular",
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: "Inter-Medium",
  },
  // Hero Section
  heroSection: {
    width: screenWidth,
    height: 320,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  placeholderCover: {
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 80,
    color: theme.colors.gray300,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  heroContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  backButtonHero: {
    margin: 16,
    alignSelf: "flex-start",
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroInfo: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },
  brandName: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 32,
    color: theme.colors.white,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  latestSeason: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  // Info Section
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: theme.colors.gray500,
  },
  founderSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: theme.colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  founderName: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    color: theme.colors.black,
  },
  linksSection: {
    gap: 12,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  linkText: {
    flex: 1,
    fontFamily: "Inter-Medium",
    fontSize: 15,
    color: theme.colors.black,
  },
  // Shows Section
  showsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 22,
    color: theme.colors.black,
    marginBottom: 4,
  },
  showsCount: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: theme.colors.gray400,
    marginBottom: 16,
  },
  showsGrid: {
    gap: 16,
  },
  showCard: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  showImage: {
    width: "100%",
    height: "100%",
  },
  showGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  showInfo: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  showSeason: {
    fontFamily: "Inter-Bold",
    fontSize: 16,
    color: theme.colors.white,
  },
  showCategory: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  // Empty State
  emptyShows: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: "Inter-Regular",
    fontSize: 15,
    color: theme.colors.gray400,
    marginTop: 12,
  },
});

export default BrandDetailScreen;
