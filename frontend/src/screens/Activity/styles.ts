import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    gap: 8,
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
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  notifImage: {
    width: 46,
    height: 56,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    position: "absolute",
    top: 16,
    right: theme.spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.gray100,
  },
  chipActive: {
    backgroundColor: theme.colors.black,
  },
});
