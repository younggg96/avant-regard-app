import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { apiClient } from "@avant-regard/core/src/api/client";
import { theme } from "../theme";
import RunwayShowCard from "../components/RunwayShowCard";
import FilterBar from "../components/FilterBar";

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feed", filters],
    queryFn: () => apiClient.getFeed(filters),
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderFeedItem = (item: any) => {
    switch (item.type) {
      case "lookbook":
        return (
          <RunwayShowCard
            key={item.data.id}
            lookbook={item.data}
            onPress={() =>
              navigation.navigate("LookbookDetail", { id: item.data.id })
            }
          />
        );
      // Add more cases for other feed item types
      default:
        return null;
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.black} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AVANT REGARD</Text>
        <Text style={styles.headerSubtitle}>Fashion Archive</Text>
      </View>

      <FilterBar onFilterChange={setFilters} filters={filters} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
      >
        {data?.data?.map((item) => renderFeedItem(item))}

        {(!data?.data || data.data.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No content yet</Text>
            <Text style={styles.emptyText}>
              Follow designers to see their latest collections
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.white,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerTitle: {
    ...theme.typography.hero,
    color: theme.colors.black,
    letterSpacing: 2,
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  emptyState: {
    paddingVertical: theme.spacing.xxl * 2,
    alignItems: "center",
  },
  emptyTitle: {
    ...theme.typography.h2,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
    paddingHorizontal: theme.spacing.xl,
  },
});

export default DiscoverScreen;
