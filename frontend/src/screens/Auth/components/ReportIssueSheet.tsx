import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Alert } from "../../../utils/Alert";
import {
  authReportService,
  AuthIssueType,
  AuthContactType,
} from "../../../services/authReportService";
import { LoginMethod } from "../types";

interface ReportIssueSheetProps {
  visible: boolean;
  onClose: () => void;
  loginMethod: LoginMethod;
  defaultContact?: string;
}

interface IssueOption {
  value: AuthIssueType;
  label: string;
}

const ISSUE_OPTIONS: IssueOption[] = [
  { value: "OTP_NOT_RECEIVED", label: "收不到验证码" },
  { value: "REGISTER_FAILED", label: "注册失败" },
  { value: "LOGIN_FAILED", label: "登录失败" },
  { value: "OTHER", label: "其他问题" },
];

const MAX_DESCRIPTION = 500;

const validateEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validatePhoneLoose = (value: string) =>
  /^[+\d][\d\s\-]{5,19}$/.test(value.trim());

export const ReportIssueSheet: React.FC<ReportIssueSheetProps> = ({
  visible,
  onClose,
  loginMethod,
  defaultContact,
}) => {
  const [issueType, setIssueType] = useState<AuthIssueType>("OTP_NOT_RECEIVED");
  const [contactValue, setContactValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const contactType: AuthContactType = useMemo(
    () => (loginMethod === "email" ? "EMAIL" : "PHONE"),
    [loginMethod]
  );

  useEffect(() => {
    if (visible) {
      setContactValue(defaultContact?.trim() || "");
      setDescription("");
      setIssueType("OTP_NOT_RECEIVED");
    }
  }, [visible, defaultContact]);

  const handleSubmit = async () => {
    const trimmedContact = contactValue.trim();
    if (!trimmedContact) {
      Alert.show(
        contactType === "EMAIL"
          ? "请填写邮箱，便于我们联系您"
          : "请填写手机号，便于我们联系您"
      );
      return;
    }
    if (contactType === "EMAIL" && !validateEmail(trimmedContact)) {
      Alert.show("请填写正确的邮箱地址");
      return;
    }
    if (contactType === "PHONE" && !validatePhoneLoose(trimmedContact)) {
      Alert.show("请填写正确的手机号");
      return;
    }

    setSubmitting(true);
    try {
      await authReportService.reportAuthIssue({
        issueType,
        contactType,
        contactValue: trimmedContact,
        description,
      });
      Alert.show("提交成功：工作人员会尽快与您联系", "", 1500);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "提交失败，请稍后重试";
      Alert.show(`提交失败：${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={submitting ? undefined : onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrapper}
        >
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>问题反馈</Text>
              <TouchableOpacity
                onPress={onClose}
                disabled={submitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.hint}>
                若您在登录或注册过程中遇到问题——例如收不到验证码、注册失败、登录失败
                ——请点击下方「提交反馈」，工作人员会通过您填写的联系方式尽快与您联系。
              </Text>

              <Text style={styles.sectionLabel}>问题类型</Text>
              <View style={styles.optionGroup}>
                {ISSUE_OPTIONS.map((option) => {
                  const active = option.value === issueType;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                      onPress={() => setIssueType(option.value)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          active && styles.optionChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>
                {contactType === "EMAIL" ? "联系邮箱" : "联系手机号"}
              </Text>
              <TextInput
                style={styles.input}
                value={contactValue}
                onChangeText={setContactValue}
                placeholder={
                  contactType === "EMAIL"
                    ? "请输入可接收回复的邮箱"
                    : "请输入可以联系到您的手机号"
                }
                placeholderTextColor={theme.colors.gray200}
                keyboardType={
                  contactType === "EMAIL" ? "email-address" : "phone-pad"
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />

              <Text style={styles.sectionLabel}>
                问题描述<Text style={styles.sectionLabelOptional}>（选填）</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={(v) =>
                  setDescription(v.slice(0, MAX_DESCRIPTION))
                }
                placeholder="请描述您遇到的具体情况，便于我们更快定位问题"
                placeholderTextColor={theme.colors.gray200}
                multiline
                editable={!submitting}
              />
              <Text style={styles.charCount}>
                {description.length}/{MAX_DESCRIPTION}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>提交反馈</Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    width: "100%",
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
  },
  body: {
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray400,
    backgroundColor: "#F7F7F7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.black,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  sectionLabelOptional: {
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  optionChipText: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.gray300,
  },
  optionChipTextActive: {
    color: theme.colors.white,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.black,
    marginBottom: 20,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingTop: 12,
    marginBottom: 4,
  },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
});

export default ReportIssueSheet;
