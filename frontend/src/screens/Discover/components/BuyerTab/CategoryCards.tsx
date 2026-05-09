/**
 * 入口卡片 (CategoryCards) —— "分类 / 折扣 / 活动 / 新品" 等入口。
 *
 * 数据流：
 *   - 由 BuyerTab/index 从 `useBuyerTabData` 读到的 `entryCards` 数组驱动，
 *     来自后端 `/store/{id}/entry-cards`；商家未配置时 hook 返回空数组，
 *     本组件直接 `return null` 隐藏整段（2026-04-29 去 mock 起不再合成
 *     4 张 Unsplash 兜底卡）。
 *   - 卡片数量动态：
 *       · ≤ 4 张：4 等宽，视觉 = 旧版；
 *       · > 4 张：自动切成横向滚动，单卡固定宽度，和 4 等宽时的单卡同宽，
 *                 保证滑动节奏统一。
 *   - 点击回调带上整个 card View（含 cardType / targetCategoryId），父组件
 *     根据 `cardType` 去分发到对应列表页，本组件不再知道"路由"这一层。
 */
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, ScrollView, Text } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { theme } from "../../../../theme";
import { SCREEN_WIDTH } from "../../constants";
import type { StoreEntryCardView } from "./types";
import { PLAYFAIR } from "./playfair";

interface CategoryCardsProps {
  cards: StoreEntryCardView[];
  onPress: (card: StoreEntryCardView) => void;
}

// 布局常量：4 等宽时每张卡片宽度 = (屏宽 - 左右外边距 2×16 - 3 个间距) / 4。
const HORIZONTAL_MARGIN = 16;
const CARD_GAP = 10;
const FOUR_COL_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_MARGIN * 2 - CARD_GAP * 3) / 4;

const CardItem: React.FC<{
  item: StoreEntryCardView;
  width: number;
  onPress: (card: StoreEntryCardView) => void;
}> = React.memo(({ item, width, onPress }) => (
  <Pressable
    onPress={() => onPress(item)}
    style={[styles.card, { width, height: width }]}
  >
    <OptimizedImage
      uri={item.image}
      size={ImageSize.MEDIUM}
      style={styles.cardImage}
      contentFit="cover"
      lazy
    />
    <Box style={styles.cardOverlay} />
    <Box style={styles.cardContent}>
      <Text style={styles.cardLabel}>{item.label}</Text>
      {!!item.labelEn && (
        <Text style={styles.cardLabelEn}>{item.labelEn}</Text>
      )}
    </Box>
  </Pressable>
));
CardItem.displayName = "CategoryCardItem";

const CategoryCardsImpl: React.FC<CategoryCardsProps> = ({ cards, onPress }) => {
  // 商家未配置入口卡片时 hook 返回空数组 —— 直接隐藏整段，避免留一段
  // 空白撑着版面。
  const hasCards = cards.length > 0;

  const handlePress = useCallback(
    (card: StoreEntryCardView) => onPress(card),
    [onPress]
  );

  if (!hasCards) {
    return null;
  }

  // 卡片数 ≤ 4：等宽铺满一行（HStack 配合 flex:1）；> 4：横向滚动，单卡固定宽。
  if (cards.length <= 4) {
    return (
      <Box mx={HORIZONTAL_MARGIN} mt="$sm" mb="$md">
        <HStack gap={CARD_GAP}>
          {cards.map((card) => (
            <Box key={card.id} flex={1}>
              <CardItem
                item={card}
                width={FOUR_COL_WIDTH}
                onPress={handlePress}
              />
            </Box>
          ))}
        </HStack>
      </Box>
    );
  }

  return (
    <Box mt="$sm" mb="$md">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((card) => (
          <Box
            key={card.id}
            style={{ marginRight: CARD_GAP }}
          >
            <CardItem
              item={card}
              width={FOUR_COL_WIDTH}
              onPress={handlePress}
            />
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
};

export const CategoryCards = React.memo(CategoryCardsImpl);

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: HORIZONTAL_MARGIN,
  },
  card: {
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: theme.colors.black,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  cardContent: {
    flex: 1,
    padding: 8,
    justifyContent: "flex-start",
  },
  cardLabel: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.white,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  cardLabelEn: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.88)",
    marginTop: 4,
  },
});

export default CategoryCards;
