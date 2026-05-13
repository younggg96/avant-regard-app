import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  useMaintenanceStore,
} from "../store/maintenanceStore";
import { useThemedStyles, type AppTheme } from "../theme";

export default function MaintenanceOverlay() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const isDown = useMaintenanceStore((s) => s.isDown);
  const message = useMaintenanceStore((s) => s.message);

  if (!isDown) return null;

  const displayMessage = message?.trim()
    ? message
    : DEFAULT_MAINTENANCE_MESSAGE;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔧</Text>
        <Text style={styles.title}>{t("maintenance.title")}</Text>
        <Text style={styles.message}>{displayMessage}</Text>
        <ActivityIndicator
          size="small"
          color="#999"
          style={styles.spinner}
        />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 40,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    icon: {
      fontSize: 40,
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 20,
    },
    spinner: {
      marginTop: 16,
    },
  });
