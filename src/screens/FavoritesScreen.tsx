import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useFavoriteStore } from "../store/favoriteStore";

const FavoritesScreen = () => {
  const { favorites, removeFavorite } = useFavoriteStore();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FAVORITES</Text>
      </View>

      <ScrollView style={styles.content}>
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Save looks and items to build your personal archive
            </Text>
          </View>
        ) : (
          <View style={styles.favoritesList}>
            {favorites.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.favoriteItem}
                onPress={() => {
                  /* Navigate to detail */
                }}
              >
                <View style={styles.favoriteContent}>
                  <Text style={styles.favoriteType}>{item.type}</Text>
                  <Text style={styles.favoriteName}>{item.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeFavorite(item.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.black,
  },
  content: {
    flex: 1,
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
  favoritesList: {
    padding: theme.spacing.md,
  },
  favoriteItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  favoriteContent: {
    flex: 1,
  },
  favoriteType: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  favoriteName: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  removeButton: {
    padding: theme.spacing.sm,
  },
  removeText: {
    fontSize: 24,
    color: theme.colors.gray400,
  },
});

export default FavoritesScreen;
