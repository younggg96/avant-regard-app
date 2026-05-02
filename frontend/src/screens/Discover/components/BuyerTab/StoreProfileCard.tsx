/**
 * 买手店简介卡片。
 *
 * 视觉结构（按设计稿）：
 *   - 左上：圆形 logo（店铺首字母占位 / 或店铺封面）
 *   - 右上：店铺封面大图（占右半幅）
 *   - 左下：店铺名 + 「买手店」徽标 + 简介 + 标签 chips
 *   - 右上角 overlay：「关注 / 已关注」按钮 + 更多按钮
 *   - 分隔线下方：粉丝 / 关注 / 帖子 三列统计
 *   - 最底部：长简介
 *
 * 组件自身只负责渲染 + 把点击事件透传出去，所有文案都从
 * `BuyerStoreProfileView`（`useBuyerTabData` 合成）读取，避免在 UI 层
 * 里重复格式化数字或兜底空字段。
 */
import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { theme } from "../../../../theme";
import { BuyerStoreProfileView } from "./types";

interface StoreProfileCardProps {
  profile: BuyerStoreProfileView;
  isFollowed: boolean;
  onFollowToggle: () => void;
  onDetailPress: () => void;
  onMorePress: () => void;
}

const TAG_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  包邮: "cube-outline",
  官方认证: "checkmark-circle-outline",
  全球采购: "globe-outline",
};

const resolveTagIcon = (tag: string, index: number): keyof typeof Ionicons.glyphMap => {
  if (TAG_ICONS[tag]) return TAG_ICONS[tag];
  // 第一个 tag 通常是城市（"上海" / "东京"）；用定位图标最直观。
  if (index === 0) return "location-outline";
  return "pricetag-outline";
};

const StoreProfileCardImpl: React.FC<StoreProfileCardProps> = ({
  profile,
  isFollowed,
  onFollowToggle,
  onDetailPress,
  onMorePress,
}) => {
  const { t } = useTranslation();
  const {
    name,
    description,
    coverImage,
    logoImage,
    logoLetter,
    followerLabel,
    followingLabel,
    postCountLabel,
    tags,
    longDescription,
  } = profile;

  return (
    <Box mx="$md" mt="$sm" mb="$sm" bg="$white" borderWidth={1} borderColor="#F0F0F0" rounded="$md" overflow="hidden">
      <Pressable onPress={onDetailPress}>
        <HStack>
          <Box style={styles.leftPane}>
            {/* <Box style={styles.logoWrapper}> */}
              {/* 商家在 profile_config.logoImage 配了图就用图；没有就落回
                  店名首字母占位。这是 Phase 3 把 StoreProfileCard 接上
                  后端配置的核心改动之一（老逻辑只有 logoLetter 分支）。 */}
              {/* {logoImage ? (
                <OptimizedImage
                  uri={logoImage}
                  size={ImageSize.THUMBNAIL}
                  style={styles.logoImage}
                  contentFit="cover"
                  lazy
                />
              ) : (
                <Text style={styles.logoText}>{logoLetter}</Text>
              )} */}
            {/* </Box> */}
            <VStack flex={1} mt="$sm" pr="$xs">
              <HStack alignItems="center" gap={6} mb={2}>
                <Text
                  fontSize={17}
                  fontWeight="$bold"
                  color="$black"
                  numberOfLines={1}
                  style={styles.storeName}
                >
                  {name}
                </Text>
                <Box style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{t("discover.buyerStoreBadge")}</Text>
                </Box>
              </HStack>
              <Text fontSize={12} color="$gray300" numberOfLines={2} lineHeight={16}>
                {description}
              </Text>
              <HStack mt="$sm" flexWrap="wrap" gap={6}>
                {tags.map((tag, idx) => (
                  <HStack
                    key={`${tag}-${idx}`}
                    alignItems="center"
                    gap={3}
                    style={styles.tagChip}
                  >
                    <Ionicons
                      name={resolveTagIcon(tag, idx)}
                      size={10}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.tagText}>{tag}</Text>
                  </HStack>
                ))}
              </HStack>
            </VStack>
          </Box>

          <Box style={styles.rightPane}>
            {coverImage ? (
              <OptimizedImage
                uri={coverImage}
                size={ImageSize.MEDIUM}
                style={styles.coverImage}
                contentFit="cover"
                lazy
              />
            ) : (
              <Box style={[styles.coverImage, styles.coverFallback]} />
            )}

            <Box style={styles.overlayControls}>
              <Pressable
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onFollowToggle();
                }}
                style={[
                  styles.followButton,
                  isFollowed
                    ? styles.followButtonFollowed
                    : styles.followButtonIdle,
                ]}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowed
                      ? styles.followButtonTextFollowed
                      : styles.followButtonTextIdle,
                  ]}
                >
                  {isFollowed ? t("discover.buyerFollowedBtn") : t("discover.buyerFollowBtn")}
                </Text>
              </Pressable>
              {/* <Pressable
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onMorePress();
                }}
                style={styles.moreButton}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.white} />
              </Pressable> */}
            </Box>
          </Box>
        </HStack>
      </Pressable>

      <HStack style={styles.statsRow}>
        <StatColumn value={followerLabel} label={t("discover.buyerStatFollowers")} />
        <Box style={styles.statsDivider} />
        <StatColumn value={followingLabel} label={t("discover.buyerStatFollowing")} />
        <Box style={styles.statsDivider} />
        <StatColumn value={postCountLabel} label={t("discover.buyerStatPosts")} />
      </HStack>

      <Box px="$md" pb="$md">
        <Text fontSize={12} color="$gray300" lineHeight={18}>
          {longDescription}
        </Text>
      </Box>
    </Box>
  );
};

const StatColumn: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <Box style={styles.statCell}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Box>
);

export const StoreProfileCard = React.memo(StoreProfileCardImpl);

const styles = StyleSheet.create({
  leftPane: {
    flex: 1,
    padding: 12,
    paddingRight: 8,
  },
  rightPane: {
    width: 140,
    height: 170,
    position: "relative",
    backgroundColor: theme.colors.gray100,
  },
  logoWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.black,
    letterSpacing: 1,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  storeName: {
    maxWidth: 120,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  tagText: {
    fontSize: 10,
    color: theme.colors.gray300,
    fontWeight: "500",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    backgroundColor: theme.colors.gray100,
  },
  overlayControls: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  followButtonIdle: {
    backgroundColor: theme.colors.black,
  },
  followButtonFollowed: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: theme.colors.white,
  },
  followButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  followButtonTextIdle: {
    color: theme.colors.white,
  },
  followButtonTextFollowed: {
    color: theme.colors.white,
  },
  moreButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    marginHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
    alignItems: "center",
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: theme.colors.gray100,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.black,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray300,
    marginTop: 2,
  },
});

export default StoreProfileCard;
