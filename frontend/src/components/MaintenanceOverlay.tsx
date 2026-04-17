import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useMaintenanceStore } from "../store/maintenanceStore";

export default function MaintenanceOverlay() {
  const isDown = useMaintenanceStore((s) => s.isDown);

  if (!isDown) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔧</Text>
        <Text style={styles.title}>服务器维护中</Text>
        <Text style={styles.message}>
          服务暂时不可用，正在恢复中{"\n"}请稍后再试
        </Text>
        <ActivityIndicator
          size="small"
          color="#999"
          style={styles.spinner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "#fff",
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
    color: "#222",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  spinner: {
    marginTop: 16,
  },
});
