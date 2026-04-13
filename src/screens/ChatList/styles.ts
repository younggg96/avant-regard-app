import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  unreadItem: {
    backgroundColor: `${theme.colors.accent}05`,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: theme.spacing.md,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    ...theme.typography.bodySmall,
    fontWeight: "600",
    color: theme.colors.black,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  conversationTime: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
  },
  lastMessage: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
  },
  lastMessageUnread: {
    color: theme.colors.black,
    fontWeight: "500",
  },
});
