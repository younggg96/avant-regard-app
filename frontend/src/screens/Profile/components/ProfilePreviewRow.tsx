/**
 * ProfilePreviewRow —— 个人主页头部双列预览行（图二顶部行）。
 *
 * 左：我的收藏（收藏的单品） → MyCollections
 * 右：MY ARCHIVE（个人交易档案） → MyArchive
 *
 * 自包含地按需拉取两侧的封面 + 数量，避免污染 useProfileData。
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useThemedStyles, type AppTheme } from "../../../theme";
import { useAuthStore } from "../../../store/authStore";
import { listMyFavoritedStoreProducts } from "../../../services/storeProductService";
import { listArchive } from "../../../services/archivePlusService";
import { ProfilePreviewCard } from "./ProfilePreviewCard";

interface PreviewState {
  covers: string[];
  count: number;
}

const EMPTY: PreviewState = { covers: [], count: 0 };

export const ProfilePreviewRow: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const userId = useAuthStore((s) => s.user?.userId);

  const [collections, setCollections] = useState<PreviewState>(EMPTY);
  const [archive, setArchive] = useState<PreviewState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setCollections(EMPTY);
      setArchive(EMPTY);
      return;
    }

    (async () => {
      try {
        const res = await listMyFavoritedStoreProducts(1, 3, {
          onlyDefault: true,
        });
        if (cancelled) return;
        setCollections({
          covers: (res.products ?? [])
            .map((p) => p.images?.[0] ?? "")
            .filter(Boolean),
          count: res.total ?? 0,
        });
      } catch (err) {
        console.error("Error loading collections preview:", err);
      }
    })();

    (async () => {
      try {
        const res = await listArchive({ page: 1, pageSize: 3 });
        if (cancelled) return;
        setArchive({
          covers: (res.items ?? [])
            .map((it) => it.photos?.[0] ?? "")
            .filter(Boolean),
          count: res.total ?? 0,
        });
      } catch (err) {
        console.error("Error loading archive preview:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View style={styles.row}>
      <ProfilePreviewCard
        title={t("profile.savedItemsCard")}
        count={collections.count}
        covers={collections.covers}
        fallbackIcon="bookmark-outline"
        onPress={() => navigation.navigate("MyCollections")}
      />
      <ProfilePreviewCard
        title={t("trading.archiveEntry.title")}
        count={archive.count}
        covers={archive.covers}
        fallbackIcon="albums-outline"
        onPress={() => navigation.navigate("MyArchive")}
      />
    </View>
  );
};
ProfilePreviewRow.displayName = "ProfilePreviewRow";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
  });

export default ProfilePreviewRow;
