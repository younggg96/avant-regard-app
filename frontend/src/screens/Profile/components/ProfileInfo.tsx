import React from "react";
import { View, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { UserInfo, UserProfileInfo } from "../../../services/userInfoService";
import { styles } from "../styles";

interface ProfileInfoProps {
  avatarUri: string | undefined;
  userInfo: UserInfo | null;
  userProfile: UserProfileInfo | null;
  username: string;
  followingUsersCount: number;
  followersCount: number;
  publishedCount: number;
  userId: number | undefined;
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
  publishedCount,
  userId,
  onEditProfile,
  onFollowingPress,
  onFollowersPress,
  onAvatarPress,
}: ProfileInfoProps) => (
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
    </View>

    <View style={styles.userNameSection}>
      <RNText style={styles.userName}>{userInfo?.username || username || "用户"}</RNText>
      <RNText style={styles.bio} numberOfLines={2}>
        {userInfo?.bio || "点击编辑个人简介..."}
      </RNText>
    </View>

    <View style={styles.tagsContainer}>
      {userProfile?.age != null && userProfile.age > 0 && (
        <View style={styles.tag}>
          <RNText style={styles.tagText}>{getGenderText(userProfile?.gender)} {userProfile.age}岁</RNText>
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
        <RNText style={styles.statLabel}>关注</RNText>
      </Pressable>
      <Pressable style={styles.statItem} onPress={onFollowersPress}>
        <RNText style={styles.statNumber}>{followersCount}</RNText>
        <RNText style={styles.statLabel}>粉丝</RNText>
      </Pressable>
      <View style={styles.statItem}>
        <RNText style={styles.statNumber}>
          {publishedCount > 0 ? publishedCount : userId ? "0" : "-"}
        </RNText>
        <RNText style={styles.statLabel}>获赞与收藏</RNText>
      </View>
    </View>
  </View>
);
