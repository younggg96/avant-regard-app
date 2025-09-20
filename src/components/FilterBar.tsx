import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { theme } from "../theme";

interface FilterBarProps {
  filters: any;
  onFilterChange: (filters: any) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange }) => {
  const filterOptions = [
    { id: "all", label: "All" },
    { id: "fw24", label: "FW24" },
    { id: "ss24", label: "SS24" },
    { id: "hasListings", label: "Available" },
  ];

  const handleFilterPress = (filterId: string) => {
    if (filterId === "all") {
      onFilterChange({});
    } else {
      const newFilters = { ...filters };
      if (newFilters[filterId]) {
        delete newFilters[filterId];
      } else {
        newFilters[filterId] = true;
      }
      onFilterChange(newFilters);
    }
  };

  const isActive = (filterId: string) => {
    if (filterId === "all") return Object.keys(filters).length === 0;
    return filters[filterId];
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.filterChip,
              isActive(option.id) && styles.filterChipActive,
            ]}
            onPress={() => handleFilterPress(option.id)}
          >
            <Text
              style={[
                styles.filterText,
                isActive(option.id) && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    marginRight: theme.spacing.sm,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterText: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: theme.colors.white,
  },
});

export default FilterBar;
