/**
 * ProfilePreviewRow —— 个人主页头部三列预览行。
 *
 * 左：我的收藏（收藏的单品） → MyCollections
 * 中：浏览记录 → BrowsingHistory
 * 右：MY ARCHIVE（个人交易档案） → MyArchive
 *
 * 自包含地按需拉取各侧的封面 + 数量，避免污染 useProfileData。
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useThemedStyles, type AppTheme } from "../../../theme";
import { useAuthStore } from "../../../store/authStore";
import {
  listMyBrowsingHistory,
  listMyFavoritedStoreProducts,
} from "../../../services/storeProductService";
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
  const [history, setHistory] = useState<PreviewState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setCollections(EMPTY);
      setArchive(EMPTY);
      setHistory(EMPTY);
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

    (async () => {
      try {
        const res = await listMyBrowsingHistory(1, 3);
        if (cancelled) return;
        setHistory({
          covers: (res.products ?? [])
            .map((p) => p.images?.[0] ?? "")
            .filter(Boolean),
          count: res.total ?? 0,
        });
      } catch (err) {
        console.error("Error loading browsing history preview:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View style={styles.wrap}>
      {/* 三列并排：我的收藏 / 浏览记录 / MY ARCHIVE */}
      <View style={styles.row}>
        <ProfilePreviewCard
          title={t("profile.savedItemsCard")}
          count={collections.count}
          covers={collections.covers}
          fallbackIcon="bookmark-outline"
          maxVisible={2}
          onPress={() => navigation.navigate("MyCollections")}
        />
        <ProfilePreviewCard
          title={t("browsingHistory.title")}
          count={history.count}
          covers={history.covers}
          fallbackIcon="time-outline"
          maxVisible={2}
          onPress={() => navigation.navigate("BrowsingHistory")}
        />
        <ProfilePreviewCard
          title={t("trading.archiveEntry.title")}
          count={archive.count}
          covers={archive.covers}
          fallbackIcon="albums-outline"
          maxVisible={2}
          onPress={() => navigation.navigate("MyArchive")}
        />
      </View>
    </View>
  );
};
ProfilePreviewRow.displayName = "ProfilePreviewRow";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
  });

export default ProfilePreviewRow;
