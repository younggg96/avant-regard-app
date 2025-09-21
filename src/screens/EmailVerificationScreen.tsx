import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";

const EmailVerificationScreen = ({ route }: any) => {
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();
  const { email } = route.params || { email: user?.email };

  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleResendEmail = async () => {
    setIsLoading(true);
    setCanResend(false);
    setCountdown(60);

    try {
      // Mock API call - replace with real implementation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert("Email Sent", "Verification email has been sent again.");

      // Restart countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      Alert.alert("Error", "Failed to resend email. Please try again.");
      setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    // Mock verification success
    if (user) {
      updateUser({ isVerified: true });
    }
    Alert.alert(
      "Email Verified",
      "Your email has been verified successfully!",
      [
        {
          text: "Continue",
          onPress: () => (navigation as any).navigate("Main"),
        },
      ]
    );
  };

  const handleSkipForNow = () => {
    Alert.alert(
      "Skip Verification",
      "You can verify your email later in settings. Some features may be limited.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          onPress: () => (navigation as any).navigate("Main"),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleSkipForNow}>
          <Ionicons name="close" size={24} color={theme.colors.black} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail" size={80} color={theme.colors.accent} />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>We've sent a verification link to</Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.description}>
          Click the link in the email to verify your account. This helps us keep
          your account secure.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleVerificationComplete}
          >
            <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendButton,
              !canResend && styles.resendButtonDisabled,
            ]}
            onPress={handleResendEmail}
            disabled={!canResend || isLoading}
          >
            <Text style={styles.resendButtonText}>
              {isLoading
                ? "Sending..."
                : canResend
                ? "Resend Email"
                : `Resend in ${countdown}s`}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipForNow}>
          <Text style={styles.skipText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: theme.spacing.xxl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xxl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
    marginBottom: theme.spacing.xs,
  },
  email: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xxl,
  },
  buttonContainer: {
    width: "100%",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  primaryButton: {
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  resendButton: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    ...theme.typography.button,
    color: theme.colors.gray500,
    letterSpacing: 1,
  },
  skipButton: {
    paddingVertical: theme.spacing.md,
  },
  skipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    textDecorationLine: "underline",
  },
});

export default EmailVerificationScreen;
