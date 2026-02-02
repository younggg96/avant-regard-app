import React from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthForm } from "./hooks/useAuthForm";
import {
  BrandLogo,
  AuthTitle,
  AuthForm,
  AuthActions,
  AgreementModal,
  ProfileModal,
} from "./components";
import { styles } from "./styles";

const AuthScreen = () => {
  const {
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
  } = useAuthForm();

  // 用户确认协议并注册
  const handleConfirmAgreement = () => {
    setShowAgreementModal(false);
    handleRegister();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          <BrandLogo />
          <AuthTitle mode={mode} />

          <AuthForm
            mode={mode}
            formData={formData}
            setFormData={setFormData}
            loading={loading}
            countdown={countdown}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            phoneInputRef={phoneInputRef}
            verificationCodeInputRef={verificationCodeInputRef}
            usernameInputRef={usernameInputRef}
            passwordInputRef={passwordInputRef}
            confirmPasswordInputRef={confirmPasswordInputRef}
            handleInputLayout={handleInputLayout}
            scrollToInput={scrollToInput}
            sendVerificationCode={sendVerificationCode}
            handlePhoneSubmit={handlePhoneSubmit}
            handleVerificationCodeSubmit={handleVerificationCodeSubmit}
            handleUsernameSubmit={handleUsernameSubmit}
            handlePasswordSubmit={handlePasswordSubmit}
            handleConfirmPasswordSubmit={handleConfirmPasswordSubmit}
          />

          <AuthActions
            mode={mode}
            loading={loading}
            setMode={setMode}
            handleMainAction={handleMainAction}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 用户协议和隐私政策确认 Modal */}
      <AgreementModal
        visible={showAgreementModal}
        loading={loading}
        onClose={() => setShowAgreementModal(false)}
        onConfirm={handleConfirmAgreement}
      />

      {/* 注册成功后填写资料的 Modal */}
      <ProfileModal
        visible={showProfileModal}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        showLocationPicker={showLocationPicker}
        setShowLocationPicker={setShowLocationPicker}
        showAgePicker={showAgePicker}
        setShowAgePicker={setShowAgePicker}
        showBrandPicker={showBrandPicker}
        setShowBrandPicker={setShowBrandPicker}
        brandOptions={brandOptions}
        loadingBrands={loadingBrands}
        loadingMoreBrands={loadingMoreBrands}
        hasMoreBrands={hasMoreBrands}
        brandSearchKeyword={brandSearchKeyword}
        onBrandSearch={handleBrandSearch}
        onLoadMoreBrands={loadMoreBrands}
        onComplete={handleCompleteProfile}
      />
    </SafeAreaView>
  );
};

export default AuthScreen;
