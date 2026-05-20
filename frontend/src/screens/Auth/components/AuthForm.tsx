import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { AuthMode, LoginMethod, FormData, CountryCode } from "../types";
import { useAuthStyles } from "../styles";

// 常用国家区号列表
export const COUNTRY_CODES: (Omit<CountryCode, 'name'> & { code: string })[] = [
  { code: "CN", flag: "🇨🇳", dialCode: "+86" },
  { code: "HK", flag: "🇭🇰", dialCode: "+852" },
  { code: "TW", flag: "🇹🇼", dialCode: "+886" },
  { code: "MO", flag: "🇲🇴", dialCode: "+853" },
  { code: "US", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", flag: "🇬🇧", dialCode: "+44" },
  { code: "JP", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", flag: "🇰🇷", dialCode: "+82" },
  { code: "SG", flag: "🇸🇬", dialCode: "+65" },
  { code: "MY", flag: "🇲🇾", dialCode: "+60" },
  { code: "TH", flag: "🇹🇭", dialCode: "+66" },
  { code: "AU", flag: "🇦🇺", dialCode: "+61" },
  { code: "CA", flag: "🇨🇦", dialCode: "+1" },
  { code: "DE", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", flag: "🇮🇹", dialCode: "+39" },
  { code: "ES", flag: "🇪🇸", dialCode: "+34" },
  { code: "NL", flag: "🇳🇱", dialCode: "+31" },
  { code: "CH", flag: "🇨🇭", dialCode: "+41" },
  { code: "SE", flag: "🇸🇪", dialCode: "+46" },
  { code: "AE", flag: "🇦🇪", dialCode: "+971" },
  { code: "IN", flag: "🇮🇳", dialCode: "+91" },
  { code: "RU", flag: "🇷🇺", dialCode: "+7" },
  { code: "BR", flag: "🇧🇷", dialCode: "+55" },
  { code: "NZ", flag: "🇳🇿", dialCode: "+64" },
];

// 默认国家代码（中国）
export const DEFAULT_COUNTRY_CODE = COUNTRY_CODES[0];

interface AuthFormProps {
  mode: AuthMode;
  loginMethod: LoginMethod;
  setLoginMethod: (method: LoginMethod) => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  loading: boolean;
  countdown: number;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  // 引用
  phoneInputRef: React.RefObject<TextInput>;
  emailInputRef: React.RefObject<TextInput>;
  verificationCodeInputRef: React.RefObject<TextInput>;
  usernameInputRef: React.RefObject<TextInput>;
  passwordInputRef: React.RefObject<TextInput>;
  confirmPasswordInputRef: React.RefObject<TextInput>;
  // 方法
  handleInputLayout: (key: string) => (event: any) => void;
  scrollToInput: (key: string) => void;
  sendVerificationCode: () => void;
  handleAccountInputSubmit: () => void;
  handleVerificationCodeSubmit: () => void;
  handleUsernameSubmit: () => void;
  handlePasswordSubmit: () => void;
  handleConfirmPasswordSubmit: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  mode,
  loginMethod,
  setLoginMethod,
  formData,
  setFormData,
  loading,
  countdown,
  showPassword,
  setShowPassword,
  phoneInputRef,
  emailInputRef,
  verificationCodeInputRef,
  usernameInputRef,
  passwordInputRef,
  confirmPasswordInputRef,
  handleInputLayout,
  scrollToInput,
  sendVerificationCode,
  handleAccountInputSubmit,
  handleVerificationCodeSubmit,
  handleUsernameSubmit,
  handlePasswordSubmit,
  handleConfirmPasswordSubmit,
}) => {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleSelectCountry = (country: CountryCode) => {
    setFormData({ ...formData, countryCode: country });
    setShowCountryPicker(false);
  };

  const renderCountryItem = ({ item }: { item: (typeof COUNTRY_CODES)[number] }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        formData.countryCode?.code === item.code && styles.countryItemSelected,
      ]}
      onPress={() => handleSelectCountry({ ...item, name: t(`countries.${item.code}`) })}
    >
      <Text style={styles.countryName}>{t(`countries.${item.code}`)}</Text>
      <Text style={styles.countryDialCode}>{item.dialCode}</Text>
      {formData.countryCode?.code === item.code && (
        <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.formContainer}>
      {/* 国家区号选择弹窗 */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          style={styles.countryModalOverlay}
          onPress={() => setShowCountryPicker(false)}
        >
          <Pressable
            style={styles.countryModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.countryModalHeader}>
              <Text style={styles.countryModalTitle}>{t("auth.selectCountry")}</Text>
              <TouchableOpacity
                onPress={() => setShowCountryPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              style={styles.countryList}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* 手机 / 邮箱切换 Tab */}
      <View style={styles.methodTabContainer}>
        <TouchableOpacity
          style={[
            styles.methodTab,
            loginMethod === "phone" && styles.methodTabActive,
          ]}
          onPress={() => setLoginMethod("phone")}
        >
          <Text
            style={[
              styles.methodTabText,
              loginMethod === "phone" && styles.methodTabTextActive,
            ]}
          >
            {t("auth.phone")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.methodTab,
            loginMethod === "email" && styles.methodTabActive,
          ]}
          onPress={() => setLoginMethod("email")}
        >
          <Text
            style={[
              styles.methodTabText,
              loginMethod === "email" && styles.methodTabTextActive,
            ]}
          >
            {t("auth.email")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 手机号输入 */}
      {loginMethod === "phone" && (
        <View style={styles.inputContainer} onLayout={handleInputLayout("phone")}>
          <Text style={styles.inputLabel}>{t("auth.phone")}</Text>
          <View style={styles.inputWrapper}>
            <TouchableOpacity
              style={styles.countryCodeButton}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.countryCode}>
                {formData.countryCode?.dialCode || "+86"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              placeholder={t("auth.phonePlaceholder")}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              maxLength={15}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={handleAccountInputSubmit}
              onFocus={() => scrollToInput("phone")}
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
          </View>
        </View>
      )}

      {/* 邮箱输入 */}
      {loginMethod === "email" && (
        <View style={styles.inputContainer} onLayout={handleInputLayout("email")}>
          <Text style={styles.inputLabel}>{t("auth.email")}</Text>
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder={t("auth.emailPlaceholder")}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={handleAccountInputSubmit}
            onFocus={() => scrollToInput("email")}
            autoComplete="email"
            textContentType="emailAddress"
          />
        </View>
      )}

      {/* 验证码输入（注册和忘记密码时显示） */}
      {(mode === "register" ||
        mode === "forgotPassword" ||
        mode === "verification") && (
        <View
          style={styles.inputContainer}
          onLayout={handleInputLayout("verificationCode")}
        >
          <Text style={styles.inputLabel}>{t("auth.verificationCode")}</Text>
          <View style={styles.verificationContainer}>
            <TextInput
              ref={verificationCodeInputRef}
              style={[styles.input, styles.verificationInput]}
              placeholder={t("auth.codePlaceholder")}
              value={formData.verificationCode}
              onChangeText={(text) =>
                setFormData({ ...formData, verificationCode: text })
              }
              keyboardType="number-pad"
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
                {countdown > 0 ? `${countdown}s` : t("auth.sendCode")}
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
          <Text style={styles.inputLabel}>{t("auth.username")}</Text>
          <TextInput
            ref={usernameInputRef}
            style={styles.input}
            placeholder={t("auth.usernamePlaceholder")}
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
            {mode === "forgotPassword" ? t("changePassword.newPassword") : t("auth.password")}
          </Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordInputRef}
              style={styles.passwordInput}
              placeholder={
                mode === "forgotPassword" ? t("auth.newPasswordPlaceholder") : t("auth.passwordPlaceholder")
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
              autoComplete="off"
              textContentType="oneTimeCode"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
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
          <Text style={styles.inputLabel}>{t("auth.confirmPassword")}</Text>
          <TextInput
            ref={confirmPasswordInputRef}
            style={styles.input}
            placeholder={t("auth.confirmPasswordPlaceholder")}
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
            autoComplete="off"
            textContentType="oneTimeCode"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>
      )}

    </View>
  );
};
