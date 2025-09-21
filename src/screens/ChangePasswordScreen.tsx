import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useAlert } from "../components/AlertProvider";

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { showError, showSuccess } = useAlert();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    if (
      !formData.currentPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      showError("Error", "Please fill in all fields");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showError("Error", "New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      showError("Error", "New password must be at least 6 characters");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      showError(
        "Error",
        "New password must be different from current password"
      );
      return;
    }

    setIsLoading(true);

    try {
      // Mock API call - replace with real implementation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      showSuccess(
        "Password Changed",
        "Your password has been changed successfully.",
        () => navigation.goBack()
      );
    } catch (error) {
      showError(
        "Error",
        "Failed to change password. Please check your current password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
          </TouchableOpacity>

          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>
            Update your password to keep your account secure
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.currentPassword}
                onChangeText={(currentPassword) =>
                  setFormData({ ...formData, currentPassword })
                }
                placeholder="Enter current password"
                placeholderTextColor={theme.colors.gray300}
                secureTextEntry={!showPasswords.current}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() =>
                  setShowPasswords({
                    ...showPasswords,
                    current: !showPasswords.current,
                  })
                }
              >
                <Ionicons
                  name={showPasswords.current ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.newPassword}
                onChangeText={(newPassword) =>
                  setFormData({ ...formData, newPassword })
                }
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.gray300}
                secureTextEntry={!showPasswords.new}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() =>
                  setShowPasswords({
                    ...showPasswords,
                    new: !showPasswords.new,
                  })
                }
              >
                <Ionicons
                  name={showPasswords.new ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.confirmPassword}
                onChangeText={(confirmPassword) =>
                  setFormData({ ...formData, confirmPassword })
                }
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.gray300}
                secureTextEntry={!showPasswords.confirm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() =>
                  setShowPasswords({
                    ...showPasswords,
                    confirm: !showPasswords.confirm,
                  })
                }
              >
                <Ionicons
                  name={showPasswords.confirm ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.securityNote}>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={theme.colors.accent}
            />
            <Text style={styles.securityText}>
              Choose a strong password with a mix of letters, numbers, and
              symbols
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.changeButton,
              isLoading && styles.changeButtonDisabled,
            ]}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            <Text style={styles.changeButtonText}>
              {isLoading ? "Changing..." : "Change Password"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: theme.spacing.md,
    top: theme.spacing.lg,
    padding: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    textAlign: "center",
    paddingHorizontal: theme.spacing.md,
    lineHeight: 20,
  },
  form: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    paddingBottom: theme.spacing.xxl,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
    fontWeight: "500",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.white,
  },
  passwordInput: {
    ...theme.typography.body,
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.black,
  },
  eyeButton: {
    padding: theme.spacing.sm,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xl,
  },
  securityText: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.sm,
    flex: 1,
    lineHeight: 16,
  },
  changeButton: {
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  changeButtonDisabled: {
    opacity: 0.6,
  },
  changeButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    letterSpacing: 1,
  },
});

export default ChangePasswordScreen;
