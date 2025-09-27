import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import designersData from "../data/data.json";

interface DesignerData {
  designer: string;
  designer_url: string;
  collections_summary: Array<{
    season: string;
    category: string;
    city: string | null;
    collection_date: string;
    review_title: string;
    review_author: string | null;
    looks_count: number;
  }>;
  shows: Array<{
    show_url: string;
    season: string;
    category: string;
    city: string | null;
    collection_date: string;
    review_title: string;
    review_author: string | null;
    review_text: string | null;
    looks_count: number;
    images: Array<{
      image_url: string;
      image_type: string;
    }>;
  }>;
  show_count: number;
  image_count: number;
}

interface Designer {
  id: string;
  name: string;
  brand: string;
  nationality: string;
  collections: number;
  shows: number;
  totalLooks: number;
  description: string;
  website: string;
  latestSeason: string;
  image?: string;
}

const ArchiveScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [designers, setDesigners] = useState<Designer[]>([]);

  // Convert designers data on component mount
  useEffect(() => {
    const convertedDesigners = (designersData as DesignerData[]).map(
      (data: DesignerData, index) => {
        // Extract brand and designer name from the designer string
        const brandMatch = data.designer.match(/^([^(]+?)(?:\s*\(|$)/);
        const designerMatch = data.designer.match(/\(([^)]+)\)$/);

        const brand = designerMatch
          ? designerMatch[1]
          : brandMatch?.[1]?.trim() || data.designer;
        const name = brandMatch?.[1]?.trim() || data.designer;

        // Calculate total looks across all shows
        const totalLooks = data.shows.reduce(
          (sum, show) => sum + (show.looks_count || 0),
          0
        );

        // Get latest season from shows or collections_summary
        const latestShow = data.shows.length > 0 ? data.shows[0] : null;
        const latestCollection =
          data.collections_summary.length > 0
            ? data.collections_summary[0]
            : null;
        const latestSeason =
          latestShow?.season || latestCollection?.season || "Unknown";

        // Get hero image from the latest show if available
        const heroImage = latestShow?.images?.find(
          (img) => img.image_type === "hero"
        )?.image_url;

        return {
          id: `designer-${index}`,
          name: name,
          brand: brand,
          nationality: "国际", // Default nationality
          collections: data.collections_summary.length,
          shows: data.shows.length,
          totalLooks: totalLooks,
          description: `${brand}的时装设计，以独特的设计理念和创新的时尚视角而闻名。`,
          website: data.designer_url,
          latestSeason: latestSeason,
          image: heroImage,
        };
      }
    );
    setDesigners(convertedDesigners);
  }, []);

  // Filter designers by search query
  const filteredDesigners = designers.filter((designer) => {
    const matchesSearch =
      designer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      designer.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      designer.nationality.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group designers by first letter
  const groupedDesigners = filteredDesigners.reduce((groups, designer) => {
    const firstLetter = designer.name.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(designer);
    return groups;
  }, {} as Record<string, Designer[]>);

  // Sort groups alphabetically
  const sortedGroups = Object.keys(groupedDesigners)
    .sort()
    .map((letter) => ({
      letter,
      designers: groupedDesigners[letter].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="DESIGNERS"
        subtitle="探索时装界的传奇人物"
        boldTitle={true}
        borderless
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search designers..."
          placeholderTextColor={theme.colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Designers List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {sortedGroups.map((group) => (
          <View key={group.letter}>
            {/* Letter Header */}
            <View style={styles.letterHeader}>
              <Text style={styles.letterText}>{group.letter}</Text>
            </View>

            {/* Designers in this group */}
            {group.designers.map((designer) => (
              <TouchableOpacity
                key={designer.id}
                style={styles.designerItem}
                onPress={() => {
                  (navigation.navigate as any)("DesignerDetail", {
                    id: designer.id,
                    name: designer.name,
                  });
                }}
                activeOpacity={0.7}
              >
                {designer.image && (
                  <Image
                    source={{ uri: designer.image }}
                    style={styles.designerImage}
                  />
                )}
                <View style={styles.designerInfo}>
                  <Text style={styles.designerName}>{designer.name}</Text>
                  <Text style={styles.designerBrand}>{designer.brand}</Text>
                  <Text style={styles.designerMeta}>
                    {designer.collections} 个系列 • {designer.shows} 场秀 •{" "}
                    {designer.totalLooks} 个造型
                  </Text>
                  <Text style={styles.designerSeason}>
                    最新: {designer.latestSeason}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {filteredDesigners.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="person-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyTitle}>No designers found</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No designers match your search"
                : "Designers list is being updated"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  searchContainer: {
    padding: theme.spacing.lg,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.typography.body,
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: theme.spacing.lg,
  },
  letterHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  letterText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray400,
    letterSpacing: 1,
  },
  designerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  designerImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
  },
  designerInfo: {
    flex: 1,
  },
  designerName: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: "400",
    color: theme.colors.black,
    marginBottom: 2,
  },
  designerBrand: {
    ...theme.typography.bodySmall,
    fontSize: 14,
    color: theme.colors.gray500,
    marginBottom: 2,
  },
  designerMeta: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  designerSeason: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray500,
    fontStyle: "italic",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
  },
});

export default ArchiveScreen;
