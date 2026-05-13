import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeSharedStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      padding: t.spacing.md,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 100,
    },
    loadingText: {
      ...t.typography.body,
      color: t.colors.gray400,
      marginTop: t.spacing.md,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 100,
    },
    emptyText: {
      ...t.typography.body,
      color: t.colors.gray300,
      marginTop: t.spacing.md,
    },
    emptySubtext: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: t.spacing.xs,
    },
    // Card
    postCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.md,
      marginBottom: t.spacing.md,
      ...t.shadows.sm,
    },
    postHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: t.spacing.sm,
    },
    postMeta: {
      flexDirection: "row",
      alignItems: "center",
    },
    postType: {
      ...t.typography.caption,
      color: t.colors.textInverted,
      backgroundColor: t.colors.text,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    postId: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginLeft: t.spacing.sm,
    },
    postDate: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    postTitle: {
      ...t.typography.h4,
      color: t.colors.text,
      marginBottom: t.spacing.xs,
    },
    postContent: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      marginBottom: t.spacing.sm,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: t.spacing.sm,
    },
    username: {
      ...t.typography.bodySmall,
      color: t.colors.text,
      marginLeft: 6,
      fontWeight: "500",
    },
    userId: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginLeft: 4,
    },
    // Action buttons
    actionButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
      paddingTop: t.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
      gap: 4,
    },
    actionButtonText: {
      ...t.typography.caption,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    approveButton: {
      backgroundColor: t.colors.success,
    },
    rejectButton: {
      backgroundColor: t.colors.error,
    },
    deletePostButton: {
      backgroundColor: "#FF6B6B",
    },
    viewButton: {
      backgroundColor: t.colors.gray100,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.lg,
      width: "85%",
      maxWidth: 400,
    },
    modalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: t.spacing.md,
    },
    modalTitle: {
      ...t.typography.h4,
      color: t.colors.text,
      marginBottom: t.spacing.md,
    },
    modalWarning: {
      ...t.typography.bodySmall,
      color: t.colors.error,
      marginBottom: t.spacing.md,
      lineHeight: 20,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.md,
      ...t.typography.body,
      color: t.colors.text,
      minHeight: 48,
      textAlignVertical: "top",
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: t.spacing.sm,
      marginTop: t.spacing.lg,
    },
    modalButton: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.borderRadius.md,
      minWidth: 80,
      alignItems: "center",
    },
    modalCancelButton: {
      backgroundColor: t.colors.gray100,
    },
    modalCancelText: {
      ...t.typography.button,
      color: t.colors.gray400,
    },
    modalConfirmButton: {
      backgroundColor: t.colors.error,
    },
    modalConfirmText: {
      ...t.typography.button,
      color: t.colors.textInverted,
    },
    // Pagination
    paginationContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: t.spacing.lg,
      gap: t.spacing.md,
    },
    pageButton: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.gray100,
      borderRadius: t.borderRadius.md,
    },
    pageButtonDisabled: {
      opacity: 0.5,
    },
    pageButtonText: {
      ...t.typography.bodySmall,
      color: t.colors.text,
    },
    pageInfo: {
      ...t.typography.body,
      color: t.colors.gray400,
    },
    // Form
    formLabel: {
      ...t.typography.bodySmall,
      color: t.colors.text,
      fontWeight: "600",
      marginBottom: t.spacing.xs,
      marginTop: t.spacing.sm,
    },
    formHint: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: 4,
      marginBottom: t.spacing.sm,
    },
    // Toggle
    statusToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: t.spacing.md,
    },
    statusToggleSwitch: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.gray200,
      padding: 2,
      justifyContent: "center",
    },
    statusToggleSwitchActive: {
      backgroundColor: t.colors.success,
    },
    statusToggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.colors.card,
    },
    statusToggleThumbActive: {
      alignSelf: "flex-end",
    },
    // Link type selector
    linkTypeContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.xs,
      marginBottom: t.spacing.sm,
    },
    linkTypeButton: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.gray100,
    },
    linkTypeButtonActive: {
      backgroundColor: t.colors.text,
    },
    linkTypeButtonText: {
      ...t.typography.caption,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    linkTypeButtonTextActive: {
      color: t.colors.textInverted,
    },
    // Upload
    uploadImageButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.text,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
      marginBottom: t.spacing.lg,
      gap: t.spacing.xs,
    },
    uploadImageButtonText: {
      ...t.typography.bodySmall,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    uploadSmallButton: {
      backgroundColor: t.colors.text,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
    },
    uploadSmallButtonText: {
      ...t.typography.caption,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
  });

export const useSharedStyles = () => useThemedStyles(makeSharedStyles);

/**
 * Legacy static export — frozen to the light theme. Kept temporarily so older
 * admin tabs that haven't been migrated to `useSharedStyles()` keep compiling.
 * New code should use the hook to support dark mode.
 */
export const sharedStyles = makeSharedStyles(lightTheme);

