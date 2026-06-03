import React, { useState, useCallback } from "react";
import { ScrollView, RefreshControl, Image as RNImage, StyleSheet, Dimensions } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../../theme";
import { Box } from "../../../components/ui";
import { useProfileLoadingGif } from "../../../utils/loadingGifs";
import { useNotificationStore } from "../../../store/notificationStore";
import { TradingCategory } from "../../../services/notificationService";
import { TRADING_CATEGORY_META } from "../constants";
import { TradingCategoryEntry } from "./TradingCategoryEntry";

/**
 * 互动页「交易」tab 内容：把所有交易相关通知按分类（物流 / 售后 / 心动）
 * 聚合为三个入口行，点击进入对应的分类通知列表（复用 Activity 屏）。
 */
export const TradingContent = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const profileLoadingGif = useProfileLoadingGif();

  const notifications = useNotificationStore((s) => s.notifications);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const isInitialLoaded = useNotificationStore((s) => s.isInitialLoaded);

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const byCategory = useCallback(
    (category: TradingCategory) =>
      notifications.filter((n) => n.category === category),
    [notifications]
  );

  const goToCategory = useCallback(
    (category: TradingCategory) => {
      (navigation.navigate as any)("Activity", { tradingCategory: category });
    },
    [navigation]
  );

  if (!isInitialLoaded) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <RNImage
          source={profileLoadingGif}
          style={styles.loadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {TRADING_CATEGORY_META.map((meta) => (
        <TradingCategoryEntry
          key={meta.id}
          notifications={byCategory(meta.id)}
          label={t(meta.labelKey)}
          emptyText={t(meta.emptyKey)}
          icon={meta.icon}
          color={meta.color}
          onPress={() => goToCategory(meta.id)}
        />
      ))}
    </ScrollView>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const styles = StyleSheet.create({
  loadingGif: {
    width: screenWidth,
    height: screenHeight / 2,
  },
});
