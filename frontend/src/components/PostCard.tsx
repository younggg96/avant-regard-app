import React, { useCallback, useMemo } from "react";
import { View, Text as RNText, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OptimizedImage } from "./ui";
import { PostCoverMedia } from "./PostCoverMedia";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import { Show } from "../services/showService";
import { Brand } from "../services/brandService";
import {
  useMediaAspectRatio,
  clampAspectRatio,
} from "../utils/useMediaAspectRatio";

export interface ShowImageInfo {
  id: number;
  imageUrl: string;
  brandName?: string;
  season?: string;
}

export interface Post {
  id: string;
  type?: string;
  auditStatus?: string;
  title?: string;
  image?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    title?: string;
  };
  content?: {
    title: string;
    description?: string;
    images: string[];
    tags?: string[];
    /**
     * Natural aspect ratio (width / height) of the cover image. When set,
     * `PostCard` skips the async `Image.getSize` path and sizes the cover
     * synchronously — removes MasonryFlashList re-layout jank during scroll.
     */
    coverAspectRatio?: number;
  };
  engagement?: {
    likes: number;
    saves?: number;
    comments?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    wants?: number;
    isWanted?: boolean;
  };
  likes?: number;
  isLiked?: boolean;
  timestamp?: string;
  rating?: number;
  brandName?: string;
  productName?: string;
  season?: string;
  items?: Array<{
    id: string;
    name: string;
    brand: string;
    price: string;
    imageUrl: string;
  }>;
  showImages?: ShowImageInfo[];
  shows?: Show[];
  brands?: Brand[];
  communityId?: number;
  communityName?: string;
}

interface PostCardProps {
  post: Post;
  onPress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
  onLike?: (postId: string) => void;
  coverImageSize?: ImageSize;
  coverImagePriority?: "low" | "normal" | "high";
  showCoverPlaceholder?: boolean;
  coverImageTransition?: number;
}

const PostCardInner = ({
  post,
  onPress,
  onAuthorPress,
  onLike,
  coverImageSize = ImageSize.MEDIUM,
  coverImagePriority,
  showCoverPlaceholder = true,
  coverImageTransition,
}: PostCardProps) => {
  if (!post || !post.id || !post.author) {
    return null;
  }

  const displayTitle = post.content?.title || post.title || "";
  const displayImage = post.content?.images?.[0] || post.image || "";
  const displayLikes = post.engagement?.likes || post.likes || 0;
  const displayIsLiked = post.engagement?.isLiked ?? post.isLiked ?? false;

  const isPending = post.auditStatus === "PENDING";

  const mediaRatio = clampAspectRatio(
    useMediaAspectRatio(displayImage, 3 / 4, post.content?.coverAspectRatio)
  );

  // Stable cover style — feed-scroll hot path.
  //
  // Without this, every PostCard re-render (point-and-shoot likes, feedItems
  // append, MasonryFlashList cell recycle) hands `PostCoverMedia` → `OptimizedImage`
  // a freshly-built array literal, defeating `OptimizedImage`'s `React.memo`
  // shallow-compare and forcing a reconciliation down to the `expo-image`
  // layer. Memoizing on the two actual inputs (`mediaRatio`, `isPending`)
  // keeps the array identity stable and lets the memoized children bail out.
  const coverStyle = useMemo(
    () => [
      styles.image,
      { aspectRatio: mediaRatio },
      isPending && styles.pendingImage,
    ],
    [mediaRatio, isPending]
  );

  // Handlers only need `post.id` / `post.author.id` — not the whole post
  // object. Depending on the post reference made `handlePressPost` churn on
  // every like / feed mutation, which propagated re-renders into the
  // Pressable tree. Narrowing the deps keeps handler identities stable as
  // long as the author + post id are stable, matching how FlashList
  // recycles cells.
  const postId = post.id;
  const authorId = post.author.id;
  const handlePressPost = useCallback(() => onPress?.(post), [onPress, post]);
  const handlePressAuthor = useCallback(
    () => onAuthorPress?.(authorId),
    [onAuthorPress, authorId]
  );
  const handleLike = useCallback(() => onLike?.(postId), [onLike, postId]);

  return (
    <View style={styles.card}>
      <Pressable onPress={handlePressPost}>
        <View>
          <PostCoverMedia
            uri={displayImage}
            size={coverImageSize}
            priority={coverImagePriority}
            showPlaceholder={showCoverPlaceholder}
            transition={coverImageTransition}
            style={coverStyle}
          />

          {isPending && (
            <View style={styles.pendingBadge}>
              <RNText style={styles.badgeText}>审核中</RNText>
            </View>
          )}
          {!isPending && post.communityName && (
            <View style={styles.communityBadge}>
              <RNText style={styles.communityText}>
                # {post.communityName}
              </RNText>
            </View>
          )}
        </View>
      </Pressable>

      <Pressable onPress={handlePressPost}>
        <View style={styles.titleArea}>
          <RNText style={styles.title} numberOfLines={2}>
            {displayTitle}
          </RNText>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Pressable onPress={handlePressAuthor} style={styles.authorPressable}>
          <View style={styles.authorRow}>
            <OptimizedImage
              uri={post.author.avatar}
              size={ImageSize.THUMBNAIL}
              style={styles.avatar}
              contentFit="cover"
              lazy={true}
            />
            <RNText style={styles.authorName} numberOfLines={1}>
              {post.author.name}
            </RNText>
            {post.author.title ? (
              <View style={styles.authorTitleBadge}>
                <RNText style={styles.authorTitleText} numberOfLines={1}>
                  {post.author.title}
                </RNText>
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable onPress={handleLike} hitSlop={8}>
          <View style={styles.likeRow}>
            <Ionicons
              name={displayIsLiked ? "heart" : "heart-outline"}
              size={16}
              color={displayIsLiked ? "#FF3040" : theme.colors.gray400}
            />
            <RNText
              style={[styles.likeCount, displayIsLiked && styles.likeCountActive]}
            >
              {displayLikes}
            </RNText>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const PostCard = React.memo(PostCardInner);
PostCard.displayName = "PostCard";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  image: {
    width: "100%",
    backgroundColor: theme.colors.gray100,
  },
  pendingImage: {
    opacity: 0.85,
  },
  pendingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 165, 0, 0.9)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  communityBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  communityText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  titleArea: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.black,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  authorPressable: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
  },
  authorName: {
    color: theme.colors.gray600,
    fontWeight: "500",
    fontSize: 12,
    flex: 1,
  },
  authorTitleBadge: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
  },
  authorTitleText: {
    color: theme.colors.gray600,
    fontSize: 9,
    fontWeight: "500",
  },
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  likeCount: {
    color: theme.colors.gray400,
    fontWeight: "600",
    fontSize: 12,
  },
  likeCountActive: {
    color: "#FF3040",
  },
});

export default PostCard;
