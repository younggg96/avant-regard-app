/**
 * ArchiveEntryCard —— ProfileScreen 上的 MY ARCHIVE 入口卡片（PDF p.11 + p.19）。
 *
 * 与 FollowedBrands / LevelProgressCard 并列。仅增加，不减少。
 * 视觉跟随 useAppTheme，与 LevelProgressCard 同款卡片样式。
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, ScrollView, Image as RNImage } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text, Pressable } from "../../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useProfileStyles } from "../styles";
import {
  listArchive,
  ArchiveItem,
} from "../../../services/archivePlusService";

interface Props {
  isOwnProfile: boolean;
}

export const ArchiveEntryCard: React.FC<Props> = ({ isOwnProfile }) => {
  const theme = useAppTheme();
  const profileStyles = useProfileStyles();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isOwnProfile) return;
    (async () => {
      try {
        const data = await listArchive({ pageSize: 6 });
        setItems(data.items ?? []);
        setCount(data.total ?? data.items?.length ?? 0);
      } catch (e) {
        console.warn("[ArchiveEntryCard] load failed", e);
      }
    })();
  }, [isOwnProfile]);

  if (!isOwnProfile) return null;

  const empty = items.length === 0;

  return (
    <Pressable
      style={[profileStyles.profileInsetCard, styles.card]}
      onPress={() => navigation.navigate("MyArchive")}
    >
      <HStack justifyContent="between" alignItems="center">
        <HStack space="xs" alignItems="center">
          <Ionicons name="albums-outline" size={13} color={theme.colors.text} />
          <Text style={styles.title}>{t("trading.archiveEntry.title")}</Text>
          {count > 0 ? (
            <Box style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </Box>
          ) : null}
        </HStack>
        <Ionicons
          name="chevron-forward"
          size={12}
          color={theme.colors.gray300}
        />
      </HStack>

      {empty ? (
        <Text style={styles.emptyHint}>
          {t("trading.archiveEntry.emptyHint")}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbRow}
        >
          {items.map((it) => (
            <Box key={it.id} style={styles.thumbWrap}>
              {it.photos?.[0] ? (
                <RNImage
                  source={{ uri: it.photos[0] }}
                  style={styles.thumb}
                />
              ) : (
                <Box style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons
                    name="image-outline"
                    size={14}
                    color={theme.colors.gray300}
                  />
                </Box>
              )}
            </Box>
          ))}
        </ScrollView>
      )}
    </Pressable>
  );
};
ArchiveEntryCard.displayName = "ArchiveEntryCard";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginTop: t.spacing.xs,
      marginBottom: t.spacing.xs,
    },
    title: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    countBadge: {
      minWidth: 12,
      height: 12,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginLeft: 4,
    },
    countBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: t.colors.textInverted,
      lineHeight: 12,
      textAlign: "center",
    },
    emptyHint: {
      color: t.colors.gray300,
      fontSize: 10,
      marginTop: t.spacing.xs,
      lineHeight: 15,
    },
    thumbRow: { gap: 5, paddingVertical: 3 },
    thumbWrap: {},
    thumb: {
      width: 36,
      height: 36,
      borderRadius: 4,
      backgroundColor: t.colors.skeleton,
    },
    thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  });

export default ArchiveEntryCard;
