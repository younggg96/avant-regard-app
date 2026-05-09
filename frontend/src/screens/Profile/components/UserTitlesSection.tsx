import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { theme, playfairFonts } from "../../../theme";
import { UserTitle } from "../../../services/userInfoService";

interface UserTitlesSectionProps {
  titles: UserTitle[];
}

/** 主页只展示用户选中的主头衔；多头衔时仅 `isPrimary`；仅有一个头衔时直接展示。 */
export function titlesShownOnProfile(titles: UserTitle[]): UserTitle[] {
  const primary = titles.filter((x) => x.isPrimary);
  if (primary.length > 0) {
    return [primary[0]];
  }
  if (titles.length === 1) {
    return [titles[0]];
  }
  return [];
}

export const UserTitlesSection = ({ titles }: UserTitlesSectionProps) => {
  const { t } = useTranslation();
  const shown = titlesShownOnProfile(titles);
  if (shown.length === 0) return null;

  const item = shown[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNText style={styles.title}>{t("profile.titles")}</RNText>
      </View>
      <View style={styles.chipContainer}>
        <View key={item.id} style={[styles.chip, styles.chipPrimary]}>
          <RNText style={[styles.chipText, styles.chipTextPrimary]}>
            {item.title}
          </RNText>
        </View>
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
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray400,
    fontFamily: playfairFonts.medium,
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
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.white,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.black,
    fontFamily: playfairFonts.medium,
  },
  chipTextPrimary: {
    fontWeight: "600",
    color: theme.colors.white,
    fontFamily: playfairFonts.medium,
  },
});
