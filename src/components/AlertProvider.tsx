import React, { createContext, useContext } from "react";
import { useCustomAlert, AlertButton } from "./CustomAlert";

interface AlertContextType {
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    icon?: string,
    iconColor?: string
  ) => void;
  showSuccess: (title: string, message?: string, onPress?: () => void) => void;
  showError: (title: string, message?: string, onPress?: () => void) => void;
  showConfirm: (
    title: string,
    message?: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showAlert: showCustomAlert, AlertComponent } = useCustomAlert();

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    icon?: string,
    iconColor?: string
  ) => {
    showCustomAlert(title, message, buttons, icon, iconColor);
  };

  const showSuccess = (
    title: string,
    message?: string,
    onPress?: () => void
  ) => {
    showCustomAlert(
      title,
      message,
      [{ text: "OK", onPress }],
      "checkmark-circle",
      theme.colors.success
    );
  };

  const showError = (title: string, message?: string, onPress?: () => void) => {
    showCustomAlert(
      title,
      message,
      [{ text: "OK", onPress }],
      "alert-circle",
      theme.colors.error
    );
  };

  const showConfirm = (
    title: string,
    message?: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    showCustomAlert(title, message, [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Confirm", style: "destructive", onPress: onConfirm },
    ]);
  };

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showError,
        showConfirm,
      }}
    >
      {children}
      <AlertComponent />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within AlertProvider");
  }
  return context;
};

// Import theme for colors
import { theme } from "../theme";
