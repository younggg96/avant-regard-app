/**
 * PublishFromPostPickerScreen —— PDF p.13「从以往帖子转入」入口。
 *
 * 与 PublishListing 三步走同源，使用 ScreenHeader + 主题化样式。
 * 把作者已发的论坛 / Lookbook 帖中的图、标题、品牌、尺码 / 颜色一键预填进
 * publishListingStore，然后跳 PublishListingStep1 继续完善。
 *
 * UI 要点：
 *   - 顶部用浅色 banner 强调「这里干什么」，配 information 图标，比纯灰色提示更易读。
 *   - 加载时用 3 张骨架卡占位，避免空白屏只有转圈。
 *   - 没有可转入的帖子时给出图标 + 标题 + 副标题 + 主 CTA 的丰富空状态。
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  Image as RNImage,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { useAuthStore } from "../../store/authStore";
import { getPostsByUserId, Post } from "../../services/postService";
import { usePublishListingStore } from "../../store/publishListingStore";

const PublishFromPostPickerScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!me?.userId) return;
    setLoading(true);
    try {
      const data = await getPostsByUserId(me.userId, "PUBLISHED");
      setPosts((data || []).filter((p) => (p.imageUrls?.length ?? 0) > 0));
    } catch (e) {
      console.warn("[PublishFromPostPicker] load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePick = (post: Post) => {
    const store = usePublishListingStore.getState();
    store.reset({ sellerKind: "individual" });

    const images = post.imageUrls ?? [];

    store.patch({
      title: post.title || post.productName || "",
      description: post.contentText || "",
      brand: post.itemBrand || post.brandName || "",
      brandId: post.itemBrandId ?? null,
      categoryName: post.itemCategory || null,
      size: (post.itemSizes ?? [])[0] || "",
      color: (post.itemColors ?? [])[0] || "",
      photoAngles: {
        front: images[0] ?? null,
        back: images[1] ?? null,
        wash_label: images[2] ?? null,
        brand_label: images[3] ?? null,
        flaw: images[4] ?? null,
        extras: images.slice(5),
      },
      extras: images.slice(5),
    });

    navigation.navigate("PublishListingStep1");
  };

  const goPublishPost = () => {
    navigation.navigate("PublishV2Composer");
  };

  const renderHintBanner = () => (
    <HStack style={styles.banner} space="sm" alignItems="flex-start">
      <Ionicons
        name="information-circle"
        size={18}
        color={theme.colors.text}
        style={{ marginTop: 1 }}
      />
      <Text style={styles.bannerText}>
        {t("trading.publishFromPost.hint")}
      </Text>
    </HStack>
  );

  const renderSkeleton = () => (
    <VStack space="sm" style={styles.listContent}>
      {[0, 1, 2].map((i) => (
        <Box key={i} style={[styles.card, styles.cardSkeleton]}>
          <HStack space="md" alignItems="center">
            <View style={[styles.cover, styles.shimmer]} />
            <VStack flex={1} space="xs">
              <View style={[styles.skelLine, { width: "60%" }]} />
              <View style={[styles.skelLine, { width: "40%" }]} />
              <View style={[styles.skelLine, { width: "30%" }]} />
            </VStack>
          </HStack>
        </Box>
      ))}
    </VStack>
  );

  const renderEmpty = () => (
    <VStack style={styles.empty} space="md" alignItems="center">
      <Box style={styles.emptyIconWrap}>
        <Ionicons
          name="images-outline"
          size={36}
          color={theme.colors.gray300}
        />
      </Box>
      <Text style={styles.emptyTitle}>
        {t("trading.publishFromPost.emptyTitle")}
      </Text>
      <Text style={styles.emptySubtitle}>
        {t("trading.publishFromPost.emptySubtitle")}
      </Text>
      <TouchableOpacity
        onPress={goPublishPost}
        style={styles.emptyCta}
        activeOpacity={0.85}
      >
        <Ionicons
          name="add"
          size={18}
          color={theme.colors.textInverted}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.emptyCtaText}>
          {t("trading.publishFromPost.emptyCta")}
        </Text>
      </TouchableOpacity>
    </VStack>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.publishFromPost.title")} showBack />

      {loading && posts.length === 0 ? (
        <>
          {renderHintBanner()}
          {renderSkeleton()}
        </>
      ) : posts.length === 0 ? (
        <>
          {renderHintBanner()}
          {renderEmpty()}
        </>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHintBanner}
          ItemSeparatorComponent={() => <Box style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={theme.colors.text}
            />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => handlePick(item)}>
              <HStack space="md" alignItems="center">
                <RNImage
                  source={{ uri: item.imageUrls[0] }}
                  style={styles.cover}
                />
                <VStack flex={1} space="xs">
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title ||
                      item.productName ||
                      t("trading.publishFromPost.untitledPost")}
                  </Text>
                  {item.itemBrand || item.brandName ? (
                    <Text style={styles.brand} numberOfLines={1}>
                      {item.itemBrand || item.brandName}
                    </Text>
                  ) : null}
                  <Text style={styles.muted}>
                    {t("trading.publishFromPost.postMeta", {
                      count: item.imageUrls?.length ?? 0,
                      date: item.createdAt?.slice(0, 10) ?? "",
                    })}
                  </Text>
                </VStack>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.gray300}
                />
              </HStack>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },

    // Hint banner（顶部信息条）
    banner: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.surface,
      borderRadius: 4,
    },
    bannerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: t.colors.textSecondary,
    },

    // 列表
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cover: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
    },
    title: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    brand: { fontSize: 12, color: t.colors.gray400 },
    muted: { fontSize: 11, color: t.colors.gray300 },

    // 骨架
    cardSkeleton: { borderColor: t.colors.divider },
    shimmer: { backgroundColor: t.colors.skeleton },
    skelLine: {
      height: 10,
      borderRadius: 5,
      backgroundColor: t.colors.skeleton,
    },

    // 空状态
    empty: {
      flex: 1,
      paddingHorizontal: 32,
      paddingTop: 80,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 13,
      lineHeight: 20,
      color: t.colors.textSecondary,
      textAlign: "center",
      maxWidth: 260,
    },
    emptyCta: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: t.colors.accent,
    },
    emptyCtaText: {
      color: t.colors.textInverted,
      fontSize: 14,
      fontWeight: "600",
    },
  });

export default PublishFromPostPickerScreen;
