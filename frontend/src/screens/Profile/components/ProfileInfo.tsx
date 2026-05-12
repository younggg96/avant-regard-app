import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { UserInfo, UserProfileInfo, UserTitle } from "../../../services/userInfoService";
import { LevelBadge } from "../../../components/level";
import { useLevelStore } from "../../../store/levelStore";
import { theme, playfairFonts } from "../../../theme";
import { styles } from "../styles";
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
   * 用户头衔列表。当存在主头衔（或仅有一个头衔）时，会作为头像旁的徽章展示，
   * 替代之前位于个人主页底部的独立 UserTitlesSection。
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

  // 主头衔展示在头像右侧，与底部独立的 UserTitlesSection 共用同一规则
  // (主头衔优先；只有 1 个头衔时直接展示)，确保两处不会出现不一致。
  const primaryTitle = titlesShownOnProfile(userTitles)[0];

  return (
  <View style={[styles.profileInfo, { backgroundColor: '#FFF' }]}>
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
      {primaryTitle ? (
        <View style={titleStyles.chipBadge}>
          <RNText style={titleStyles.chipBadgeText} numberOfLines={1}>
            {primaryTitle.title}
          </RNText>
        </View>
      ) : null}
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

// 头像旁的头衔徽章。由于头像 marginTop = -AVATAR_SIZE/2 浮在封面图上，
// 这里同样要求 alignSelf: flex-end 才能与头像下沿对齐；颜色与底部
// UserTitlesSection 主头衔一致 (黑底白字)，避免视觉割裂。
const titleStyles = StyleSheet.create({
  chipBadge: {
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.white,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  chipBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.white,
    fontFamily: playfairFonts.medium,
  },
});
