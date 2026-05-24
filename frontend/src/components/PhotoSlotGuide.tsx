/**
 * PhotoSlotGuide —— PRD 1.3 强制 5 视角图，每张都给卖家明确的构图示意。
 *
 * 当卖家点开某个空槽时，弹出一个底部小卡片说明该角度的拍摄要求：
 *   - 主标题（正面 / 背面 / 细节 / 领标 / 洗标）
 *   - 一段示意文案
 *   - 一张 ASCII / SVG 占位示意（无外网素材，简单矢量画框 + 内圈占位）
 *   - 「明白了，去拍」按钮
 *
 * 用 react-native `Modal` 在底部弹出，避免重写 ActionSheet。
 */
import React from "react";
import { Modal, StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "./ui";
import { useThemedStyles, useAppTheme, type AppTheme } from "../theme";

export type PhotoAngleKey = "front" | "back" | "detail" | "brand_label" | "wash_label";

interface PhotoSlotGuideProps {
  visible: boolean;
  angle: PhotoAngleKey;
  onClose: () => void;
  onPickPhoto: () => void;
}

const GUIDE_CONTENT: Record<
  PhotoAngleKey,
  { titleKey: string; tipKey: string; iconLine: "shirt" | "tag" | "lens" }
> = {
  front: { titleKey: "front", tipKey: "frontTip", iconLine: "shirt" },
  back: { titleKey: "back", tipKey: "backTip", iconLine: "shirt" },
  detail: { titleKey: "detail", tipKey: "detailTip", iconLine: "lens" },
  brand_label: { titleKey: "brandLabel", tipKey: "brandLabelTip", iconLine: "tag" },
  wash_label: { titleKey: "washLabel", tipKey: "washLabelTip", iconLine: "tag" },
};

/** 占位示意：用纯 View 拼一张「画框 + 中央示意形状」，避免外部素材依赖。 */
const Illustration: React.FC<{ kind: "shirt" | "tag" | "lens"; color: string }> = ({
  kind,
  color,
}) => {
  if (kind === "shirt") {
    return (
      <View style={[localStyles.illustrationFrame, { borderColor: color }]}>
        {/* 衣服轮廓：领口圆 + 肩线 + 长方形身体 */}
        <View style={[localStyles.shirtCollar, { borderColor: color }]} />
        <View style={[localStyles.shirtBody, { borderColor: color }]} />
        <View style={[localStyles.shirtSleeveL, { backgroundColor: color }]} />
        <View style={[localStyles.shirtSleeveR, { backgroundColor: color }]} />
      </View>
    );
  }
  if (kind === "tag") {
    return (
      <View style={[localStyles.illustrationFrame, { borderColor: color }]}>
        <View style={[localStyles.tagBody, { borderColor: color }]}>
          <View style={[localStyles.tagLine, { backgroundColor: color }]} />
          <View style={[localStyles.tagLine, { backgroundColor: color, width: 36 }]} />
          <View style={[localStyles.tagLine, { backgroundColor: color, width: 26 }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={[localStyles.illustrationFrame, { borderColor: color }]}>
      <View style={[localStyles.lensOuter, { borderColor: color }]}>
        <View style={[localStyles.lensInner, { borderColor: color }]} />
      </View>
    </View>
  );
};

const PhotoSlotGuide: React.FC<PhotoSlotGuideProps> = ({
  visible,
  angle,
  onClose,
  onPickPhoto,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const cfg = GUIDE_CONTENT[angle];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Box style={styles.sheet}>
              <HStack
                alignItems="center"
                justifyContent="space-between"
                style={styles.header}
              >
                <Text style={styles.title}>
                  {t(`trading.publishListing.photoGuide.${cfg.titleKey}`)}
                </Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </HStack>

              <VStack style={styles.body} space="md">
                <Illustration kind={cfg.iconLine} color={theme.colors.textSecondary} />
                <Text style={styles.tip}>
                  {t(`trading.publishListing.photoGuide.${cfg.tipKey}`)}
                </Text>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    onClose();
                    onPickPhoto();
                  }}
                >
                  <Text style={styles.actionBtnText}>
                    {t("trading.publishListing.photoGuide.go")}
                  </Text>
                </Pressable>
              </VStack>
            </Box>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  illustrationFrame: {
    width: 120,
    height: 150,
    borderWidth: 1.2,
    borderRadius: 4,
    alignSelf: "center",
    overflow: "hidden",
    position: "relative",
  },
  shirtCollar: {
    width: 24,
    height: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1.2,
    alignSelf: "center",
    marginTop: 16,
    borderBottomWidth: 0,
  },
  shirtBody: {
    width: 70,
    height: 90,
    borderWidth: 1.2,
    alignSelf: "center",
    marginTop: 4,
  },
  shirtSleeveL: {
    position: "absolute",
    top: 32,
    left: 14,
    width: 14,
    height: 4,
    transform: [{ rotate: "-20deg" }],
  },
  shirtSleeveR: {
    position: "absolute",
    top: 32,
    right: 14,
    width: 14,
    height: 4,
    transform: [{ rotate: "20deg" }],
  },
  tagBody: {
    marginTop: 36,
    width: 70,
    height: 60,
    borderWidth: 1.2,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 6,
  },
  tagLine: {
    height: 3,
    width: 50,
  },
  lensOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.2,
    alignSelf: "center",
    marginTop: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  lensInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.2,
  },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      paddingBottom: 24,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    closeBtn: {
      padding: 4,
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    tip: {
      fontSize: 13,
      color: t.colors.textSecondary,
      lineHeight: 19,
      textAlign: "center",
    },
    actionBtn: {
      marginTop: 8,
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    actionBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default PhotoSlotGuide;
