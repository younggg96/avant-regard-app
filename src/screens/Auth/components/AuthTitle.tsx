import React from "react";
import { View, Text } from "react-native";
import { AuthMode } from "../types";
import { AUTH_TITLES, AUTH_SUBTITLES } from "../constants";
import { styles } from "../styles";

interface AuthTitleProps {
  mode: AuthMode;
}

export const AuthTitle: React.FC<AuthTitleProps> = ({ mode }) => {
  return (
    <View style={styles.titleContainer}>
      <Text style={styles.title}>{AUTH_TITLES[mode]}</Text>
      <Text style={styles.subtitle}>{AUTH_SUBTITLES[mode]}</Text>
    </View>
  );
};
