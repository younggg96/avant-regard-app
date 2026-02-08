import { StyleSheet, Dimensions, Platform } from "react-native";
import { theme } from "../../theme";

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25, // 4:5 aspect ratio
    backgroundColor: theme.colors.gray100,
  },
  // Header 样式
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.gray100,
  },
  // Lookbook 小红书风格样式
  lookbookContainer: {
    backgroundColor: theme.colors.white,
  },
  lookbookImageSection: {
    position: "relative",
    backgroundColor: theme.colors.black,
  },
  lookbookImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
  },
  lookbookImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  // 圆点指示器
  dotIndicatorContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 4,
  },
  dotIndicatorActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  // 小红书风格内容区域
  lookbookContentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  lookbookTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    lineHeight: 26,
    marginBottom: 10,
  },
  lookbookDescription: {
    fontSize: 15,
    color: theme.colors.gray600,
    lineHeight: 24,
    marginBottom: 12,
  },
  lookbookMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 16,
  },
  lookbookMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  lookbookMetaLabel: {
    fontSize: 13,
    color: theme.colors.gray400,
    marginRight: 4,
  },
  lookbookMetaValue: {
    fontSize: 13,
    color: theme.colors.black,
    fontWeight: "500",
  },
  lookbookTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  lookbookTag: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  lookbookTagText: {
    fontSize: 13,
    color: "#666",
  },
  // 保留旧的 tag 样式用于非 lookbook 类型
  tag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.gray600,
  },
  // 普通图片网格样式
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 2,
  },
  gridImageWrapper: {
    width: "33.333%",
    aspectRatio: 0.8, // 4:5 ratio
    padding: 2,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  // 评论相关
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  // 遮罩层
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1,
  },
  // 底部栏
  bottomBar: {
    backgroundColor: theme.colors.white,
    zIndex: 20,
  },
  bottomBarExpanded: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  expandedInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: theme.colors.white,
  },
  expandedTextInputWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    padding: 16,
    height: 80,
  },
  expandedTextInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.black,
  },
  expandedSendButton: {
    padding: 6,
    alignSelf: "flex-end",
  },
  // 回复提示样式
  replyHint: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.gray100,
  },
  replyHintText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.gray600,
  },
  replyHintClose: {
    padding: 4,
  },
  compactBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  engagementSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  engagementButton: {
    padding: 4,
    marginRight: 20,
  },
  compactInputWrapper: {
    flex: 1,
    marginLeft: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    height: 36,
    justifyContent: "center",
  },
  doneButton: {
    marginLeft: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // 全屏图片
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: theme.borderRadius.sm,
  },
  imageCounter: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: theme.borderRadius.sm,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  // 关联秀场样式
  showImageCard: {
    width: 100,
    marginRight: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  showImagePhoto: {
    width: "100%",
    height: 130,
    backgroundColor: theme.colors.gray100,
  },
  showImageInfo: {
    padding: 8,
  },
  // 选项菜单样式
  optionsMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  optionsMenuContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  optionsMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  optionsMenuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.black,
  },
  optionsMenuCloseButton: {
    padding: 4,
  },
  optionsMenuContent: {
    paddingTop: 8,
  },
  optionsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  optionsMenuItemCancel: {
    justifyContent: "center",
    borderBottomWidth: 0,
    marginTop: 8,
  },
  optionsMenuIcon: {
    marginRight: 12,
  },
  optionsMenuItemText: {
    fontSize: 16,
    color: theme.colors.black,
    fontWeight: "500",
  },
  optionsMenuItemTextDanger: {
    fontSize: 16,
    color: "#FF3040",
    fontWeight: "500",
  },
  loadingGif: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
  },
});
