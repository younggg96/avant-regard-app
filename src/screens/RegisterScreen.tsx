import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useAlert } from "../components/AlertProvider";

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { login, setLoading, isLoading } = useAuthStore();
  const { showError } = useAlert();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nickname: "",
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!formData.email || !formData.password || !formData.nickname) {
      showError("Error", "Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showError("Error", "Passwords do not match");
      return;
    }

    if (!formData.acceptTerms) {
      showError("Error", "Please accept the terms and conditions");
      return;
    }

    setLoading(true);

    try {
      // Mock registration - replace with real API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockUser = {
        id: "user-new-" + Date.now(),
        email: formData.email,
        nickname: formData.nickname,
        token: "mock-jwt-token",
        refreshToken: "mock-refresh-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      login(mockUser);
      // Navigation will automatically switch to main app due to auth state change
    } catch (error) {
      showError("Registration Failed", "Please try again");
    } finally {
      setLoading(false);
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

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the fashion community</Text>
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nickname *</Text>
            <TextInput
              style={styles.input}
              value={formData.nickname}
              onChangeText={(nickname) =>
                setFormData({ ...formData, nickname })
              }
              placeholder="Choose a nickname"
              placeholderTextColor={theme.colors.gray300}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(email) => setFormData({ ...formData, email })}
              placeholder="Enter your email"
              placeholderTextColor={theme.colors.gray300}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.password}
                onChangeText={(password) =>
                  setFormData({ ...formData, password })
                }
                placeholder="Create a password"
                placeholderTextColor={theme.colors.gray300}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.confirmPassword}
                onChangeText={(confirmPassword) =>
                  setFormData({ ...formData, confirmPassword })
                }
                placeholder="Confirm your password"
                placeholderTextColor={theme.colors.gray300}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() =>
              setFormData({ ...formData, acceptTerms: !formData.acceptTerms })
            }
          >
            <Ionicons
              name={formData.acceptTerms ? "checkbox" : "square-outline"}
              size={20}
              color={
                formData.acceptTerms
                  ? theme.colors.accent
                  : theme.colors.gray300
              }
            />
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.registerButton,
              isLoading && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate("Login")}
            >
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  form: {
    flex: 1,
  },
  formContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    justifyContent: "center",
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
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
  },
  termsText: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    color: theme.colors.black,
    textDecorationLine: "underline",
  },
  registerButton: {
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: theme.spacing.xxl,
  },
  loginText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  loginLink: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});

export default RegisterScreen;
