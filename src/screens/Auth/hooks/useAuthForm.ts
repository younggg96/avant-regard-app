import { useState, useRef, useEffect, useCallback } from "react";
import { TextInput, ScrollView, LayoutChangeEvent } from "react-native";
import { Alert } from "../../../utils/Alert";
import { authService } from "../../../services/authService";
import { userInfoService, Gender } from "../../../services/userInfoService";
import { useAuthStore } from "../../../store/authStore";
import { AuthMode, FormData, RegisteredTokens } from "../types";
import { INITIAL_FORM_DATA } from "../constants";

export const useAuthForm = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // 注册后用户ID
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);
  const [registeredTokens, setRegisteredTokens] =
    useState<RegisteredTokens | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);

  // 输入框引用
  const phoneInputRef = useRef<TextInput>(null);
  const verificationCodeInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // ScrollView 引用和输入框位置跟踪
  const scrollViewRef = useRef<ScrollView>(null);
  const inputPositions = useRef<{ [key: string]: number }>({});

  const { loginWithResponse } = useAuthStore();

  // 记录输入框位置
  const handleInputLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      inputPositions.current[key] = event.nativeEvent.layout.y;
    },
    []
  );

  // 输入框获得焦点时滚动到可见区域
  const scrollToInput = useCallback((key: string) => {
    const yOffset = inputPositions.current[key];
    if (yOffset !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, yOffset - 120),
        animated: true,
      });
    }
  }, []);

  // 验证手机号格式（根据国家区号验证）
  const validatePhone = useCallback(
    (phone: string, countryDialCode?: string) => {
      const dialCode =
        countryDialCode || formData.countryCode?.dialCode || "+86";

      // 去除空格和横线
      const cleanPhone = phone.replace(/[\s\-]/g, "");

      // 根据不同国家/地区的区号进行验证
      switch (dialCode) {
        case "+86": // 中国大陆：11位，1开头
          return /^1[3-9]\d{9}$/.test(cleanPhone);
        case "+852": // 香港：8位数字
          return /^[2-9]\d{7}$/.test(cleanPhone);
        case "+853": // 澳门：8位数字
          return /^6\d{7}$/.test(cleanPhone);
        case "+886": // 台湾：9位数字（去掉0开头）
          return /^9\d{8}$/.test(cleanPhone) || /^0?9\d{8}$/.test(cleanPhone);
        case "+1": // 美国/加拿大：10位数字
          return /^\d{10}$/.test(cleanPhone);
        case "+44": // 英国：10-11位
          return /^7\d{9}$/.test(cleanPhone) || /^0?7\d{9}$/.test(cleanPhone);
        case "+81": // 日本：10-11位
          return (
            /^[789]0\d{8}$/.test(cleanPhone) ||
            /^0?[789]0\d{8}$/.test(cleanPhone)
          );
        case "+82": // 韩国：10-11位
          return (
            /^1[0-9]\d{7,8}$/.test(cleanPhone) ||
            /^0?1[0-9]\d{7,8}$/.test(cleanPhone)
          );
        case "+65": // 新加坡：8位数字
          return /^[89]\d{7}$/.test(cleanPhone);
        default:
          // 其他国家：通用验证，6-15位数字
          return /^\d{6,15}$/.test(cleanPhone);
      }
    },
    [formData.countryCode]
  );

  // 获取完整手机号（带国家区号）
  const getFullPhoneNumber = useCallback(() => {
    const dialCode = formData.countryCode?.dialCode || "+86";
    const cleanPhone = formData.phone.replace(/[\s\-]/g, "");
    return `${dialCode}${cleanPhone}`;
  }, [formData.phone, formData.countryCode]);

  // 发送验证码
  const sendVerificationCode = useCallback(async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      await authService.sendSms({ phone: fullPhone });

      Alert.show("验证码已发送至 " + fullPhone);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "验证码发送失败，请稍后重试";
      Alert.show("发送失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [formData.phone, validatePhone, getFullPhoneNumber]);

  // 处理密码登录
  const handleLogin = useCallback(async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.password) {
      Alert.show("提示: 请输入密码");
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      const response = await authService.login({
        phone: fullPhone,
        password: formData.password,
      });

      loginWithResponse(response);
      console.log("response", response);
      Alert.show("登录成功: 欢迎回来！", "", 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "手机号或密码错误";
      Alert.show("登录失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [
    formData.phone,
    formData.password,
    validatePhone,
    loginWithResponse,
    getFullPhoneNumber,
  ]);

  // 处理验证码登录
  const handleSmsLogin = useCallback(async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.verificationCode) {
      Alert.show("提示: 请输入验证码");
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      const response = await authService.loginSms({
        phone: fullPhone,
        code: formData.verificationCode,
      });

      loginWithResponse(response);
      Alert.show("登录成功: 欢迎回来！", "", 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "验证码错误或已过期";
      Alert.show("登录失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [
    formData.phone,
    formData.verificationCode,
    validatePhone,
    loginWithResponse,
    getFullPhoneNumber,
  ]);

  // 处理注册
  const handleRegister = useCallback(async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    if (!formData.verificationCode) {
      Alert.show("提示: 请输入验证码");
      return;
    }

    if (!formData.username || formData.username.trim().length < 2) {
      Alert.show("提示: 用户名长度至少2个字符");
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

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      const response = await authService.register({
        phone: fullPhone,
        username: formData.username.trim(),
        password: formData.password,
        code: formData.verificationCode,
      });

      setRegisteredUserId(response.userId);
      setRegisteredTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      // 临时登录
      const tempLoginResponse = {
        userId: response.userId,
        username: formData.username,
        phone: fullPhone,
        is_admin: false,
        userType: "USER",
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };
      loginWithResponse(tempLoginResponse);

      Alert.show("注册成功: 请完善您的资料", "", 1000);

      setTimeout(() => {
        setMode("completeProfile");
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "注册过程中出现错误，请稍后重试";
      Alert.show("注册失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [
    formData,
    validatePhone,
    loginWithResponse,
    getFullPhoneNumber,
  ]);

  // 处理完善资料
  const handleCompleteProfile = useCallback(async () => {
    if (!formData.location) {
      Alert.show("提示: 请选择您的所在地");
      return;
    }

    if (!formData.gender) {
      Alert.show("提示: 请选择您的性别");
      return;
    }

    if (!formData.age) {
      Alert.show("提示: 请选择您的年龄段");
      return;
    }

    if (!registeredUserId || !registeredTokens) {
      Alert.show("错误: 请重新注册");
      setMode("register");
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      const tempLoginResponse = {
        userId: registeredUserId,
        username: formData.username,
        phone: fullPhone,
        is_admin: false,
        userType: "USER",
        accessToken: registeredTokens.accessToken,
        refreshToken: registeredTokens.refreshToken,
      };
      loginWithResponse(tempLoginResponse);

      let ageValue = 25;
      if (formData.age === "50+") {
        ageValue = 55;
      } else {
        const ageParts = formData.age.split("-");
        if (ageParts.length === 2) {
          ageValue = Math.floor(
            (parseInt(ageParts[0]) + parseInt(ageParts[1])) / 2
          );
        }
      }

      await userInfoService.updateUserProfile(registeredUserId, {
        location: formData.location,
        gender: formData.gender as Gender,
        age: ageValue,
        preference: formData.preference,
      });

      Alert.show("资料完善成功: 请使用账号密码登录", "", 1500);

      setTimeout(() => {
        useAuthStore.getState().logout();
        setMode("login");
        setFormData((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
          verificationCode: "",
          location: "",
          gender: "",
          age: "",
          preference: "",
        }));
        setRegisteredUserId(null);
        setRegisteredTokens(null);
      }, 1500);
    } catch (error) {
      useAuthStore.getState().logout();
      const message =
        error instanceof Error ? error.message : "保存资料失败，请稍后重试";
      Alert.show("保存失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [
    formData,
    registeredUserId,
    registeredTokens,
    loginWithResponse,
    getFullPhoneNumber,
  ]);

  // 处理忘记密码
  const handleForgotPassword = useCallback(async () => {
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

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      await authService.forgetPassword({
        phone: fullPhone,
        password: formData.password,
        code: formData.verificationCode,
      });

      Alert.show("密码重置成功: 请使用新密码登录", "", 1000);

      setTimeout(() => {
        setMode("login");
        setFormData((prev) => ({
          ...prev,
          password: "",
          confirmPassword: "",
          verificationCode: "",
        }));
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "密码重置失败，请稍后重试";
      Alert.show("重置失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [formData, validatePhone, getFullPhoneNumber]);

  // 处理手机号输入完成后的跳转
  const handlePhoneSubmit = useCallback(() => {
    if (mode === "login") {
      passwordInputRef.current?.focus();
    } else if (
      mode === "register" ||
      mode === "forgotPassword" ||
      mode === "verification"
    ) {
      verificationCodeInputRef.current?.focus();
    }
  }, [mode]);

  // 处理验证码输入完成后的跳转
  const handleVerificationCodeSubmit = useCallback(() => {
    if (mode === "register") {
      usernameInputRef.current?.focus();
    } else if (mode === "forgotPassword") {
      passwordInputRef.current?.focus();
    } else if (mode === "verification") {
      handleSmsLogin();
    }
  }, [mode, handleSmsLogin]);

  // 处理用户名输入完成后的跳转
  const handleUsernameSubmit = useCallback(() => {
    passwordInputRef.current?.focus();
  }, []);

  // 处理密码输入完成后的跳转
  const handlePasswordSubmit = useCallback(() => {
    if (mode === "login") {
      handleLogin();
    } else if (mode === "register" || mode === "forgotPassword") {
      confirmPasswordInputRef.current?.focus();
    }
  }, [mode, handleLogin]);

  // 处理确认密码输入完成后的操作
  const handleConfirmPasswordSubmit = useCallback(() => {
    if (mode === "register") {
      handleRegister();
    } else if (mode === "forgotPassword") {
      handleForgotPassword();
    }
  }, [mode, handleRegister, handleForgotPassword]);

  // 处理主要操作
  const handleMainAction = useCallback(() => {
    switch (mode) {
      case "login":
        return handleLogin();
      case "register":
        return handleRegister();
      case "forgotPassword":
        return handleForgotPassword();
      case "verification":
        return handleSmsLogin();
      case "completeProfile":
        return handleCompleteProfile();
    }
  }, [
    mode,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleSmsLogin,
    handleCompleteProfile,
  ]);

  // 跳过资料填写
  const handleSkipProfile = useCallback(() => {
    if (registeredTokens && registeredUserId) {
      useAuthStore.getState().logout();
    }
    setMode("login");
    Alert.show("提示: 您可以稍后在设置中完善资料");
  }, [registeredTokens, registeredUserId]);

  return {
    // 状态
    mode,
    setMode,
    formData,
    setFormData,
    loading,
    countdown,
    showPassword,
    setShowPassword,
    showLocationPicker,
    setShowLocationPicker,
    showAgePicker,
    setShowAgePicker,

    // 引用
    phoneInputRef,
    verificationCodeInputRef,
    usernameInputRef,
    passwordInputRef,
    confirmPasswordInputRef,
    scrollViewRef,

    // 方法
    handleInputLayout,
    scrollToInput,
    sendVerificationCode,
    handlePhoneSubmit,
    handleVerificationCodeSubmit,
    handleUsernameSubmit,
    handlePasswordSubmit,
    handleConfirmPasswordSubmit,
    handleMainAction,
    handleSkipProfile,
  };
};
