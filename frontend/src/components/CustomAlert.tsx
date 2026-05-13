import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";

const { width } = Dimensions.get("window");

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
  icon?: string;
  iconColor?: string;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: "OK" }],
  onClose,
  icon,
  iconColor = theme.colors.gray400,
}) => {
  const styles = useThemedStyles(makeStyles);

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    onClose();
  };

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case "destructive":
        return [styles.button, styles.destructiveButton];
      case "cancel":
        return [styles.button, styles.cancelButton];
      default:
        return [styles.button, styles.defaultButton];
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case "destructive":
        return [styles.buttonText, styles.destructiveButtonText];
      case "cancel":
        return [styles.buttonText, styles.cancelButtonText];
      default:
        return [styles.buttonText, styles.defaultButtonText];
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons name={icon as any} size={32} color={iconColor} />
            </View>
          )}

          <Text style={styles.title}>{title}</Text>

          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={getButtonStyle(button.style)}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.8}
              >
                <Text style={getButtonTextStyle(button.style)}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Hook for easier usage
export const useCustomAlert = () => {
  const [alertConfig, setAlertConfig] = React.useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    icon?: string;
    iconColor?: string;
  }>({
    visible: false,
    title: "",
  });

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    icon?: string,
    iconColor?: string
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
      icon,
      iconColor,
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const AlertComponent = () => (
    <CustomAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      onClose={hideAlert}
      icon={alertConfig.icon}
      iconColor={alertConfig.iconColor}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: t.spacing.md,
    },
    alertContainer: {
      width: width - t.spacing.md * 2,
      maxWidth: 320,
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.lg,
      alignItems: "center",
      ...t.shadows.lg,
    },
    iconContainer: {
      marginBottom: t.spacing.md,
    },
    title: {
      ...t.typography.h3,
      color: t.colors.text,
      textAlign: "center",
      marginBottom: t.spacing.sm,
    },
    message: {
      ...t.typography.body,
      color: t.colors.gray500,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: t.spacing.lg,
    },
    buttonContainer: {
      width: "100%",
      gap: t.spacing.sm,
    },
    button: {
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
    },
    defaultButton: {
      backgroundColor: t.colors.text,
    },
    cancelButton: {
      backgroundColor: t.colors.gray100,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    destructiveButton: {
      backgroundColor: t.colors.error,
    },
    buttonText: {
      ...t.typography.button,
      fontSize: 16,
    },
    defaultButtonText: {
      color: t.colors.textInverted,
    },
    cancelButtonText: {
      color: t.colors.gray500,
    },
    destructiveButtonText: {
      color: t.colors.textInverted,
    },
  });

export default CustomAlert;
