import React from "react";
import {
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Box, Text, Pressable, HStack, VStack } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

export interface HeaderAction {
  icon?: keyof typeof Ionicons.glyphMap;
  text?: string;
  onPress: () => void;
  style?: "primary" | "secondary" | "ghost";
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showBackButton?: boolean;
  showCloseButton?: boolean;
  rightActions?: HeaderAction[];
  rightComponent?: React.ReactNode;
  variant?: "default" | "large" | "minimal";
  style?: ViewStyle;
  titleStyle?: TextStyle;
  borderless?: boolean;
  onBackPress?: () => void;
  boldTitle?: boolean;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showBackButton = false,
  showCloseButton = false,
  rightActions = [],
  rightComponent,
  variant = "default",
  style,
  titleStyle,
  borderless = false,
  onBackPress,
  boldTitle = false,
}) => {
  const navigation = useNavigation();
  const t = useAppTheme();
  const theme = t;
  const styles = useThemedStyles(makeStyles);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const renderLeftButton = () => {
    if (showBack || showBackButton) {
      return (
        <Pressable
          w={40}
          h={40}
          justifyContent="center"
          alignItems="start"
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={24} color={t.colors.text} />
        </Pressable>
      );
    }

    if (showCloseButton) {
      return (
        <Pressable
          w={40}
          h={40}
          justifyContent="center"
          alignItems="start"
          onPress={handleBackPress}
        >
          <Ionicons name="close" size={24} color={t.colors.text} />
        </Pressable>
      );
    }

    return <Box w={40} h={40} />;
  };

  const renderRightActions = () => {
    if (rightComponent) {
      // 用 minW=40 占住对称位 (与左侧 back 按钮 w=40 配对, 让 title 视觉居中),
      // 但允许内容自然撑开 — 历史这里写 w=40 把 QuotaBadge 等宽控件挤成竖排。
      // 不加 alignItems, 保持子元素自然布局 (避免破坏既有图标按钮位置)。
      return <Box minWidth={40}>{rightComponent}</Box>;
    }

    if (rightActions.length === 0) {
      return <Box w={40} />;
    }

    return (
      <HStack w={40} justifyContent="end" alignItems="center">
        {rightActions.map((action, index) => (
          <Pressable
            key={index}
            px="$sm"
            py="$xs"
            rounded="$sm"
            style={{ backgroundColor: action.style === "primary" ? theme.colors.black : action.style === "ghost" ? "transparent" : theme.colors.gray100 }}
            ml="$xs"
            onPress={action.onPress}
          >
            <HStack space="xs" alignItems="center">
              {action.icon && (
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={
                    action.style === "primary"
                      ? t.colors.textInverted
                      : t.colors.gray400
                  }
                />
              )}
              {action.text && (
                <Text
                  style={{ color: action.style === "primary" ? theme.colors.white : theme.colors.gray600 }}
                  fontWeight="$semibold"
                  fontSize="$sm"
                >
                  {action.text}
                </Text>
              )}
            </HStack>
          </Pressable>
        ))}
      </HStack>
    );
  };

  const getTitleStyle = () => {
    switch (variant) {
      case "large":
        return [styles.titleLarge, titleStyle];
      case "minimal":
        return [styles.titleMinimal, titleStyle];
      default:
        return [styles.title, titleStyle];
    }
  };

  const containerStyle = {
    ...style,
  };

  return (
    <Box
      bg={t.colors.card}
      px="$lg"
      pt={variant === "large" ? "$xl" : variant === "minimal" ? "$md" : "$sm"}
      pb={variant === "large" ? "$lg" : "$sm"}
      borderBottomWidth={borderless ? 0 : 1}
      borderBottomColor={t.colors.border}
      sx={containerStyle}
    >
      <HStack alignItems="center" justifyContent="between">
        {renderLeftButton()}

        <VStack flex={1} alignItems="center" px="$sm">
          <Text
            textAlign="center"
            style={[boldTitle ? styles.boldTitle : getTitleStyle()]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{ color: theme.colors.gray400 }}
              fontSize="$xs"
              lineHeight="$xs"
              textAlign="center"
              mt="$xs"
              sx={{
                letterSpacing: 1,
              }}
            >
              {subtitle}
            </Text>
          )}
        </VStack>
        {renderRightActions()}
      </HStack>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    boldTitle: {
      ...t.typography.h1,
      fontWeight: "600",
      color: t.colors.text,
    },
    titleLarge: {
      ...t.typography.hero,
      fontSize: 32,
      fontWeight: "300",
      color: t.colors.text,
      letterSpacing: 1,
      textAlign: "center",
    },
    titleMinimal: {
      ...t.typography.body,
      fontSize: 18,
      fontWeight: "500",
      color: t.colors.text,
      textAlign: "center",
    },
    title: {
      ...t.typography.h4,
      color: t.colors.text,
      textAlign: "center",
    },
  });

export default ScreenHeader;
