/**
 * 发布单品 Wizard 共用表单样式 —— 与 PublishV2 / SubmitStore 对齐：
 * underlined 单行输入、 bordered 多行文本域、gray600 标签、14px 字号。
 */
import React from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, Text, VStack } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

export const PUBLISH_LISTING_FORM_PADDING = 16;

export const makePublishListingFormStyles = (t: AppTheme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: PUBLISH_LISTING_FORM_PADDING,
      paddingBottom: 32,
    },
    fieldLabel: {
      fontSize: 14,
      color: t.colors.gray600,
      marginBottom: 4,
    },
    fieldHint: {
      fontSize: 14,
      color: t.colors.gray400,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 14,
      color: t.colors.gray600,
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 14,
      color: t.colors.gray400,
      marginBottom: 12,
    },
    hintSmall: {
      fontSize: 14,
      color: t.colors.gray400,
      marginTop: 8,
    },
    underlinedInput: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      paddingVertical: 8,
      paddingHorizontal: 0,
      fontSize: 14,
      color: t.colors.text,
    },
    textArea: {
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 110,
    },
    textAreaInput: {
      fontSize: 14,
      color: t.colors.text,
      minHeight: 90,
      textAlignVertical: "top",
    },
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      paddingVertical: 8,
    },
    selectorText: {
      fontSize: 14,
      color: t.colors.text,
      flex: 1,
    },
    placeholderText: {
      color: t.colors.placeholder,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.gray100,
    },
    chipActive: {
      borderColor: t.colors.black,
      backgroundColor: t.colors.black,
    },
    chipText: {
      fontSize: 14,
      color: t.colors.black,
    },
    chipTextActive: {
      color: t.colors.white,
    },
    smallChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.gray100,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionRowActive: {
      borderColor: t.colors.black,
      backgroundColor: t.colors.gray100,
    },
    optionTitle: {
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "500",
    },
    optionSubtitle: {
      fontSize: 12,
      color: t.colors.gray400,
      marginTop: 2,
    },
    modeChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: t.borderRadius.sm,
      padding: 12,
      backgroundColor: t.colors.gray100,
    },
    modeChipActive: {
      borderColor: t.colors.black,
      backgroundColor: t.colors.black,
    },
    modeChipTitle: {
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "500",
    },
    modeChipTitleActive: {
      color: t.colors.white,
    },
    modeChipSub: {
      fontSize: 12,
      color: t.colors.gray400,
      marginTop: 2,
      lineHeight: 16,
    },
    modeChipSubActive: {
      color: t.colors.gray400,
    },
    footer: {
      padding: PUBLISH_LISTING_FORM_PADDING,
      paddingBottom: Platform.OS === "ios" ? 28 : PUBLISH_LISTING_FORM_PADDING,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    nextButton: {
      backgroundColor: t.colors.black,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    nextButtonDisabled: {
      opacity: 0.4,
    },
    nextButtonText: {
      color: t.colors.white,
      fontSize: 14,
      fontWeight: "600",
    },
    draftButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
      backgroundColor: t.colors.gray100,
    },
    draftButtonText: {
      color: t.colors.text,
      fontSize: 14,
    },
    submitButton: {
      flex: 1,
      backgroundColor: t.colors.black,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    submitButtonText: {
      color: t.colors.white,
      fontSize: 14,
      fontWeight: "600",
    },
    feeNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: PUBLISH_LISTING_FORM_PADDING,
      paddingVertical: 10,
    },
    feeNoticeText: {
      flex: 1,
      fontSize: 14,
      color: t.colors.gray500,
      lineHeight: 20,
    },
  });

export const PublishListingFieldRow: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => {
  const styles = useThemedStyles(makePublishListingFormStyles);
  const theme = useAppTheme();
  return (
    <VStack space="xs">
      <Text style={styles.fieldLabel}>
        {label}
        {required ? (
          <Text style={{ color: theme.colors.error }}> *</Text>
        ) : null}
      </Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </VStack>
  );
};

export const PublishListingTextArea: React.FC<
  React.ComponentProps<typeof TextInput>
> = (props) => {
  const styles = useThemedStyles(makePublishListingFormStyles);
  return (
    <View style={styles.textArea}>
      <TextInput
        style={styles.textAreaInput}
        multiline
        textAlignVertical="top"
        {...props}
      />
    </View>
  );
};

export const PublishListingFeeNotice: React.FC = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makePublishListingFormStyles);
  const theme = useAppTheme();
  return (
    <Box style={styles.feeNotice}>
      <Ionicons
        name="information-circle-outline"
        size={16}
        color={theme.colors.gray500}
      />
      <Text style={styles.feeNoticeText} numberOfLines={3}>
        {t("trading.publishListing.feeNotice")}
      </Text>
    </Box>
  );
};
