import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useAlert } from "../components/AlertProvider";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();
  const { showConfirm, showAlert } = useAlert();

  const menuItems = [
    { id: "followed", label: "Followed Designers", count: 12 },
    { id: "saved", label: "Saved Looks", count: 48 },
    { id: "alerts", label: "Price Alerts", count: 5 },
    { id: "drafts", label: "Draft Notes", count: 3 },
    { id: "settings", label: "Settings", count: null },
  ];

  const handleLogout = () => {
    showConfirm("Sign Out", "Are you sure you want to sign out?", logout);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nickname?.slice(0, 2).toUpperCase() || "AG"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.nickname || "User"}</Text>
            <Text style={styles.joinDate}>
              {user?.email || "user@example.com"}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                if (item.id === "settings") {
                  (navigation as any).navigate("Settings");
                } else {
                  showAlert(
                    "Coming Soon",
                    `${item.label} will be available soon`
                  );
                }
              }}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <View style={styles.menuRight}>
                {item.count !== null && (
                  <Text style={styles.menuCount}>{item.count}</Text>
                )}
                <Text style={styles.menuArrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>ACTIVITY</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>156</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>48</Text>
              <Text style={styles.statLabel}>Saves</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Notes</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.md,
  },
  avatarText: {
    ...theme.typography.h3,
    color: theme.colors.white,
  },
  userInfo: {
    flex: 1,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  username: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: 2,
  },
  joinDate: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  content: {
    flex: 1,
  },
  menuSection: {
    paddingVertical: theme.spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  menuLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginRight: theme.spacing.sm,
  },
  menuArrow: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  statsSection: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    ...theme.typography.h1,
    color: theme.colors.black,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 4,
  },
});

export default ProfileScreen;
