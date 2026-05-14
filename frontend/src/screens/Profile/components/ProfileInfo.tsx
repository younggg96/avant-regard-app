import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { UserInfo, UserProfileInfo, UserTitle } from "../../../services/userInfoService";
import { LevelBadge } from "../../../components/level";
import { useLevelStore } from "../../../store/levelStore";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { useProfileStyles } from "../styles";
import { titlesShownOnProfile } from "./UserTitlesSection";

interface ProfileInfoProps {
  avatarUri: string | undefined;
  userInfo: UserInfo | null;
  userProfile: UserProfileInfo | null;
  username: string;
  followingUsersCount: number;
  followersCount: number;
  /**
   * 累计获赞 + 收藏数（来自 /api/posts/user/{id}/stats）。
   * 后端实时聚合 PUBLISHED + APPROVED 帖子的 like_count + favorite_count，
   * 与单篇帖子真实数据保持同步；undefined 表示尚未加载。
   */
  likesAndSavesCount: number | undefined;
  userId: number | undefined;
  /**
   * 用户头衔列表。当存在主头衔（或仅有一个头衔）时，在用户名列一行展示，
   * 紧跟等级徽章右侧（与访客主页一致）。
   */
  userTitles: UserTitle[];
  onEditProfile: () => void;
  onFollowingPress: () => void;
  onFollowersPress: () => void;
  onAvatarPress?: () => void;
}

function getGenderText(gender?: string): string {
  switch (gender) {
    case "MALE": return "♂";
    case "FEMALE": return "♀";
    default: return "";
  }
}

export const ProfileInfo = ({
  avatarUri,
  userInfo,
  userProfile,
  username,
  followingUsersCount,
  followersCount,
  likesAndSavesCount,
  userId,
  userTitles,
  onEditProfile,
  onFollowingPress,
  onFollowersPress,
  onAvatarPress,
}: ProfileInfoProps) => {
  const { t } = useTranslation();
  const levelStatus = useLevelStore((s) => s.status);
  const currentLevel = levelStatus?.currentLevel ?? 0;
  const pendingLevel = levelStatus?.pendingLevel ?? null;
  const styles = useProfileStyles();
  const appTheme = useAppTheme();
  const titleStyles = useThemedStyles(makeTitleStyles);

  // 主头衔与 UserTitlesSection / 访客主页共用 titlesShownOnProfile 规则。
  const primaryTitle = titlesShownOnProfile(userTitles)[0];

  return (
  <View style={[styles.profileInfo, { backgroundColor: appTheme.colors.card }]}>
    <View style={styles.avatarRow}>
      <View style={styles.avatarWrapper}>
        <Pressable
          onPress={avatarUri ? onAvatarPress : onEditProfile}
          disabled={!avatarUri && !onEditProfile}
        >
          {avatarUri ? (
            <OptimizedImage uri={avatarUri} size={ImageSize.THUMBNAIL} style={styles.avatar} contentFit="cover" lazy={false} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <RNText style={styles.avatarText}>
                {username?.slice(0, 2).toUpperCase() || "AG"}
              </RNText>
            </View>
          )}
        </Pressable>
        <Pressable style={styles.avatarAddButton} onPress={onEditProfile}>
          <Ionicons name="add" size={14} color="white" />
        </Pressable>
      </View>
    </View>

    <View style={styles.userNameSection}>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <RNText style={styles.userName}>{userInfo?.username || username || t("profile.user")}</RNText>
        {currentLevel > 0 ? (
          <LevelBadge
            level={currentLevel}
            size="sm"
            pendingLevel={pendingLevel}
          />
        ) : null}
        {primaryTitle ? (
          <View style={titleStyles.chipBadge}>
            <RNText style={titleStyles.chipBadgeText} numberOfLines={1}>
              {primaryTitle.title}
            </RNText>
          </View>
        ) : null}
      </View>
      <RNText style={styles.bio} numberOfLines={2}>
        {userInfo?.bio || t("profile.editBioPlaceholder")}
      </RNText>
    </View>

    <View style={styles.tagsContainer}>
      {userProfile?.age != null && userProfile.age > 0 && (
        <View style={styles.tag}>
          <RNText style={styles.tagText}>{getGenderText(userProfile?.gender)} {userProfile.age}{t("profile.ageUnit")}</RNText>
        </View>
      )}
      {userInfo?.location && (
        <View style={styles.tag}>
          <RNText style={styles.tagText}>{userInfo.location}</RNText>
        </View>
      )}
      {userProfile?.preference && (
        <View style={styles.tag}>
          <RNText style={styles.tagText}>{userProfile.preference}</RNText>
        </View>
      )}
    </View>

    <View style={styles.statsContainer}>
      <Pressable style={styles.statItem} onPress={onFollowingPress}>
        <RNText style={styles.statNumber}>{followingUsersCount}</RNText>
        <RNText style={styles.statLabel}>{t("profile.following")}</RNText>
      </Pressable>
      <Pressable style={styles.statItem} onPress={onFollowersPress}>
        <RNText style={styles.statNumber}>{followersCount}</RNText>
        <RNText style={styles.statLabel}>{t("profile.followers")}</RNText>
      </Pressable>
      <View style={styles.statItem}>
        <RNText style={styles.statNumber}>
          {likesAndSavesCount != null ? likesAndSavesCount : userId ? "0" : "-"}
        </RNText>
        <RNText style={styles.statLabel}>{t("profile.likesAndSaves")}</RNText>
      </View>
    </View>
  </View>
  );
};

// 头衔徽章：与用户名、等级同一行，紧跟在等级徽章右侧（与 UserProfileScreen 一致）。
// gray100 底 + text 字色，两套主题下与其他资料 chip 同调。
const makeTitleStyles = (t: AppTheme) =>
  StyleSheet.create({
    chipBadge: {
      maxWidth: 148,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: t.colors.gray100,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    chipBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.text,
      fontFamily: playfairFonts.medium,
    },
  });
