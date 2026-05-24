/**
 * BrandSearchSheet —— PRD 1.2 单品发布的品牌搜索面板。
 *
 * 与既有的 BrandSelectorModal 类似（卡片网格 + 搜索框），但额外加入：
 *   - 「找不到想要的品牌？联系小客服」CTA；
 *   - 客服工作时间（从 GET /api/marketplace/support-contact 拉取）；
 *   - 圆角统一 4。
 *
 * 当 PRD 1.2 同样需要在「秀场」搜索面板加这个 CTA 时，可复用本组件的
 * `ContactSupportInline` 子组件。
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  FlatList,
  Dimensions,
  Linking,
  ActivityIndicator,
  TouchableWithoutFeedback,
  View,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { useThemedStyles, useAppTheme, type AppTheme } from "../theme";
import { searchBrands, type Brand } from "../services/brandService";
import { getSupportContact, type SupportContactInfo } from "../services/storeProductService";

const { width: screenWidth } = Dimensions.get("window");

interface BrandSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (brand: Brand) => void;
  /** 初始关键词（一般为空）。 */
  initialQuery?: string;
}

const BrandSearchSheet: React.FC<BrandSearchSheetProps> = ({
  visible,
  onClose,
  onSelect,
  initialQuery = "",
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);

  const brandWidth = (screenWidth - 16 * 2 - 12) / 2;

  // 防抖：用户停止输入 250ms 后搜索一次
  useEffect(() => {
    if (!visible) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const list = await searchBrands(query.trim(), 30);
        setResults(list || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
                <Box style={styles.header}>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Text style={styles.title}>
                      {t("trading.publishListing.brand.searchTitle")}
                    </Text>
                    <Pressable style={styles.closeBtn} onPress={onClose}>
                      <Ionicons name="close" size={22} color={theme.colors.text} />
                    </Pressable>
                  </HStack>
                  <HStack alignItems="center" style={styles.searchRow}>
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={t(
                        "trading.publishListing.brand.searchPlaceholder"
                      )}
                      placeholderTextColor={theme.colors.placeholder}
                      style={styles.searchInput}
                      autoFocus
                      returnKeyType="search"
                    />
                    {!!query && (
                      <Pressable onPress={() => setQuery("")} hitSlop={8}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={theme.colors.textSecondary}
                        />
                      </Pressable>
                    )}
                  </HStack>
                </Box>

                <FlatList
                  data={results}
                  keyExtractor={(b, i) => `${b.id}-${b.name}-${i}`}
                  numColumns={2}
                  contentContainerStyle={styles.list}
                  columnWrapperStyle={styles.columnWrapper}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.brandItem, { width: brandWidth }]}
                      onPress={() => onSelect(item)}
                    >
                      <Box
                        style={[
                          styles.brandImage,
                          { height: brandWidth * 0.7 },
                        ]}
                      >
                        {item.coverImage ? (
                          <OptimizedImage
                            uri={item.coverImage}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                            lazy
                          />
                        ) : (
                          <Box style={styles.brandImagePlaceholder}>
                            <Text style={styles.brandImageInitial}>
                              {item.name.substring(0, 2).toUpperCase()}
                            </Text>
                          </Box>
                        )}
                      </Box>
                      <Text style={styles.brandName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.category && (
                        <Text style={styles.brandSub} numberOfLines={1}>
                          {item.category}
                        </Text>
                      )}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Box style={styles.emptyBox}>
                      {loading ? (
                        <ActivityIndicator />
                      ) : query.trim() ? (
                        <Text style={styles.emptyText}>
                          {t("trading.publishListing.brand.noResults")}
                        </Text>
                      ) : (
                        <Text style={styles.emptyText}>
                          {t("trading.publishListing.brand.searchPrompt")}
                        </Text>
                      )}
                    </Box>
                  }
                  ListFooterComponent={<ContactSupportInline />}
                />
              </SafeAreaView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

/**
 * 「找不到品牌？联系小客服」CTA，可在 BrandSearchSheet 和未来 ShowSearchSheet 复用。
 */
export const ContactSupportInline: React.FC = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const [info, setInfo] = useState<SupportContactInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupportContact()
      .then((res) => {
        if (!cancelled) setInfo(res);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContact = async () => {
    if (info?.email) {
      const ok = await Linking.canOpenURL(`mailto:${info.email}`);
      if (ok) {
        Linking.openURL(
          `mailto:${info.email}?subject=${encodeURIComponent(
            "[Avant Regard] 品牌 / 秀场补录申请"
          )}`
        );
        return;
      }
    }
    // 兜底：复制邮箱 / 微信号
  };

  return (
    <Box style={styles.supportCard}>
      <VStack space="xs">
        <HStack alignItems="center" space="sm">
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.supportTitle}>
            {t("trading.publishListing.brand.notFoundTitle")}
          </Text>
        </HStack>
        <Text style={styles.supportSub}>
          {t("trading.publishListing.brand.notFoundSubtitle")}
        </Text>
        {info && (
          <Text style={styles.supportHours}>
            {t("trading.publishListing.brand.csHours", {
              weekday: info.weekdayHours,
              weekend: info.weekendHours,
            })}
          </Text>
        )}
        <Pressable style={styles.supportBtn} onPress={handleContact}>
          <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
          <Text style={styles.supportBtnText}>
            {t("trading.publishListing.brand.contactCs")}
          </Text>
        </Pressable>
      </VStack>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      height: "85%",
      backgroundColor: t.colors.background,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      overflow: "hidden",
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    closeBtn: { padding: 4 },
    searchRow: {
      marginTop: 10,
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: t.colors.text,
      paddingVertical: 4,
    },
    list: {
      padding: 16,
      paddingBottom: 24,
    },
    columnWrapper: {
      justifyContent: "space-between",
      marginBottom: 12,
    },
    brandItem: {
      marginBottom: 4,
    },
    brandImage: {
      width: "100%",
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
    },
    brandImagePlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    brandImageInitial: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.textSecondary,
    },
    brandName: {
      marginTop: 6,
      fontSize: 13,
      color: t.colors.text,
      fontWeight: "600",
    },
    brandSub: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    emptyBox: {
      paddingVertical: 60,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.textSecondary,
    },
    supportCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 14,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    supportTitle: {
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "600",
    },
    supportSub: {
      fontSize: 12,
      color: t.colors.textSecondary,
      lineHeight: 18,
    },
    supportHours: {
      marginTop: 4,
      fontSize: 11,
      color: t.colors.textSecondary,
      letterSpacing: 0.4,
    },
    supportBtn: {
      marginTop: 10,
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    supportBtnText: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
  });

export default BrandSearchSheet;
