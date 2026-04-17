import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  // 社区样式
  communityButton: {
    alignItems: "center",
    width: 64,
  },
  communityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 4,
  },
  communityImage: {
    width: "100%",
    height: "100%",
  },
  communityPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  communityName: {
    width: 60,
  },
  // 发帖按钮
  publishButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // 骨架屏样式（匹配 PostCard 组件结构）
  skeletonCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    overflow: "hidden",
    // 阴影效果（与 PostCard 一致）
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  skeletonImage: {
    width: "100%",
    aspectRatio: 3 / 4, // 3:4 比例，与 PostCard 一致
    backgroundColor: theme.colors.gray200,
  },
  skeletonTitleArea: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skeletonFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  skeletonUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  skeletonAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.gray200,
  },
});
