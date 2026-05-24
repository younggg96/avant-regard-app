import React from "react";
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text, UserAvatar } from "../ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../theme";
import { Post } from "../PostCard";
import { PostStatus, formatTimestamp } from "./types";

interface PostDetailHeaderProps {
  post: Post;
  postStatus: PostStatus;
  isOwnPost: boolean;
  isFollowing: boolean;
  isFollowLoading?: boolean;
  onGoBack: () => void;
  onAuthorPress: () => void;
  onFollow: () => void;
  onShare?: () => void;
  onContinueEdit: () => void;
  onShowOptionsMenu: () => void;
  onShowReportMenu?: () => void;
}

type NavTo = { navigate: (screen: string, params?: any) => void };

export const PostDetailHeader: React.FC<PostDetailHeaderProps> = ({
  post,
  postStatus,
  isOwnPost,
  isFollowing,
  isFollowLoading = false,
  onGoBack,
  onAuthorPress,
  onFollow,
  onShare,
  onContinueEdit,
  onShowOptionsMenu,
  onShowReportMenu,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NavTo>();
  const h = useThemedStyles(makeHeaderStyles);
  const displayAuthorName = post.author?.name?.trim() || "用户";

  const renderRightActions = () => {
    if (postStatus === "DRAFT") {
      return (
        <>
          <TouchableOpacity onPress={onContinueEdit} style={h.draftBtn}>
            <Text fontSize={11} fontWeight="$semibold" style={{ color: theme.colors.white }}>
              {t("postDetail.continueEdit")}
            </Text>
          </TouchableOpacity>
          {isOwnPost && (
            <TouchableOpacity onPress={onShowOptionsMenu} style={h.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.black} />
            </TouchableOpacity>
          )}
        </>
      );
    }

    if (postStatus === "PENDING") {
      return (
        <>
          <View style={h.pendingBadge}>
            <Text fontSize={11} fontWeight="$semibold" style={{ color: theme.colors.white }}>
              {t("postDetail.pending")}
            </Text>
          </View>
          {isOwnPost && (
            <TouchableOpacity onPress={onShowOptionsMenu} style={h.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.black} />
            </TouchableOpacity>
          )}
        </>
      );
    }

    // 审核驳回：和草稿一样直接给一个「重新修改」主按钮，省掉 "..." 二次点击。
    // 同时复用 onContinueEdit，跳过编辑确认弹窗（onContinueEdit 直达编辑页），
    // 因为驳回帖子本来就不对外可见，没有「编辑会重置审核状态」的成本。
    if (postStatus === "REJECTED") {
      return (
        <>
          {isOwnPost && (
            <TouchableOpacity onPress={onContinueEdit} style={h.rejectedBtn}>
              <Text fontSize={11} fontWeight="$semibold" style={{ color: theme.colors.white }}>
                {t("postDetail.editAndResubmit")}
              </Text>
            </TouchableOpacity>
          )}
          {isOwnPost && (
            <TouchableOpacity onPress={onShowOptionsMenu} style={h.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.black} />
            </TouchableOpacity>
          )}
        </>
      );
    }

    return (
      <>
        {!isOwnPost && (
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
                style={{ color: isFollowing ? theme.colors.gray600 : theme.colors.white }}
              >
                {isFollowing ? t("postDetail.followed") : t("postDetail.follow")}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={isOwnPost ? onShowOptionsMenu : onShowReportMenu}
          style={h.moreBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.black} />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={h.container}>
      {/* Back button */}
      <TouchableOpacity onPress={onGoBack} style={h.backBtn} activeOpacity={0.6}>
        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.7}>
        <UserAvatar
          uri={post.author.avatar || undefined}
          name={post.author.name}
          size={30}
          style={h.avatar}
        />
      </TouchableOpacity>

      {/* Author info */}
      <TouchableOpacity onPress={onAuthorPress} style={h.infoArea} activeOpacity={0.7}>
        {/* Row 1: name + title badge */}
        <View style={h.nameRow}>
          <Text
            fontSize={13}
            fontWeight="$semibold"
            style={[h.nameText, { color: theme.colors.black }]}
            numberOfLines={1}

          >
            {displayAuthorName}
          </Text>
          {post.author.title ? (
            <View style={h.titleBadge}>
              <Text style={{ color: theme.colors.gray600 }} fontSize={9} fontWeight="$medium" numberOfLines={1}>
                {post.author.title}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Row 2: timestamp (+ store badge when applicable) */}
        <View style={h.metaRow}>
          <Text fontSize={11} style={[h.timestamp, { color: theme.colors.gray600 }]}>
            {post.timestamp ? formatTimestamp(post.timestamp) : ""}
          </Text>
          {post.storeName && post.storeId ? (
            <TouchableOpacity
              onPress={(e: any) => {
                e?.stopPropagation?.();
                navigation.navigate("StoreDetail", { storeId: post.storeId });
              }}
              style={h.metaBadge}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront" size={9} color={theme.colors.gray600} />
              <Text fontSize={10} style={[{ marginLeft: 2 }, { color: theme.colors.gray600 }]} numberOfLines={1}>
                {post.storeName}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Right actions */}
      <View style={h.rightActions}>
        {renderRightActions()}
      </View>
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
      marginRight: 8,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    nameText: {
      flexShrink: 0,
      maxWidth: "65%",
    },
    titleBadge: {
      backgroundColor: t.colors.gray100,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      flexShrink: 1,
      maxWidth: "45%",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 1,
      overflow: "hidden",
    },
    timestamp: {
      flexShrink: 0,
    },
    metaBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray100,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      flexShrink: 1,
    },
    rightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
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
    draftBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.colors.text,
      borderRadius: 12,
    },
    pendingBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.colors.accent,
      borderRadius: 12,
    },
    // 红色「修改后重新提交」按钮：饱和度 / 视觉权重高于草稿的黑色按钮，
    // 强调违规驳回的紧迫感，但不堆叠多个 CTA。
    rejectedBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: "#DC2626",
      borderRadius: 12,
    },
    moreBtn: {
      padding: 4,
    },
  });
