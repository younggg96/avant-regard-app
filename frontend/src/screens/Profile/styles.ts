import { StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme, playfairFonts, lightTheme } from "../../theme";
import {
  COVER_HEIGHT,
  AVATAR_SIZE,
  AVATAR_SIZE_SMALL,
  AVATAR_BORDER,
  HEADER_CONTENT_HEIGHT,
  TAB_BAR_HEIGHT,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from "./constants";

export const PF = playfairFonts;

const makeProfileStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    coverContainer: {
      height: COVER_HEIGHT,
      overflow: "hidden",
    },
    coverImage: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
    },
    defaultCover: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // 没有 cover 图时退化为深色面，避免 dark mode 下 t.colors.text=#FFFFFF
      // 把整片封面变成大块白；light 模式仍是黑色封面（视觉与原版一致）。
      backgroundColor: t.colors.gray500,
    },
    coverGradient: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    topActions: {
      position: "absolute",
      left: 12,
      right: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 10,
    },
    actionButton: {
      position: "relative",
      width: 36,
      height: 36,
      borderRadius: t.borderRadius.sm,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
    },
    collapsedHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    collapsedHeaderBg: {
      ...StyleSheet.absoluteFillObject,
    },
    collapsedHeaderContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
    },
    headerButton: {
      position: "relative",
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      overflow: "visible",
    },
    headerLeftSpacer: {
      width: 80,
      height: 36,
    },
    collapsedAvatarContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    collapsedAvatar: {
      width: AVATAR_SIZE_SMALL,
      height: AVATAR_SIZE_SMALL,
      borderRadius: AVATAR_SIZE_SMALL / 2,
      backgroundColor: t.colors.skeleton,
    },
    avatarTextSmall: {
      color: t.colors.textInverted,
      fontSize: 14,
      fontWeight: "bold",
      fontFamily: PF.bold,
    },
    headerRightButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stickyTabBar: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 99,
      height: TAB_BAR_HEIGHT,
      backgroundColor: t.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    profileInfo: {
      paddingBottom: 10,
    },
    avatarRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: -(AVATAR_SIZE / 2),
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: -(AVATAR_SIZE / 2),
      paddingHorizontal: 16,
      gap: 16,
    },
    headerTextCol: {
      flex: 1,
      paddingBottom: t.spacing.xs,
      minWidth: 0,
    },
    userNameLine: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    avatarWrapper: {
      borderRadius: (AVATAR_SIZE + AVATAR_BORDER * 2) / 2,
      borderWidth: AVATAR_BORDER,
      borderColor: t.colors.card,
      position: "relative",
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: t.colors.skeleton,
    },
    avatarPlaceholder: {
      backgroundColor: t.colors.text,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: t.colors.textInverted,
      fontSize: 26,
      fontWeight: "bold",
      fontFamily: PF.bold,
    },
    avatarAddButton: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#FFD700",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: t.colors.card,
    },
    userNameSection: {
      paddingHorizontal: 16,
      marginTop: 8,
    },
    userName: {
      fontSize: 22,
      fontWeight: "bold",
      color: t.colors.text,
      fontFamily: PF.bold,
      flexShrink: 1,
    },
    userIdText: {
      fontSize: 12,
      color: t.colors.gray400,
      marginTop: 2,
      fontFamily: PF.regular,
    },
    bio: {
      fontSize: 14,
      color: t.colors.gray600,
      marginTop: 4,
      lineHeight: 20,
      fontFamily: PF.regular,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    tagsHalf: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: t.colors.gray100,
    },
    tagText: {
      fontSize: 12,
      color: t.colors.gray600,
      fontFamily: PF.regular,
    },
    statsContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.md,
      marginTop: t.spacing.md,
      paddingBottom: t.spacing.xs,
      gap: t.spacing.md,
    },
    statsHalf: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.lg,
    },
    statItem: {
      alignItems: "center",
    },
    statNumber: {
      fontSize: 16,
      fontWeight: "bold",
      color: t.colors.text,
      fontFamily: PF.bold,
      lineHeight: 20,
    },
    statLabel: {
      fontSize: 12,
      color: t.colors.gray600,
      fontFamily: PF.regular,
      marginTop: t.spacing.xs,
      lineHeight: 16,
    },
    followedBrandsSection: {
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: t.colors.card,
    },
    followedBrandsHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 6,
      gap: 6,
    },
    followedBrandsTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray400,
      fontFamily: PF.medium,
    },
    followedBrandsCount: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.gray300,
      fontFamily: PF.medium,
    },
    /** QuickEntriesGrid 等 profile 内嵌卡片共用 —— 扁平 surface 底，无阴影 */
    profileInsetCard: {
      marginHorizontal: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    brandChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 6,
      paddingRight: 8,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.gray100,
      gap: 6,
    },
    brandChipImage: {
      width: 22,
      height: 22,
      borderRadius: t.borderRadius.sm,
    },
    brandChipImagePlaceholder: {
      width: 22,
      height: 22,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.text,
      justifyContent: "center",
      alignItems: "center",
    },
    brandChipInitial: {
      fontSize: 10,
      fontWeight: "700",
      color: t.colors.textInverted,
      fontFamily: PF.bold,
    },
    brandChipName: {
      fontSize: 12,
      fontWeight: "500",
      color: t.colors.text,
      maxWidth: 80,
      fontFamily: PF.medium,
    },
    // tabBarContainer 是一级 TopTabBar (`components/ui`) 的外层容器,
    // 提供分割线 + 行布局; chip 样式由 AnimatedChip 自管。
    tabBarContainer: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    postsContainer: {
      paddingBottom: t.spacing.xl,
    },
    // 让 loading GIF 占满整个 tab 内容区域。
    // 父 View 用的是 `minHeight: contentMinHeight`（在 ScrollView 里），
    // 这种情况下子节点 `flex: 1` 不一定能撑起来（父没有 max height），所以
    // 直接用一个明确的 `height` —— 取 SCREEN_HEIGHT 减掉头部/底部估算，
    // 在保留品牌动画完整居中的同时铺满可见区。
    profileLoadingGif: {
      width: "100%",
      height: "50%",
      // height: "100%",
      backgroundColor: t.colors.background,
    },
  });

const makeStoreActivityStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.gray200,
      gap: 12,
      alignItems: "center",
    },
    storeImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
    },
    storeImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
      justifyContent: "center",
      alignItems: "center",
    },
    cardBody: {
      flex: 1,
      gap: 4,
    },
    storeName: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      fontFamily: PF.medium,
    },
    storeLocation: {
      fontSize: 12,
      color: t.colors.gray400,
      fontFamily: PF.regular,
    },
    commentContent: {
      fontSize: 13,
      color: t.colors.gray600,
      lineHeight: 18,
      fontFamily: PF.regular,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    metaText: {
      fontSize: 11,
      color: t.colors.gray400,
      fontFamily: PF.regular,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#F5A623",
      fontFamily: PF.medium,
    },
  });

export const useProfileStyles = () => useThemedStyles(makeProfileStyles);
export const useStoreActivityStyles = () => useThemedStyles(makeStoreActivityStyles);

/**
 * Legacy static exports — frozen to the light theme. Migrate consumers to the
 * matching hooks above for full dark-mode support.
 */
export const styles = makeProfileStyles(lightTheme);
export const storeActivityStyles = makeStoreActivityStyles(lightTheme);
