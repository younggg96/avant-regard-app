import { StyleSheet } from "react-native";
import { theme } from "../../theme";
import { SCREEN_WIDTH } from "./constants";

export const styles = StyleSheet.create({
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
  // 跳过按钮样式
  skipContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
    textDecorationLine: "underline",
  },
  // 选择器样式
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pickerText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
  },
  pickerPlaceholder: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
  },
  pickerOptionsContainer: {
    marginTop: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerOptions: {
    maxHeight: 200,
  },
  pickerOptionsSmall: {
    maxHeight: 150,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.black,
  },
  pickerOptionText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
  },
  pickerOptionTextSelected: {
    color: theme.colors.white,
    fontFamily: "Inter-Medium",
  },
  // 性别选择样式
  genderContainer: {
    flexDirection: "row",
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  genderOptionSelected: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  genderOptionText: {
    fontSize: 15,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
  },
  genderOptionTextSelected: {
    color: theme.colors.white,
  },
  // 偏好输入样式
  preferenceInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  // 设计师选择样式
  inputHint: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    marginBottom: 12,
    marginTop: -4,
  },
  designerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  designerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    maxWidth: (SCREEN_WIDTH - 48 - 20) / 2 - 5,
  },
  designerChipSelected: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  designerChipText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: theme.colors.black,
    flex: 1,
  },
  designerChipTextSelected: {
    color: theme.colors.white,
  },
  designerCheckIcon: {
    marginLeft: 4,
  },
});
