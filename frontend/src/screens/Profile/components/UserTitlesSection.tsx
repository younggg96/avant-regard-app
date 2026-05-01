import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "../../../theme";
import { UserTitle } from "../../../services/userInfoService";

interface UserTitlesSectionProps {
  titles: UserTitle[];
}

export const UserTitlesSection = ({ titles }: UserTitlesSectionProps) => {
  const { t } = useTranslation();
  if (titles.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNText style={styles.title}>{t("profile.titles")}</RNText>
        <RNText style={styles.count}>{titles.length}</RNText>
      </View>
      <View style={styles.chipContainer}>
        {titles.map((item) => (
          <View
            key={item.id}
            style={[styles.chip, item.isPrimary && styles.chipPrimary]}
          >
            <RNText
              style={[styles.chipText, item.isPrimary && styles.chipTextPrimary]}
            >
              {item.title}
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
