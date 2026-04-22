import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { CrashInfo } from "./crashStorage";

type CrashScreenProps = {
  info: CrashInfo;
  onDismiss?: () => void;
};

export function CrashScreen({ info, onDismiss }: CrashScreenProps): JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>App startup error</Text>
      <Text style={styles.subtitle}>
        {info.origin} · {new Date(info.at).toLocaleString()}
      </Text>

      <Text selectable style={styles.errorLine}>
        {info.name}: {info.message}
      </Text>

      <ScrollView
        style={styles.stackContainer}
        contentContainerStyle={styles.stackContent}
      >
        <Text selectable style={styles.stackText}>
          {info.stack || "(no stack)"}
        </Text>
      </ScrollView>

      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.dismissButtonPressed,
          ]}
        >
          <Text style={styles.dismissText}>Dismiss & try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#8a8a8a",
    fontSize: 12,
    marginBottom: 16,
  },
  errorLine: {
    color: "#ff6b6b",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  stackContainer: {
    flex: 1,
    backgroundColor: "#161616",
    borderRadius: 8,
    padding: 12,
  },
  stackContent: {
    paddingBottom: 12,
  },
  stackText: {
    color: "#bdbdbd",
    fontSize: 10,
    lineHeight: 14,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  dismissButton: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  dismissButtonPressed: {
    opacity: 0.7,
  },
  dismissText: {
    color: "#0b0b0b",
    fontSize: 16,
    fontWeight: "600",
  },
});
