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
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
  View,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { Box, HStack, VStack, Text, Pressable } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { useThemedStyles, useAppTheme, type AppTheme } from "../theme";
import { searchBrands, type Brand } from "../services/brandService";
import { getSupportContact, type SupportContactInfo } from "../services/storeProductService";
import { contactSupportGeneral } from "../services/aftersalesService";
import { sendMessageREST } from "../services/chatService";
import { getCustomerServiceChatParams } from "../utils/chatNavigationUtils";

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
      animationType="fade"
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
                  ListFooterComponent={
                    <ContactSupportInline
                      onBeforeNavigate={onClose}
                      searchQuery={query}
                      contextKind="brand"
                    />
                  }
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
interface ContactSupportInlineProps {
  /** 点击 CTA 前的回调（一般用来关掉外层 Sheet，避免 Chat 屏被 Modal 盖住）。 */
  onBeforeNavigate?: () => void;
  /**
   * 当前搜索关键词，会自动作为一条文本消息发到客服会话里，
   * 让客服直接看到「用户想补录哪个品牌」。空字符串表示无上下文。
   */
  searchQuery?: string;
  /**
   * 上下文类型：用于挑选预填消息模板。默认 'brand'，可选 'show' 以复用到秀场搜索。
   */
  contextKind?: "brand" | "show";
}

export const ContactSupportInline: React.FC<ContactSupportInlineProps> = ({
  onBeforeNavigate,
  searchQuery,
  contextKind = "brand",
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const [info, setInfo] = useState<SupportContactInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftVisible, setDraftVisible] = useState(false);
  const [draftText, setDraftText] = useState("");

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

  /** 根据当前 searchQuery / contextKind 生成默认草稿。 */
  const buildDefaultDraft = useCallback((): string => {
    const trimmedQuery = (searchQuery ?? "").trim();
    const messageKey =
      contextKind === "show"
        ? trimmedQuery
          ? "trading.publishListing.brand.csIntroShowWithQuery"
          : "trading.publishListing.brand.csIntroShow"
        : trimmedQuery
          ? "trading.publishListing.brand.csIntroBrandWithQuery"
          : "trading.publishListing.brand.csIntroBrand";
    return t(messageKey, {
      query: trimmedQuery,
      defaultValue: trimmedQuery
        ? `你好，我想补录${
            contextKind === "show" ? "秀场" : "品牌"
          }「${trimmedQuery}」，可以帮忙吗？`
        : `你好，我想补录${
            contextKind === "show" ? "秀场" : "品牌"
          }，可以帮忙吗？`,
    });
  }, [contextKind, searchQuery, t]);

  /** 点击主按钮 → 弹出可编辑的预览框。 */
  const handleOpenDraft = () => {
    if (submitting) return;
    setDraftText(buildDefaultDraft());
    setDraftVisible(true);
  };

  /** 发送 → 真正落地：创建 / 复用客服会话 → 发用户编辑后的文本 → 跳 Chat。 */
  const handleSendDraft = async () => {
    const finalText = draftText.trim();
    if (!finalText || submitting) return;
    setSubmitting(true);
    try {
      const res = await contactSupportGeneral();

      try {
        await sendMessageREST(res.conversationId, finalText, "text");
      } catch (sendErr) {
        console.warn("[brand-sheet] seed intro message failed", sendErr);
      }

      setDraftVisible(false);
      onBeforeNavigate?.();
      navigation.navigate(
        "Chat",
        getCustomerServiceChatParams(res.conversationId, res.csUserId, t),
      );
    } catch (e) {
      console.warn("[brand-sheet] contact support failed", e);
      Alert.alert(
        t("trading.support.contactSupport"),
        t("trading.support.openFailed", {
          defaultValue: "无法连接客服，请稍后再试。",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
          <Pressable
            style={[styles.supportBtn, submitting && styles.supportBtnDisabled]}
            onPress={handleOpenDraft}
            disabled={submitting}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={16}
              color={theme.colors.textInverted}
            />
            <Text style={styles.supportBtnText}>
              {t("trading.publishListing.brand.contactCs")}
            </Text>
          </Pressable>
        </VStack>
      </Box>

      <DraftReviewModal
        visible={draftVisible}
        value={draftText}
        onChange={setDraftText}
        onCancel={() => {
          if (!submitting) setDraftVisible(false);
        }}
        onSend={handleSendDraft}
        submitting={submitting}
      />
    </>
  );
};

/**
 * 编辑预填客服文案的轻量 Modal。
 * 跟 BrandSearchSheet 共用 theme 色板，自动适配 Dark / Light。
 */
interface DraftReviewModalProps {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
  submitting: boolean;
}

const DraftReviewModal: React.FC<DraftReviewModalProps> = ({
  visible,
  value,
  onChange,
  onCancel,
  onSend,
  submitting,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const trimmed = value.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.draftOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.draftCard}>
              <Text style={styles.draftTitle}>
                {t("trading.publishListing.brand.draftTitle", {
                  defaultValue: "发送给客服",
                })}
              </Text>
              <Text style={styles.draftHint}>
                {t("trading.publishListing.brand.draftHint", {
                  defaultValue: "可以修改后再发送 ↓",
                })}
              </Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                style={styles.draftInput}
                multiline
                autoFocus
                placeholder={t(
                  "trading.publishListing.brand.draftPlaceholder",
                  { defaultValue: "想跟客服说点什么？" },
                )}
                placeholderTextColor={theme.colors.placeholder}
                editable={!submitting}
              />
              <HStack
                justifyContent="flex-end"
                alignItems="center"
                space="sm"
                style={styles.draftActions}
              >
                <Pressable
                  style={[
                    styles.draftBtn,
                    styles.draftBtnGhost,
                    submitting && styles.supportBtnDisabled,
                  ]}
                  onPress={onCancel}
                  disabled={submitting}
                >
                  <Text style={styles.draftBtnGhostText}>
                    {t("common.cancel", { defaultValue: "取消" })}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.draftBtn,
                    styles.draftBtnPrimary,
                    (!trimmed || submitting) && styles.supportBtnDisabled,
                  ]}
                  onPress={onSend}
                  disabled={!trimmed || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.textInverted}
                    />
                  ) : (
                    <Ionicons
                      name="send"
                      size={14}
                      color={theme.colors.textInverted}
                    />
                  )}
                  <Text style={styles.draftBtnPrimaryText}>
                    {t("trading.publishListing.brand.draftSend", {
                      defaultValue: "发送并联系客服",
                    })}
                  </Text>
                </Pressable>
              </HStack>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
    supportBtnDisabled: {
      opacity: 0.6,
    },
    supportBtnText: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
    draftOverlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    draftCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 16,
      gap: 8,
    },
    draftTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    draftHint: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginBottom: 4,
    },
    draftInput: {
      minHeight: 96,
      maxHeight: 200,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      padding: 10,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.surface,
      textAlignVertical: "top",
    },
    draftActions: {
      marginTop: 12,
    },
    draftBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: t.borderRadius.sm,
      gap: 6,
    },
    draftBtnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    draftBtnGhostText: {
      color: t.colors.text,
      fontSize: 13,
      fontWeight: "500",
    },
    draftBtnPrimary: {
      backgroundColor: t.colors.accent,
    },
    draftBtnPrimaryText: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
  });

export default BrandSearchSheet;
