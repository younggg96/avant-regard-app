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
import { theme } from "../theme";

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  alertContainer: {
    width: width - theme.spacing.md * 2,
    maxWidth: 320,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: "center",
    ...theme.shadows.lg,
  },
  iconContainer: {
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.gray500,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  buttonContainer: {
    width: "100%",
    gap: theme.spacing.sm,
  },
  button: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  defaultButton: {
    backgroundColor: theme.colors.black,
  },
  cancelButton: {
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  destructiveButton: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    ...theme.typography.button,
    fontSize: 16,
  },
  defaultButtonText: {
    color: theme.colors.white,
  },
  cancelButtonText: {
    color: theme.colors.gray500,
  },
  destructiveButtonText: {
    color: theme.colors.white,
  },
});

export default CustomAlert;
