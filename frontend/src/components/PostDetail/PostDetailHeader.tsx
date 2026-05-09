import React from "react";
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { theme } from "../../theme";
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
  const { t } = useTranslation();
  const navigation = useNavigation<NavTo>();
  const displayAuthorName = post.author?.name?.trim() || "用户";

  const renderRightActions = () => {
    if (postStatus === "DRAFT") {
      return (
        <>
          <TouchableOpacity onPress={onContinueEdit} style={h.draftBtn}>
            <Text fontSize={11} fontWeight="$semibold" color="$white">
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
            <Text fontSize={11} fontWeight="$semibold" color="$white">
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
                color={isFollowing ? "$gray600" : "$white"}
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
        <Ionicons name="arrow-back" size={22} color={theme.colors.black} />
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.7}>
        <OptimizedImage
          uri={post.author.avatar}
          size={ImageSize.THUMBNAIL}
          style={h.avatar}
          contentFit="cover"
          lazy={true}
        />
      </TouchableOpacity>

      {/* Author info */}
      <TouchableOpacity onPress={onAuthorPress} style={h.infoArea} activeOpacity={0.7}>
        {/* Row 1: name + title badge */}
        <View style={h.nameRow}>
          <Text
            fontSize={13}
            fontWeight="$semibold"
            color="$black"
            numberOfLines={1}
            style={h.nameText}
          >
            {displayAuthorName}
          </Text>
          {post.author.title ? (
            <View style={h.titleBadge}>
              <Text color="$gray600" fontSize={9} fontWeight="$medium" numberOfLines={1}>
                {post.author.title}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Row 2: timestamp + community/store */}
        <View style={h.metaRow}>
          <Text fontSize={11} color="$gray600" style={h.timestamp}>
            {post.timestamp ? formatTimestamp(post.timestamp) : ""}
          </Text>
          {post.communityName ? (
            <View style={h.metaBadge}>
              <Text fontSize={10} color="$gray600" numberOfLines={1}>
                # {post.communityName}
              </Text>
            </View>
          ) : post.storeName && post.storeId ? (
            <TouchableOpacity
              onPress={(e: any) => {
                e?.stopPropagation?.();
                navigation.navigate("StoreDetail", { storeId: post.storeId });
              }}
              style={h.metaBadge}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront" size={9} color={theme.colors.gray600} />
              <Text fontSize={10} color="$gray600" numberOfLines={1} style={{ marginLeft: 2 }}>
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

const h = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.gray100,
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
    backgroundColor: theme.colors.gray100,
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
    backgroundColor: theme.colors.gray100,
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
    backgroundColor: theme.colors.black,
  },
  followBtnFollowed: {
    backgroundColor: theme.colors.gray100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray200,
  },
  draftBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.black,
    borderRadius: 12,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
  },
  moreBtn: {
    padding: 4,
  },
});
