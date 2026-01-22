import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, Pressable, HStack, VStack, Image } from "../ui";
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
  onShare: () => void;
  onContinueEdit: () => void;
  onShowOptionsMenu: () => void;
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
          <Image
            source={{ uri: post.author.avatar }}
            style={styles.headerAvatar}
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
            </HStack>
            <Text fontSize="$xs" color="$gray600">
              {post.timestamp ? formatTimestamp(post.timestamp) : ""}
            </Text>
          </VStack>
        </Pressable>
      </HStack>

      {/* Right: Actions based on status */}
      <HStack space="xs" alignItems="center">
        {console.log("postStatus", postStatus)}
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
                px="$lg"
                py="$sm"
                bg={isFollowing ? "$gray100" : "$black"}
                borderRadius={20}
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

            {isOwnPost && (
              <Pressable onPress={onShowOptionsMenu} p="$xs">
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.colors.black}
                />
              </Pressable>
            )}

            <Pressable onPress={onShare} pl={isOwnPost ? "$none" : "$sm"}>
              <Ionicons
                name="share-outline"
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
