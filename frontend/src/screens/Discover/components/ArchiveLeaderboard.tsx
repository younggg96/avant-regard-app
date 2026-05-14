import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, VStack, ScrollView } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { theme, useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import {
  ContributionUser,
  getContributionLeaderboard,
} from "../../../services/userInfoService";

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const styles = useThemedStyles(makeStyles);
  if (rank <= 3) {
    return (
      <View style={[styles.medalBadge, { backgroundColor: MEDAL_COLORS[rank - 1] }]}>
        <Text style={styles.medalText}>{rank}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankText}>{rank}</Text>
    </View>
  );
};

const LeaderboardItem: React.FC<{
  user: ContributionUser;
  onPress: (userId: number, username: string, avatarUrl: string) => void;
}> = ({ user, onPress }) => {
  const { t } = useTranslation();
  const themeCtx = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onPress(user.userId, user.username, user.avatarUrl)}
      activeOpacity={0.7}
    >
      <RankBadge rank={user.rank} />
      <View style={styles.avatarWrapper}>
        {user.avatarUrl ? (
          <OptimizedImage
            uri={user.avatarUrl}
            size={ImageSize.THUMBNAIL}
            style={styles.avatar}
            contentFit="cover"
            lazy={true}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={16} color={themeCtx.colors.textInverted} />
          </View>
        )}
      </View>
      <VStack flex={1} ml={8}>
        <Text style={styles.username} numberOfLines={1}>
          {user.username || t("archive.userFallback", { id: user.userId })}
        </Text>
        <Text style={styles.countText}>
          {t("archive.contributionCount", { count: user.contributionCount })}
        </Text>
      </VStack>
      <Ionicons name="chevron-forward" size={16} color={themeCtx.colors.gray200} />
    </TouchableOpacity>
  );
};

export const ArchiveLeaderboard: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [leaderboard, setLeaderboard] = useState<ContributionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getContributionLeaderboard(100);
        setLeaderboard(data);
      } catch (err) {
        console.warn("获取贡献榜失败:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const handleUserPress = useCallback(
    (userId: number, username: string, avatarUrl: string) => {
      (navigation.navigate as any)("UserProfile", {
        userId,
        username,
        avatar: avatarUrl,
      });
    },
    [navigation]
  );

  if (loading) {
    return (
      <Box py="$md" px="$md" style={{ backgroundColor: theme.colors.white }}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </Box>
    );
  }

  if (leaderboard.length === 0) {
    return null;
  }

  return (
    <Box py="$md" style={{ backgroundColor: theme.colors.white }}>
      <HStack
        justifyContent="space-between"
        alignItems="center"
        mb="$sm"
        px="$md"
      >
        <HStack alignItems="center" space="xs">
          <Ionicons name="trophy-outline" size={18} color={theme.colors.black} />
          <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
            {t("archive.contributionBoard")}
          </Text>
        </HStack>
      </HStack>
      <VStack px="$md">
        {leaderboard.map((user) => (
          <LeaderboardItem
            key={user.userId}
            user={user}
            onPress={handleUserPress}
          />
        ))}
      </VStack>
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  medalBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  medalText: {
    // Medal background colors are fixed gold/silver/bronze regardless of theme;
    // keep the text literally white so contrast is consistent in both modes.
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  rankBadge: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    color: t.colors.gray300,
    fontSize: 13,
    fontWeight: "600",
  },
  avatarWrapper: {
    marginLeft: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.text,
  },
  countText: {
    fontSize: 12,
    color: t.colors.gray300,
    marginTop: 2,
  },
});

export default ArchiveLeaderboard;
