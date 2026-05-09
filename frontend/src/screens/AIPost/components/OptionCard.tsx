/**
 * AI 发帖助手 — 4 步问答的大卡选项组件。
 *
 * 设计原则:
 *  - 卡片优先视觉: 上半封面图、下半双语名字。Q4 角度卡无图时退化为色块 + 大号 emoji。
 *  - 整张卡可点;选中态用边框 + 背景反差,避免在小屏上看不清。
 */

import React from "react";
import { Text as RNText } from "react-native";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, OptimizedImage } from "../../../components/ui";
import { playfairFonts, theme } from "../../../theme";
import { ImageSize } from "../../../utils/imageUtils";
import type { OptionCard as OptionCardData } from "../../../services/aiPostService";

interface OptionCardProps {
  data: OptionCardData;
  selected?: boolean;
  onPress: () => void;
}

const PLACEHOLDER_BG = "#F0EDE6";

const OptionCard: React.FC<OptionCardProps> = ({ data, selected, onPress }) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith("zh");
  const displayName = isZh && data.name_zh ? data.name_zh : data.name;
  const subtitle = isZh && data.name_zh ? data.name : data.name_zh || data.subtitle;

  return (
    <Pressable onPress={onPress} flex={1}>
      <Box
        bg="$white"
        borderWidth={selected ? 2 : 1}
        borderColor={selected ? "$black" : "$gray100"}
        rounded="$md"
        overflow="hidden"
        sx={{
          shadowColor: "$black",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: selected ? 0.12 : 0.04,
          shadowRadius: 4,
          elevation: selected ? 3 : 1,
        }}
      >
        <Box
          aspectRatio={1}
          bg={PLACEHOLDER_BG}
          alignItems="center"
          justifyContent="center"
        >
          {data.cover_url ? (
            <OptimizedImage
              uri={data.cover_url}
              size={ImageSize.THUMBNAIL}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          ) : (
            // 裸 RN Text：大字 + 显式 lineHeight，避免部分机型上主题默认行高裁切首字。
            <RNText
              style={{
                fontSize: 36,
                lineHeight: 45,
                fontWeight: "500",
                color: theme.colors.gray300,
                textAlign: "center",
                fontFamily: playfairFonts.medium,
              }}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {displayName.slice(0, 1)}
            </RNText>
          )}
        </Box>
        <Box px="$sm" py="$sm">
          <Text
            fontSize="$sm"
            fontWeight="$medium"
            color="$black"
            numberOfLines={1}
            style={{ fontFamily: playfairFonts.medium }}
          >
            {displayName}
          </Text>
          {subtitle ? (
            <Text
              fontSize="$xs"
              color="$gray400"
              mt={2}
              numberOfLines={1}
              style={{ fontFamily: playfairFonts.regular }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Box>
      </Box>
    </Pressable>
  );
};

export default OptionCard;
