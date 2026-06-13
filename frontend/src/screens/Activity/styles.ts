import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeActivityStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    filterBar: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    row: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowUnread: {
      backgroundColor: `${t.colors.accent}05`,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    iconBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 5,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: t.colors.card,
    },
    notifImage: {
      width: 46,
      height: 56,
      borderRadius: t.borderRadius.sm,
      marginLeft: t.spacing.sm,
    },
    unreadIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.error,
      position: "absolute",
      top: 16,
      right: t.spacing.md,
    },
  });

export const useActivityStyles = () => useThemedStyles(makeActivityStyles);

/** Legacy static export — light only. Migrate to the hook for dark-mode. */
export const styles = makeActivityStyles(lightTheme);
