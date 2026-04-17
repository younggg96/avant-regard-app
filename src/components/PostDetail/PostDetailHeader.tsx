import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, Pressable, HStack, VStack, Box } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { theme } from "../../theme";
import { Post } from "../PostCard";
import { PostStatus, formatTimestamp } from "./types";
import { styles } from "./styles";

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
  return (
    <HStack
      px="$md"
      py="$sm"
      alignItems="center"
      justifyContent="between"
      bg="$white"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      {/* Left: Back + Author Info */}
      <HStack space="sm" alignItems="center" flex={1}>
        <Pressable onPress={onGoBack} p="$xs">
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>

        <Pressable onPress={onAuthorPress}>
          <OptimizedImage
            uri={post.author.avatar}
            size={ImageSize.THUMBNAIL}
            style={styles.headerAvatar}
            contentFit="cover"
            lazy={true}
          />
        </Pressable>

        <Pressable onPress={onAuthorPress} flex={1}>
          <VStack>
            <HStack space="xs" alignItems="center">
              <Text
                fontSize="$sm"
                fontWeight="$semibold"
                color="$black"
                numberOfLines={1}
              >
                {post.author.name}
              </Text>
              {post.author.title ? (
                <Box bg="$gray100" px="$xs" py={1} rounded="$xs">
                  <Text color="$gray600" fontSize={9} fontWeight="$medium" numberOfLines={1}>
                    {post.author.title}
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <HStack space="xs" alignItems="center" flexShrink={1}>
              <Text fontSize="$xs" color="$gray600" flexShrink={0}>
                {post.timestamp ? formatTimestamp(post.timestamp) : ""}
              </Text>
              {post.communityName && (
                <View
                  style={{
                    backgroundColor: theme.colors.gray100,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    flexShrink: 1,
                  }}
                >
                  <Text fontSize="$xs" color="$gray600" numberOfLines={1}>
                    # {post.communityName}
                  </Text>
                </View>
              )}
            </HStack>
          </VStack>
        </Pressable>
      </HStack>

      {/* Right: Actions based on status */}
      <HStack space="xs" alignItems="center">
        {postStatus === "DRAFT" ? (
          // 草稿状态：显示继续修改按钮和删除按钮
          <>
            <Pressable
              onPress={onContinueEdit}
              px="$md"
              py="$xs"
              bg="$black"
              rounded="$md"
            >
              <Text fontSize="$xs" fontWeight="$semibold" color="$white">
                继续修改
              </Text>
            </Pressable>
            {isOwnPost && (
              <Pressable onPress={onShowOptionsMenu} p="$xs">
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.colors.black}
                />
              </Pressable>
            )}
          </>
        ) : postStatus === "PENDING" ? (
          // 审核中状态：显示审核状态标签和删除按钮
          <>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                backgroundColor: theme.colors.accent,
                borderRadius: theme.borderRadius.md,
              }}
            >
              <Text fontSize="$xs" fontWeight="$semibold" color="$white">
                审核中
              </Text>
            </View>
            {isOwnPost && (
              <Pressable onPress={onShowOptionsMenu} p="$xs">
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.colors.black}
                />
              </Pressable>
            )}
          </>
        ) : (
          // 已发布状态：根据是否是本人决定显示内容
          <>
            {!isOwnPost && (
              <Pressable
                onPress={onFollow}
                px="$xs"
                py="$xs"
                bg={isFollowing ? "$gray100" : "$black"}
                borderRadius="$sm"
                borderWidth={isFollowing ? 1 : 0}
                borderColor="$gray200"
                disabled={isFollowLoading}
                opacity={isFollowLoading ? 0.7 : 1}
                minWidth={72}
                alignItems="center"
              >
                {isFollowLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? theme.colors.gray600 : theme.colors.white}
                  />
                ) : (
                  <Text
                    fontSize="$sm"
                    fontWeight="$semibold"
                    color={isFollowing ? "$gray600" : "$white"}
                  >
                    {isFollowing ? "已关注" : "关注"}
                  </Text>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={isOwnPost ? onShowOptionsMenu : onShowReportMenu}
              p="$xs"
              ml={isOwnPost ? "$none" : "$sm"}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={theme.colors.black}
              />
            </Pressable>
          </>
        )}
      </HStack>
    </HStack>
  );
};
