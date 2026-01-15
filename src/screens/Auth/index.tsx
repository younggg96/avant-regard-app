import React from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthForm } from "./hooks/useAuthForm";
import {
  BrandLogo,
  AuthTitle,
  AuthForm,
  ProfileForm,
  AuthActions,
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
    handleSkipProfile,
  } = useAuthForm();

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
          
          {mode === "completeProfile" ? (
            <ProfileForm
              formData={formData}
              setFormData={setFormData}
              showLocationPicker={showLocationPicker}
              setShowLocationPicker={setShowLocationPicker}
              showAgePicker={showAgePicker}
              setShowAgePicker={setShowAgePicker}
            />
          ) : (
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
          )}
          
          <AuthActions
            mode={mode}
            loading={loading}
            setMode={setMode}
            handleMainAction={handleMainAction}
            handleSkipProfile={handleSkipProfile}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;
