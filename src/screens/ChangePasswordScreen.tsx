import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { authService } from "../services/authService";
import ScreenHeader from "../components/ScreenHeader";
import { Alert } from "../utils/Alert";

const MIN_PASSWORD_LENGTH = 6;

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFormValid =
    oldPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === newPassword;

  const handleSubmit = async () => {
    if (!user?.userId) return;

    if (newPassword !== confirmPassword) {
      Alert.show("两次输入的新密码不一致");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.show(`密码长度不能少于${MIN_PASSWORD_LENGTH}位`);
      return;
    }

    if (oldPassword === newPassword) {
      Alert.show("新密码不能与当前密码相同");
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        userId: user.userId,
        oldPassword,
        newPassword,
      });
      Alert.show("密码修改成功");
      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "密码修改失败，请稍后重试";
      Alert.show(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="修改密码" showBack={true} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.description}>
            请输入当前密码以验证身份，然后设置新密码。
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>当前密码</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="请输入当前密码"
                placeholderTextColor={theme.colors.gray200}
                secureTextEntry={!showOldPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowOldPassword(!showOldPassword)}
              >
                <Ionicons
                  name={showOldPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>新密码</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={`请输入新密码（至少${MIN_PASSWORD_LENGTH}位）`}
                placeholderTextColor={theme.colors.gray200}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>确认新密码</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="请再次输入新密码"
                placeholderTextColor={theme.colors.gray200}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={
                    showConfirmPassword ? "eye-outline" : "eye-off-outline"
                  }
                  size={20}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <Text style={styles.errorHint}>两次输入的密码不一致</Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormValid && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>确认修改</Text>
            )}
          </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
    marginBottom: theme.spacing.lg,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray50,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  eyeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  errorHint: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
});

export default ChangePasswordScreen;
