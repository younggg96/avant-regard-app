import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeInteractionStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    swipeContainer: {
      flex: 1,
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
  });

export const useInteractionStyles = () => useThemedStyles(makeInteractionStyles);

/** Legacy static export — light only. Migrate to the hook for dark-mode. */
export const styles = makeInteractionStyles(lightTheme);
