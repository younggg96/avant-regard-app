import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const sharedStyles = StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: theme.spacing.xs,
  },
  // Card
  postCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  postType: {
    ...theme.typography.caption,
    color: theme.colors.white,
    backgroundColor: theme.colors.black,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  postId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginLeft: theme.spacing.sm,
  },
  postDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  postTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.xs,
  },
  postContent: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  username: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginLeft: 6,
    fontWeight: "500",
  },
  userId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginLeft: 4,
  },
  // Action buttons
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  actionButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  deletePostButton: {
    backgroundColor: "#FF6B6B",
  },
  viewButton: {
    backgroundColor: theme.colors.gray100,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: "85%",
    maxWidth: 400,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  modalWarning: {
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.black,
    minHeight: 48,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 80,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: theme.colors.gray100,
  },
  modalCancelText: {
    ...theme.typography.button,
    color: theme.colors.gray400,
  },
  modalConfirmButton: {
    backgroundColor: theme.colors.error,
  },
  modalConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  // Pagination
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pageButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
  },
  pageInfo: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  // Form
  formLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  formHint: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  // Toggle
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.md,
  },
  statusToggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.gray200,
    padding: 2,
    justifyContent: "center",
  },
  statusToggleSwitchActive: {
    backgroundColor: theme.colors.success,
  },
  statusToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
  },
  statusToggleThumbActive: {
    alignSelf: "flex-end",
  },
  // Link type selector
  linkTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  linkTypeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
  },
  linkTypeButtonActive: {
    backgroundColor: theme.colors.black,
  },
  linkTypeButtonText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    fontWeight: "500",
  },
  linkTypeButtonTextActive: {
    color: theme.colors.white,
  },
  // Upload
  uploadImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  uploadImageButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: "600",
  },
  uploadSmallButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  uploadSmallButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
});
