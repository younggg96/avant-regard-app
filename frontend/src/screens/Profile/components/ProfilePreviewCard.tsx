/**
 * ProfilePreviewCard —— 个人主页头部双列预览卡（图二「收藏的单品 / MY ARCHIVE」样式）。
 *
 * 标题 + 数量 + 一排缩略图预览，点击进入对应列表页。视觉沿用 ProfileSectionCard，
 * 颜色 / 圆角全部走 theme tokens，自动兼容 light / dark。
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { OptimizedImage, Text } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { ProfileSectionCard } from "./ProfileSectionCard";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const MAX_VISIBLE = 3;

interface ProfilePreviewCardProps {
  title: string;
  count?: number;
  covers?: string[];
  fallbackIcon: IoniconName;
  onPress: () => void;
}

export const ProfilePreviewCard: React.FC<ProfilePreviewCardProps> = ({
  title,
  count,
  covers = [],
  fallbackIcon,
  onPress,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const visible = covers.filter(Boolean).slice(0, MAX_VISIBLE);
  const extraCount = Math.max(0, (count ?? visible.length) - visible.length);

  return (
    <ProfileSectionCard
      cardTitle={title}
      cardTitleCount={count}
      embedded
      embeddedFlex={1}
      showChevron
      onPress={onPress}
      cardStyle={styles.cardFill}
    >
      <View style={styles.thumbRow}>
        {visible.length > 0 ? (
          <>
            {visible.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.thumb}>
                <OptimizedImage
                  uri={uri}
                  size={ImageSize.THUMBNAIL}
                  style={styles.thumbImage}
                  contentFit="cover"
                  lazy
                />
              </View>
            ))}
            {extraCount > 0 ? (
              <View style={[styles.thumb, styles.moreThumb]}>
                <Text style={styles.moreText}>+{extraCount}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.thumb, styles.emptyThumb]}>
            <Ionicons
              name={fallbackIcon}
              size={18}
              color={theme.colors.gray300}
            />
          </View>
        )}
      </View>
    </ProfileSectionCard>
  );
};
ProfilePreviewCard.displayName = "ProfilePreviewCard";

const THUMB_SIZE = 40;

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    cardFill: {
      minHeight: 96,
    },
    thumbRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    thumbImage: {
      width: "100%",
      height: "100%",
    },
    moreThumb: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    moreText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.textSecondary,
    },
    emptyThumb: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
  });

export default ProfilePreviewCard;
