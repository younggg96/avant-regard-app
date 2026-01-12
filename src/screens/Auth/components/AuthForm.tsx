import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { AuthMode, FormData } from "../types";
import { styles } from "../styles";

interface AuthFormProps {
  mode: AuthMode;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  loading: boolean;
  countdown: number;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  // 引用
  phoneInputRef: React.RefObject<TextInput>;
  verificationCodeInputRef: React.RefObject<TextInput>;
  usernameInputRef: React.RefObject<TextInput>;
  passwordInputRef: React.RefObject<TextInput>;
  confirmPasswordInputRef: React.RefObject<TextInput>;
  // 方法
  handleInputLayout: (key: string) => (event: any) => void;
  scrollToInput: (key: string) => void;
  sendVerificationCode: () => void;
  handlePhoneSubmit: () => void;
  handleVerificationCodeSubmit: () => void;
  handleUsernameSubmit: () => void;
  handlePasswordSubmit: () => void;
  handleConfirmPasswordSubmit: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  mode,
  formData,
  setFormData,
  loading,
  countdown,
  showPassword,
  setShowPassword,
  phoneInputRef,
  verificationCodeInputRef,
  usernameInputRef,
  passwordInputRef,
  confirmPasswordInputRef,
  handleInputLayout,
  scrollToInput,
  sendVerificationCode,
  handlePhoneSubmit,
  handleVerificationCodeSubmit,
  handleUsernameSubmit,
  handlePasswordSubmit,
  handleConfirmPasswordSubmit,
}) => {
  return (
    <View style={styles.formContainer}>
      {/* 手机号输入 */}
      <View
        style={styles.inputContainer}
        onLayout={handleInputLayout("phone")}
      >
        <Text style={styles.inputLabel}>手机号</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.countryCode}>+86</Text>
          <TextInput
            ref={phoneInputRef}
            style={styles.input}
            placeholder="请输入手机号"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
            maxLength={11}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={handlePhoneSubmit}
            onFocus={() => scrollToInput("phone")}
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </View>
      </View>

      {/* 验证码输入（注册和忘记密码时显示） */}
      {(mode === "register" ||
        mode === "forgotPassword" ||
        mode === "verification") && (
        <View
          style={styles.inputContainer}
          onLayout={handleInputLayout("verificationCode")}
        >
          <Text style={styles.inputLabel}>验证码</Text>
          <View style={styles.verificationContainer}>
            <TextInput
              ref={verificationCodeInputRef}
              style={[styles.input, styles.verificationInput]}
              placeholder="请输入验证码"
              value={formData.verificationCode}
              onChangeText={(text) =>
                setFormData({ ...formData, verificationCode: text })
              }
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType={mode === "verification" ? "done" : "next"}
              blurOnSubmit={mode === "verification"}
              onSubmitEditing={handleVerificationCodeSubmit}
              onFocus={() => scrollToInput("verificationCode")}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
            />
            <TouchableOpacity
              style={[
                styles.sendCodeButton,
                countdown > 0 && styles.sendCodeButtonDisabled,
              ]}
              onPress={sendVerificationCode}
              disabled={countdown > 0 || loading}
            >
              <Text
                style={[
                  styles.sendCodeText,
                  countdown > 0 && styles.sendCodeTextDisabled,
                ]}
              >
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 用户名输入（注册时显示） */}
      {mode === "register" && (
        <View
          style={styles.inputContainer}
          onLayout={handleInputLayout("username")}
        >
          <Text style={styles.inputLabel}>用户名</Text>
          <TextInput
            ref={usernameInputRef}
            style={styles.input}
            placeholder="请输入用户名"
            value={formData.username}
            onChangeText={(text) =>
              setFormData({ ...formData, username: text })
            }
            maxLength={20}
            autoCapitalize="none"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={handleUsernameSubmit}
            onFocus={() => scrollToInput("username")}
            autoComplete="username"
            textContentType="username"
          />
        </View>
      )}

      {/* 密码输入（登录时显示，或注册/重置密码时显示） */}
      {(mode === "login" ||
        mode === "register" ||
        mode === "forgotPassword") && (
        <View
          style={styles.inputContainer}
          onLayout={handleInputLayout("password")}
        >
          <Text style={styles.inputLabel}>
            {mode === "forgotPassword" ? "新密码" : "密码"}
          </Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordInputRef}
              style={styles.passwordInput}
              placeholder={
                mode === "forgotPassword" ? "请输入新密码" : "请输入密码"
              }
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
              secureTextEntry={!showPassword}
              maxLength={20}
              returnKeyType={mode === "login" ? "done" : "next"}
              blurOnSubmit={mode === "login"}
              onSubmitEditing={handlePasswordSubmit}
              onFocus={() => scrollToInput("password")}
              autoComplete={mode === "login" ? "password" : "password-new"}
              textContentType={mode === "login" ? "password" : "newPassword"}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 确认密码（注册和忘记密码时显示） */}
      {(mode === "register" || mode === "forgotPassword") && (
        <View
          style={styles.inputContainer}
          onLayout={handleInputLayout("confirmPassword")}
        >
          <Text style={styles.inputLabel}>确认密码</Text>
          <TextInput
            ref={confirmPasswordInputRef}
            style={styles.input}
            placeholder="请再次输入密码"
            value={formData.confirmPassword}
            onChangeText={(text) =>
              setFormData({ ...formData, confirmPassword: text })
            }
            secureTextEntry={true}
            maxLength={20}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handleConfirmPasswordSubmit}
            onFocus={() => scrollToInput("confirmPassword")}
            autoComplete="password-new"
            textContentType="newPassword"
          />
        </View>
      )}

      {/* 用户协议（注册时显示） */}
      {mode === "register" && (
        <View style={styles.agreementContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() =>
              setFormData({ ...formData, agreement: !formData.agreement })
            }
          >
            <Ionicons
              name={formData.agreement ? "checkbox" : "square-outline"}
              size={20}
              color={
                formData.agreement
                  ? theme.colors.accent
                  : theme.colors.gray400
              }
            />
          </TouchableOpacity>
          <Text style={styles.agreementText}>
            我已阅读并同意
            <Text style={styles.agreementLink}>《用户协议》</Text>和
            <Text style={styles.agreementLink}>《隐私政策》</Text>
          </Text>
        </View>
      )}
    </View>
  );
};
