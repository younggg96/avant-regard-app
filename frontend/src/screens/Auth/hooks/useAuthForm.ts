import { useState, useRef, useEffect, useCallback } from "react";
import { TextInput, ScrollView, LayoutChangeEvent, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import i18n from "@/i18n";
import { Alert } from "../../../utils/Alert";
import { authService, LoginResponse } from "../../../services/authService";
import { userInfoService, Gender, UserProfileInfo } from "../../../services/userInfoService";
import { brandService } from "../../../services/brandService";
import { useAuthStore } from "../../../store/authStore";
import { AuthMode, LoginMethod, FormData, RegisteredTokens, BrandOption } from "../types";
import { INITIAL_FORM_DATA } from "../constants";

export const useAuthForm = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginMethod, setLoginMethodRaw] = useState<LoginMethod>("phone");
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // 注册后用户ID和tokens
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);
  const [registeredTokens, setRegisteredTokens] =
    useState<RegisteredTokens | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  
  // 注册成功后显示资料填写 Modal
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 用户协议确认 Modal 状态
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  // 登录页面协议勾选状态
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 品牌选择相关状态
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingMoreBrands, setLoadingMoreBrands] = useState(false);
  const [brandPage, setBrandPage] = useState(1);
  const [hasMoreBrands, setHasMoreBrands] = useState(true);
  const [brandSearchKeyword, setBrandSearchKeyword] = useState("");
  const brandPageSize = 50;

  // 输入框引用
  const phoneInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const verificationCodeInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // ScrollView 引用和输入框位置跟踪
  const scrollViewRef = useRef<ScrollView>(null);
  const inputPositions = useRef<{ [key: string]: number }>({});

  const { loginWithResponse, setProfileCompleted } = useAuthStore();

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

  const setLoginMethod = useCallback(
    (method: LoginMethod) => {
      setLoginMethodRaw(method);
      setFormData((prev) => ({
        ...prev,
        phone: "",
        email: "",
        verificationCode: "",
        password: "",
        confirmPassword: "",
      }));
      setCountdown(0);
      if (method === "email" && mode === "verification") {
        setMode("login");
      }
    },
    [mode]
  );

  const validateEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

  // 加载品牌数据（支持分页和搜索）
  const loadBrands = useCallback(
    async (page: number = 1, keyword: string = "", reset: boolean = false) => {
      if (page === 1) {
        setLoadingBrands(true);
      } else {
        setLoadingMoreBrands(true);
      }

      try {
        const response = await brandService.getBrands({
          page,
          pageSize: brandPageSize,
          keyword: keyword || undefined,
        });

        const options: BrandOption[] = response.brands.map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category || null,
        }));

        if (reset || page === 1) {
          setBrandOptions(options);
        } else {
          setBrandOptions((prev) => [...prev, ...options]);
        }

        const totalLoaded = page * brandPageSize;
        setHasMoreBrands(totalLoaded < response.total);
        setBrandPage(page);
      } catch (error) {
        console.error("Failed to load brands:", error);
      } finally {
        setLoadingBrands(false);
        setLoadingMoreBrands(false);
      }
    },
    []
  );

  // 加载更多品牌
  const loadMoreBrands = useCallback(() => {
    if (loadingMoreBrands || !hasMoreBrands) return;
    loadBrands(brandPage + 1, brandSearchKeyword);
  }, [loadingMoreBrands, hasMoreBrands, brandPage, brandSearchKeyword, loadBrands]);

  const handleBrandSearch = useCallback(
    (keyword: string) => {
      setBrandSearchKeyword(keyword);
      if (!keyword.trim()) {
        setBrandPage(1);
        setHasMoreBrands(true);
        loadBrands(1, "", true);
      }
    },
    [loadBrands]
  );

  const handleBrandSearchSubmit = useCallback(() => {
    setBrandPage(1);
    setHasMoreBrands(true);
    loadBrands(1, brandSearchKeyword, true);
  }, [loadBrands, brandSearchKeyword]);

  // 当显示品牌选择器时加载品牌
  useEffect(() => {
    if (showBrandPicker && brandOptions.length === 0) {
      loadBrands(1, "", true);
    }
  }, [showBrandPicker, brandOptions.length, loadBrands]);

  // Apple 登录可用性（仅 iOS 13+）
  const [isAppleLoginAvailable, setIsAppleLoginAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleLoginAvailable);
    }
  }, []);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码（根据 loginMethod 发送短信或邮箱验证码）
  const sendVerificationCode = useCallback(async () => {
    if (countdown > 0) {
      Alert.show(i18n.t('auth.waitCountdown', { count: countdown }));
      return;
    }

    if (loginMethod === "email") {
      if (!validateEmail(formData.email)) {
        Alert.show(i18n.t('auth.invalidEmail'));
        return;
      }
      setLoading(true);
      try {
        await authService.sendEmailOtp({ email: formData.email.trim() });
        setCountdown(60);
        Alert.show(i18n.t('auth.codeSentTo', { target: formData.email }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : i18n.t('auth.codeFailed');
        Alert.show(i18n.t('auth.sendFailedMsg', { message }));
      } finally {
        setLoading(false);
      }
    } else {
      if (!validatePhone(formData.phone)) {
        Alert.show(i18n.t('auth.invalidPhone'));
        return;
      }
      const fullPhone = getFullPhoneNumber();
      setLoading(true);
      try {
        await authService.sendSms({ phone: fullPhone });
        setCountdown(60);
        Alert.show(i18n.t('auth.codeSentTo', { target: fullPhone }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : i18n.t('auth.codeFailed');
        Alert.show(i18n.t('auth.sendFailedMsg', { message }));
      } finally {
        setLoading(false);
      }
    }
  }, [formData.phone, formData.email, loginMethod, validatePhone, validateEmail, getFullPhoneNumber, countdown]);

  // 登录成功后检查并同步用户资料状态
  const syncProfileStatus = useCallback(async (response: LoginResponse) => {
    try {
      // 获取用户完整资料
      const profile = await userInfoService.getUserProfile(response.userId);
      
      // 直接使用后端返回的 profileCompleted 字段
      setProfileCompleted(profile.profileCompleted);
      
      console.log("Profile status synced from server:", profile.profileCompleted);
    } catch (error) {
      // 获取资料失败时，不改变状态，避免误判
      // 下次登录或应用重启时会重新检查
      console.log("Failed to fetch profile, keeping current status:", error);
    }
  }, [setProfileCompleted]);

  // 处理密码登录
  const handleLogin = useCallback(async () => {
    if (!formData.password) {
      Alert.show(i18n.t('auth.passwordRequired'));
      return;
    }

    setLoading(true);
    try {
      let response;
      if (loginMethod === "email") {
        if (!validateEmail(formData.email)) {
          Alert.show(i18n.t('auth.invalidEmail'));
          setLoading(false);
          return;
        }
        response = await authService.loginEmail({
          email: formData.email.trim(),
          password: formData.password,
        });
      } else {
        if (!validatePhone(formData.phone)) {
          Alert.show(i18n.t('auth.invalidPhone'));
          setLoading(false);
          return;
        }
        const fullPhone = getFullPhoneNumber();
        response = await authService.login({
          phone: fullPhone,
          password: formData.password,
        });
      }

      loginWithResponse(response);
      await syncProfileStatus(response);
      Alert.show(i18n.t('auth.loginWelcome'), "", 1000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : loginMethod === "email"
          ? i18n.t('auth.emailPasswordError')
          : i18n.t('auth.phonePasswordError');
      Alert.show(i18n.t('auth.loginFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [
    formData.phone,
    formData.email,
    formData.password,
    loginMethod,
    validatePhone,
    validateEmail,
    loginWithResponse,
    getFullPhoneNumber,
    syncProfileStatus,
  ]);

  // 处理验证码登录
  const handleOtpLogin = useCallback(async () => {
    if (!formData.verificationCode) {
      Alert.show(i18n.t('auth.codeRequired'));
      return;
    }

    setLoading(true);
    try {
      let response;
      if (loginMethod === "email") {
        if (!validateEmail(formData.email)) {
          Alert.show(i18n.t('auth.invalidEmail'));
          setLoading(false);
          return;
        }
        response = await authService.loginEmailOtp({
          email: formData.email.trim(),
          code: formData.verificationCode,
        });
      } else {
        if (!validatePhone(formData.phone)) {
          Alert.show(i18n.t('auth.invalidPhone'));
          setLoading(false);
          return;
        }
        const fullPhone = getFullPhoneNumber();
        response = await authService.loginSms({
          phone: fullPhone,
          code: formData.verificationCode,
        });
      }

      loginWithResponse(response);
      await syncProfileStatus(response);
      Alert.show(i18n.t('auth.loginWelcome'), "", 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : i18n.t('auth.codeExpired');
      Alert.show(i18n.t('auth.loginFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [
    formData.phone,
    formData.email,
    formData.verificationCode,
    loginMethod,
    validatePhone,
    validateEmail,
    loginWithResponse,
    getFullPhoneNumber,
    syncProfileStatus,
  ]);

  // Apple 登录
  const handleAppleLogin = useCallback(async () => {
    if (!isAppleLoginAvailable) {
      Alert.show(i18n.t('auth.appleNotSupported'));
      return;
    }

    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.show(i18n.t('auth.appleNoCredential'));
        return;
      }

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ") || undefined;

      const response = await authService.loginApple({
        identityToken: credential.identityToken,
        fullName,
        email: credential.email || undefined,
      });

      loginWithResponse(response);
      await syncProfileStatus(response);
      Alert.show(i18n.t('auth.loginWelcome'), "", 1000);
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      const message =
        error instanceof Error ? error.message : i18n.t('auth.appleLoginFailed');
      Alert.show(i18n.t('auth.loginFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [isAppleLoginAvailable, loginWithResponse, syncProfileStatus]);

  // 验证注册表单（不包含协议检查）
  const validateRegisterForm = useCallback((): boolean => {
    if (loginMethod === "email") {
      if (!validateEmail(formData.email)) {
        Alert.show(i18n.t('auth.invalidEmail'));
        return false;
      }
    } else {
      if (!validatePhone(formData.phone)) {
        Alert.show(i18n.t('auth.invalidPhone'));
        return false;
      }
    }

    if (!formData.verificationCode) {
      Alert.show(i18n.t('auth.codeRequired'));
      return false;
    }

    if (!formData.username || formData.username.trim().length < 2) {
      Alert.show(i18n.t('auth.usernameMinLength'));
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.show(i18n.t('auth.passwordMinLength'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.show(i18n.t('changePassword.mismatch'));
      return false;
    }

    return true;
  }, [formData, loginMethod, validatePhone, validateEmail]);

  // 显示协议确认弹窗
  const showAgreementConfirmation = useCallback(() => {
    if (validateRegisterForm()) {
      setShowAgreementModal(true);
    }
  }, [validateRegisterForm]);

  // 处理注册（用户确认协议后调用）
  const handleRegister = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (loginMethod === "email") {
        response = await authService.registerEmail({
          email: formData.email.trim(),
          username: formData.username.trim(),
          password: formData.password,
          code: formData.verificationCode,
        });
      } else {
        const fullPhone = getFullPhoneNumber();
        response = await authService.register({
          phone: fullPhone,
          username: formData.username.trim(),
          password: formData.password,
          code: formData.verificationCode,
        });
      }

      setRegisteredUserId(response.userId);
      setRegisteredTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      setShowProfileModal(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : i18n.t('auth.registerDefaultError');
      Alert.show(i18n.t('auth.registerFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [
    formData,
    loginMethod,
    getFullPhoneNumber,
  ]);

  // 处理完善资料（所有字段均为可选，填写完成后直接登录进入主页面）
  const handleCompleteProfile = useCallback(async () => {
    if (!registeredUserId || !registeredTokens) {
      Alert.show(i18n.t('auth.pleaseReRegister'));
      setShowProfileModal(false);
      return;
    }

    const phone = loginMethod === "phone" ? getFullPhoneNumber() : "";
    setLoading(true);
    try {
      const loginResponse = {
        userId: registeredUserId,
        username: formData.username,
        phone,
        is_admin: false,
        userType: "USER",
        accessToken: registeredTokens.accessToken,
        refreshToken: registeredTokens.refreshToken,
      };
      loginWithResponse(loginResponse);

      // 计算年龄值（如果选择了年龄段）
      let ageValue = 0;
      if (formData.age) {
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
      }

      // 构建更新数据（仅包含用户填写的字段）
      const updateData: {
        location?: string;
        gender?: Gender;
        age?: number;
        preference?: string;
        bio?: string;
        followedBrandIds?: number[];
        profileCompleted?: boolean;
      } = {
        // 标记资料已完善（保存到数据库）
        profileCompleted: true,
      };

      if (formData.location) {
        updateData.location = formData.location;
      }
      if (formData.gender) {
        updateData.gender = formData.gender as Gender;
      }
      if (ageValue > 0) {
        updateData.age = ageValue;
      }
      if (formData.preference) {
        updateData.preference = formData.preference;
      }
      if (formData.bio) {
        updateData.bio = formData.bio;
      }
      if (formData.followedBrandIds && formData.followedBrandIds.length > 0) {
        updateData.followedBrandIds = formData.followedBrandIds;
      }

      // 调用更新接口（包含 profileCompleted: true，同时会写入 brand_follows）
      await userInfoService.updateUserProfile(registeredUserId, updateData);

      // 同步更新本地状态
      setProfileCompleted(true);

      // 关闭 Modal 并清理状态
      setShowProfileModal(false);
      setRegisteredUserId(null);
      setRegisteredTokens(null);
      setFormData(INITIAL_FORM_DATA);

      Alert.show(i18n.t('auth.registerWelcome'), "", 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : i18n.t('auth.saveDefaultError');
      Alert.show(i18n.t('auth.saveFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [
    formData,
    loginMethod,
    registeredUserId,
    registeredTokens,
    loginWithResponse,
    getFullPhoneNumber,
  ]);

  // 处理忘记密码
  const handleForgotPassword = useCallback(async () => {
    if (loginMethod === "email") {
      if (!validateEmail(formData.email)) {
        Alert.show(i18n.t('auth.invalidEmail'));
        return;
      }
    } else {
      if (!validatePhone(formData.phone)) {
        Alert.show(i18n.t('auth.invalidPhone'));
        return;
      }
    }

    if (!formData.verificationCode) {
      Alert.show(i18n.t('auth.codeRequired'));
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.show(i18n.t('auth.newPasswordMinLength'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.show(i18n.t('changePassword.mismatch'));
      return;
    }

    setLoading(true);
    try {
      if (loginMethod === "email") {
        await authService.forgetPasswordEmail({
          email: formData.email.trim(),
          password: formData.password,
          code: formData.verificationCode,
        });
      } else {
        const fullPhone = getFullPhoneNumber();
        await authService.forgetPassword({
          phone: fullPhone,
          password: formData.password,
          code: formData.verificationCode,
        });
      }

      Alert.show(i18n.t('auth.passwordResetSuccess'), "", 1000);

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
        error instanceof Error ? error.message : i18n.t('auth.passwordResetDefaultError');
      Alert.show(i18n.t('auth.resetFailedMsg', { message }));
    } finally {
      setLoading(false);
    }
  }, [formData, loginMethod, validatePhone, validateEmail, getFullPhoneNumber]);

  // 处理手机号/邮箱输入完成后的跳转
  const handleAccountInputSubmit = useCallback(() => {
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
      handleOtpLogin();
    }
  }, [mode, handleOtpLogin]);

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
      showAgreementConfirmation();
    } else if (mode === "forgotPassword") {
      handleForgotPassword();
    }
  }, [mode, showAgreementConfirmation, handleForgotPassword]);

  // 处理主要操作
  const handleMainAction = useCallback(() => {
    if (mode !== "forgotPassword" && mode !== "completeProfile" && !agreedToTerms) {
      Alert.show(i18n.t('auth.pleaseAgreeTerms'));
      return;
    }
    switch (mode) {
      case "login":
        return handleLogin();
      case "register":
        return showAgreementConfirmation();
      case "forgotPassword":
        return handleForgotPassword();
      case "verification":
        return handleOtpLogin();
      case "completeProfile":
        return handleCompleteProfile();
    }
  }, [
    mode,
    agreedToTerms,
    handleLogin,
    showAgreementConfirmation,
    handleForgotPassword,
    handleOtpLogin,
    handleCompleteProfile,
  ]);

  return {
    // 状态
    mode,
    setMode,
    loginMethod,
    setLoginMethod,
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
    showProfileModal,
    setShowProfileModal,
    // 用户协议确认 Modal
    showAgreementModal,
    setShowAgreementModal,
    // 登录页协议勾选
    agreedToTerms,
    setAgreedToTerms,
    // 品牌选择相关
    showBrandPicker,
    setShowBrandPicker,
    brandOptions,
    loadingBrands,
    loadingMoreBrands,
    hasMoreBrands,
    brandSearchKeyword,
    handleBrandSearch,
    handleBrandSearchSubmit,
    loadMoreBrands,

    // 引用
    phoneInputRef,
    emailInputRef,
    verificationCodeInputRef,
    usernameInputRef,
    passwordInputRef,
    confirmPasswordInputRef,
    scrollViewRef,

    // Apple 登录
    isAppleLoginAvailable,
    handleAppleLogin,

    // 方法
    handleInputLayout,
    scrollToInput,
    sendVerificationCode,
    handleAccountInputSubmit,
    handleVerificationCodeSubmit,
    handleUsernameSubmit,
    handlePasswordSubmit,
    handleConfirmPasswordSubmit,
    handleMainAction,
    handleCompleteProfile,
    handleRegister,
  };
};
