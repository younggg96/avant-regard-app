import React from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
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
import { theme } from "../../theme";

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

      {/* 注册成功后填写资料的 Modal */}
      <Modal
        visible={showProfileModal}
        animationType="fade"
        presentationStyle="pageSheet"
        onRequestClose={() => { }}
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.profileModalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Modal 标题 */}
              <View style={styles.profileModalHeader}>
                <Text style={styles.profileModalTitle}>完善个人资料</Text>
                <Text style={styles.profileModalSubtitle}>
                  让我们更好地了解您
                </Text>
              </View>

              <ProfileForm
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
              />

              {/* 完成按钮 */}
              <TouchableOpacity
                style={[styles.mainButton, loading && styles.mainButtonDisabled]}
                onPress={handleCompleteProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.mainButtonText}>完成并进入</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default AuthScreen;
