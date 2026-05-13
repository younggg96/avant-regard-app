import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { UserAvatar } from "./ui/UserAvatar";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import {
  Conversation,
  getConversations,
  createConversation,
  sendMessageREST,
  chatWS,
} from "../services/chatService";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import { Post } from "./PostCard";
import { Post as ServicePost } from "../services/postService";
import { BuyerStore, BuyerStoreDetail } from "../services/buyerStoreService";
import { Brand } from "../services/brandService";
import { UserInfo } from "../services/userInfoService";
import {
  ShareContentType,
  generateShareUrl,
  copyShareUrl,
  shareWithSystemGeneric,
  shareToWeChatGeneric,
  shareToWeiboGeneric,
  buildGenericShareContent,
} from "../services/shareService";

export interface PostSharePayload {
  postId: string;
  title: string;
  imageUrl?: string;
  authorName: string;
  authorAvatar?: string;
}

export interface StoreSharePayload {
  storeId: string;
  name: string;
  imageUrl?: string;
  city: string;
  country: string;
  rating?: number;
  styles?: string[];
}

export interface BrandSharePayload {
  brandId: number;
  name: string;
  imageUrl?: string;
  country?: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
}

export interface ShowSharePayload {
  showId: string;
  title: string;
  season: string;
  year?: string;
  imageUrl?: string;
  brandName?: string;
  designer?: string;
  category?: string;
}

export interface UserSharePayload {
  userId: number;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  primaryTitle?: string;
}

type ShareableUser =
  | UserInfo
  | {
      userId: number;
      username: string;
      avatarUrl?: string;
      avatar?: string;
      bio?: string;
      location?: string;
      primaryTitle?: string;
    };

export function buildUserSharePayload(user: ShareableUser): UserSharePayload {
  const avatarUrl =
    (user as UserInfo).avatarUrl ??
    (user as { avatar?: string }).avatar ??
    undefined;
  return {
    userId: user.userId,
    username: user.username,
    avatarUrl: avatarUrl || undefined,
    bio: user.bio || undefined,
    location: user.location || undefined,
    primaryTitle: (user as UserInfo).primaryTitle || undefined,
  };
}

export interface ShareableShow {
  id: string | number;
  title: string;
  season: string;
  year?: string | number;
  coverImage?: string;
  brandName?: string;
  designer?: string | null;
  category?: string | null;
}

type ShareableStore = BuyerStore | BuyerStoreDetail;

interface ShareToChatModalProps {
  visible: boolean;
  post?: Post | null;
  store?: ShareableStore | null;
  brand?: Brand | null;
  show?: ShareableShow | null;
  user?: ShareableUser | null;
  onClose: () => void;
  onShareComplete?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function buildPostSharePayload(post: Post): PostSharePayload {
  return {
    postId: post.id,
    title: post.content?.title || post.title || "",
    imageUrl: post.content?.images?.[0] || post.image,
    authorName: post.author.name,
    authorAvatar: post.author.avatar,
  };
}

/**
 * Build a post share payload from the raw service-shaped Post
 * (as returned by postService.getPostsByUserId / getLikedPostsByUserId /
 * getFavoritePostsByUserId / searchPosts).
 *
 * Keeps the share payload builder logic in one place (DRY) while allowing
 * callers that never materialize the UI-shaped Post to share directly.
 */
export function buildPostSharePayloadFromService(post: ServicePost): PostSharePayload {
  return {
    postId: String(post.id),
    title: post.title || "",
    imageUrl: post.imageUrls?.[0],
    authorName: post.username,
    authorAvatar: post.avatarUrl,
  };
}

export function buildStoreSharePayload(store: ShareableStore): StoreSharePayload {
  return {
    storeId: store.id,
    name: store.name,
    imageUrl: store.images?.[0],
    city: store.city,
    country: store.country,
    rating: "averageRating" in store ? store.averageRating : store.rating,
    styles: store.style?.length ? store.style.slice(0, 3) : undefined,
  };
}

export function buildBrandSharePayload(brand: Brand): BrandSharePayload {
  return {
    brandId: brand.id,
    name: brand.name,
    imageUrl: brand.coverImage || brand.coverImages?.[0],
    country: brand.country,
    category: brand.category,
    foundedYear: brand.foundedYear,
    founder: brand.founder,
  };
}

export function buildShowSharePayload(show: ShareableShow): ShowSharePayload {
  return {
    showId: String(show.id),
    title: show.title,
    season: show.season,
    year: show.year !== undefined && show.year !== null ? String(show.year) : undefined,
    imageUrl: show.coverImage || undefined,
    brandName: show.brandName || undefined,
    designer: show.designer || undefined,
    category: show.category || undefined,
  };
}

interface SharePreview {
  imageUrl?: string;
  title: string;
  subtitle: string;
  messageType: "post_card" | "store_card" | "brand_card" | "show_card" | "user_card";
  payload: string;
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  contentType: ShareContentType;
  contentId: string | number;
}

function resolvePreview(
  t: (key: string) => string,
  post?: Post | null,
  store?: ShareableStore | null,
  brand?: Brand | null,
  show?: ShareableShow | null,
  user?: ShareableUser | null,
): SharePreview | null {
  if (post) {
    const p = buildPostSharePayload(post);
    return {
      imageUrl: p.imageUrl,
      title: p.title || t("shareToChat.sharePost"),
      subtitle: `@${p.authorName}`,
      messageType: "post_card",
      payload: JSON.stringify(p),
      contentType: "post",
      contentId: p.postId,
    };
  }
  if (store) {
    const p = buildStoreSharePayload(store);
    return {
      imageUrl: p.imageUrl,
      title: p.name,
      subtitle: `${p.city}, ${p.country}`,
      messageType: "store_card",
      payload: JSON.stringify(p),
      placeholderIcon: "storefront-outline",
      contentType: "store",
      contentId: p.storeId,
    };
  }
  if (brand) {
    const p = buildBrandSharePayload(brand);
    const parts = [p.country, p.category].filter(Boolean);
    return {
      imageUrl: p.imageUrl,
      title: p.name,
      subtitle: parts.length ? parts.join(" · ") : t("shareToChat.brandLabel"),
      messageType: "brand_card",
      payload: JSON.stringify(p),
      placeholderIcon: "pricetag-outline",
      contentType: "brand",
      contentId: p.brandId,
    };
  }
  if (show) {
    const p = buildShowSharePayload(show);
    const seasonLine = [p.season, p.year].filter(Boolean).join(" ");
    return {
      imageUrl: p.imageUrl,
      title: p.brandName ? `${p.brandName} · ${p.title}` : p.title,
      subtitle: seasonLine || t("shareToChat.showLabel"),
      messageType: "show_card",
      payload: JSON.stringify(p),
      placeholderIcon: "sparkles-outline",
      contentType: "show",
      contentId: p.showId,
    };
  }
  if (user) {
    const p = buildUserSharePayload(user);
    const parts = [p.location, p.primaryTitle].filter(Boolean);
    return {
      imageUrl: p.avatarUrl,
      title: p.username,
      subtitle: parts.length ? parts.join(" · ") : t("shareToChat.userProfile"),
      messageType: "user_card",
      payload: JSON.stringify(p),
      placeholderIcon: "person-outline",
      contentType: "user",
      contentId: p.userId,
    };
  }
  return null;
}

export const ShareToChatModal: React.FC<ShareToChatModalProps> = ({
  visible,
  post,
  store,
  brand,
  show,
  user,
  onClose,
  onShareComplete,
}) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const currentUser = useAuthStore((s) => s.user);
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const s = useThemedStyles(makeStyles);

