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

/** 地址簿 / Checkout 共用的收货地址字段组 */
export const ShippingAddressFields: React.FC<{
  receiverName: string;
  phone: string;
  fullText: string;
  label?: string;
  showLabelField?: boolean;
  onChangeReceiverName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeFullText: (v: string) => void;
  onChangeLabel?: (v: string) => void;
}> = ({
  receiverName,
  phone,
  fullText,
  label = "",
  showLabelField = false,
  onChangeReceiverName,
  onChangePhone,
  onChangeFullText,
  onChangeLabel,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <TradingFormSection title={t("trading.addressBook.contactSection")}>
        <TradingFormField label={t("trading.checkout.receiverName")}>
          <TradingFormInput
            value={receiverName}
            onChangeText={onChangeReceiverName}
            placeholder={t("trading.checkout.receiverName")}
            autoCapitalize="words"
          />
        </TradingFormField>
        <TradingFormField label={t("trading.checkout.phone")}>
          <TradingFormInput
            value={phone}
            onChangeText={onChangePhone}
            placeholder={t("trading.checkout.phone")}
            keyboardType="phone-pad"
          />
        </TradingFormField>
      </TradingFormSection>

      <TradingFormSection title={t("trading.addressBook.addressSection")}>
        <TradingFormField label={t("trading.addressBook.fullTextHint")}>
          <TradingFormTextArea
            value={fullText}
            onChangeText={onChangeFullText}
            placeholder={t("trading.addressBook.fullTextPlaceholder")}
          />
        </TradingFormField>
        {showLabelField && onChangeLabel ? (
          <TradingFormField label={t("trading.addressBook.labelField")}>
            <TradingFormInput
              value={label}
              onChangeText={onChangeLabel}
              placeholder={t("trading.addressBook.labelHint")}
              maxLength={20}
            />
          </TradingFormField>
        ) : null}
      </TradingFormSection>
    </>
  );
};
