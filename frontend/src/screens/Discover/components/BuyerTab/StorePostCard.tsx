/**
 * 店铺帖子卡片（migration 055）—— Discover/Stores tab 的 Posts 子 tab 用.
 *
 * 设计思路：
 *   - 视觉风格对齐同屏 ProductCard：3:4 封面 + 标题 + 副信息行, 让用户在
 *     同一个买手店上下文里两种内容形态切换无认知负担.
 *   - 副信息行复用 store 上下文 (作者名 + 点赞数), 不重复 PostDetail 的
 *     完整 metadata; 商业目的就是把用户引到帖子详情页深度消费.
 *   - 点击整张卡 → PostDetail. 不带"收藏 / 分享"快捷按钮, 避免和 PostCard
 *     主体功能重复.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../../theme";
import type { Post as ApiPost } from "../../../../services/postService";
import { PLAYFAIR } from "./playfair";

interface StorePostCardProps {
  post: ApiPost;
  onPress: (postId: number) => void;
}

const StorePostCardImpl: React.FC<StorePostCardProps> = ({ post, onPress }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const cover = post.imageUrls?.[0];
  return (
    <Pressable onPress={() => onPress(post.id)} style={styles.card}>
      <Box style={styles.imageWrapper}>
        {cover ? (
          // allowDownscaling={false}: 同 PostCoverMedia 的 quality note (路径 2).
          // 2 列网格 + Pressable 内部布局会让 cell 在挂载/重排瞬间出现小于
          // 稳态宽度的 frame, expo-image 的 processImage 会在那一刻把 bitmap
          // 永久缩到那个尺寸写进 SDImageCache 内存缓存, 下次回到这条 uri 命中
          // cache 就只能拿到糊版本. 关掉 downscaling 让 GPU 走 trilinear 即时
          // 缩放, 不留低分辨率残影.
          <OptimizedImage
            uri={cover}
            size={ImageSize.MEDIUM}
            style={styles.image}
            contentFit="cover"
            lazy
            allowDownscaling={false}
          />
        ) : (
          <Box style={styles.imageEmpty}>
            <Ionicons
              name="image-outline"
              size={28}
              color={theme.colors.gray300}
            />
          </Box>
        )}
      </Box>
      <Box px={0} pt={10}>
        <Text numberOfLines={2} style={styles.title}>
          {post.title}
        </Text>
        <HStack alignItems="center" justifyContent="space-between" mt={6}>
          <Text numberOfLines={1} style={styles.author}>
            {post.username ? `@${post.username}` : ""}
          </Text>
          <HStack alignItems="center" gap={3}>
            <Ionicons
              name="heart-outline"
              size={14}
              color={theme.colors.gray200}
            />
            <Text style={styles.likeCount}>{post.likeCount ?? 0}</Text>
          </HStack>
        </HStack>
      </Box>
    </Pressable>
  );
};

export const StorePostCard = React.memo(StorePostCardImpl);

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: {
    flex: 1,
    paddingBottom: 16,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 13,
    fontWeight: "600",
    color: t.colors.text,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  author: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    color: t.colors.gray300,
    flex: 1,
    marginRight: 6,
  },
  likeCount: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    color: t.colors.gray300,
  },
});

export default StorePostCard;
