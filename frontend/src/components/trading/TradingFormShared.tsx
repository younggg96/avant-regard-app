/**
 * Trading 模块共用表单 UI —— ScreenHeader / useThemedStyles / Playfair Display
 * 与 UploadArchiveItemScreen、PublishListing wizard 视觉对齐。
 */
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../ScreenHeader";
import { VStack } from "../ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { IS_NA } from "../../config/env";
import type {
  UserAddress,
  UserAddressCreate,
} from "../../services/addressService";

export const TRADING_FORM_PADDING = 16;

export const makeTradingFormStyles = (t: AppTheme) =>
  StyleSheet.create({
    scroll: {
      padding: TRADING_FORM_PADDING,
      paddingBottom: 32,
      gap: 12,
    },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: TRADING_FORM_PADDING,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 2,
    },
    fieldLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 2,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.inputBorder,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      ...t.typography.bodySmall,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    inputMultiline: {
      minHeight: 96,
      textAlignVertical: "top",
    },
    linkText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.accent,
    },
    bodyText: {
      ...t.typography.bodySmall,
      color: t.colors.text,
    },
    mutedText: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      ...t.typography.button,
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
    },
    defaultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 2,
      minHeight: 32,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1.5,
      borderColor: t.colors.inputBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.inputBackground,
    },
    checkboxOn: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    defaultRowText: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
      ...(Platform.OS === "android"
        ? { includeFontPadding: false, textAlignVertical: "center" as const }
        : {}),
    },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    defaultBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
    },
    defaultBadgeText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
    },
    notFoundContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      paddingBottom: 48,
    },
    notFoundIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.cardElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    emptyTitle: {
      fontSize: 18,
      lineHeight: 26,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginTop: 20,
      textAlign: "center",
    },
    emptyHint: {
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 8,
      textAlign: "center",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: TRADING_FORM_PADDING,
      paddingTop: 12,
      paddingBottom: Platform.OS === "ios" ? 28 : 16,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    footerLabel: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    footerPrice: {
      ...t.typography.h3,
      color: t.colors.text,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 4,
    },
    noticeText: {
      flex: 1,
      ...t.typography.caption,
      color: t.colors.gray300,
      lineHeight: 18,
    },
    errorText: {
      ...t.typography.caption,
      color: t.colors.error,
      marginTop: 8,
    },
    /** 上传典藏 / 鉴定等 · 多图选择网格 */
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    photoWrap: {
      width: 72,
      height: 72,
      position: "relative",
    },
    photoThumb: {
      width: 72,
      height: 72,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    photoRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: t.borderRadius.full,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.card,
    },
    stickyFooter: {
      padding: TRADING_FORM_PADDING,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    stickyFooterPrimary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
      alignSelf: "stretch",
    },
    stickyFooterPrimaryDisabled: { opacity: 0.5 },
  });

