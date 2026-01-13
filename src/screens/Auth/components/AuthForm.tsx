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
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { AuthMode, FormData, CountryCode } from "../types";
import { styles } from "../styles";

// 常用国家区号列表
export const COUNTRY_CODES: CountryCode[] = [
  { code: "CN", name: "中国", flag: "🇨🇳", dialCode: "+86" },
  { code: "HK", name: "香港", flag: "🇭🇰", dialCode: "+852" },
  { code: "TW", name: "台湾", flag: "🇹🇼", dialCode: "+886" },
  { code: "MO", name: "澳门", flag: "🇲🇴", dialCode: "+853" },
  { code: "US", name: "美国", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", name: "英国", flag: "🇬🇧", dialCode: "+44" },
  { code: "JP", name: "日本", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", name: "韩国", flag: "🇰🇷", dialCode: "+82" },
  { code: "SG", name: "新加坡", flag: "🇸🇬", dialCode: "+65" },
  { code: "MY", name: "马来西亚", flag: "🇲🇾", dialCode: "+60" },
  { code: "TH", name: "泰国", flag: "🇹🇭", dialCode: "+66" },
  { code: "AU", name: "澳大利亚", flag: "🇦🇺", dialCode: "+61" },
  { code: "CA", name: "加拿大", flag: "🇨🇦", dialCode: "+1" },
  { code: "DE", name: "德国", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "法国", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", name: "意大利", flag: "🇮🇹", dialCode: "+39" },
  { code: "ES", name: "西班牙", flag: "🇪🇸", dialCode: "+34" },
  { code: "NL", name: "荷兰", flag: "🇳🇱", dialCode: "+31" },
  { code: "CH", name: "瑞士", flag: "🇨🇭", dialCode: "+41" },
  { code: "SE", name: "瑞典", flag: "🇸🇪", dialCode: "+46" },
  { code: "AE", name: "阿联酋", flag: "🇦🇪", dialCode: "+971" },
  { code: "IN", name: "印度", flag: "🇮🇳", dialCode: "+91" },
  { code: "RU", name: "俄罗斯", flag: "🇷🇺", dialCode: "+7" },
  { code: "BR", name: "巴西", flag: "🇧🇷", dialCode: "+55" },
  { code: "NZ", name: "新西兰", flag: "🇳🇿", dialCode: "+64" },
];

// 默认国家代码（中国）
export const DEFAULT_COUNTRY_CODE = COUNTRY_CODES[0];

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
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleSelectCountry = (country: CountryCode) => {
    setFormData({ ...formData, countryCode: country });
    setShowCountryPicker(false);
  };

  const renderCountryItem = ({ item }: { item: CountryCode }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        formData.countryCode?.code === item.code && styles.countryItemSelected,
      ]}
      onPress={() => handleSelectCountry(item)}
    >
      <Text style={styles.countryName}>{item.name}</Text>
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
              <Text style={styles.countryModalTitle}>选择国家/地区</Text>
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

      {/* 手机号输入 */}
      <View style={styles.inputContainer} onLayout={handleInputLayout("phone")}>
        <Text style={styles.inputLabel}>手机号</Text>
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            style={styles.countryCodeButton}
            onPress={() => setShowCountryPicker(true)}
          >
            <Text style={styles.countryCodeFlag}>
              {formData.countryCode?.flag || "🇨🇳"}
            </Text>
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
            placeholder="请输入手机号"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
            maxLength={15}
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
              autoComplete="off"
              textContentType="none"
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
            autoComplete="off"
            textContentType="none"
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
                formData.agreement ? theme.colors.accent : theme.colors.gray400
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