  useEffect(() => {
    if (visible) {
      setSentIds(new Set());
      fetchConversations();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch {
      console.error("Failed to load conversations for share");
    } finally {
      setLoading(false);
    }
  };

  const preview = resolvePreview(t, post, store, brand, show, user);

  const shareUrl = preview
    ? generateShareUrl(preview.contentType, preview.contentId)
    : "";

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    await copyShareUrl(shareUrl);
  }, [shareUrl]);

  const buildShareContent = useCallback(() => {
    if (!preview) return null;
    return buildGenericShareContent({
      contentType: preview.contentType,
      id: preview.contentId,
      title: preview.title,
      subtitle: preview.subtitle,
    });
  }, [preview]);

  const handleWeChatShare = useCallback(async () => {
    const content = buildShareContent();
    if (!content) return;
    const success = await shareToWeChatGeneric(content);
    if (success) onClose();
  }, [buildShareContent, onClose]);

  const handleWeiboShare = useCallback(async () => {
    const content = buildShareContent();
    if (!content) return;
    const success = await shareToWeiboGeneric(content);
    if (success) onClose();
  }, [buildShareContent, onClose]);

  const handleSystemShare = useCallback(async () => {
    const content = buildShareContent();
    if (!content) return;
    const success = await shareWithSystemGeneric(content);
    if (success) onClose();
  }, [buildShareContent, onClose]);