/** 钱包 / 放款 / KYC 列表页共用样式 —— 在 makeTradingFormStyles 基础上扩展。 */
export const makeWalletScreenStyles = (t: AppTheme) => {
  const base = makeTradingFormStyles(t);
  return StyleSheet.create({
    ...base,
    scroll: { padding: TRADING_FORM_PADDING, paddingBottom: 32 },
    listContent: { padding: TRADING_FORM_PADDING, paddingBottom: 32, flexGrow: 1 },
    emptyWrap: { alignItems: "center", paddingVertical: 56 },
    emptyText: {
      marginTop: 12,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      textAlign: "center",
    },
    emptyHint: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      textAlign: "center",
      paddingHorizontal: 24,
    },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    typePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: t.colors.gray100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    typePillActive: { backgroundColor: t.colors.accent, borderColor: t.colors.accent },
    typePillText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
    },
    typePillTextActive: {
      color: t.colors.textInverted,
      fontFamily: "PlayfairDisplay-Medium",
    },
    connectCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: t.borderRadius.sm,
      marginBottom: 14,
      backgroundColor: t.colors.cardElevated,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    connectIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    connectTitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    connectSubtitle: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 2,
      lineHeight: 17,
    },
    connectCta: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.accent,
    },
    connectCtaText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
    },
    cardTitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    cardSubtitle: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 2,
    },
    cardIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    actionBtnDanger: { borderColor: t.colors.error },
    actionBtnText: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      maxHeight: "85%",
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    modalHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 16,
    },
    balanceCard: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 20,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    balanceLabel: {
      color: t.colors.textSecondary,
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    balanceValue: {
      color: t.colors.text,
      fontSize: 32,
      fontFamily: "PlayfairDisplay-Bold",
      letterSpacing: -0.5,
    },
    balanceHint: {
      color: t.colors.textSecondary,
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      marginTop: 6,
    },
    balanceCellLabel: {
      color: t.colors.textSecondary,
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      marginBottom: 4,
    },
    balanceCellValue: {
      color: t.colors.text,
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
    },
    balanceRow: {
      flexDirection: "row",
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    balanceCell: { flex: 1 },
    withdrawCta: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
      backgroundColor: t.colors.accent,
    },
    withdrawDisabled: {
      backgroundColor: t.colors.surface,
      opacity: 1,
    },
    withdrawCtaText: {
      color: t.colors.textInverted,
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
    },
    withdrawCtaTextDisabled: {
      color: t.colors.textSecondary,
    },
    walletBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: t.colors.error + "12",
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.error,
      marginBottom: 12,
    },
    walletBannerText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.error,
    },
    actionRow: {
      flexDirection: "row",
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 12,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    actionItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    actionLabel: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
      textAlign: "center",
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: t.colors.textSecondary,
      marginBottom: 12,
    },
    listRow: {
      flexDirection: "row",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    listRowTitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    listRowDate: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 4,
    },
    listRowAmount: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
    },
    intro: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginBottom: 12,
      lineHeight: 20,
    },
    statusCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 12,
      borderRadius: t.borderRadius.sm,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    statusTitle: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    statusHint: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 4,
      lineHeight: 18,
    },
    usStep: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
    usStepBadge: {
      width: 22,
      height: 22,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    usStepBadgeText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Bold",
    },
    usStepText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    usPrivacy: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 4,
    },
    loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
    amountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    maxBtn: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.accent,
    },
    amountInputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: t.colors.inputBorder,
      paddingVertical: 8,
    },
    amountPrefix: {
      fontSize: 28,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 28,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      padding: 0,
    },
    availableHint: {
      marginTop: 8,
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
    },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 8,
    },
    accountRowActive: { borderColor: t.colors.accent },
    accountTitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    accountSubtitle: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
      marginTop: 2,
    },
    bindCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    bindCtaText: {
      color: t.colors.text,
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
    },
  });
};

/** Trading 模块资源不存在页 —— ScreenHeader + 空状态 + 返回 */
export const TradingNotFoundState: React.FC<{
  headerTitle: string;
  title: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onBackPress?: () => void;
}> = ({
  headerTitle,
  title,
  hint,
  icon = "receipt-outline",
  onBackPress,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader
        title={headerTitle}
        showBack
        onBackPress={handleBack}
      />
      <View style={styles.notFoundContent}>
        <View style={styles.notFoundIconWrap}>
          <Ionicons name={icon} size={40} color={theme.colors.gray300} />
        </View>
        <RNText style={styles.emptyTitle}>{title}</RNText>
        {hint ? <RNText style={styles.emptyHint}>{hint}</RNText> : null}
        <Pressable
          style={[styles.primaryBtn, { marginTop: 28, minWidth: 160 }]}
          onPress={handleBack}
        >
          <RNText style={styles.primaryBtnText}>{t("common.back")}</RNText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export const TradingFormSection: React.FC<{
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ title, children, style }) => {
  const styles = useThemedStyles(makeTradingFormStyles);
  return (
    <View style={[styles.section, style]}>
      <RNText style={styles.sectionTitle}>{title}</RNText>
      {children}
    </View>
  );
};

export const TradingFormField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => {
  const styles = useThemedStyles(makeTradingFormStyles);
  return (
    <VStack space="xs">
      <RNText style={styles.fieldLabel}>{label}</RNText>
      {children}
    </VStack>
  );
};

export const TradingFormInput: React.FC<TextInputProps> = (props) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);
  return (
    <TextInput
      placeholderTextColor={theme.colors.placeholder}
      {...props}
      style={[styles.input, props.style]}
    />
  );
};

export const TradingFormTextArea: React.FC<TextInputProps> = (props) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={theme.colors.placeholder}
      {...props}
      style={[styles.input, styles.inputMultiline, props.style]}
    />
  );
};

export const TradingFormDefaultToggle: React.FC<{
  checked: boolean;
  label: string;
  onToggle: () => void;
}> = ({ checked, label, onToggle }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);

  return (
    <Pressable style={styles.defaultRow} onPress={onToggle} hitSlop={4}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? (
          <Ionicons
            name="checkmark"
            size={13}
            color={theme.colors.textInverted}
          />
        ) : null}
      </View>
      <RNText style={styles.defaultRowText}>{label}</RNText>
    </Pressable>
  );
};

