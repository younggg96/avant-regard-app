import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeChatListStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    emptyContainer: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: t.spacing.xxl * 2,
      paddingHorizontal: t.spacing.xl,
    },
    emptyTitle: {
      ...t.typography.h3,
      color: t.colors.text,
      marginTop: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    emptyText: {
      ...t.typography.body,
      color: t.colors.gray400,
      textAlign: "center",
    },
    conversationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    unreadItem: {
      backgroundColor: `${t.colors.accent}05`,
    },
    avatarWrapper: {
      position: "relative",
      marginRight: t.spacing.md,
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
      ...t.typography.bodySmall,
      fontWeight: "600",
      color: t.colors.text,
      flex: 1,
      marginRight: t.spacing.sm,
    },
    conversationTime: {
      ...t.typography.caption,
      color: t.colors.gray200,
    },
    lastMessage: {
      ...t.typography.bodySmall,
      color: t.colors.gray300,
    },
    lastMessageUnread: {
      color: t.colors.text,
      fontWeight: "500",
    },
    titleBadge: {
      backgroundColor: t.colors.gray100,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      marginLeft: 4,
      flexShrink: 0,
    },
    titleBadgeText: {
      color: t.colors.gray600,
      fontSize: 9,
      fontWeight: "500",
    },
  });

export const useChatListStyles = () => useThemedStyles(makeChatListStyles);

/** Legacy static export — light only. Migrate to the hook for dark-mode. */
export const styles = makeChatListStyles(lightTheme);
