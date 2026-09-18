/**
 * Archive Tab · 公开档案
 *
 * 展示所有 visibility=public 的藏品，包括本人的。线上旧接口仍会排除本人，
 * 所以这里再拉一次自己的列表补上，按 id 去重。私密的不进这个 feed。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import {
  Pressable,
  Text,
  AiPhotoBadge,
  isAiPhoto,
} from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  WorldArchiveItem,
  listArchive,
  listWorldArchive,
} from "../../services/archivePlusService";
import { useAuthStore } from "../../store/authStore";
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
  const userId = useAuthStore((s) => s.user?.userId);
  const username = useAuthStore((s) => s.user?.username);
  const avatar = useAuthStore((s) => s.user?.avatar);
  const [items, setItems] = useState<WorldArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [worldRes, mineRes] = await Promise.all([
        listWorldArchive({ page: 1, pageSize: 60 }).catch((e) => {
          console.warn("[archive] world list failed", e);
          return { items: [] as WorldArchiveItem[], total: 0 };
        }),
        listArchive({ page: 1, pageSize: 60 }).catch((e) => {
          console.warn("[archive] own list failed", e);
          return { items: [], total: 0 };
        }),
      ]);

      const byId = new Map<number, WorldArchiveItem>();
      for (const item of worldRes.items) byId.set(item.id, item);

      // 旧的 /world 会把本人排除掉。Archive tab 是唯一浏览入口，
      // 自己公开的藏品必须从 /items 补回来，否则「已公开」永远是空的。
      const me =
        userId != null
          ? { id: userId, username: username ?? "", avatarUrl: avatar }
          : null;
      for (const item of mineRes.items) {
        if ((item.visibility ?? "public") !== "public") continue;
        const prev = byId.get(item.id);
        if (prev?.author) continue;
        byId.set(item.id, { ...(prev ?? item), author: prev?.author ?? me });
      }

      setItems(
        [...byId.values()].sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        ),
      );
    } finally {
      setLoading(false);
      setLoaded(true);
      onLoaded?.();
    }
  }, [onLoaded, userId, username, avatar]);

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

  // 点图看藏品、点作者行看主页。整格都跳作者主页的话，这个 feed 里就没有
  // 任何入口能真正打开一件藏品。
  const openItem = (item: WorldArchiveItem) => {
    (navigation.navigate as any)("ArchiveDetail", { archiveId: item.id });
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
        <Pressable key={item.id} onPress={() => openItem(item)} style={s.cell}>
          {item.photos?.[0] ? (
            <View>
              <OptimizedImage uri={item.photos[0]} size={ImageSize.THUMBNAIL} style={s.img} contentFit="cover" lazy />
              {isAiPhoto(item.photos[0], item.aiPhotos) && <AiPhotoBadge size="sm" />}
            </View>
          ) : (
            <View style={[s.img, { backgroundColor: theme.colors.surface }]} />
          )}
          <Pressable style={s.authorRow} onPress={() => openAuthor(item)}>
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
          </Pressable>
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
