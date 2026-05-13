import React, { useState, useCallback } from "react";
import {
  FlatList,
  ActivityIndicator,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Text, HStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { Alert } from "../utils/Alert";
import {
  moderationService,
  BlockedUser,
} from "../services/moderationService";

const BlockedUsersScreen = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await moderationService.getBlockedUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load blocked users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBlockedUsers();
    }, [loadBlockedUsers])
  );

  const handleUnblock = async (user: BlockedUser) => {
    setUnblockingId(user.userId);
    try {
      await moderationService.unblockUser(user.userId);
      setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      Alert.show(t("user.unblockSuccess"));
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : t("common.operationFailed");
      Alert.show(msg);
    } finally {
      setUnblockingId(null);
    }
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <HStack
      px="$md"
      py="$md"
      alignItems="center"
      justifyContent="between"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      <HStack space="md" alignItems="center" flex={1}>
        <OptimizedImage
          uri={item.avatarUrl}
          size={ImageSize.THUMBNAIL}
          style={styles.avatar}
          contentFit="cover"
          lazy={true}
        />
        <Text fontSize="$md" fontWeight="$medium" color="$black" numberOfLines={1}>
          {item.username || `${t("profile.user")}${item.userId}`}
        </Text>
      </HStack>

      <TouchableOpacity
        style={[
          styles.unblockButton,
          unblockingId === item.userId && styles.unblockButtonDisabled,
        ]}
        onPress={() => handleUnblock(item)}
        disabled={unblockingId === item.userId}
      >
        {unblockingId === item.userId ? (
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <Text fontSize="$sm" fontWeight="$semibold" color="$black">
            {t("blockedUsers.unblock")}
          </Text>
        )}
      </TouchableOpacity>
    </HStack>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text fontSize="$md" color="$gray400">
          {t("blockedUsers.noBlocked")}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("blockedUsers.title")} showBack={true} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.white} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.userId)}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.gray100,
    },
    unblockButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      minWidth: 88,
      alignItems: "center",
    },
    unblockButtonDisabled: {
      opacity: 0.5,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 120,
    },
  });

export default BlockedUsersScreen;
