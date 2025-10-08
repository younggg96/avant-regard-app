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
import { Alert } from "../utils/Alert";
import ScreenHeader from "../components/ScreenHeader";

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

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
      Alert.show("错误: 请填写所有字段");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.show("错误: 新密码不匹配");
      return;
    }

    if (formData.newPassword.length < 6) {
      Alert.show("错误: 新密码至少需要6个字符");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      Alert.show("错误: 新密码必须与当前密码不同");
      return;
    }

    setIsLoading(true);

    try {
      // Mock API call - replace with real implementation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.show("密码已更改: 您的密码已成功更改", "", 1000);
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      Alert.show("错误: 密码更改失败。请检查您的当前密码");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="更改密码" showBack={true} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>当前密码</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.currentPassword}
                onChangeText={(currentPassword) =>
                  setFormData({ ...formData, currentPassword })
                }
                placeholder="输入当前密码"
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
            <Text style={styles.label}>新密码</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.newPassword}
                onChangeText={(newPassword) =>
                  setFormData({ ...formData, newPassword })
                }
                placeholder="输入新密码"
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
            <Text style={styles.label}>确认新密码</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.confirmPassword}
                onChangeText={(confirmPassword) =>
                  setFormData({ ...formData, confirmPassword })
                }
                placeholder="确认新密码"
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
              选择一个包含字母、数字和符号的强密码
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
              {isLoading ? "更改中..." : "更改密码"}
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
  form: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
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
