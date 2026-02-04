import { useState, useRef, useEffect, useCallback } from "react";
import { TextInput, ScrollView, LayoutChangeEvent } from "react-native";
import { Alert } from "../../../utils/Alert";
import { authService, LoginResponse } from "../../../services/authService";
import { userInfoService, Gender, UserProfileInfo } from "../../../services/userInfoService";
import { brandService } from "../../../services/brandService";
import { useAuthStore } from "../../../store/authStore";
import { AuthMode, FormData, RegisteredTokens, BrandOption } from "../types";
import { INITIAL_FORM_DATA } from "../constants";

export const useAuthForm = () => {
  const [mode, setMode] = useState<AuthMode>("login");
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

  // 品牌选择相关状态
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingMoreBrands, setLoadingMoreBrands] = useState(false);
  const [brandPage, setBrandPage] = useState(1);
  const [hasMoreBrands, setHasMoreBrands] = useState(true);
  const [brandSearchKeyword, setBrandSearchKeyword] = useState("");
  const brandPageSize = 50;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 输入框引用
  const phoneInputRef = useRef<TextInput>(null);
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

  // 搜索品牌（防抖处理）
  const handleBrandSearch = useCallback(
    (keyword: string) => {
      setBrandSearchKeyword(keyword);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        setBrandPage(1);
        setHasMoreBrands(true);
        loadBrands(1, keyword, true);
      }, 300);
    },
    [loadBrands]
  );

  // 当显示品牌选择器时加载品牌
  useEffect(() => {
    if (showBrandPicker && brandOptions.length === 0) {
      loadBrands(1, "", true);
    }
  }, [showBrandPicker, brandOptions.length, loadBrands]);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const sendVerificationCode = useCallback(async () => {
    // 防止倒计时期间重复发送
    if (countdown > 0) {
      Alert.show(`请等待 ${countdown} 秒后再试`);
      return;
    }

    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      await authService.sendSms({ phone: fullPhone });

      // 发送成功后启动 60 秒倒计时
      setCountdown(60);
      Alert.show("验证码已发送至 " + fullPhone);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "验证码发送失败，请稍后重试";
      Alert.show("发送失败: " + message);
    } finally {
      setLoading(false);
    }
  }, [formData.phone, validatePhone, getFullPhoneNumber, countdown]);

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
      
      // 登录成功后同步用户资料状态
      await syncProfileStatus(response);
      
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
    syncProfileStatus,
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
      
      // 登录成功后同步用户资料状态
      await syncProfileStatus(response);
      
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
    syncProfileStatus,
  ]);

  // 验证注册表单（不包含协议检查）
  const validateRegisterForm = useCallback((): boolean => {
    if (!validatePhone(formData.phone)) {
      Alert.show("提示: 请输入正确的手机号码");
      return false;
    }

    if (!formData.verificationCode) {
      Alert.show("提示: 请输入验证码");
      return false;
    }

    if (!formData.username || formData.username.trim().length < 2) {
      Alert.show("提示: 用户名长度至少2个字符");
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.show("提示: 密码长度至少6位");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.show("提示: 两次输入的密码不一致");
      return false;
    }

    return true;
  }, [formData, validatePhone]);

  // 显示协议确认弹窗
  const showAgreementConfirmation = useCallback(() => {
    if (validateRegisterForm()) {
      setShowAgreementModal(true);
    }
  }, [validateRegisterForm]);

  // 处理注册（用户确认协议后调用）
  const handleRegister = useCallback(async () => {
    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      const response = await authService.register({
        phone: fullPhone,
        username: formData.username.trim(),
        password: formData.password,
        code: formData.verificationCode,
      });

      // 保存注册信息，用于后续填写资料和登录
      setRegisteredUserId(response.userId);
      setRegisteredTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      // 显示资料填写 Modal
      setShowProfileModal(true);
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
    getFullPhoneNumber,
  ]);

  // 处理完善资料（所有字段均为可选，填写完成后直接登录进入主页面）
  const handleCompleteProfile = useCallback(async () => {
    if (!registeredUserId || !registeredTokens) {
      Alert.show("错误: 请重新注册");
      setShowProfileModal(false);
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    try {
      // 先登录以获取认证 token（这样后续的 API 调用才能通过认证）
      const loginResponse = {
        userId: registeredUserId,
        username: formData.username,
        phone: fullPhone,
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
        favoriteBrandIds?: number[];
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
      if (formData.favoriteBrandIds && formData.favoriteBrandIds.length > 0) {
        updateData.favoriteBrandIds = formData.favoriteBrandIds;
      }

      // 调用更新接口（包含 profileCompleted: true）
      await userInfoService.updateUserProfile(registeredUserId, updateData);
      
      // 同步更新本地状态
      setProfileCompleted(true);

      // 关闭 Modal 并清理状态
      setShowProfileModal(false);
      setRegisteredUserId(null);
      setRegisteredTokens(null);
      setFormData(INITIAL_FORM_DATA);

      Alert.show("注册成功: 欢迎加入！", "", 1000);
    } catch (error) {
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
        // 注册时先显示协议确认弹窗
        return showAgreementConfirmation();
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
    showAgreementConfirmation,
    handleForgotPassword,
    handleSmsLogin,
    handleCompleteProfile,
  ]);

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
    showProfileModal,
    setShowProfileModal,
    // 用户协议确认 Modal
    showAgreementModal,
    setShowAgreementModal,
    // 品牌选择相关
    showBrandPicker,
    setShowBrandPicker,
    brandOptions,
    loadingBrands,
    loadingMoreBrands,
    hasMoreBrands,
    brandSearchKeyword,
    handleBrandSearch,
    loadMoreBrands,

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
    handleCompleteProfile,
    handleRegister,
  };
};
