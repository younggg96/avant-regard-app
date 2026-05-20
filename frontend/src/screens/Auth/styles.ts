import { StyleSheet, Dimensions } from "react-native";
import { useThemedStyles, type AppTheme, lightTheme } from "../../theme";

const makeAuthStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
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
      width: 280,
      height: 140,
    },
    brandName: {
      fontSize: 22,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      letterSpacing: 3,
      marginBottom: 4,
    },
    brandTagline: {
      fontSize: 11,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
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
      color: t.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      letterSpacing: 0.5,
    },
    // 表单样式
    formContainer: {
      marginBottom: 24,
    },
    methodTabContainer: {
      flexDirection: "row",
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      padding: 3,
      marginBottom: 24,
    },
    methodTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
    },
    methodTabActive: {
      backgroundColor: t.colors.card,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    methodTabText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray200,
    },
    methodTabTextActive: {
      color: t.colors.text,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    countryCodeButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingRight: 12,
      marginRight: 12,
      borderRightWidth: 1,
      borderRightColor: t.colors.divider,
      gap: 6,
    },
    countryCodeFlag: {
      fontSize: 18,
    },
    countryCode: {
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    phoneInput: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      flex: 1,
      paddingVertical: 16,
      color: t.colors.text,
    },
    input: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      flex: 1,
      paddingVertical: 16,
      color: t.colors.text,
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    // 国家区号选择器样式
    countryModalOverlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    countryModalContent: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "70%",
      paddingBottom: 34,
    },
    countryModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    countryModalTitle: {
      fontSize: 17,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    countryList: {
      paddingHorizontal: 8,
    },
    countryItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginHorizontal: 4,
      marginVertical: 2,
    },
    countryItemSelected: {
      backgroundColor: t.colors.gray100,
    },
    countryFlag: {
      fontSize: 22,
      marginRight: 12,
    },
    countryName: {
      flex: 1,
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    countryDialCode: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
      marginRight: 8,
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
      backgroundColor: t.colors.text,
      borderRadius: 12,
    },
    sendCodeButtonDisabled: {
      backgroundColor: t.colors.gray100,
    },
    sendCodeText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
      letterSpacing: 0.3,
    },
    sendCodeTextDisabled: {
      color: t.colors.gray400,
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      paddingRight: 16,
    },
    passwordInput: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      flex: 1,
      paddingVertical: 16,
      paddingLeft: 16,
      color: t.colors.text,
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
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      flex: 1,
      lineHeight: 18,
    },
    agreementLink: {
      color: t.colors.text,
      fontFamily: "PlayfairDisplay-Medium",
    },
    // 按钮和操作样式
    actionsContainer: {
      marginBottom: 24,
    },
    mainButton: {
      backgroundColor: t.colors.text,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
      marginBottom: 20,
    },
    mainButtonDisabled: {
      backgroundColor: t.colors.gray100,
    },
    mainButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
      letterSpacing: 0.5,
    },
    mainButtonTextDisabled: {
      // light mode 下按钮背景为 gray100, textInverted 是白色会看不见
      // 这里强制使用 gray300, 在 light/dark 下都有足够对比度
      color: t.colors.gray300,
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.divider,
    },
    dividerText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray200,
      marginHorizontal: 16,
    },
    appleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      // Apple's brand requires the button to be black on light backgrounds
      // and white on dark — flip with the resolved theme.
      backgroundColor: t.mode === "dark" ? "#FFFFFF" : "#000000",
      borderRadius: 16,
      paddingVertical: 16,
      marginBottom: 20,
      gap: 8,
    },
    appleButtonDisabled: {
      opacity: 0.5,
    },
    appleButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.mode === "dark" ? "#000000" : "#FFFFFF",
      letterSpacing: 0.3,
    },
    linksContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    linkText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
      letterSpacing: 0.2,
    },
    switchContainer: {
      alignItems: "center",
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: t.colors.divider,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    switchText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      marginRight: 6,
    },
    switchLink: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    // 跳过按钮样式
    skipContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    skipText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
      textDecorationLine: "underline",
    },
    // 选择器样式
    pickerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    pickerText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    pickerPlaceholder: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
    },
    pickerOptionsContainer: {
      marginTop: 8,
      backgroundColor: t.colors.gray100,
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
      borderBottomColor: t.colors.divider,
    },
    pickerOptionSelected: {
      backgroundColor: t.colors.text,
    },
    pickerOptionText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
    },
    pickerOptionTextSelected: {
      color: t.colors.textInverted,
      fontFamily: "PlayfairDisplay-Medium",
    },
    // 性别选择样式
    genderContainer: {
      flexDirection: "row",
      gap: 12,
    },
    genderOption: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: t.colors.gray100,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    genderOptionSelected: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    genderOptionText: {
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray400,
    },
    genderOptionTextSelected: {
      color: t.colors.textInverted,
    },
    // 偏好输入样式
    preferenceInput: {
      minHeight: 80,
      textAlignVertical: "top",
      paddingTop: 12,
    },
    // 个人简介输入样式
    bioInput: {
      minHeight: 100,
      textAlignVertical: "top",
      paddingTop: 12,
    },
    // 字符计数样式
    charCount: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      textAlign: "right",
      marginTop: 4,
    },
    // 资料填写提示样式
    profileHintContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray100,
      borderRadius: 10,
      padding: 12,
      marginBottom: 24,
      gap: 8,
    },
    profileHintText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      flex: 1,
      lineHeight: 18,
    },
    // Modal 样式
    profileModalContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },
    profileModalHeader: {
      alignItems: "center",
      marginBottom: 32,
    },
    profileModalTitle: {
      fontSize: 28,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginBottom: 8,
    },
    profileModalSubtitle: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      letterSpacing: 0.5,
    },
    // 品牌选择相关样式
    brandSelectedCount: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      marginTop: 6,
    },
    brandModalContainer: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    brandModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    brandModalTitle: {
      fontSize: 17,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    brandModalCloseButton: {
      padding: 4,
    },
    brandSearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.gray100,
      borderRadius: 10,
      gap: 8,
    },
    brandSearchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.text,
      paddingVertical: 0,
    },
    brandLoadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingGif: {
      width: Dimensions.get("window").width * 0.5,
      height: Dimensions.get("window").width * 0.5,
    },
    brandLoadingText: {
      marginTop: 8,
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
    },
    brandItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    brandItemSelected: {
      backgroundColor: t.colors.gray50,
    },
    brandInfo: {
      flex: 1,
    },
    brandNameSelected: {
      fontFamily: "PlayfairDisplay-Medium",
    },
    brandCategory: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      marginTop: 2,
    },
    brandCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.colors.gray300,
      justifyContent: "center",
      alignItems: "center",
    },
    brandCheckboxSelected: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    brandEmptyList: {
      padding: 40,
      alignItems: "center",
    },
    brandEmptyText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
    },
    brandLoadMoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      gap: 8,
    },
    brandLoadMoreText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
    },
    brandLoadMoreHint: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray400,
    },
    brandConfirmButton: {
      margin: 20,
      backgroundColor: t.colors.text,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    brandConfirmButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
    },
  });

export const useAuthStyles = () => useThemedStyles(makeAuthStyles);

/**
 * Legacy static export — frozen to the light theme. Migrate consumers to
 * `useAuthStyles()` to pick up dark mode.
 */
export const styles = makeAuthStyles(lightTheme);
