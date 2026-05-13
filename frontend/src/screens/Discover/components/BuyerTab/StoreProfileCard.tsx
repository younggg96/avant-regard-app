/**
 * 买手店简介区块 —— 视觉对齐 ETHOS 式买手店主页_demo：
 *   白底扁平、系统性无衬线正文 + 克制的留白；
 *   左：圆形 logo；中：店名 / 买手店徽标 / 一句话 / 信任标签行；
 *   右上：关注（黑药丸）+ 更多；右：竖版封面图；
 *   三列数据缩小排在标签行下方；底部长简介。
 */
import React, { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../../theme";
import { BuyerStoreProfileView } from "./types";
import { PLAYFAIR } from "./playfair";

interface StoreProfileCardProps {
  profile: BuyerStoreProfileView;
  /** 当前店在 Discover 已拉取的帖子条数（与 Posts tab 一致） */
  postsCount: number;
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
  if (index === 0) return "location-outline";
  return "pricetag-outline";
};

const formatCompactCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
};

/** 超过约此长度时显示「更多」（与 numberOfLines 配合，减少短文案误显示） */
const BIO_TRUNCATE_LINES = 4;
const BIO_MORE_MIN_CHARS = 48;

const StoreProfileCardImpl: React.FC<StoreProfileCardProps> = ({
  profile,
  postsCount,
  isFollowed,
  onFollowToggle,
  onDetailPress,
  onMorePress,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [bioExpanded, setBioExpanded] = useState(false);

  const {
    name,
    description,
    coverImage,
    logoImage,
    logoLetter,
    followerCount,
    productCount,
    tags,
    longDescription,
  } = profile;

  const showBioToggle = useMemo(
    () =>
      !!longDescription && longDescription.trim().length >= BIO_MORE_MIN_CHARS,
    [longDescription]
  );

  return (
    <Box px="$md" pt="$xs" pb="$md" mt="$md">
      <Pressable onPress={onDetailPress}>
        <HStack alignItems="flex-start" style={styles.topRow}>
          <VStack flex={1} style={styles.centerBlock} minWidth={0}>
            <HStack alignItems="flex-start" justifyContent="space-between">
              <VStack flex={1} pr="$2" minWidth={0}>
                <HStack alignItems="center" flexWrap="wrap" gap={6}>
                  <Text style={styles.storeName} numberOfLines={2}>
                    {name}
                  </Text>
                </HStack>
                {!!description && (
                  <Text style={styles.tagline} numberOfLines={2}>
                    {description}
                  </Text>
                )}
              </VStack>
              <HStack alignItems="center" gap={6} style={styles.actions}>
                <Pressable
                  onPress={(e: { stopPropagation?: () => void }) => {
                    e?.stopPropagation?.();
                    onFollowToggle();
                  }}
                  style={[
                    styles.followButton,
                    isFollowed ? styles.followButtonFollowed : styles.followButtonIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowed ? styles.followButtonTextFollowed : styles.followButtonTextIdle,
                    ]}
                  >
                    {isFollowed ? t("discover.buyerFollowedBtn") : t("discover.buyerFollowBtn")}
                  </Text>
                </Pressable>
              </HStack>
            </HStack>

            {tags.length > 0 && (
              <HStack mt={6} flexWrap="wrap" gap={2}>
                {tags.map((tag, idx) => (
                  <HStack key={`${tag}-${idx}`} alignItems="center" gap={4} style={styles.tagChip}>
                    <Ionicons
                      name={resolveTagIcon(tag, idx)}
                      size={11}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.tagText}>{tag}</Text>
                  </HStack>
                ))}
              </HStack>
            )}

            <HStack style={styles.statsRow}>
              <StatColumn value={formatCompactCount(followerCount)} label={t("discover.buyerStatFollowers")} />
              <StatColumn
                value={formatCompactCount(productCount)}
                label={t("discover.buyerStatProducts")}
              />
              <StatColumn value={formatCompactCount(postsCount)} label={t("discover.buyerStatPosts")} />
            </HStack>
          </VStack>

          <Box style={styles.heroWrap}>
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
          </Box>
        </HStack>
      </Pressable>

      {!!longDescription && (
        <Box mt="$2">
          <Text
            style={styles.bio}
            selectable
            numberOfLines={bioExpanded || !showBioToggle ? undefined : BIO_TRUNCATE_LINES}
          >
            {longDescription}
          </Text>
          {showBioToggle && (
            <Pressable
              onPress={() => setBioExpanded((e) => !e)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              mt="$1"
              alignSelf="flex-start"
            >
              <Text style={styles.bioMoreText}>
                {bioExpanded ? t("common.less") : t("common.more")}
              </Text>
            </Pressable>
          )}
        </Box>
      )}
    </Box>
  );
};

const StatColumn: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <Box style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Box>
  );
};

export const StoreProfileCard = React.memo(StoreProfileCardImpl);

const makeStyles = (t: AppTheme) => StyleSheet.create({
  topRow: {
    gap: 12,
  },

  centerBlock: {
    flexShrink: 1,
  },
  storeName: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 16,
    fontWeight: "600",
    color: t.colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  typeBadgeText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    fontWeight: "600",
    color: t.colors.gray400,
    letterSpacing: 0.2,
  },
  tagline: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 12,
    lineHeight: 17,
    color: t.colors.gray300,
    marginTop: 6,
  },
  tagChip: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    color: t.colors.gray300,
    fontWeight: "500",
  },
  actions: {
    flexShrink: 0,
  },
  followButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  followButtonIdle: {
    backgroundColor: t.colors.text,
  },
  followButtonFollowed: {
    backgroundColor: t.colors.card,
    borderWidth: 1,
    borderColor: t.colors.text,
  },
  followButtonText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    fontWeight: "600",
  },
  followButtonTextIdle: {
    color: t.colors.textInverted,
  },
  followButtonTextFollowed: {
    color: t.colors.text,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.card,
  },
  heroWrap: {
    width: 108,
    height: 168,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    flexShrink: 0,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    backgroundColor: t.colors.gray100,
  },
  statsRow: {
    marginTop: 10,
    paddingTop: 8,
    alignItems: "stretch",
    alignSelf: "stretch",
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 2,
    backgroundColor: t.colors.divider,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  statValue: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
    letterSpacing: -0.25,
  },
  statLabel: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 10,
    color: t.colors.gray300,
    marginTop: 3,
    fontWeight: "400",
  },
  bio: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: PLAYFAIR.regular,
    fontSize: 12,
    lineHeight: 22,
    color: t.colors.gray300,
    alignSelf: "stretch",
  },
  bioMoreText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 11,
    color: t.colors.text,
    textDecorationLine: "underline",
    letterSpacing: 0.1,
  },
});

export default StoreProfileCard;
