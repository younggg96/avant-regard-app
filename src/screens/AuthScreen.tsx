import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";

type AuthMode = "login" | "register" | "forgotPassword" | "verification";

interface FormData {
  phone: string;
  password: string;
  confirmPassword: string;
  verificationCode: string;
  agreement: boolean;
}

const AuthScreen = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [formData, setFormData] = useState<FormData>({
    phone: "",
    password: "",
    confirmPassword: "",
    verificationCode: "",
    agreement: false,
  });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthStore();

  // 验证手机号格式
  const validatePhone = (phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 发送验证码
  const sendVerificationCode = async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    setLoading(true);
    try {
      // 模拟发送验证码
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 开始倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.show("验证码已发送至 " + formData.phone);
    } catch (error) {
      Alert.show("发送失败: 验证码发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理登录
  const handleLogin = async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.password) {
      Alert.show("提示: 请输入密码");
      return;
    }

    setLoading(true);
    try {
      // 模拟登录请求
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 登录成功
      login({
        id: "user-1",
        phone: formData.phone,
        nickname: "用户" + formData.phone.slice(-4),
        avatar: "https://via.placeholder.com/100x100",
      });
    } catch (error) {
      Alert.show("登录失败: 手机号或密码错误");
    } finally {
      setLoading(false);
    }
  };

  // 处理注册
  const handleRegister = async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.verificationCode) {
      Alert.show("提示: 请输入验证码");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.show("提示: 密码长度至少6位");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.show("提示: 两次输入的密码不一致");
      return;
    }

    if (!formData.agreement) {
      Alert.show("提示: 请阅读并同意用户协议和隐私政策");
      return;
    }

    setLoading(true);
    try {
      // 模拟注册请求
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.show("注册成功: 欢迎使用AVANT REGARD！", "", 1000);
      setTimeout(() => {
        login({
          id: "user-1",
          phone: formData.phone,
          nickname: "用户" + formData.phone.slice(-4),
          avatar: "https://via.placeholder.com/100x100",
        });
      }, 1000);
    } catch (error) {
      Alert.show("注册失败: 注册过程中出现错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理忘记密码
  const handleForgotPassword = async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.verificationCode) {
      Alert.show("提示: 请输入验证码");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.show("提示: 新密码长度至少6位");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.show("提示: 两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      // 模拟重置密码请求
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.show("密码重置成功: 请使用新密码登录", "", 1000);
      setTimeout(() => setMode("login"), 1000);
    } catch (error) {
      Alert.show("重置失败: 密码重置失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 渲染品牌logo
  const renderBrandLogo = () => {
    return (
      <View style={styles.brandContainer}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
    );
  };

  // 渲染标题
  const renderTitle = () => {
    const titles = {
      login: "登录",
      register: "注册",
      forgotPassword: "忘记密码",
      verification: "验证码登录",
    };

    const subtitles = {
      login: "欢迎回来",
      register: "创建您的账户",
      forgotPassword: "重置您的密码",
      verification: "输入验证码",
    };

    return (
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{titles[mode]}</Text>
        <Text style={styles.subtitle}>{subtitles[mode]}</Text>
      </View>
    );
  };

  // 渲染表单
  const renderForm = () => {
    return (
      <View style={styles.formContainer}>
        {/* 手机号输入 */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>手机号</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.countryCode}>+86</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入手机号"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>
        </View>

        {/* 验证码输入（注册和忘记密码时显示） */}
        {(mode === "register" ||
          mode === "forgotPassword" ||
          mode === "verification") && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>验证码</Text>
            <View style={styles.verificationContainer}>
              <TextInput
                style={[styles.input, styles.verificationInput]}
                placeholder="请输入验证码"
                value={formData.verificationCode}
                onChangeText={(text) =>
                  setFormData({ ...formData, verificationCode: text })
                }
                keyboardType="number-pad"
                maxLength={6}
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

        {/* 密码输入（登录时显示，或注册/重置密码时显示） */}
        {(mode === "login" ||
          mode === "register" ||
          mode === "forgotPassword") && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {mode === "forgotPassword" ? "新密码" : "密码"}
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
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
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>确认密码</Text>
            <TextInput
              style={styles.input}
              placeholder="请再次输入密码"
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPassword: text })
              }
              secureTextEntry={true}
              maxLength={20}
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

  // 渲染操作按钮
  const renderActions = () => {
    const getButtonText = () => {
      if (loading) return "处理中...";

      switch (mode) {
        case "login":
          return "登录";
        case "register":
          return "注册";
        case "forgotPassword":
          return "重置密码";
        case "verification":
          return "验证并登录";
        default:
          return "确定";
      }
    };

    const handleMainAction = () => {
      switch (mode) {
        case "login":
          return handleLogin();
        case "register":
          return handleRegister();
        case "forgotPassword":
          return handleForgotPassword();
        case "verification":
          return handleLogin(); // 验证码登录
      }
    };

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.mainButton, loading && styles.mainButtonDisabled]}
          onPress={handleMainAction}
          disabled={loading}
        >
          <Text style={styles.mainButtonText}>{getButtonText()}</Text>
        </TouchableOpacity>

        {/* 切换模式的链接 */}
        <View style={styles.linksContainer}>
          {mode === "login" && (
            <>
              <TouchableOpacity onPress={() => setMode("verification")}>
                <Text style={styles.linkText}>验证码登录</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode("forgotPassword")}>
                <Text style={styles.linkText}>忘记密码？</Text>
              </TouchableOpacity>
            </>
          )}

          {mode !== "login" && (
            <TouchableOpacity onPress={() => setMode("login")}>
              <Text style={styles.linkText}>返回登录</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 登录注册切换 */}
        <View style={styles.switchContainer}>
          {mode === "login" ? (
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>还没有账户？</Text>
              <TouchableOpacity onPress={() => setMode("register")}>
                <Text style={styles.switchLink}>立即注册</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>已有账户？</Text>
              <TouchableOpacity onPress={() => setMode("login")}>
                <Text style={styles.switchLink}>立即登录</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderBrandLogo()}
          {renderTitle()}
          {renderForm()}
          {renderActions()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  // 品牌Logo样式
  brandContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    letterSpacing: 3,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  // 标题样式
  titleContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    letterSpacing: 0.5,
  },
  // 表单样式
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  countryCode: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: "#D8D8D8",
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    flex: 1,
    paddingVertical: 16,
    color: theme.colors.black,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  verificationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  verificationInput: {
    flex: 1,
    marginRight: 12,
  },
  sendCodeButton: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: theme.colors.black,
    borderRadius: 12,
  },
  sendCodeButtonDisabled: {
    backgroundColor: "#E8E8E8",
  },
  sendCodeText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  sendCodeTextDisabled: {
    color: theme.colors.gray400,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingRight: 16,
  },
  passwordInput: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 16,
    color: theme.colors.black,
  },
  eyeButton: {
    padding: 8,
  },
  agreementContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  checkbox: {
    marginRight: 8,
    marginTop: 2,
  },
  agreementText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    flex: 1,
    lineHeight: 18,
  },
  agreementLink: {
    color: theme.colors.black,
    fontFamily: "Inter-Medium",
  },
  // 按钮和操作样式
  actionsContainer: {
    marginBottom: 24,
  },
  mainButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
  },
  mainButtonDisabled: {
    backgroundColor: "#E8E8E8",
  },
  mainButtonText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
    letterSpacing: 0.2,
  },
  switchContainer: {
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    marginRight: 6,
  },
  switchLink: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: theme.colors.black,
    letterSpacing: 0.3,
  },
});

export default AuthScreen;
