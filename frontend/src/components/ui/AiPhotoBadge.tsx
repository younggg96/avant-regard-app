/**
 * 「AI 生成」角标，盖在数字护照的三视图上。
 *
 * 为什么必须有：三视图里只有正面是从实拍推导的，侧面和背面是模型根据正面
 * 猜出来的。一件背面素色的大衣，模型可能给出背面带大印花的图 —— 看起来
 * 完全合理，但那不是这件衣服。展示时不区分，买家就会把推测当实物照。
 *
 * 用法：套在图片外层的相对定位容器里。
 *
 *   <View style={{ position: "relative" }}>
 *     <Image ... />
 *     {isAiPhoto(url, item.aiPhotos) && <AiPhotoBadge />}
 *   </View>
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "./text";

export type AiPhotoBadgeSize = "sm" | "md";

/**
 * 这张图是不是 AI 生成的。
 *
 * aiPhotos 可能是 undefined —— 老数据、或者调用方拿的是不带这个字段的接口。
 * 那种情况一律按"不是"处理：宁可漏标一张旧数据，也不要给实拍图乱扣帽子。
 */
export function isAiPhoto(url: string, aiPhotos?: string[] | null): boolean {
  return Boolean(aiPhotos?.includes(url));
}

export const AiPhotoBadge: React.FC<{ size?: AiPhotoBadgeSize }> = ({
  size = "md",
}) => {
  const { t } = useTranslation();
  const small = size === "sm";
  return (
    <View style={[styles.badge, small && styles.badgeSm]} pointerEvents="none">
      <Text style={[styles.text, small && styles.textSm]}>
        {t("archive.aiGenerated")}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    // 固定深色底而不用主题色：这张角标要压在任意图片上，
    // 跟随主题会在浅色图上糊掉。
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  badgeSm: {
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  text: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.4,
    color: "#fff",
  },
  textSm: {
    fontSize: 9,
    lineHeight: 11,
  },
});
