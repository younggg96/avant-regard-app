/**
 * 论坛 Tab · 「我的档案」子 Tab（PRD 2 节 Tab 2）
 *
 * M1 先落地基础形态：三列瀑布、只展示图片与标题，点击进入档案详情。
 * 完整护照展开态、品牌 / 年代筛选与「日历事件 → 档案展开态」互引在 M2 完成。
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
import { ArchiveItem, listArchive } from "../../services/archivePlusService";
import { SCREEN_WIDTH } from "../Discover/constants";

interface Props {
  refreshSignal?: number;
  /** 每次数据加载完成后回调，供父级停止下拉刷新指示器。 */
  onLoaded?: () => void;
}

const COLUMNS = 3;
const GAP = 4;
const CELL_W = (SCREEN_WIDTH - GAP * (COLUMNS + 1)) / COLUMNS;

export const ForumMyArchiveSection: React.FC<Props> = ({ refreshSignal = 0, onLoaded }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listArchive({ page: 1, pageSize: 60 });
      setItems(res.items);
    } catch (e) {
      console.warn("[archive] list failed", e);
    } finally {
      setLoading(false);
      setLoaded(true);
      onLoaded?.();
    }
  }, [onLoaded]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const openItem = (item: ArchiveItem) =>
    (navigation.navigate as any)("ArchiveDetail", { archiveId: item.id });

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
        <Ionicons name="albums-outline" size={40} color={theme.colors.gray200} />
        <Text fontSize="$md" fontWeight="$medium" style={{ color: theme.colors.text, marginTop: 12 }}>
          {t("events.archiveEmpty")}
        </Text>
        <Text fontSize="$sm" style={{ color: theme.colors.gray300, marginTop: 4, textAlign: "center" }}>
          {t("events.archiveEmptyHint")}
        </Text>
        <Pressable
          onPress={() => (navigation.navigate as any)("UploadArchiveItem")}
          style={[s.cta, { backgroundColor: theme.colors.text }]}
        >
          <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
            {t("events.archiveUpload")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.grid}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => openItem(item)} style={s.cell}>
          {item.photos?.[0] ? (
            <OptimizedImage uri={item.photos[0]} size={ImageSize.THUMBNAIL} style={s.img} contentFit="cover" lazy />
          ) : (
            <View style={[s.img, { backgroundColor: theme.colors.surface }]} />
          )}
          <Text fontSize={11} numberOfLines={1} style={{ color: theme.colors.text, marginTop: 4 }}>
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
    cta: { marginTop: 16, paddingHorizontal: 20, height: 36, borderRadius: 4, alignItems: "center", justifyContent: "center" },
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
  });

export default ForumMyArchiveSection;