/**
 * 收货地址表单的统一数据模型 —— 同时承载中国版(自由文本)与北美版(结构化)字段。
 *
 * - 中国版(IS_NA=false):用户填一行「完整地址」(fullText),结构化字段留空。
 * - 北美版(IS_NA=true):按美国格式拆成 街道 / 公寓 / 城市 / 州 / 邮编,
 *   提交前由 composeShippingFullText 拼成快照文本。
 *
 * 落库映射(北美):line1→detail、line2→district、city→city、state→province、
 * postalCode→postal_code、country 固定为 "United States"。这样编辑时能完整回填。
 */
export interface ShippingAddressValue {
  receiverName: string;
  phone: string;
  /** 中国版自由文本地址;北美版作为旧数据/快照兜底。 */
  fullText: string;
  /** 北美版:街道地址(门牌号 + 街道)。 */
  line1: string;
  /** 北美版:公寓 / 单元(选填)。 */
  line2: string;
  city: string;
  /** 北美版:州。 */
  state: string;
  /** 北美版:邮编(ZIP)。 */
  postalCode: string;
  label: string;
}

export const emptyShippingAddress = (): ShippingAddressValue => ({
  receiverName: "",
  phone: "",
  fullText: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  label: "",
});

/** 把后端返回的地址簿条目映射成表单值,北美版回填结构化字段。 */
export const shippingAddressFromUserAddress = (
  a: Partial<UserAddress> | null | undefined,
): ShippingAddressValue => {
  const base = emptyShippingAddress();
  if (!a) return base;
  base.receiverName = a.receiverName ?? "";
  base.phone = a.phone ?? "";
  base.fullText = a.fullText ?? "";
  base.label = a.label ?? "";
  if (IS_NA) {
    base.line1 = a.detail ?? "";
    base.line2 = a.district ?? "";
    base.city = a.city ?? "";
    base.state = a.province ?? "";
    base.postalCode = a.postalCode ?? "";
  }
  return base;
};

