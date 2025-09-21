import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DesignerBrandHistory } from "@avant-regard/core/src/types";
import { theme } from "../theme";

interface BrandHistoryCardProps {
  brandHistory: DesignerBrandHistory;
  onPress?: () => void;
}

const BrandHistoryCard: React.FC<BrandHistoryCardProps> = ({
  brandHistory,
  onPress,
}) => {
  const formatYearRange = () => {
    if (brandHistory.isActive && !brandHistory.endYear) {
      return `${brandHistory.startYear} - Present`;
    }
    return brandHistory.endYear
      ? `${brandHistory.startYear} - ${brandHistory.endYear}`
      : `${brandHistory.startYear}`;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !brandHistory.isActive && styles.containerInactive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: brandHistory.logoUrl }}
              style={styles.logo}
              defaultSource={require("../../assets/placeholder.png")}
            />
          </View>

          <View style={styles.brandInfo}>
            <Text style={styles.brandName}>{brandHistory.brandName}</Text>
            <Text style={styles.role}>{brandHistory.role}</Text>
            <Text style={styles.yearRange}>{formatYearRange()}</Text>
          </View>

          <View style={styles.statusContainer}>
            {brandHistory.isActive ? (
              <View style={styles.activeStatus}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Current</Text>
              </View>
            ) : (
              <Text style={styles.inactiveText}>Past</Text>
            )}

            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.gray300}
            />
          </View>
        </View>

        {brandHistory.description && (
          <Text style={styles.description} numberOfLines={2}>
            {brandHistory.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    overflow: "hidden",
  },
  containerInactive: {
    opacity: 0.8,
    borderColor: theme.colors.gray200,
  },
  content: {
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.md,
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: 2,
  },
  role: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  yearRange: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontWeight: "500",
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  activeStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    marginRight: theme.spacing.xs,
  },
  activeText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: "500",
  },
  inactiveText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.xs,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray500,
    lineHeight: 18,
  },
});

export default BrandHistoryCard;
