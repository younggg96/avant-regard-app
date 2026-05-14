import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack, VStack, Pressable, Box } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../theme";
import { Post } from "../PostCard";
import HalfStarRating from "../HalfStarRating";
import { VideoPlayer } from "./VideoPlayer";
import { useMediaAspectRatio } from "../../utils/useMediaAspectRatio";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ContentBlock {
  id: string;
  type: "text" | "image" | "video";
  content: string;
}

interface PostContentSectionProps {
  post: Post;
  onOpenMediaFullscreen?: (index: number, mediaUris: string[]) => void;
  mediaUrisForViewer?: string[];
  hideFirstCoverImage?: boolean;
}

// 解析内容：支持新的块格式和旧的纯文本格式
const parseContent = (description: string | undefined): ContentBlock[] | null => {
  if (!description) return null;

  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      return parsed as ContentBlock[];
    }
  } catch {
    // 不是 JSON，返回 null 表示使用纯文本模式
  }
  return null;
};

// Full-bleed media blocks share the first media's aspect ratio so the lead
// asset has no letterboxing under `contain`; later assets may pillar/letterbox.
const VideoBlockRenderer: React.FC<{ uri: string; frameRatio: number }> = ({
  uri,
  frameRatio,
}) => {
  const contentStyles = useThemedStyles(makeContentStyles);
  const mediaSize = { width: SCREEN_WIDTH, height: SCREEN_WIDTH / frameRatio };
  return (
    <VideoPlayer
      uri={uri}
      style={[contentStyles.blockImageContainer, mediaSize]}
      videoStyle={mediaSize}
      contentFit="contain"
    />
  );
};

const ImageBlockRenderer: React.FC<{ uri: string; frameRatio: number }> = ({
  uri,
  frameRatio,
}) => {
  const theme = useAppTheme();
  const contentStyles = useThemedStyles(makeContentStyles);
  const mediaSize = { width: SCREEN_WIDTH, height: SCREEN_WIDTH / frameRatio };
  return (
    <View style={[contentStyles.blockImageContainer, mediaSize]}>
      <OptimizedImage
        uri={uri}
        size={ImageSize.LARGE}
        style={mediaSize}
        contentFit="contain"
        placeholderColor={theme.colors.gray50}
        lazy={true}
      />
    </View>
  );
};

const ContentBlockRenderer: React.FC<{
  block: ContentBlock;
  frameRatio: number;
  onOpenMediaFullscreen?: () => void;
}> = ({ block, frameRatio, onOpenMediaFullscreen }) => {
  const contentStyles = useThemedStyles(makeContentStyles);
  if (block.type === "text") {
    if (!block.content.trim()) return null;
    return (
      <Text
        fontFamily="PlayfairDisplay-Regular"
        fontSize={15}
        style={[contentStyles.blockText, { color: theme.colors.gray600 }]}

      >
        {block.content}
      </Text>
    );
  }

  if (block.type === "video" || (block.type === "image" && isVideoUrl(block.content))) {
    return <VideoBlockRenderer uri={block.content} frameRatio={frameRatio} />;
  }

  if (block.type === "image") {
    if (onOpenMediaFullscreen) {
      return (
        <Pressable onPress={onOpenMediaFullscreen}>
          <ImageBlockRenderer uri={block.content} frameRatio={frameRatio} />
        </Pressable>
      );
    }
    return <ImageBlockRenderer uri={block.content} frameRatio={frameRatio} />;
  }

  return null;
};

