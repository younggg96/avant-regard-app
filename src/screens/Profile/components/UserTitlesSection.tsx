import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { theme } from "../../../theme";
import { UserTitle } from "../../../services/userInfoService";

interface UserTitlesSectionProps {
  titles: UserTitle[];
}

export const UserTitlesSection = ({ titles }: UserTitlesSectionProps) => {
  if (titles.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNText style={styles.title}>头衔</RNText>
        <RNText style={styles.count}>{titles.length}</RNText>
      </View>
      <View style={styles.chipContainer}>
        {titles.map((t) => (
          <View
            key={t.id}
            style={[styles.chip, t.isPrimary && styles.chipPrimary]}
          >
            <RNText
              style={[styles.chipText, t.isPrimary && styles.chipTextPrimary]}
            >
              {t.title}
            </RNText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 14,
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  count: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray300,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  chipPrimary: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.black,
  },
  chipTextPrimary: {
    fontWeight: "600",
    color: "#92400E",
  },
});
