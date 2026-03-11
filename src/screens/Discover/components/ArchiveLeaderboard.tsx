import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Image as RNImage,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, VStack, ScrollView } from "../../../components/ui";
import { theme } from "../../../theme";
import {
  ContributionUser,
  getContributionLeaderboard,
} from "../../../services/userInfoService";

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
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
}> = ({ user, onPress }) => (
  <TouchableOpacity
    style={styles.itemContainer}
    onPress={() => onPress(user.userId, user.username, user.avatarUrl)}
    activeOpacity={0.7}
  >
    <RankBadge rank={user.rank} />
    <View style={styles.avatarWrapper}>
      {user.avatarUrl ? (
        <RNImage source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={16} color={theme.colors.white} />
        </View>
      )}
    </View>
    <VStack flex={1} ml={8}>
      <Text style={styles.username} numberOfLines={1}>
        {user.username || `用户${user.userId}`}
      </Text>
      <Text style={styles.countText}>
        贡献 {user.contributionCount}
      </Text>
    </VStack>
    <Ionicons name="chevron-forward" size={16} color={theme.colors.gray200} />
  </TouchableOpacity>
);

export const ArchiveLeaderboard: React.FC = () => {
  const navigation = useNavigation();
  const [leaderboard, setLeaderboard] = useState<ContributionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getContributionLeaderboard(10);
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
      <Box py="$md" px="$md" bg="$white">
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </Box>
    );
  }

  if (leaderboard.length === 0) {
    return null;
  }

  return (
    <Box py="$md" bg="$white">
      <HStack
        justifyContent="space-between"
        alignItems="center"
        mb="$sm"
        px="$md"
      >
        <HStack alignItems="center" space="xs">
          <Ionicons name="trophy-outline" size={18} color={theme.colors.black} />
          <Text fontSize="$md" fontWeight="$semibold" color="$black">
            Archive 贡献榜
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

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  medalBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  medalText: {
    color: theme.colors.white,
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
    color: theme.colors.gray300,
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
    borderColor: theme.colors.gray100,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
  },
  countText: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginTop: 2,
  },
});

export default ArchiveLeaderboard;
