import React, { useCallback, useMemo } from "react";
import { View, Text as RNText, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { OptimizedImage } from "./ui";
import { PostCoverMedia } from "./PostCoverMedia";
import { ImageSize } from "../utils/imageUtils";
import { playfairFonts, theme } from "../theme";
import { Show } from "../services/showService";
import { Brand } from "../services/brandService";
import {
  useMediaAspectRatio,
  clampAspectRatio,
} from "../utils/useMediaAspectRatio";
import { getPostTextPreview } from "../utils/postContentPreview";

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
  // 买手店帖子（migration 055）— 设置后 PostCard 会显示 "店铺" 角标,
  // 点击进入对应 StoreDetail. 同时 PostDetail header 也要显示店铺名行。
  storeId?: string;
  storeName?: string;
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
  // 默认走原图（ORIGINAL 在 getOptimizedImageUrl 里直通 Storage，不进
  // proxy）。背景见 PostCoverMedia 的 Quality note：proxy 路径上每隔一段
  // 时间会有概率把糊掉的字节永久写进 SDImageCache 磁盘，必须卸载重装才
  // 能复原。直接用原图 + GPU decode 时下采样换掉这条故障路径。
  coverImageSize = ImageSize.ORIGINAL,
  coverImagePriority,
  showCoverPlaceholder = true,
  coverImageTransition,
}: PostCardProps) => {
  const { t } = useTranslation();
  if (!post || !post.id || !post.author) {
    return null;
  }

  const isForumPost = !!post.communityId || !!post.communityName;
  const displayTitle = post.content?.title || post.title || "";
  const displayImage = post.content?.images?.[0] || post.image || "";
  const displayDescription = getPostTextPreview(
    post.content?.description,
    isForumPost ? 120 : 140
  );
  const textOnlyPlaceholder = getPostTextPreview(
    post.content?.description,
    isForumPost ? 88 : 120
  );
  const displayLikes = post.engagement?.likes || post.likes || 0;
  const displayIsLiked = post.engagement?.isLiked ?? post.isLiked ?? false;
  const hasImage = !!displayImage;

  const isPending = post.auditStatus === "PENDING";
  const isRejected = post.auditStatus === "REJECTED";
  // 审核中 + 驳回都需要在封面上压一层低饱和度滤镜，提示作者「这条不对外可见」。
  const isUnderReviewOrRejected = isPending || isRejected;

  const mediaRatio = clampAspectRatio(
    useMediaAspectRatio(displayImage, 3 / 4, post.content?.coverAspectRatio)
  );

  // Stable cover style — feed-scroll hot path.
  const coverStyle = useMemo(
    () => [
      styles.image,
      { aspectRatio: mediaRatio },
      isUnderReviewOrRejected && styles.pendingImage,
    ],
    [mediaRatio, isUnderReviewOrRejected]
  );

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
      {hasImage ? (
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

            {isRejected && (
              <View style={styles.rejectedBadge}>
                <Ionicons name="alert-circle" size={11} color="#FFFFFF" />
                <RNText style={styles.rejectedBadgeText}>
                  {t("postDetail.rejected")}
                </RNText>
              </View>
            )}
            {isPending && (
              <View style={styles.pendingBadge}>
                <RNText style={styles.badgeText}>{t("postDetail.pending")}</RNText>
              </View>
            )}
            {!isUnderReviewOrRejected && post.communityName && (
              <View style={styles.communityBadge}>
                <RNText style={styles.communityText}>
                  # {post.communityName}
                </RNText>
              </View>
            )}
            {!isUnderReviewOrRejected && !post.communityName && post.storeName && (
              <View style={styles.storeBadge}>
                <Ionicons name="storefront" size={10} color="#FFFFFF" />
                <RNText style={styles.storeText} numberOfLines={1}>
                  {post.storeName}
                </RNText>
              </View>
            )}
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={handlePressPost}>
          <View style={styles.textOnlyCover}>
            {isRejected && (
              <View style={styles.rejectedBadge}>
                <Ionicons name="alert-circle" size={11} color="#FFFFFF" />
                <RNText style={styles.rejectedBadgeText}>
                  {t("postDetail.rejected")}
                </RNText>
              </View>
            )}
            {isPending && (
              <View style={styles.pendingBadge}>
                <RNText style={styles.badgeText}>{t("postDetail.pending")}</RNText>
              </View>
            )}
            {!isUnderReviewOrRejected && post.communityName && (
              <View style={styles.communityBadge}>
                <RNText style={styles.communityText}>
                  # {post.communityName}
                </RNText>
              </View>
            )}
            {!isUnderReviewOrRejected && !post.communityName && post.storeName && (
              <View style={styles.storeBadge}>
                <Ionicons name="storefront" size={10} color="#FFFFFF" />
                <RNText style={styles.storeText} numberOfLines={1}>
                  {post.storeName}
                </RNText>
              </View>
            )}
            <RNText style={styles.textOnlyTitle} numberOfLines={3}>
              {displayTitle}
            </RNText>
            {textOnlyPlaceholder ? (
              <RNText style={styles.textOnlyDesc} numberOfLines={5}>
                {textOnlyPlaceholder}
              </RNText>
            ) : null}
          </View>
        </Pressable>
      )}

      {hasImage && (
        <Pressable onPress={handlePressPost}>
          <View style={styles.titleArea}>
            <RNText style={styles.title} numberOfLines={2}>
              {displayTitle}
            </RNText>
          </View>
        </Pressable>
      )}

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
    fontFamily: playfairFonts.medium,
  },
  // 驳回角标：饱和度高的红色 + 警告图标，与「审核中」的橘色明显区分，
  // 让用户在瀑布流中一眼定位需要修改的违规帖子。
  rejectedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: 3,
  },
  rejectedBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: playfairFonts.medium,
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
    fontFamily: playfairFonts.regular,
  },
  // 买手店帖子角标（migration 055）：和 community 角标视觉差异化, 用
  // 浅色背景 + 店铺图标, 让消费者一眼区分「这是买手店发的」.
  storeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 20, 0.78)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    maxWidth: 160,
  },
  storeText: {
    color: "#FFFFFF",
    fontSize: 11,
    marginLeft: 4,
    fontWeight: "500",
    fontFamily: playfairFonts.medium,
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
    fontFamily: playfairFonts.medium,
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
    fontFamily: playfairFonts.medium,
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
    fontFamily: playfairFonts.medium,
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
    fontFamily: playfairFonts.medium,
  },
  likeCountActive: {
    color: "#FF3040",
  },
  textOnlyCover: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    minHeight: 120,
    justifyContent: "center",
  },
  textOnlyTitle: {
    color: theme.colors.black,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: playfairFonts.bold,
  },
  textOnlyDesc: {
    color: theme.colors.gray600,
    fontSize: 13,
    lineHeight: 19,
    marginTop: theme.spacing.sm,
    fontFamily: playfairFonts.regular,
  },
});

export default PostCard;
