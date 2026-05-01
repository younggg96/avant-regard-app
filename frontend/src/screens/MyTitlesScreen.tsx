import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import { Alert } from "../utils/Alert";
import {
  userInfoService,
  UserTitle,
} from "../services/userInfoService";

const MyTitlesScreen = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [titles, setTitles] = useState<UserTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadTitles = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const result = await userInfoService.getUserTitles(user.userId);
      setTitles(result);
    } catch (error) {
      console.error("Error loading titles:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useFocusEffect(
    useCallback(() => {
      loadTitles();
    }, [loadTitles])
  );

  const handleSetPrimary = async (titleId: number) => {
    if (!user?.userId || updating) return;
    setUpdating(true);
    try {
      await userInfoService.setPrimaryTitle(user.userId, titleId);
      setTitles((prev) =>
        prev.map((t) => ({ ...t, isPrimary: t.id === titleId }))
      );
    } catch (error) {
      Alert.show(t("common.operationFailed"));
    } finally {
      setUpdating(false);
    }
  };

  const handleClearPrimary = async () => {
    if (!user?.userId || updating) return;
    setUpdating(true);
    try {
      await userInfoService.clearPrimaryTitle(user.userId);
      setTitles((prev) => prev.map((t) => ({ ...t, isPrimary: false })));
    } catch (error) {
      Alert.show(t("common.operationFailed"));
    } finally {
      setUpdating(false);
    }
  };

  const primaryTitle = titles.find((t) => t.isPrimary);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("myTitles.title")} showBack={true} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : titles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="ribbon-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyText}>{t("myTitles.noTitles")}</Text>
            <Text style={styles.emptySubText}>
              {t("myTitles.emptyHint")}
            </Text>
          </View>
        ) : (
          <>
            {primaryTitle && (
              <View style={styles.primarySection}>
                <Text style={styles.sectionTitle}>{t("myTitles.current")}</Text>
                <View style={styles.primaryCard}>
                  <View style={styles.primaryContent}>
                    <Ionicons name="star" size={18} color="#D97706" />
                    <Text style={styles.primaryTitleText}>
                      {primaryTitle.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClearPrimary}
                    disabled={updating}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>{t("myTitles.unequip")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.allSection}>
              <Text style={styles.sectionTitle}>{t("myTitles.allTitles")}</Text>
              <Text style={styles.sectionHint}>
                {t("myTitles.allTitlesHint")}
              </Text>
              {titles.map((title) => (
                <TouchableOpacity
                  key={title.id}
                  style={[
                    styles.titleItem,
                    title.isPrimary && styles.titleItemActive,
                  ]}
                  onPress={() => handleSetPrimary(title.id)}
                  disabled={updating || title.isPrimary}
                  activeOpacity={0.7}
                >
                  <View style={styles.titleItemLeft}>
                    <Ionicons
                      name={title.isPrimary ? "star" : "star-outline"}
                      size={18}
                      color={
                        title.isPrimary ? "#D97706" : theme.colors.gray300
                      }
                    />
                    <Text
                      style={[
                        styles.titleItemText,
                        title.isPrimary && styles.titleItemTextActive,
                      ]}
                    >
                      {title.title}
                    </Text>
                  </View>
                  {title.isPrimary ? (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>{t("myTitles.primary")}</Text>
                    </View>
                  ) : (
                    <Text style={styles.setAsText}>{t("myTitles.equip")}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.gray400,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  emptySubText: {
    fontSize: 13,
    color: theme.colors.gray300,
    textAlign: "center",
    lineHeight: 18,
  },
  primarySection: {
    padding: theme.spacing.md,
    borderBottomWidth: 8,
    borderBottomColor: theme.colors.gray50,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.gray400,
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginBottom: 12,
    lineHeight: 17,
  },
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
  },
  primaryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(146, 64, 14, 0.1)",
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#92400E",
  },
  allSection: {
    padding: theme.spacing.md,
  },
  titleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.gray50,
  },
  titleItemActive: {
    backgroundColor: "#FEF3C7",
  },
  titleItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.black,
  },
  titleItemTextActive: {
    fontWeight: "600",
    color: "#92400E",
  },
  primaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#D97706",
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.white,
  },
  setAsText: {
    fontSize: 13,
    color: theme.colors.gray300,
  },
});

export default MyTitlesScreen;
