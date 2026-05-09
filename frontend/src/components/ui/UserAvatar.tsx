import React from "react";
import { View, Text as RNText, StyleSheet, ViewStyle } from "react-native";
import { OptimizedImage } from "./OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { theme } from "../../theme";

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}

const FALLBACK_BG = theme.colors.gray100;
const FALLBACK_TEXT_COLOR = theme.colors.gray400;

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
  const borderRadius = size / 2;
  const fontSize = Math.max(10, Math.round(size * 0.36));

  if (uri) {
    return (
      <OptimizedImage
        uri={uri}
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

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: FALLBACK_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: FALLBACK_TEXT_COLOR,
    fontWeight: "600",
  },
});