  const handleSend = useCallback(
    async (conversation: Conversation) => {
      if (!preview || sending !== null) return;

      const other = conversation.otherUser;
      if (!other) return;

      setSending(conversation.id);
      try {
        if (chatWS.isConnected) {
          chatWS.sendMessage(conversation.id, preview.payload, preview.messageType);
        } else {
          await sendMessageREST(conversation.id, preview.payload, preview.messageType);
        }

        setSentIds((prev) => new Set(prev).add(conversation.id));
        onShareComplete?.();
      } catch {
        Alert.show(t("shareToChat.shareFailed"));
      } finally {
        setSending(null);
      }
    },
    [preview, sending, onShareComplete]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const other = item.otherUser;
      if (!other) return null;

      const isSent = sentIds.has(item.id);
      const isSending = sending === item.id;

      return (
        <TouchableOpacity
          style={s.conversationRow}
          onPress={() => handleSend(item)}
          disabled={isSent || isSending}
          activeOpacity={0.6}
        >
          <UserAvatar
            uri={other.avatarUrl}
            name={other.username}
            size={44}
          />
          <Text style={s.username} numberOfLines={1}>
            {other.username}
          </Text>
          {isSending ? (
            <ActivityIndicator size="small" color={theme.colors.black} />
          ) : isSent ? (
            <View style={s.sentBadge}>
              <Ionicons name="checkmark" size={14} color={theme.colors.white} />
              <Text style={s.sentText}>{t("shareToChat.sent")}</Text>
            </View>
          ) : (
            <View style={s.sendBtn}>
              <Text style={s.sendBtnText}>{t("shareToChat.send")}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [handleSend, sending, sentIds]
  );

  if (!preview) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[s.container, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={s.handleContainer}>
          <View style={s.handle} />
        </View>

        <Text style={s.title}>{t("shareToChat.title")}</Text>

        {/* Preview card */}
        <View style={s.previewCard}>
          {preview.imageUrl ? (
            <OptimizedImage
              uri={preview.imageUrl}
              size={ImageSize.THUMBNAIL}
              style={[
                s.previewImage,
                preview.messageType === "user_card" && s.previewImageRound,
              ]}
              contentFit="cover"
              lazy
            />
          ) : preview.placeholderIcon ? (
            <View style={[
              s.previewImage,
              s.previewPlaceholder,
              preview.messageType === "user_card" && s.previewImageRound,
            ]}>
              <Ionicons name={preview.placeholderIcon} size={22} color={theme.colors.gray300} />
            </View>
          ) : null}
          <View style={s.previewInfo}>
            <Text style={s.previewTitle} numberOfLines={2}>
              {preview.title}
            </Text>
            <Text style={s.previewAuthor} numberOfLines={1}>
              {preview.subtitle}
            </Text>
          </View>
        </View>

        {/* Social share platforms */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.platformsRow}
          style={s.platformsScroll}
        >
          <TouchableOpacity style={s.platformItem} onPress={handleWeChatShare} activeOpacity={0.6}>
            <View style={[s.platformIcon, { backgroundColor: "#07C160" }]}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
            </View>
            <Text style={s.platformLabel}>{t("shareToChat.wechat")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.platformItem} onPress={handleWeChatShare} activeOpacity={0.6}>
            <View style={[s.platformIcon, { backgroundColor: "#07C160" }]}>
              <Ionicons name="aperture" size={22} color="#fff" />
            </View>
            <Text style={s.platformLabel}>{t("shareToChat.moments")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.platformItem} onPress={handleWeiboShare} activeOpacity={0.6}>
            <View style={[s.platformIcon, { backgroundColor: "#E6162D" }]}>
              <Ionicons name="logo-rss" size={22} color="#fff" />
            </View>
            <Text style={s.platformLabel}>{t("shareToChat.weibo")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.platformItem} onPress={handleCopyLink} activeOpacity={0.6}>
            <View style={[s.platformIcon, { backgroundColor: theme.colors.gray100 }]}>
              <Ionicons name="link" size={22} color={theme.colors.gray700} />
            </View>
            <Text style={s.platformLabel}>{t("shareToChat.copyLink")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.platformItem} onPress={handleSystemShare} activeOpacity={0.6}>
            <View style={[s.platformIcon, { backgroundColor: theme.colors.gray100 }]}>
              <Ionicons name="share-outline" size={22} color={theme.colors.gray700} />
            </View>
            <Text style={s.platformLabel}>{t("shareToChat.more")}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={s.divider} />

        {/* Conversations list */}
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.gray300} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={s.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={32}
              color={theme.colors.gray200}
            />
            <Text style={s.emptyText}>{t("shareToChat.noChats")}</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            style={s.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
    },
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "70%",
      paddingBottom: 34,
    },
    handleContainer: {
      alignItems: "center",
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.colors.gray200,
      borderRadius: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
      marginBottom: 12,
    },
    previewCard: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 10,
      backgroundColor: t.colors.gray50,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.gray100,
      gap: 10,
    },
    previewImage: {
      width: 48,
      height: 48,
      borderRadius: 6,
      backgroundColor: t.colors.gray100,
    },
    previewPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    previewImageRound: {
      borderRadius: 24,
    },
    previewInfo: {
      flex: 1,
      justifyContent: "center",
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      lineHeight: 18,
    },
    previewAuthor: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    list: {
      maxHeight: 260,
      paddingHorizontal: 16,
    },
    platformsScroll: {
      flexGrow: 0,
      marginBottom: 4,
    },
    platformsRow: {
      paddingHorizontal: 16,
      gap: 20,
    },
    platformItem: {
      alignItems: "center",
      width: 56,
    },
    platformIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    platformLabel: {
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 6,
      textAlign: "center",
    },
    divider: {
      height: 1,
      backgroundColor: t.colors.divider,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    conversationRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 12,
    },
    username: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: t.colors.text,
    },
    sendBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: t.colors.accent,
      borderRadius: 16,
    },
    sendBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    sentBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: t.colors.gray200,
      borderRadius: 16,
      gap: 4,
    },
    sentText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: "center",
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: t.colors.gray300,
    },
    cancelBtn: {
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 14,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: t.colors.divider,
    },
    cancelText: {
      fontSize: 16,
      color: t.colors.gray300,
    },
  });

export default ShareToChatModal;
