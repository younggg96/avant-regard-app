import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeChatStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex1: {
      flex: 1,
    },
    headerUserInfo: {
      flex: 1,
    },
    messageList: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.md,
      flexGrow: 1,
      justifyContent: "flex-end",
    },
    loadingMore: {
      paddingVertical: t.spacing.md,
      alignItems: "center",
    },
    emptyChat: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: t.spacing.xxl * 2,
    },
    emptyChatText: {
      ...t.typography.bodySmall,
      color: t.colors.gray200,
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
      backgroundColor: t.colors.text,
      borderBottomRightRadius: 6,
    },
    bubbleOther: {
      backgroundColor: t.colors.gray50,
      borderBottomLeftRadius: 6,
    },
    bubbleText: {
      ...t.typography.bodySmall,
      lineHeight: 20,
    },
    bubbleTextMine: {
      color: t.colors.textInverted,
    },
    bubbleTextOther: {
      color: t.colors.text,
    },
    deliveredText: {
      ...t.typography.caption,
      fontSize: 11,
      color: t.colors.gray200,
      marginTop: 3,
      marginRight: 2,
    },
    inputContainer: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
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
      backgroundColor: t.colors.gray50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    plusButtonActive: {
      backgroundColor: t.colors.text,
    },
    writeMessageButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray50,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
    },
    writeMessagePlaceholder: {
      ...t.typography.body,
      color: t.colors.gray300,
      marginLeft: 8,
      flex: 1,
    },
    writeMessageExpanded: {
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 12,
    },
    expandedTextInput: {
      backgroundColor: t.colors.card,
      borderRadius: 12,
      padding: 16,
      ...t.typography.bodySmall,
      color: t.colors.text,
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
      backgroundColor: t.colors.text,
    },
    sendButtonDisabled: {
      backgroundColor: t.colors.gray100,
    },
    sendButtonText: {
      ...t.typography.bodySmall,
      fontWeight: "500",
      color: t.colors.textInverted,
    },
    sendButtonTextDisabled: {
      color: t.colors.gray200,
    },
    restrictionBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: t.spacing.md,
      marginHorizontal: t.spacing.sm,
      marginBottom: t.spacing.sm,
      backgroundColor: t.colors.gray50,
      borderRadius: 10,
      gap: 6,
    },
    restrictionBannerText: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    disabledInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.gray50,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 6,
    },
    disabledInputText: {
      ...t.typography.bodySmall,
      color: t.colors.gray200,
    },
  });

export const useChatStyles = () => useThemedStyles(makeChatStyles);

/** Legacy static export — light only. Migrate to the hook for dark-mode. */
export const styles = makeChatStyles(lightTheme);
