import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { AuthMode } from "../types";
import { styles } from "../styles";

const TITLE_KEYS: Record<AuthMode, string> = {
  login: "auth.login",
  register: "auth.register",
  forgotPassword: "auth.forgotPasswordTitle",
  verification: "auth.verificationLogin",
  completeProfile: "auth.completeProfile",
};

const SUBTITLE_KEYS: Record<AuthMode, string> = {
  login: "auth.loginTitle",
  register: "auth.registerSubtitle",
  forgotPassword: "auth.forgotPasswordSubtitle",
  verification: "auth.verificationSubtitle",
  completeProfile: "auth.completeProfileSubtitle",
};

interface AuthTitleProps {
  mode: AuthMode;
}

export const AuthTitle: React.FC<AuthTitleProps> = ({ mode }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{t(TITLE_KEYS[mode])}</Text>
      <Text style={styles.subtitle}>{t(SUBTITLE_KEYS[mode])}</Text>
    </View>
  );
};