/** 生成下单 / 展示用的地址快照文本(北美按美国格式拼接)。 */
export const composeShippingFullText = (v: ShippingAddressValue): string => {
  if (!IS_NA) return v.fullText.trim();
  const line1 = v.line1.trim();
  // 旧数据没有结构化字段时,回退到原始 fullText。
  if (!line1 && v.fullText.trim()) return v.fullText.trim();
  const street = [line1, v.line2.trim()].filter(Boolean).join(", ");
  const cityState = [
    v.city.trim(),
    [v.state.trim(), v.postalCode.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [street, cityState, "United States"].filter(Boolean).join(", ");
};

/** 当前区域下地址是否填写完整(可保存 / 可下单)。 */
export const isShippingAddressComplete = (v: ShippingAddressValue): boolean => {
  if (v.receiverName.trim().length === 0) return false;
  if (v.phone.trim().length < 5) return false;
  if (IS_NA) {
    return (
      v.line1.trim().length > 0 &&
      v.city.trim().length > 0 &&
      v.state.trim().length > 0 &&
      v.postalCode.trim().length > 0
    );
  }
  return v.fullText.trim().length > 0;
};

/** 转成创建 / 更新地址簿的请求体。 */
export const shippingAddressToPayload = (
  v: ShippingAddressValue,
): UserAddressCreate => {
  const base: UserAddressCreate = {
    receiverName: v.receiverName.trim(),
    phone: v.phone.trim(),
    fullText: composeShippingFullText(v),
    label: v.label.trim() || undefined,
  };
  if (!IS_NA) return base;
  return {
    ...base,
    country: "United States",
    province: v.state.trim() || undefined,
    city: v.city.trim() || undefined,
    district: v.line2.trim() || undefined,
    detail: v.line1.trim() || undefined,
    postalCode: v.postalCode.trim() || undefined,
  };
};

/** 联系信息字段(收货人 / 电话),中美通用。 */
const ContactFields: React.FC<{
  value: ShippingAddressValue;
  onChange: (patch: Partial<ShippingAddressValue>) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <>
      <TradingFormField label={t("trading.checkout.receiverName")}>
        <TradingFormInput
          value={value.receiverName}
          onChangeText={(v) => onChange({ receiverName: v })}
          placeholder={t("trading.checkout.receiverName")}
          autoCapitalize="words"
        />
      </TradingFormField>
      <TradingFormField label={t("trading.checkout.phone")}>
        <TradingFormInput
          value={value.phone}
          onChangeText={(v) => onChange({ phone: v })}
          placeholder={t("trading.checkout.phone")}
          keyboardType="phone-pad"
        />
      </TradingFormField>
    </>
  );
};

/** 地址字段(随区域切换:北美结构化 / 中国自由文本)+ 可选标签。 */
const RegionAddressFields: React.FC<{
  value: ShippingAddressValue;
  onChange: (patch: Partial<ShippingAddressValue>) => void;
  showLabelField?: boolean;
}> = ({ value, onChange, showLabelField = false }) => {
  const { t } = useTranslation();
  return (
    <>
      {IS_NA ? (
        <>
          <TradingFormField label={t("trading.addressBook.streetAddress")}>
            <TradingFormInput
              value={value.line1}
              onChangeText={(v) => onChange({ line1: v })}
              placeholder={t("trading.addressBook.streetAddressPlaceholder")}
              autoCapitalize="words"
            />
          </TradingFormField>
          <TradingFormField label={t("trading.addressBook.aptSuite")}>
            <TradingFormInput
              value={value.line2}
              onChangeText={(v) => onChange({ line2: v })}
              placeholder={t("trading.addressBook.aptSuitePlaceholder")}
              autoCapitalize="words"
            />
          </TradingFormField>
          <TradingFormField label={t("trading.addressBook.city")}>
            <TradingFormInput
              value={value.city}
              onChangeText={(v) => onChange({ city: v })}
              placeholder={t("trading.addressBook.cityPlaceholder")}
              autoCapitalize="words"
            />
          </TradingFormField>
          <TradingFormField label={t("trading.addressBook.state")}>
            <TradingFormInput
              value={value.state}
              onChangeText={(v) => onChange({ state: v })}
              placeholder={t("trading.addressBook.statePlaceholder")}
              autoCapitalize="characters"
            />
          </TradingFormField>
          <TradingFormField label={t("trading.addressBook.zipCode")}>
            <TradingFormInput
              value={value.postalCode}
              onChangeText={(v) => onChange({ postalCode: v })}
              placeholder={t("trading.addressBook.zipCodePlaceholder")}
              keyboardType="number-pad"
            />
          </TradingFormField>
        </>
      ) : (
        <TradingFormField label={t("trading.addressBook.fullTextHint")}>
          <TradingFormTextArea
            value={value.fullText}
            onChangeText={(v) => onChange({ fullText: v })}
            placeholder={t("trading.addressBook.fullTextPlaceholder")}
          />
        </TradingFormField>
      )}
      {showLabelField ? (
        <TradingFormField label={t("trading.addressBook.labelField")}>
          <TradingFormInput
            value={value.label}
            onChangeText={(v) => onChange({ label: v })}
            placeholder={t("trading.addressBook.labelHint")}
            maxLength={20}
          />
        </TradingFormField>
      ) : null}
    </>
  );
};

/**
 * 地址簿 / Checkout 共用的收货地址字段组(带分区卡片)。
 * 受控组件:由 value + onChange(patch) 驱动,区域差异在内部处理。
 */
export const ShippingAddressFields: React.FC<{
  value: ShippingAddressValue;
  onChange: (patch: Partial<ShippingAddressValue>) => void;
  showLabelField?: boolean;
}> = ({ value, onChange, showLabelField = false }) => {
  const { t } = useTranslation();
  return (
    <>
      <TradingFormSection title={t("trading.addressBook.contactSection")}>
        <ContactFields value={value} onChange={onChange} />
      </TradingFormSection>
      <TradingFormSection title={t("trading.addressBook.addressSection")}>
        <RegionAddressFields
          value={value}
          onChange={onChange}
          showLabelField={showLabelField}
        />
      </TradingFormSection>
    </>
  );
};

/**
 * 同样的字段,但不含分区卡片外壳 —— 供已有 section 容器的页面(如 Checkout)内嵌使用。
 */
export const ShippingAddressFieldGroup: React.FC<{
  value: ShippingAddressValue;
  onChange: (patch: Partial<ShippingAddressValue>) => void;
  showLabelField?: boolean;
}> = ({ value, onChange, showLabelField = false }) => (
  <>
    <ContactFields value={value} onChange={onChange} />
    <RegionAddressFields
      value={value}
      onChange={onChange}
      showLabelField={showLabelField}
    />
  </>
);