export const PostContentSection: React.FC<PostContentSectionProps> = ({
  post,
  onOpenMediaFullscreen,
  mediaUrisForViewer,
  hideFirstCoverImage = false,
}) => {
  const theme = useAppTheme();
  const contentStyles = useThemedStyles(makeContentStyles);
  // 解析内容
  const contentBlocks = useMemo(
    () => parseContent(post.content?.description),
    [post.content?.description]
  );

  const firstMediaUri = useMemo(() => {
    if (!contentBlocks) return undefined;
    for (const b of contentBlocks) {
      if (b.type === "video" || b.type === "image") {
        const c = b.content?.trim();
        if (c) return c;
      }
    }
    return undefined;
  }, [contentBlocks]);

  // 判断是否使用块格式
  const isBlockFormat = contentBlocks !== null;
  const isForumPost = !!post.communityName;
  const coverUri = post.content?.images?.[0];

  const firstMediaKnownRatio =
    firstMediaUri &&
    post.content?.images?.[0] === firstMediaUri &&
    typeof post.content?.coverAspectRatio === "number"
      ? post.content.coverAspectRatio
      : undefined;

  const frameRatio = useMediaAspectRatio(
    firstMediaUri,
    isForumPost ? 1 : 16 / 9,
    firstMediaKnownRatio
  );

  const viewerMediaUris = useMemo(() => {
    if (mediaUrisForViewer && mediaUrisForViewer.length > 0) return mediaUrisForViewer;
    return post.content?.images || [];
  }, [mediaUrisForViewer, post.content?.images]);

  const mediaIndexByUri = useMemo(() => {
    const map = new Map<string, number>();
    viewerMediaUris.forEach((uri, idx) => {
      if (!map.has(uri)) {
        map.set(uri, idx);
      }
    });
    return map;
  }, [viewerMediaUris]);

  const filteredBlocks = useMemo(() => {
    if (!contentBlocks) return [];
    if (!hideFirstCoverImage || !coverUri) return contentBlocks;
    let hasHiddenCover = false;
    return contentBlocks.filter((block) => {
      if (
        !hasHiddenCover &&
        block.type === "image" &&
        block.content?.trim() === coverUri
      ) {
        hasHiddenCover = true;
        return false;
      }
      return true;
    });
  }, [contentBlocks, hideFirstCoverImage, coverUri]);

  return (
    <VStack style={contentStyles.container}>
      {/* Title - 使用优雅的衬线字体 */}
      <Text
        fontFamily="PlayfairDisplay-Bold"
        fontSize={22}
        style={[contentStyles.title, { color: theme.colors.black }]}

      >
        {post.content?.title}
      </Text>

      {/* Description - 支持块格式和纯文本格式 */}
      {isBlockFormat ? (
        // 块格式：渲染每个内容块
        <VStack style={contentStyles.blocksContainer}>
          {filteredBlocks.map((block) => {
            const mediaUri = block.content?.trim();
            const mediaIndex = mediaUri ? (mediaIndexByUri.get(mediaUri) ?? 0) : 0;
            const openFullscreen =
              block.type === "image" && onOpenMediaFullscreen
                ? () => onOpenMediaFullscreen(mediaIndex, viewerMediaUris)
                : undefined;
            return (
              <ContentBlockRenderer
                key={block.id}
                block={block}
                frameRatio={frameRatio}
                onOpenMediaFullscreen={openFullscreen}
              />
            );
          })}
        </VStack>
      ) : (
        // 纯文本格式：直接渲染
        post.content?.description && (
          <Text
            fontFamily="PlayfairDisplay-Regular"
            fontSize={15}
            style={[contentStyles.description, { color: theme.colors.gray600 }]}

          >
            {post.content.description}
          </Text>
        )
      )}

      {/* ITEM_REVIEW 类型显示品牌、产品名和评分 */}
      {post.type === "ITEM_REVIEW" && (() => {
        // productName 历史上是单字符串字段, 但发布端允许用 \n 分隔多个单品
        // (PublishReviewScreen / PublishV2Composer 都按这个约定写入)。
        // 这里拆开后每个单品独占一个标签, 避免出现一长串挤在一起的情况。
        const productNameList = post.productName
          ? post.productName
              .split("\n")
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
          : [];
        return (
          <VStack style={contentStyles.reviewMeta}>
            {/* 品牌和产品名 - 优雅的标签样式 */}
            {(post.brandName || productNameList.length > 0) && (
              <HStack style={contentStyles.tagRow}>
                {post.brandName && (
                  <View style={contentStyles.brandTag}>
                    <Text style={contentStyles.brandTagText}>
                      {post.brandName}
                    </Text>
                  </View>
                )}
                {productNameList.map((name, idx) => (
                  <View
                    key={`product-tag-${idx}`}
                    style={contentStyles.productTag}
                  >
                    <Text style={contentStyles.productTagText}>{name}</Text>
                  </View>
                ))}
              </HStack>
            )}
            {/* 评分 - 精致的星级显示 */}
            {post.rating !== undefined && (
              <HStack style={contentStyles.ratingRow}>
                <HalfStarRating
                  rating={post.rating}
                  size={16}
                  color="#D4AF37"
                  inactiveColor={theme.colors.gray200}
                  gap={2}
                />
                <Text style={contentStyles.ratingText}>
                  {post.rating % 1 === 0 ? `${post.rating}.0` : post.rating.toFixed(1)}
                </Text>
              </HStack>
            )}
          </VStack>
        );
      })()}
    </VStack>
  );
};

const makeContentStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      letterSpacing: -0.3,
      lineHeight: 30,
      marginBottom: 12,
    },
    description: {
      lineHeight: 24,
      letterSpacing: 0.2,
      marginBottom: 16,
    },
    // 块格式样式
    blocksContainer: {
      marginBottom: 16,
    },
    blockText: {
      lineHeight: 24,
      letterSpacing: 0.2,
      marginBottom: 16,
    },
    blockImageContainer: {
      marginHorizontal: -20, // 让图片撑满屏幕宽度
      marginBottom: 16,
      backgroundColor: t.colors.gray50,
    },
    reviewMeta: {
      marginTop: 4,
      gap: 14,
    },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    brandTag: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 4,
    },
    brandTagText: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    productTag: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.colors.gray200,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 4,
    },
    productTagText: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      letterSpacing: 0.5,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    starsContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    ratingText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
      letterSpacing: 0.5,
    },
  });

// 搭配单品组件
interface OutfitItemsSectionProps {
  items: Post["items"];
}

export const OutfitItemsSection: React.FC<OutfitItemsSectionProps> = ({
  items,
}) => {
  const theme = useAppTheme();
  const outfitStyles = useThemedStyles(makeOutfitStyles);
  if (!items || items.length === 0) return null;

  return (
    <View style={outfitStyles.container}>
      {/* 标题区域 - 带有精致的分割线 */}
      <View style={outfitStyles.headerSection}>
        <View style={outfitStyles.headerLine} />
        <Text style={outfitStyles.headerTitle}>
          ITEMS
        </Text>
        <View style={outfitStyles.headerLine} />
      </View>

      {items.map((item, index) => (
        <Pressable key={item.id} style={outfitStyles.itemCard}>
          <OptimizedImage
            uri={item.imageUrl}
            size={ImageSize.MEDIUM}
            style={outfitStyles.itemImage}
            contentFit="cover"
            lazy={true}
          />
          <View style={outfitStyles.itemInfo}>
            <Text style={outfitStyles.itemBrand}>
              {item.brand}
            </Text>
            <Text style={outfitStyles.itemName}>
              {item.name}
            </Text>
            <Text style={outfitStyles.itemPrice}>
              {item.price}
            </Text>
          </View>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={theme.colors.gray300}
          />
        </Pressable>
      ))}
    </View>
  );
};

const makeOutfitStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 20,
    },
    headerSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    headerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.gray100,
    },
    headerTitle: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray300,
      letterSpacing: 3,
      marginHorizontal: 16,
    },
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.gray100,
    },
    itemImage: {
      width: 64,
      height: 80,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
    },
    itemInfo: {
      flex: 1,
      marginLeft: 14,
    },
    itemBrand: {
      fontSize: 10,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray300,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    itemName: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 6,
    },
    itemPrice: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
  });
