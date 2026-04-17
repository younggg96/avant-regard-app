import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  swipeContainer: {
    flex: 1,
  },
  row: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  rowUnread: {
    backgroundColor: `${theme.colors.accent}05`,
  },
  csAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
