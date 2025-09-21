import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../theme";

const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <ImageBackground
      source={{
        uri: "https://via.placeholder.com/400x800/000000/FFFFFF?text=AVANT+REGARD",
      }}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>AVANT REGARD</Text>
              <Text style={styles.subtitle}>Fashion Archive</Text>
              <Text style={styles.description}>
                Discover the world's most influential designers and their iconic
                runway collections
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => (navigation as any).navigate("Register")}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => (navigation as any).navigate("Login")}
              >
                <Text style={styles.secondaryButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.7,
  },
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  header: {
    alignItems: "center",
    marginTop: theme.spacing.xxl * 2,
  },
  title: {
    ...theme.typography.hero,
    color: theme.colors.white,
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.h3,
    color: theme.colors.accent,
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: theme.spacing.xl,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.white,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.9,
    paddingHorizontal: theme.spacing.md,
  },
  buttonContainer: {
    gap: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.black,
    letterSpacing: 1,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    letterSpacing: 1,
  },
});

export default WelcomeScreen;
