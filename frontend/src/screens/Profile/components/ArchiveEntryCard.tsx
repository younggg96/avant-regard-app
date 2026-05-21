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
import {
  listArchive,
  ArchiveItem,
} from "../../../services/archivePlusService";

interface Props {
  isOwnProfile: boolean;
}

export const ArchiveEntryCard: React.FC<Props> = ({ isOwnProfile }) => {
  const theme = useAppTheme();
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
      style={styles.card}
      onPress={() => navigation.navigate("MyArchive")}
    >
      <HStack justifyContent="between" alignItems="center">
        <HStack space="xs" alignItems="center">
          <Ionicons name="albums" size={18} color={theme.colors.text} />
          <Text style={styles.title}>{t("trading.archiveEntry.title")}</Text>
          {count > 0 ? (
            <Text style={styles.countBadge}>{count}</Text>
          ) : null}
        </HStack>
        <Ionicons
          name="chevron-forward"
          size={18}
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
                    size={20}
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
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.text,
      letterSpacing: 0.5,
    },
    countBadge: {
      fontSize: 11,
      color: t.colors.textInverted,
      backgroundColor: t.colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: "hidden",
      marginLeft: 4,
    },
    emptyHint: { color: t.colors.gray300, fontSize: 12, marginTop: 8 },
    thumbRow: { gap: 8, paddingVertical: 8 },
    thumbWrap: {},
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 6,
      backgroundColor: t.colors.skeleton,
    },
    thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  });

export default ArchiveEntryCard;
