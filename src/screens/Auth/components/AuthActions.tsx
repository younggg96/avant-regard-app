import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthMode, LoginMethod } from "../types";
import { styles } from "../styles";

interface AuthActionsProps {
  mode: AuthMode;
  loginMethod: LoginMethod;
  loading: boolean;
  setMode: (mode: AuthMode) => void;
  handleMainAction: () => void;
  isAppleLoginAvailable?: boolean;
  onAppleLogin?: () => void;
}

const getButtonText = (mode: AuthMode, loading: boolean): string => {
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

export const AuthActions: React.FC<AuthActionsProps> = ({
  mode,
  loginMethod,
  loading,
  setMode,
  handleMainAction,
  isAppleLoginAvailable,
  onAppleLogin,
}) => {
  const showAppleLogin =
    Platform.OS === "ios" &&
    isAppleLoginAvailable &&
    (mode === "login" || mode === "verification");

  return (
    <View style={styles.actionsContainer}>
      <TouchableOpacity
        style={[styles.mainButton, loading && styles.mainButtonDisabled]}
        onPress={handleMainAction}
        disabled={loading}
      >
        <Text style={styles.mainButtonText}>{getButtonText(mode, loading)}</Text>
      </TouchableOpacity>

      {/* Apple 登录（仅 iOS，仅登录/验证码登录模式） */}
      {showAppleLogin && (
        <>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            style={[styles.appleButton, loading && styles.appleButtonDisabled]}
            onPress={onAppleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={styles.appleButtonText}>通过 Apple 登录</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 切换模式的链接 */}
      <View style={styles.linksContainer}>
        {mode === "login" && (
          <>
            {loginMethod === "phone" && (
              <TouchableOpacity onPress={() => setMode("verification")}>
                <Text style={styles.linkText}>验证码登录</Text>
              </TouchableOpacity>
            )}
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
