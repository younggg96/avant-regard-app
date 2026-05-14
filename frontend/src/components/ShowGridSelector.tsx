import React from "react";
import { Dimensions, StyleSheet, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Box, Text, HStack, Pressable, OptimizedImage } from "./ui";
import { ImageSize } from "../utils/imageUtils";
import { playfairFonts, theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

export interface SelectedShow {
  id: number | string;
  brand: string;
  season: string;
  imageUrl: string;
  showId?: number | string;  // 秀场数据库 ID，用于直接关联到 shows 表
  showUrl?: string; // 秀场 URL，仅用于按钮点击跳转链接
}

interface ShowGridSelectorProps {
  selectedShows: SelectedShow[];
  onShowPress: (show: SelectedShow, index: number) => void;
  onRemoveShow: (index: number) => void;
  onAddShow: () => void;
  maxShows?: number;
  label?: string;
  required?: boolean;
}

const ShowGridSelector: React.FC<ShowGridSelectorProps> = ({
  selectedShows,
  onShowPress,
  onRemoveShow,
  onAddShow,
  maxShows = 6,
  label,
  required = false,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const displayLabel = label || t("showSelector.linkedShows");
  const showWidth = (screenWidth - 48 - 16) / 3;
  const showHeight = showWidth * 1.4;
  const styles = useThemedStyles(makeStyles);

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text
          style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.gray600 }]}
          fontSize="$sm"

        >
          {displayLabel}
        </Text>
        {required && (
          <Text
            style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.error }]}
            fontSize="$sm"
            ml="$xs"

          >
            *
          </Text>
        )}
      </HStack>

      <HStack flexWrap="wrap" gap="$sm" pl="$sm">
        {selectedShows.map((show, index) => (
          <View key={`show-${index}`} style={{ width: showWidth, position: "relative" }}>
            <TouchableOpacity
              style={[styles.showCard, { height: showHeight }]}
              onPress={() => onShowPress(show, index)}
              activeOpacity={0.8}
            >
              <OptimizedImage
                uri={show.imageUrl}
                size={ImageSize.THUMBNAIL}
                style={styles.showImage}
                contentFit="cover"
                lazy={true}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.showGradient}
              />
              <View style={styles.showInfo}>
                <Text
                  fontSize={11}
                  style={[{ fontFamily: playfairFonts.bold }, { color: theme.colors.white }]}
                  numberOfLines={1}

                >
                  {show.brand}
                </Text>
                <Text
                  fontSize={10}
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    marginTop: 2,
                    fontFamily: playfairFonts.regular,
                  }}
                  numberOfLines={1}
                >
                  {show.season}
                </Text>
              </View>
            </TouchableOpacity>

            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={22}
              h={22}
              rounded="$sm"
              bg="rgba(0,0,0,0.7)"
              alignItems="center"
              justifyContent="center"
              onPress={() => onRemoveShow(index)}
            >
              <Ionicons name="close" size={12} color={theme.colors.white} />
            </Pressable>
          </View>
        ))}

        {selectedShows.length < maxShows && (
          <Pressable
            w={showWidth}
            h={showHeight}
            rounded="$md"
            style={{ backgroundColor: theme.colors.gray100 }}
            alignItems="center"
            justifyContent="center"
            onPress={onAddShow}
          >
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={theme.colors.gray400}
            />
            <Text
              style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.gray400 }]}
              fontSize="$sm"
              mt="$xs"

            >
              {t("showSelector.addShow")}
            </Text>
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    showCard: {
      width: "100%",
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
    },
    showImage: {
      width: "100%",
      height: "100%",
      backgroundColor: t.colors.gray100,
    },
    showGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
    },
    showInfo: {
      position: "absolute",
      bottom: 8,
      left: 8,
      right: 8,
    },
  });

export default ShowGridSelector;
