import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";

const PhoneManagementScreen = () => {
  const navigation = useNavigation();
  const { user, updateProfile } = useAuthStore();

  const [step, setStep] = useState<"main" | "change" | "verify">("main");
  const [newPhone, setNewPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  const currentPhone = user?.phone || "";
  const maskedPhone = currentPhone
    ? currentPhone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
    : "";

  const startCountdown = () => {
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
  };

  const handleSendCode = async () => {
    if (!newPhone.trim()) {
      Alert.show("提示: 请输入手机号");
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      Alert.show("提示: 请输入正确的手机号格式");
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      startCountdown();
      setStep("verify");
      Alert.show("验证码已发送到 " + newPhone);
    } catch (error) {
      Alert.show("发送失败: 验证码发送失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.show("提示: 请输入验证码");
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.show("提示: 请输入6位验证码");
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update phone number
      updateProfile({ phone: newPhone });

      Alert.show("更换成功: 手机号已更换成功", "", 1000);
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      Alert.show("验证失败: 验证码错误或已过期");
    } finally {
      setLoading(false);
    }
  };

  const handleUnbindPhone = () => {
    try {
      updateProfile({ phone: "" });
      Alert.show("解绑成功: 手机号已解绑");
    } catch (error) {
      Alert.show("解绑失败: 请重试");
    }
  };

  const renderMainScreen = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前手机号</Text>
        <View style={styles.phoneCard}>
          <View style={styles.phoneInfo}>
            <Ionicons name="call" size={20} color={theme.colors.gray600} />
            <Text style={styles.phoneNumber}>
              {currentPhone ? maskedPhone : "未绑定手机号"}
            </Text>
          </View>
          {currentPhone && (
            <View style={styles.phoneBadge}>
              <Text style={styles.phoneBadgeText}>已验证</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>手机号管理</Text>
        <View style={styles.actionList}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setStep("change")}
          >
            <View style={styles.actionLeft}>
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={theme.colors.gray600}
              />
              <Text style={styles.actionLabel}>
                {currentPhone ? "更换手机号" : "绑定手机号"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>

          {currentPhone && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleUnbindPhone}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="unlink-outline" size={20} color="#ff4757" />
                <Text style={[styles.actionLabel, { color: "#ff4757" }]}>
                  解绑手机号
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.notice}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={theme.colors.gray500}
        />
        <Text style={styles.noticeText}>
          手机号用于账户安全验证和密码找回，建议保持绑定状态
        </Text>
      </View>
    </ScrollView>
  );

  const renderChangeScreen = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {currentPhone ? "更换手机号" : "绑定手机号"}
        </Text>
        <Text style={styles.sectionSubtitle}>
          请输入新的手机号码，我们将发送验证码进行验证
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>新手机号</Text>
          <TextInput
            style={styles.input}
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="请输入手机号"
            placeholderTextColor={theme.colors.gray400}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleSendCode}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "发送中..." : "发送验证码"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderVerifyScreen = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>输入验证码</Text>
        <Text style={styles.sectionSubtitle}>
          验证码已发送至 {newPhone}，请查收短信
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>验证码</Text>
          <TextInput
            style={styles.input}
            value={verificationCode}
            onChangeText={setVerificationCode}
            placeholder="请输入6位验证码"
            placeholderTextColor={theme.colors.gray400}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleVerifyCode}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "验证中..." : "确认验证"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleSendCode}
          disabled={countdown > 0}
        >
          <Text style={styles.secondaryButtonText}>
            {countdown > 0 ? `重新发送(${countdown}s)` : "重新发送验证码"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const getTitle = () => {
    switch (step) {
      case "change":
        return currentPhone ? "更换手机号" : "绑定手机号";
      case "verify":
        return "验证手机号";
      default:
        return "手机号管理";
    }
  };

  const handleBack = () => {
    if (step === "main") {
      navigation.goBack();
    } else {
      setStep("main");
      setNewPhone("");
      setVerificationCode("");
      setCountdown(0);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={getTitle()}
        showBack={true}
        onBackPress={handleBack}
      />

      {step === "main" && renderMainScreen()}
      {step === "change" && renderChangeScreen()}
      {step === "verify" && renderVerifyScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginBottom: 24,
    lineHeight: 20,
  },
  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  phoneInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  phoneNumber: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    marginLeft: 12,
  },
  phoneBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  phoneBadgeText: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  actionList: {
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    marginLeft: 12,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    backgroundColor: theme.colors.gray50,
    margin: 20,
    borderRadius: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    marginLeft: 8,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.black,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
});

export default PhoneManagementScreen;
