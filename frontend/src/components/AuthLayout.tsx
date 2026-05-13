import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  children: React.ReactNode;
  centerContent?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  showBackButton = true,
  children,
  centerContent = true,
}) => {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.black}
              />
            </TouchableOpacity>
          )}

          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        <View style={[styles.content, centerContent && styles.contentCentered]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.lg,
      position: "relative",
      minHeight: 100,
      justifyContent: "center",
    },
    backButton: {
      position: "absolute",
      left: t.spacing.md,
      top: t.spacing.lg,
      padding: t.spacing.sm,
      zIndex: 1,
    },
    titleContainer: {
      alignItems: "center",
      paddingHorizontal: t.spacing.xl,
    },
    title: {
      ...t.typography.h1,
      color: t.colors.text,
      marginBottom: t.spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 20,
    },
    content: {
      flex: 1,
      paddingHorizontal: t.spacing.md,
    },
    contentCentered: {
      justifyContent: "center",
      paddingBottom: t.spacing.xxl,
    },
  });

export default AuthLayout;
