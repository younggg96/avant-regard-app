/**
 * My Archive Tab · 「世界」二级 Tab
 *
 * 浏览其他用户的公开档案条目（后端 /api/archive/world 已排除本人）。
 * 三列瀑布，展示图片 + 作者头像/名，点击进入作者主页。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { WorldArchiveItem, listWorldArchive } from "../../services/archivePlusService";
import { SCREEN_WIDTH } from "../Discover/constants";

interface Props {
  refreshSignal?: number;
  /** 每次数据加载完成后回调，供父级停止下拉刷新指示器。 */
  onLoaded?: () => void;
}

const COLUMNS = 3;
const GAP = 4;
const CELL_W = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

export const WorldArchiveSection: React.FC<Props> = ({ refreshSignal = 0, onLoaded }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const [items, setItems] = useState<WorldArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listWorldArchive({ page: 1, pageSize: 60 });
      setItems(res.items);
    } catch (e) {
      console.warn("[archive] world list failed", e);
    } finally {
      setLoading(false);
      setLoaded(true);
      onLoaded?.();
    }
  }, [onLoaded]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const openAuthor = (item: WorldArchiveItem) => {
    if (!item.author?.id) return;
    (navigation.navigate as any)("UserProfile", {
      userId: item.author.id,
      username: item.author.username,
      avatar: item.author.avatarUrl ?? undefined,
    });
  };

  if (loading && !loaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="small" color={theme.colors.gray300} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="planet-outline" size={40} color={theme.colors.gray200} />
        <Text fontSize="$md" fontWeight="$medium" style={{ color: theme.colors.text, marginTop: 12 }}>
          {t("events.worldEmpty")}
        </Text>
        <Text fontSize="$sm" style={{ color: theme.colors.gray300, marginTop: 4, textAlign: "center" }}>
          {t("events.worldEmptyHint")}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.grid}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => openAuthor(item)} style={s.cell}>
          {item.photos?.[0] ? (
            <OptimizedImage uri={item.photos[0]} size={ImageSize.THUMBNAIL} style={s.img} contentFit="cover" lazy />
          ) : (
            <View style={[s.img, { backgroundColor: theme.colors.surface }]} />
          )}
          <View style={s.authorRow}>
            {item.author?.avatarUrl ? (
              <OptimizedImage
                uri={item.author.avatarUrl}
                size={ImageSize.THUMBNAIL}
                style={s.avatar}
                contentFit="cover"
                lazy
              />
            ) : (
              <View style={[s.avatar, { backgroundColor: theme.colors.surface }]} />
            )}
            <Text fontSize={11} numberOfLines={1} style={{ color: theme.colors.gray400, flex: 1 }}>
              {item.author?.username || "—"}
            </Text>
          </View>
          <Text fontSize={11} numberOfLines={1} style={{ color: theme.colors.text }}>
            {item.title || item.brandName || "—"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: GAP,
      paddingTop: GAP,
      gap: GAP,
      backgroundColor: t.colors.card,
    },
    cell: { width: CELL_W, marginBottom: 6 },
    img: { width: CELL_W, height: CELL_W * 1.25, borderRadius: 4 },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    avatar: { width: 14, height: 14, borderRadius: 7 },
  });

export default WorldArchiveSection;
