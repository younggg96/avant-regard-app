import React from "react";
import { View, Text as RNText, StyleSheet, ViewStyle } from "react-native";
import { OptimizedImage } from "./OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useThemedStyles, type AppTheme } from "../../theme";
import { isPlaceholderAvatarUrl } from "../../utils/avatarUtils";

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const trimmed = name.trim();
  if (!trimmed) return "U";
  return trimmed.slice(0, 2).toUpperCase();
}

// `ImageSize.SMALL` was referenced here historically but never existed in
// the enum, so anything in (40, 80] silently fell through to `MEDIUM` via
// `getOptimizedImageUrl`'s default. We make the mapping explicit and use
// the real ladder: avatars up to 80dp are still well-served by THUMBNAIL
// (400px source → 240px container @3x DPR ≈ 1.7× headroom), and only
// genuinely large avatar/profile-header use cases need MEDIUM.
function getImageSize(size: number): ImageSize {
  if (size <= 80) return ImageSize.THUMBNAIL;
  return ImageSize.MEDIUM;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  uri,
  name,
  size = 40,
  style,
}) => {
  const styles = useThemedStyles(makeStyles);
  const borderRadius = size / 2;
  const fontSize = Math.max(10, Math.round(size * 0.36));
  const resolvedUri =
    uri && !isPlaceholderAvatarUrl(uri) ? uri : undefined;

  if (resolvedUri) {
    return (
      <OptimizedImage
        uri={resolvedUri}
        size={getImageSize(size)}
        style={[{ width: size, height: size, borderRadius }, style]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius },
        style,
      ]}
    >
      <RNText style={[styles.initials, { fontSize }]}>
        {getInitials(name)}
      </RNText>
    </View>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  placeholder: {
    backgroundColor: t.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: t.colors.gray400,
    fontWeight: "600",
  },
});
