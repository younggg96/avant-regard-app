import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { OptimizedImage, Text } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { FollowingBrand } from "../../../services/followService";
import { playfairFonts, useThemedStyles, type AppTheme } from "../../../theme";
import { ProfileSectionCard } from "./ProfileSectionCard";

const MAX_VISIBLE = 4;
const AVATAR_SIZE = 36;
const AVATAR_OVERLAP = 10;

interface FollowedBrandsProps {
  brands: FollowingBrand[];
  userId?: number;
  embedded?: boolean;
}

export const FollowedBrands = ({
  brands,
  userId,
  embedded = false,
}: FollowedBrandsProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);

  if (brands.length === 0) return null;

  const visible = brands.slice(0, MAX_VISIBLE);
  const extraCount = brands.length - visible.length;

  const openAllBrands = () => {
    if (!userId) return;
    navigation.navigate("FollowingUsers", {
      userId,
      initialTab: "brands",
    });
  };

  return (
    <ProfileSectionCard
      cardTitle={t("profile.followedBrands")}
      cardTitleCount={brands.length}
      embedded={embedded}
      embeddedFlex={embedded ? 2 : undefined}
      showChevron
      onPress={openAllBrands}
      cardStyle={styles.cardFill}
    >
      <View style={styles.stackRow}>
        {visible.map((item, index) => (
          <View
            key={item.brandId}
            style={[
              styles.avatarWrap,
              index > 0 && { marginLeft: -AVATAR_OVERLAP },
              { zIndex: visible.length - index },
            ]}
          >
            {item.coverImage ? (
              <OptimizedImage
                uri={item.coverImage}
                size={ImageSize.THUMBNAIL}
                style={styles.avatarImage}
                contentFit="cover"
                lazy
              />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {item.name?.charAt(0)?.toUpperCase() || "B"}
                </Text>
              </View>
            )}
          </View>
        ))}
        {extraCount > 0 ? (
          <View
            style={[
              styles.avatarWrap,
              styles.moreWrap,
              { marginLeft: -AVATAR_OVERLAP, zIndex: 0 },
            ]}
          >
            <Text style={styles.moreText}>+{extraCount}</Text>
          </View>
        ) : null}
      </View>
    </ProfileSectionCard>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    cardFill: {
      minHeight: 148,
    },
    stackRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: t.borderRadius.md,
      borderWidth: 2,
      borderColor: t.colors.surface,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.text,
    },
    avatarInitial: {
      ...t.typography.caption,
      fontFamily: playfairFonts.bold,
      color: t.colors.textInverted,
    },
    moreWrap: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
    },
    moreText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.textSecondary,
    },
  });
