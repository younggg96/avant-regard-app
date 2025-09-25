import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../theme";

export interface HeaderAction {
  icon?: keyof typeof Ionicons.glyphMap;
  text?: string;
  onPress: () => void;
  style?: "primary" | "secondary";
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showCloseButton?: boolean;
  rightActions?: HeaderAction[];
  variant?: "default" | "large" | "minimal";
  style?: ViewStyle;
  titleStyle?: TextStyle;
  borderless?: boolean;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  showCloseButton = false,
  rightActions = [],
  variant = "default",
  style,
  titleStyle,
  borderless = false,
}) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const renderLeftButton = () => {
    if (showBackButton) {
      return (
        <TouchableOpacity
          style={styles.leftButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>
      );
    }

    if (showCloseButton) {
      return (
        <TouchableOpacity
          style={styles.leftButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={theme.colors.black} />
        </TouchableOpacity>
      );
    }

    return <View style={styles.leftButton} />;
  };

  const renderRightActions = () => {
    if (rightActions.length === 0) {
      return <View style={styles.rightActions} />;
    }

    return (
      <View style={styles.rightActions}>
        {rightActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.actionButton,
              action.style === "primary" && styles.primaryActionButton,
            ]}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
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
                style={[
                  styles.actionButtonText,
                  action.style === "primary" && styles.primaryActionButtonText,
                ]}
              >
                {action.text}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
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

  return (
    <View
      style={[
        styles.container,
        variant === "large" && styles.containerLarge,
        variant === "minimal" && styles.containerMinimal,
        !borderless && styles.containerWithBorder,
        style,
      ]}
    >
      <View style={styles.content}>
        {renderLeftButton()}

        <View style={styles.titleContainer}>
          <Text style={getTitleStyle()}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {renderRightActions()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  containerLarge: {
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  containerMinimal: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  containerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.black,
    fontWeight: "600",
    textAlign: "center",
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
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  rightActions: {
    width: 40,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
    marginLeft: theme.spacing.xs,
  },
  primaryActionButton: {
    backgroundColor: theme.colors.black,
  },
  actionButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray600,
    fontWeight: "600",
    marginLeft: theme.spacing.xs / 2,
  },
  primaryActionButtonText: {
    color: theme.colors.white,
  },
});

export default ScreenHeader;
