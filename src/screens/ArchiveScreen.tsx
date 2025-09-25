import React, { useState } from "react";
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

interface Designer {
  id: string;
  name: string;
  brand: string;
  nationality: string;
  birthYear: string;
  avatarUrl: string;
  coverUrl: string;
  description: string;
  famous_works: string[];
  style: "classic" | "avant-garde" | "minimalist" | "romantic" | "streetwear";
  isActive: boolean;
  followersCount: number;
}

const DesignersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  // Mock designers data (matching API client data)
  const designers: Designer[] = [
    {
      id: "designer-3",
      name: "Maison Margiela",
      brand: "Martin Margiela / MMM",
      nationality: "France",
      birthYear: "1988",
      avatarUrl: "https://via.placeholder.com/150x150",
      coverUrl: "https://via.placeholder.com/300x200",
      description: "解构主义时装屋，以概念性和艺术性设计著称",
      famous_works: ["解构设计", "白色标签", "概念时装"],
      style: "avant-garde",
      isActive: true,
      followersCount: 980000,
    },
    {
      id: "designer-2",
      name: "Rei Kawakubo",
      brand: "川久保玲",
      nationality: "Japan",
      birthYear: "1942",
      avatarUrl: "https://via.placeholder.com/150x150",
      coverUrl: "https://via.placeholder.com/300x200",
      description: "COMME des GARÇONS创始人，解构主义先锋",
      famous_works: ["COMME des GARÇONS", "解构设计", "黑色系列"],
      style: "avant-garde",
      isActive: true,
      followersCount: 1250000,
    },
    {
      id: "designer-1",
      name: "Yohji Yamamoto",
      brand: "Y.Y. / 山本耀司",
      nationality: "Japan",
      birthYear: "1943",
      avatarUrl: "https://via.placeholder.com/150x150",
      coverUrl: "https://via.placeholder.com/300x200",
      description: "日本著名时装设计师，以黑色和宽松剪裁著称",
      famous_works: ["Yohji Yamamoto", "Y-3", "黑色美学"],
      style: "avant-garde",
      isActive: true,
      followersCount: 1100000,
    },
  ];

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
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.designerInfo}>
                  <Text style={styles.designerName}>{designer.name}</Text>
                  <Text style={styles.designerBrand}>{designer.brand}</Text>
                  <Text style={styles.designerCountry}>
                    {designer.nationality}
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
  designerCountry: {
    ...theme.typography.caption,
    fontSize: 13,
    color: theme.colors.gray400,
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

export default DesignersScreen;
