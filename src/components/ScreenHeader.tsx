import React from "react";
import {
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Box, Text, Pressable, HStack, VStack } from "./ui";
import { theme } from "../theme";

export interface HeaderAction {
  icon?: keyof typeof Ionicons.glyphMap;
  text?: string;
  onPress: () => void;
  style?: "primary" | "secondary";
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
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
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
          <Ionicons name="close" size={24} color={theme.colors.black} />
        </Pressable>
      );
    }

    return <Box w={40} h={40} />;
  };

  const renderRightActions = () => {
    if (rightComponent) {
      return <Box w={40}>{rightComponent}</Box>;
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
            rounded="$full"
            bg={action.style === "primary" ? "$black" : "$gray100"}
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
                      ? theme.colors.white
                      : theme.colors.gray400
                  }
                />
              )}
              {action.text && (
                <Text
                  color={action.style === "primary" ? "$white" : "$gray600"}
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
      bg="$white"
      px="$lg"
      pt={variant === "large" ? "$xl" : variant === "minimal" ? "$md" : "$sm"}
      pb={variant === "large" ? "$lg" : "$sm"}
      borderBottomWidth={borderless ? 0 : 1}
      borderBottomColor="$gray100"
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
              color="$gray400"
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

const styles = StyleSheet.create({
  boldTitle: {
    ...theme.typography.h1,
    fontWeight: "600",
  },
  titleLarge: {
    ...theme.typography.hero,
    fontSize: 32,
    fontWeight: "300",
    color: theme.colors.black,
    letterSpacing: 1,
    textAlign: "center",
  },
  titleMinimal: {
    ...theme.typography.body,
    fontSize: 18,
    fontWeight: "500",
    color: theme.colors.black,
    textAlign: "center",
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.black,
    textAlign: "center",
  },
});

export default ScreenHeader;
