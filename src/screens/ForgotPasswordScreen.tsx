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
import { useAlert } from "../components/AlertProvider";

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const { showError, showSuccess } = useAlert();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendReset = async () => {
    if (!email) {
      showError("Error", "Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      // Mock API call - replace with real implementation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setEmailSent(true);
      showSuccess(
        "Email Sent",
        "If an account with this email exists, you will receive a password reset link.",
        () => (navigation as any).navigate("Login")
      );
    } catch (error) {
      showError("Error", "Failed to send reset email. Please try again.");
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

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your
            password
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="mail-outline"
              size={64}
              color={theme.colors.gray300}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={theme.colors.gray300}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!emailSent}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (isLoading || emailSent) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendReset}
            disabled={isLoading || emailSent}
          >
            <Text style={styles.sendButtonText}>
              {isLoading
                ? "Sending..."
                : emailSent
                ? "Email Sent"
                : "Send Reset Link"}
            </Text>
          </TouchableOpacity>

          {emailSent && (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.colors.accent}
              />
              <Text style={styles.successText}>
                Check your email for reset instructions
              </Text>
            </View>
          )}

          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate("Login")}
            >
              <Text style={styles.helpLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
  iconContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
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
  input: {
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  sendButton: {
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.lg,
  },
  successText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.sm,
  },
  helpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  helpText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  helpLink: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});

export default ForgotPasswordScreen;
