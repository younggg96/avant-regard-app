import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack, VStack, Image, Pressable, Box } from "../ui";
import { theme } from "../../theme";
import { Post } from "../PostCard";
import { styles } from "./styles";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 内容块类型定义
interface ContentBlock {
  id: string;
  type: "text" | "image";
  content: string;
}

interface PostContentSectionProps {
  post: Post;
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

// 渲染内容块
const ContentBlockRenderer: React.FC<{ block: ContentBlock }> = ({ block }) => {
  if (block.type === "text") {
    if (!block.content.trim()) return null;
    return (
      <Text
        fontFamily="Inter-Regular"
        fontSize={15}
        color="$gray600"
        style={contentStyles.blockText}
      >
        {block.content}
      </Text>
    );
  }

  if (block.type === "image") {
    return (
      <View style={contentStyles.blockImageContainer}>
        <Image
          source={{ uri: block.content }}
          style={contentStyles.blockImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  return null;
};

export const PostContentSection: React.FC<PostContentSectionProps> = ({
  post,
}) => {
  // 解析内容
  const contentBlocks = useMemo(
    () => parseContent(post.content?.description),
    [post.content?.description]
  );

  // 判断是否使用块格式
  const isBlockFormat = contentBlocks !== null;

  return (
    <VStack style={contentStyles.container}>
      {/* Title - 使用优雅的衬线字体 */}
      <Text
        fontFamily="PlayfairDisplay-Bold"
        fontSize={22}
        color="$black"
        style={contentStyles.title}
      >
        {post.content?.title}
      </Text>

      {/* Description - 支持块格式和纯文本格式 */}
      {isBlockFormat ? (
        // 块格式：渲染每个内容块
        <VStack style={contentStyles.blocksContainer}>
          {contentBlocks.map((block) => (
            <ContentBlockRenderer key={block.id} block={block} />
          ))}
        </VStack>
      ) : (
        // 纯文本格式：直接渲染
        post.content?.description && (
          <Text
            fontFamily="Inter-Regular"
            fontSize={15}
            color="$gray600"
            style={contentStyles.description}
          >
            {post.content.description}
          </Text>
        )
      )}

      {post.type === "article" && post.readTime && (
        <HStack style={contentStyles.metaRow}>
          <Ionicons
            name="time-outline"
            size={14}
            color={theme.colors.gray300}
          />
          <Text style={contentStyles.metaText}>
            {post.readTime}
          </Text>
        </HStack>
      )}

      {/* ITEM_REVIEW 类型显示品牌、产品名和评分 */}
      {post.type === "ITEM_REVIEW" && (
        <VStack style={contentStyles.reviewMeta}>
          {/* 品牌和产品名 - 优雅的标签样式 */}
          {(post.brandName || post.productName) && (
            <HStack style={contentStyles.tagRow}>
              {post.brandName && (
                <View style={contentStyles.brandTag}>
                  <Text style={contentStyles.brandTagText}>
                    {post.brandName}
                  </Text>
                </View>
              )}
              {post.productName && (
                <View style={contentStyles.productTag}>
                  <Text style={contentStyles.productTagText}>
                    {post.productName}
                  </Text>
                </View>
              )}
            </HStack>
          )}
          {/* 评分 - 精致的星级显示 */}
          {post.rating !== undefined && (
            <HStack style={contentStyles.ratingRow}>
              <HStack style={contentStyles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= post.rating! ? "star" : "star-outline"}
                    size={16}
                    color={star <= post.rating! ? "#D4AF37" : theme.colors.gray200}
                    style={contentStyles.starIcon}
                  />
                ))}
              </HStack>
              <Text style={contentStyles.ratingText}>
                {post.rating}.0
              </Text>
            </HStack>
          )}
        </VStack>
      )}
    </VStack>
  );
};

const contentStyles = StyleSheet.create({
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
  },
  blockImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.5625, // 16:9 比例
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray300,
    letterSpacing: 0.3,
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
    backgroundColor: theme.colors.black,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
  },
  brandTagText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: theme.colors.white,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  productTag: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  productTagText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
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
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
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
          <Image source={{ uri: item.imageUrl }} style={outfitStyles.itemImage} />
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

const outfitStyles = StyleSheet.create({
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
    backgroundColor: theme.colors.gray100,
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray300,
    letterSpacing: 3,
    marginHorizontal: 16,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  itemImage: {
    width: 64,
    height: 80,
    borderRadius: 4,
    backgroundColor: theme.colors.gray100,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  itemBrand: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray300,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: "Inter-Bold",
    color: theme.colors.black,
  },
});
