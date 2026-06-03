import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeSharedStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      padding: 10,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    loadingText: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      marginTop: t.spacing.sm,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      ...t.typography.bodySmall,
      color: t.colors.gray300,
      marginTop: t.spacing.sm,
    },
    emptySubtext: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: t.spacing.xs,
    },
    // Card
    postCard: {
      backgroundColor: t.colors.card,
      borderRadius: 4,
      padding: 10,
      marginBottom: t.spacing.sm,
      ...t.shadows.sm,
    },
    postHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    postMeta: {
      flexDirection: "row",
      alignItems: "center",
    },
    postType: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.textInverted,
      backgroundColor: t.colors.text,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      overflow: "hidden",
    },
    postId: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray300,
      marginLeft: 6,
    },
    postDate: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray300,
    },
    postTitle: {
      ...t.typography.h4,
      fontSize: 14,
      lineHeight: 18,
      color: t.colors.text,
      marginBottom: 2,
    },
    postContent: {
      ...t.typography.bodySmall,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.gray400,
      marginBottom: 6,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    username: {
      ...t.typography.caption,
      fontSize: 12,
      color: t.colors.text,
      marginLeft: 5,
      fontWeight: "500",
    },
    userId: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray300,
      marginLeft: 4,
    },
    // Action buttons
    actionButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 4,
      gap: 4,
    },
    actionButtonText: {
      ...t.typography.caption,
      fontSize: 11,
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
      backgroundColor: t.colors.error,
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
      borderRadius: 4,
      padding: 14,
      width: "85%",
      maxWidth: 400,
    },
    modalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: t.spacing.sm,
    },
    modalTitle: {
      ...t.typography.h4,
      fontSize: 15,
      lineHeight: 20,
      color: t.colors.text,
      marginBottom: t.spacing.sm,
    },
    modalWarning: {
      ...t.typography.bodySmall,
      fontSize: 12,
      color: t.colors.error,
      marginBottom: t.spacing.sm,
      lineHeight: 18,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: 4,
      padding: t.spacing.sm,
      ...t.typography.bodySmall,
      color: t.colors.text,
      minHeight: 40,
      textAlignVertical: "top",
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
    modalButton: {
      paddingHorizontal: 14,
      paddingVertical: t.spacing.sm,
      borderRadius: 4,
      minWidth: 70,
      alignItems: "center",
    },
    modalCancelButton: {
      backgroundColor: t.colors.gray100,
    },
    modalCancelText: {
      ...t.typography.button,
      fontSize: 13,
      color: t.colors.gray400,
    },
    modalConfirmButton: {
      backgroundColor: t.colors.error,
    },
    modalConfirmText: {
      ...t.typography.button,
      fontSize: 13,
      color: t.colors.textInverted,
    },
    // Pagination
    paginationContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: t.spacing.md,
      gap: t.spacing.md,
    },
    pageButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: t.colors.gray100,
      borderRadius: 4,
    },
    pageButtonDisabled: {
      opacity: 0.5,
    },
    pageButtonText: {
      ...t.typography.bodySmall,
      fontSize: 12,
      color: t.colors.text,
    },
    pageInfo: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
    },
    // Form
    formLabel: {
      ...t.typography.bodySmall,
      fontSize: 12,
      color: t.colors.text,
      fontWeight: "600",
      marginBottom: t.spacing.xs,
      marginTop: t.spacing.sm,
    },
    formHint: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 4,
      marginBottom: t.spacing.sm,
    },
    // Toggle
    statusToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: t.spacing.sm,
    },
    statusToggleSwitch: {
      width: 44,
      height: 24,
      borderRadius: 4,
      backgroundColor: t.colors.gray200,
      padding: 2,
      justifyContent: "center",
    },
    statusToggleSwitchActive: {
      backgroundColor: t.colors.success,
    },
    statusToggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 4,
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
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    linkTypeButtonActive: {
      backgroundColor: t.colors.cardElevated,
      borderWidth: 1,
      borderColor: t.colors.text,
    },
    linkTypeButtonText: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    linkTypeButtonTextActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    // Upload
    uploadImageButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.text,
      paddingVertical: t.spacing.sm,
      borderRadius: 4,
      marginBottom: t.spacing.md,
      gap: t.spacing.xs,
    },
    uploadImageButtonText: {
      ...t.typography.bodySmall,
      fontSize: 12,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    uploadSmallButton: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 4,
    },
    uploadSmallButtonText: {
      ...t.typography.caption,
      fontSize: 11,
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
