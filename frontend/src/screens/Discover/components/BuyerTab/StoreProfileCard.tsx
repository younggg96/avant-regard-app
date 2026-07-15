/**
 * 买手店简介区块 —— 杂志画册式排版：
 *   左列：大号衬线英文店名 / 中文名 / 短分隔线 / 一句话简介 /
 *         描边胶囊标签 / 三列数据(竖线分隔) / 黑色关注按钮 + 圆形分享按钮；
 *   右列：大圆角竖版封面图，高度随左列内容自适应。
 */
import React, { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Box, HStack, Pressable, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useThemedStyles, type AppTheme } from "../../../../theme";
import { BuyerStoreProfileView } from "./types";
import { PLAYFAIR } from "./playfair";

interface StoreProfileCardProps {
  profile: BuyerStoreProfileView;
  /** 当前店在 Discover 已拉取的帖子条数（与 Posts tab 一致） */
  postsCount: number;
  isFollowed: boolean;
  onFollowToggle: () => void;
  onDetailPress: () => void;
}

const formatCompactCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
};

/**
 * 店名形如 "HECAITI 赫卡帝"（拉丁名 + 中文名）时拆成两行排版；
 * 找不到 CJK 段则整名走主标题。
 */
const splitStoreName = (name: string): { primary: string; secondary: string } => {
  const match = name.match(/^([^\u4e00-\u9fff]*?)\s*([\u4e00-\u9fff][\s\S]*)$/);
  if (match && match[1].trim()) {
    return { primary: match[1].trim(), secondary: match[2].trim() };
  }
  return { primary: name.trim(), secondary: "" };
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
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [bioExpanded, setBioExpanded] = useState(false);

  const {
    name,
    description,
    coverImage,
    followerCount,
    productCount,
    tags,
    longDescription,
  } = profile;

  const { primary: primaryName, secondary: secondaryName } = useMemo(
    () => splitStoreName(name),
    [name]
  );

  // 长简介和短简介一致时不重复渲染底部段落（设计稿只出现一次文案）。
  const bioText = useMemo(() => {
    const trimmed = (longDescription ?? "").trim();
    if (!trimmed || trimmed === description.trim()) return "";
    return trimmed;
  }, [longDescription, description]);

  const showBioToggle = useMemo(
    () => bioText.length >= BIO_MORE_MIN_CHARS,
    [bioText]
  );

  return (
    <Box px="$md" pt="$xs" pb="$md" mt="$md">
      <Pressable onPress={onDetailPress}>
        <HStack alignItems="stretch" style={styles.topRow}>
          <VStack flex={1} minWidth={0}>
            <Text style={styles.storeNamePrimary} numberOfLines={2}>
              {primaryName}
            </Text>
            {!!secondaryName && (
              <Text style={styles.storeNameSecondary} numberOfLines={1}>
                {secondaryName}
              </Text>
            )}

            <Box style={styles.nameDivider} />

            {!!description && (
              <Text style={styles.tagline} numberOfLines={2}>
                {description}
              </Text>
            )}

            {tags.length > 0 && (
              <HStack mt={10} gap={6}>
                {tags.slice(0, 4).map((tag, idx) => (
                  <Box key={`${tag}-${idx}`} style={styles.tagPill}>
                    <Text style={styles.tagText} numberOfLines={1}>{tag}</Text>
                  </Box>
                ))}
              </HStack>
            )}

            <HStack style={styles.statsRow} alignItems="center">
              <StatColumn
                value={formatCompactCount(followerCount)}
                label={t("discover.buyerStatFollowers")}
              />
              <Box style={styles.statsDivider} />
              <StatColumn
                value={formatCompactCount(productCount)}
                label={t("discover.buyerStatProducts")}
              />
              <Box style={styles.statsDivider} />
              <StatColumn
                value={formatCompactCount(postsCount)}
                label={t("discover.buyerStatPosts")}
              />
            </HStack>

            <HStack alignItems="center" style={styles.actionsRow}>
              <Pressable
                onPress={(e: { stopPropagation?: () => void }) => {
                  e?.stopPropagation?.();
                  onFollowToggle();
                }}
                style={styles.followButton}
              >
                <Text style={styles.followButtonText}>
                  {isFollowed
                    ? t("discover.buyerFollowedBtn")
                    : t("discover.buyerFollowBtn")}
                </Text>
              </Pressable>
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

      {!!bioText && (
        <Box mt="$sm">
          <Text
            style={styles.bio}
            selectable
            numberOfLines={bioExpanded || !showBioToggle ? undefined : BIO_TRUNCATE_LINES}
          >
            {bioText}
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
    gap: 14,
  },
  storeNamePrimary: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 22,
    fontWeight: "700",
    color: t.colors.text,
    letterSpacing: 0.7,
    lineHeight: 26,
  },
  storeNameSecondary: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 13,
    fontWeight: "500",
    color: t.colors.text,
    letterSpacing: 1,
    marginTop: 2,
  },
  nameDivider: {
    width: 32,
    height: 2,
    backgroundColor: t.colors.text,
    marginTop: 9,
    marginBottom: 9,
  },
  tagline: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    lineHeight: 16,
    color: t.colors.text,
  },
  tagPill: {
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.text,
  },
  tagText: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 8,
    lineHeight: 12,
    color: t.colors.text,
    fontWeight: "400",
  },
  statsRow: {
    marginTop: 13,
    alignSelf: "stretch",
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: t.colors.text,
    opacity: 0.5,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  statValue: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 13,
    fontWeight: "700",
    color: t.colors.text,
    letterSpacing: -0.25,
  },
  statLabel: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 8,
    color: t.colors.gray400,
    marginTop: 3,
    fontWeight: "400",
  },
  actionsRow: {
    marginTop: 12,
  },
  followButton: {
    minWidth: 108,
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: t.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    fontWeight: "600",
    color: t.colors.textInverted,
    letterSpacing: 0.5,
  },
  heroWrap: {
    width: 150,
    height: 244,
    borderRadius: 4,
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
  bio: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    lineHeight: 18,
    color: t.colors.gray400,
    alignSelf: "stretch",
  },
  bioMoreText: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    color: t.colors.text,
    textDecorationLine: "underline",
    letterSpacing: 0.1,
  },
});

export default StoreProfileCard;
