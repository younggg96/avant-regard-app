import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  flex1: {
    flex: 1,
  },
  headerUserInfo: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  loadingMore: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyChatText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray200,
  },
  messageWrapper: {
    marginBottom: 6,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubbleGroupLeft: {
    maxWidth: "75%",
  },
  bubbleGroupRight: {
    maxWidth: "75%",
    alignItems: "flex-end",
  },
  senderAvatarContainer: {
    marginRight: 10,
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: theme.colors.black,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: theme.colors.gray50,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...theme.typography.bodySmall,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: theme.colors.white,
  },
  bubbleTextOther: {
    color: theme.colors.black,
  },
  deliveredText: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray200,
    marginTop: 3,
    marginRight: 2,
  },
  inputContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputRowFlex: {
    flex: 1,
  },
  plusButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.gray50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  plusButtonActive: {
    backgroundColor: theme.colors.black,
  },
  writeMessageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  writeMessagePlaceholder: {
    ...theme.typography.body,
    color: theme.colors.gray300,
    marginLeft: 8,
    flex: 1,
  },
  writeMessageExpanded: {
    backgroundColor: theme.colors.gray50,
    padding: 16,
    borderRadius: 12,
  },
  expandedTextInput: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    textAlignVertical: "top",
    minHeight: 80,
    maxHeight: 160,
    marginBottom: 12,
  },
  inputActionsEnd: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray100,
  },
  sendButtonText: {
    ...theme.typography.bodySmall,
    fontWeight: "500",
    color: theme.colors.white,
  },
  sendButtonTextDisabled: {
    color: theme.colors.gray200,
  },
  restrictionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: 10,
    gap: 6,
  },
  restrictionBannerText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  disabledInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  disabledInputText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray200,
  },
});
