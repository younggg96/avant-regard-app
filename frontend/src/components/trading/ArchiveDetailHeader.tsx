/**
 * ArchiveDetailHeader —— 藏品详情页头部。
 *
 * 视觉和交互对齐 PostDetail 的头部：返回键 + 作者头像 + 昵称 + 时间，
 * 右侧放一个动作。藏品从「只有自己能看的表单页」变成了别人也能打开的页面，
 * 头部就得先回答「这是谁的东西」—— 一个居中的「藏品详情」标题答不了。
 *
 * 右侧动作按身份分叉：
 *   - 本人：公开 / 仅自己可见 的切换。这页是用户唯一会去找这个开关的地方。
 *   - 他人：关注作者，和帖子一致。
 */
import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Text, UserAvatar } from "../ui";
import { useThemedStyles, type AppTheme, useAppTheme } from "../../theme";
import { formatTimestamp } from "../PostDetail/types";
import type {
  ArchiveAuthor,
  ArchiveVisibility,
} from "../../services/archivePlusService";

interface ArchiveDetailHeaderProps {
  author?: ArchiveAuthor | null;
  createdAt?: string | null;
  isOwner: boolean;
  visibility: ArchiveVisibility;
  isVisibilityLoading?: boolean;
  isFollowing: boolean;
  isFollowLoading?: boolean;
  onGoBack: () => void;
  onAuthorPress: () => void;
  onFollow: () => void;
  onToggleVisibility: () => void;
}

export const ArchiveDetailHeader: React.FC<ArchiveDetailHeaderProps> = ({
  author,
  createdAt,
  isOwner,
  visibility,
  isVisibilityLoading = false,
  isFollowing,
  isFollowLoading = false,
  onGoBack,
  onAuthorPress,
  onFollow,
  onToggleVisibility,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const h = useThemedStyles(makeHeaderStyles);

  const displayName =
    author?.username?.trim() ||
    t(
      isOwner
        ? "trading.archiveDetail.ownerFallbackName"
        : "trading.archiveDetail.authorFallbackName",
    );
  const isPublic = visibility === "public";

  const renderRightAction = () => {
    if (isOwner) {
      return (
        <TouchableOpacity
          onPress={onToggleVisibility}
          disabled={isVisibilityLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ checked: isPublic }}
          accessibilityLabel={t("trading.archiveDetail.visibilityA11y")}
          style={[
            h.visibilityBtn,
            isPublic ? h.visibilityPublic : h.visibilityPrivate,
          ]}
        >
          {isVisibilityLoading ? (
            <ActivityIndicator size="small" color={theme.colors.gray600} />
          ) : (
            <>
              <Ionicons
                name={isPublic ? "earth-outline" : "lock-closed-outline"}
                size={11}
                color={theme.colors.gray600}
              />
              <Text
                fontSize={11}
                fontWeight="$medium"
                style={{ color: theme.colors.gray600, marginLeft: 4 }}
              >
                {isPublic
                  ? t("trading.archiveDetail.visibilityPublic")
                  : t("trading.archiveDetail.visibilityPrivate")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={onFollow}
        disabled={isFollowLoading}
        activeOpacity={0.7}
        style={[
          h.followBtn,
          isFollowing ? h.followBtnFollowed : h.followBtnDefault,
        ]}
      >
        {isFollowLoading ? (
          <ActivityIndicator
            size="small"
            color={isFollowing ? theme.colors.gray600 : theme.colors.white}
          />
        ) : (
          <Text
            fontSize={11}
            fontWeight="$semibold"
            style={{
              color: isFollowing ? theme.colors.gray600 : theme.colors.white,
            }}
          >
            {isFollowing ? t("postDetail.followed") : t("postDetail.follow")}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={h.container}>
      <TouchableOpacity onPress={onGoBack} style={h.backBtn} activeOpacity={0.6}>
        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onAuthorPress}
        activeOpacity={0.7}
        disabled={isOwner}
      >
        <UserAvatar
          uri={author?.avatarUrl || undefined}
          name={displayName}
          size={30}
          style={h.avatar}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onAuthorPress}
        style={h.infoArea}
        activeOpacity={0.7}
        disabled={isOwner}
      >
        <Text
          fontSize={13}
          fontWeight="$semibold"
          style={[h.nameText, { color: theme.colors.black }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text fontSize={11} style={{ color: theme.colors.gray600 }}>
          {createdAt ? formatTimestamp(createdAt) : ""}
        </Text>
      </TouchableOpacity>

      <View style={h.rightActions}>{renderRightAction()}</View>
    </View>
  );
};

const makeHeaderStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    backBtn: {
      padding: 4,
      marginRight: 8,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.colors.gray100,
      marginRight: 8,
    },
    infoArea: {
      flex: 1,
      justifyContent: "center",
    },
    nameText: {
      maxWidth: "90%",
    },
    rightActions: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },
    followBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 52,
    },
    followBtnDefault: {
      backgroundColor: t.colors.text,
    },
    followBtnFollowed: {
      backgroundColor: t.colors.gray100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.gray200,
    },
    visibilityBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      minWidth: 52,
      borderWidth: StyleSheet.hairlineWidth,
    },
    visibilityPublic: {
      backgroundColor: t.colors.gray100,
      borderColor: t.colors.gray200,
    },
    visibilityPrivate: {
      backgroundColor: "transparent",
      borderColor: t.colors.border,
    },
  });

export default ArchiveDetailHeader;
