import { useState, useRef, useEffect, useCallback } from "react";
import { TextInput, ScrollView, LayoutChangeEvent } from "react-native";
import { Alert } from "../../../utils/Alert";
import { authService } from "../../../services/authService";
import {
  designerService,
  DesignerOption,
} from "../../../services/designerService";
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

  // 设计师选项和注册后用户ID
  const [designerOptions, setDesignerOptions] = useState<DesignerOption[]>([]);
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

  // 加载设计师列表（需要认证，在注册成功后调用）
  const loadDesigners = useCallback(async () => {
    try {
      const designers = await designerService.getDesignerOptions();
      setDesignerOptions(designers);
    } catch (error) {
      console.log("加载设计师列表失败:", error);
    }
  }, []);

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

  // 验证手机号格式
  const validatePhone = useCallback((phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }, []);

  // 发送验证码
  const sendVerificationCode = useCallback(async () => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    setLoading(true);
    try {
      await authService.sendSms({ phone: formData.phone });

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
      const message =
        error instanceof Error ? error.message : "验证码发送失败，请稍后重试";
      Alert.show("发送失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [formData.phone, validatePhone]);

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

    setLoading(true);
    try {
      const response = await authService.login({
        phone: formData.phone,
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
  }, [formData.phone, formData.password, validatePhone, loginWithResponse]);

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

    setLoading(true);
    try {
      const response = await authService.loginSms({
        phone: formData.phone,
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

    setLoading(true);
    try {
      const response = await authService.register({
        phone: formData.phone,
        username: formData.username.trim(),
        password: formData.password,
        code: formData.verificationCode,
      });

      setRegisteredUserId(response.userId);
      setRegisteredTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      // 临时登录以便加载设计师列表
      const tempLoginResponse = {
        userId: response.userId,
        username: formData.username,
        phone: formData.phone,
        admin: false,
        userType: "USER",
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };
      loginWithResponse(tempLoginResponse);

      // 加载设计师列表（需要认证）
      await loadDesigners();

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
  }, [formData, validatePhone, loginWithResponse, loadDesigners]);

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

    if (formData.selectedDesigners.length === 0) {
      Alert.show("提示: 请至少选择1个您可能喜欢的设计师");
      return;
    }

    if (formData.selectedDesigners.length > 5) {
      Alert.show("提示: 最多选择5个设计师");
      return;
    }

    if (!registeredUserId || !registeredTokens) {
      Alert.show("错误: 请重新注册");
      setMode("register");
      return;
    }

    setLoading(true);
    try {
      const tempLoginResponse = {
        userId: registeredUserId,
        username: formData.username,
        phone: formData.phone,
        admin: false,
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
        possibleDesignerIds: formData.selectedDesigners.map((d) => d.id),
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
          selectedDesigners: [],
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
  }, [formData, registeredUserId, registeredTokens, loginWithResponse]);

  // 切换设计师选择
  const toggleDesignerSelection = useCallback((designer: DesignerOption) => {
    setFormData((prev) => {
      const isSelected = prev.selectedDesigners.some(
        (d) => d.id === designer.id
      );
      if (isSelected) {
        return {
          ...prev,
          selectedDesigners: prev.selectedDesigners.filter(
            (d) => d.id !== designer.id
          ),
        };
      } else {
        if (prev.selectedDesigners.length >= 5) {
          Alert.show("提示: 最多选择5个设计师");
          return prev;
        }
        return {
          ...prev,
          selectedDesigners: [...prev.selectedDesigners, designer],
        };
      }
    });
  }, []);

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

    setLoading(true);
    try {
      await authService.forgetPassword({
        phone: formData.phone,
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
  }, [formData, validatePhone]);

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
    designerOptions,
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
    toggleDesignerSelection,
  };
};
