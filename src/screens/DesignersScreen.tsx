import React, { useState } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { apiClient } from "@avant-regard/core/src/api/client";
import { Designer } from "@avant-regard/core/src/types";
import { theme } from "../theme";

const DesignersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: designers, isLoading } = useQuery({
    queryKey: ["designers"],
    queryFn: () => apiClient.getDesigners(),
  });

  // Group designers by first letter
  const groupedDesigners = React.useMemo(() => {
    if (!designers?.data) return [];

    const filtered = designers.data.filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped = filtered.reduce((acc, designer) => {
      const letter = designer.letterIndex || designer.name[0].toUpperCase();
      if (!acc[letter]) {
        acc[letter] = [];
      }
      acc[letter].push(designer);
      return acc;
    }, {} as Record<string, Designer[]>);

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, data]) => ({
        title: letter,
        data,
      }));
  }, [designers, searchQuery]);

  const renderDesigner = ({ item }: { item: Designer }) => (
    <TouchableOpacity
      style={styles.designerItem}
      onPress={() => navigation.navigate("DesignerDetail", { id: item.id })}
    >
      <View style={styles.designerContent}>
        <Text style={styles.designerName}>{item.name}</Text>
        {item.aliases && item.aliases.length > 0 && (
          <Text style={styles.designerAliases}>{item.aliases.join(" / ")}</Text>
        )}
        <Text style={styles.designerCountry}>{item.country}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DESIGNERS</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search designers..."
          placeholderTextColor={theme.colors.gray300}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <SectionList
        sections={groupedDesigners}
        keyExtractor={(item) => item.id}
        renderItem={renderDesigner}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.black,
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontFamily: __DEV__ ? "System" : "Inter-Bold",
    letterSpacing: 1,
  },
  designerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  designerContent: {
    flex: 1,
  },
  designerName: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: 2,
  },
  designerAliases: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontStyle: "italic",
  },
  designerCountry: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 2,
  },
  arrow: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.gray100,
    marginLeft: theme.spacing.md,
  },
});

export default DesignersScreen;
