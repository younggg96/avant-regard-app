import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../../../theme";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import type { ActionSheetAction } from "../../../components/ui/ActionSheet";
import { Message } from "../../../services/chatService";
import { PostSharePayload, StoreSharePayload, BrandSharePayload, ShowSharePayload } from "../../../components/ShareToChatModal";
import { formatMessageTime } from "../utils";
import { DateSeparator } from "./DateSeparator";
import { styles } from "../styles";
import HalfStarRating from "../../../components/HalfStarRating";

interface MessageBubbleProps {
  message: Message;
  showTime: boolean;
  isLast: boolean;
  onReportMessage?: (message: Message) => void;
  onReportUser?: (message: Message) => void;
}

function tryParsePostCard(content: string): PostSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.postId === "string") return parsed;
  } catch { }
  return null;
}

function tryParseStoreCard(content: string): StoreSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.storeId === "string") return parsed;
  } catch { }
  return null;
}

function tryParseBrandCard(content: string): BrandSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.brandId === "number") return parsed;
  } catch { }
  return null;
}

function tryParseShowCard(content: string): ShowSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.showId === "string") return parsed;
  } catch { }
  return null;
}

export const MessageBubble = ({
  message,
  showTime,
  isLast,
  onReportMessage,
  onReportUser,
}: MessageBubbleProps) => {
  const isMine = message.isMine;
  const [showMenu, setShowMenu] = useState(false);
  const navigation = useNavigation();

  const canReport = !isMine && (onReportMessage || onReportUser);

  const isPostCard = message.messageType === "post_card";
  const postCard = isPostCard ? tryParsePostCard(message.content) : null;

  const isStoreCard = message.messageType === "store_card";
  const storeCard = isStoreCard ? tryParseStoreCard(message.content) : null;

  const isBrandCard = message.messageType === "brand_card";
  const brandCard = isBrandCard ? tryParseBrandCard(message.content) : null;

  const isShowCard = message.messageType === "show_card";
  const showCard = isShowCard ? tryParseShowCard(message.content) : null;

  const menuActions = useMemo<ActionSheetAction[]>(() => {
    const list: ActionSheetAction[] = [];
    if (onReportMessage) {
      list.push({
        label: "举报此消息",
        icon: <Ionicons name="flag-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportMessage(message),
      });
    }
    if (onReportUser) {
      list.push({
        label: "举报该用户",
        icon: <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportUser(message),
      });
    }
    return list;
  }, [message, onReportMessage, onReportUser]);

  const handlePostCardPress = () => {
    if (!postCard) return;
    (navigation.navigate as any)("PostDetail", { postId: postCard.postId });
  };

  const handleStoreCardPress = () => {
    if (!storeCard) return;
    (navigation.navigate as any)("StoreDetail", { storeId: storeCard.storeId });
  };

  const handleBrandCardPress = () => {
    if (!brandCard) return;
    (navigation.navigate as any)("BrandDetail", { id: String(brandCard.brandId), name: brandCard.name });
  };

  const handleShowCardPress = () => {
    if (!showCard) return;
    (navigation.navigate as any)("CollectionDetail", {
      collection: {
        id: showCard.showId,
        title: showCard.title,
        season: showCard.season,
        year: showCard.year || "",
        coverImage: showCard.imageUrl || "",
        imageCount: 0,
        designer: showCard.designer,
        category: showCard.category,
      },
      brandName: showCard.brandName,
    });
  };

  const renderContent = () => {
    if (showCard) {
      const seasonLine = [showCard.season, showCard.year].filter(Boolean).join(" ");
      const metaParts = [showCard.designer, showCard.category].filter(Boolean) as string[];
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handleShowCardPress}
          activeOpacity={0.7}
        >
          {showCard.imageUrl ? (
            <OptimizedImage
              uri={showCard.imageUrl}
              size={ImageSize.MEDIUM}
              style={cardStyles.image}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[cardStyles.image, showCardStyles.placeholder]}>
              <Ionicons
                name="sparkles-outline"
                size={36}
                color={isMine ? "rgba(255,255,255,0.3)" : theme.colors.gray200}
              />
            </View>
          )}
          <View style={cardStyles.body}>
            <Text
              style={[
                cardStyles.title,
                isMine ? cardStyles.titleMine : cardStyles.titleOther,
              ]}
              numberOfLines={2}
            >
              {showCard.brandName ? `${showCard.brandName} · ${showCard.title}` : showCard.title}
            </Text>
            {seasonLine ? (
              <Text
                style={[
                  showCardStyles.season,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {seasonLine}
              </Text>
            ) : null}
            {metaParts.length > 0 && (
              <Text
                style={[
                  showCardStyles.meta,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {metaParts.join(" · ")}
              </Text>
            )}
            <View style={cardStyles.footer}>
              <View style={cardStyles.authorRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={isMine ? "rgba(255,255,255,0.55)" : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  秀场
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  查看
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.colors.gray200}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (brandCard) {
      const infoParts = [brandCard.country, brandCard.category].filter(Boolean);
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handleBrandCardPress}
          activeOpacity={0.7}
        >
          {brandCard.imageUrl ? (
            <OptimizedImage
              uri={brandCard.imageUrl}
              size={ImageSize.MEDIUM}
              style={cardStyles.image}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[cardStyles.image, brandCardStyles.placeholder]}>
              <Text style={[brandCardStyles.initial, isMine && brandCardStyles.initialMine]}>
                {brandCard.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={cardStyles.body}>
            <Text
              style={[
                cardStyles.title,
                isMine ? cardStyles.titleMine : cardStyles.titleOther,
              ]}
              numberOfLines={2}
            >
              {brandCard.name}
            </Text>
            {infoParts.length > 0 && (
              <Text
                style={[
                  brandCardStyles.info,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {infoParts.join(" · ")}
              </Text>
            )}
            {brandCard.founder && (
              <Text
                style={[
                  brandCardStyles.founder,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {brandCard.founder}
              </Text>
            )}
            <View style={cardStyles.footer}>
              <View style={cardStyles.authorRow}>
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={isMine ? "rgba(255,255,255,0.55)" : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  品牌
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  查看
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.colors.gray200}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (storeCard) {
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handleStoreCardPress}
          activeOpacity={0.7}
        >
          {storeCard.imageUrl ? (
            <OptimizedImage
              uri={storeCard.imageUrl}
              size={ImageSize.MEDIUM}
              style={cardStyles.image}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[cardStyles.image, storeCardStyles.placeholder]}>
              <Ionicons
                name="storefront-outline"
                size={36}
                color={isMine ? "rgba(255,255,255,0.3)" : theme.colors.gray200}
              />
            </View>
          )}
          <View style={cardStyles.body}>
            <Text
              style={[
                cardStyles.title,
                isMine ? cardStyles.titleMine : cardStyles.titleOther,
              ]}
              numberOfLines={2}
            >
              {storeCard.name}
            </Text>
            <View style={storeCardStyles.meta}>
              <Text
                style={[
                  storeCardStyles.location,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {storeCard.city}, {storeCard.country}
              </Text>
              {(storeCard.rating ?? 0) > 0 && (
                <HalfStarRating
                  rating={storeCard.rating!}
                  size={12}
                  color="#FFB800"
                  inactiveColor={isMine ? "rgba(255,255,255,0.2)" : theme.colors.gray100}
                />
              )}
            </View>
            {storeCard.styles && storeCard.styles.length > 0 && (
              <View style={storeCardStyles.tagsRow}>
                {storeCard.styles.map((tag) => (
                  <View
                    key={tag}
                    style={[
                      storeCardStyles.tag,
                      isMine ? storeCardStyles.tagMine : storeCardStyles.tagOther,
                    ]}
                  >
                    <Text
                      style={[
                        storeCardStyles.tagText,
                        isMine ? storeCardStyles.tagTextMine : storeCardStyles.tagTextOther,
                      ]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={cardStyles.footer}>
              <View style={cardStyles.authorRow}>
                <Ionicons
                  name="storefront-outline"
                  size={14}
                  color={isMine ? "rgba(255,255,255,0.55)" : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  买手店
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  查看
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.colors.gray200}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (postCard) {
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handlePostCardPress}
          activeOpacity={0.7}
        >
          {postCard.imageUrl && (
            <OptimizedImage
              uri={postCard.imageUrl}
              size={ImageSize.MEDIUM}
              style={cardStyles.image}
              contentFit="cover"
              lazy
            />
          )}
          <View style={cardStyles.body}>
            <Text
              style={[
                cardStyles.title,
                isMine ? cardStyles.titleMine : cardStyles.titleOther,
              ]}
              numberOfLines={2}
            >
              {postCard.title || "帖子分享"}
            </Text>
            <View style={cardStyles.footer}>
              <View style={cardStyles.authorRow}>
                <UserAvatar
                  uri={postCard.authorAvatar}
                  name={postCard.authorName}
                  size={18}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {postCard.authorName}
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  查看
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.colors.gray200}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
          ]}
        >
          {message.content}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.messageWrapper}>
      {showTime && (
        <DateSeparator dateStr={formatMessageTime(message.createdAt)} />
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={canReport ? () => setShowMenu(true) : undefined}
        delayLongPress={400}
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        {!isMine && (
          <View style={styles.senderAvatarContainer}>
            <UserAvatar
              uri={message.senderAvatar}
              name={message.senderName}
              size={36}
            />
          </View>
        )}

        <View style={isMine ? styles.bubbleGroupRight : styles.bubbleGroupLeft}>
          {!isMine && message.senderTitle ? (
            <View style={titleStyles.badge}>
              <Text style={titleStyles.badgeText}>{message.senderTitle}</Text>
            </View>
          ) : null}
          {renderContent()}
        </View>
      </TouchableOpacity>

      <ActionSheet
        visible={showMenu}
        actions={menuActions}
        onClose={() => setShowMenu(false)}
      />
    </View>
  );
};

const titleStyles = StyleSheet.create({
  badge: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    width: 220,
  },
  containerMine: {
    backgroundColor: theme.colors.black,
  },
  containerOther: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  image: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.gray100,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  titleMine: {
    color: theme.colors.white,
  },
  titleOther: {
    color: theme.colors.black,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  authorName: {
    fontSize: 12,
    flex: 1,
  },
  textMuted: {
    color: "rgba(255,255,255,0.55)",
  },
  textSubtle: {
    color: theme.colors.gray200,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

const storeCardStyles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  location: {
    fontSize: 12,
    flex: 1,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagMine: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tagOther: {
    backgroundColor: theme.colors.gray50,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
  },
  tagTextMine: {
    color: "rgba(255,255,255,0.7)",
  },
  tagTextOther: {
    color: theme.colors.gray400,
  },
});

const brandCardStyles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
  },
  initial: {
    fontSize: 36,
    fontWeight: "300",
    color: theme.colors.gray300,
    letterSpacing: 2,
  },
  initialMine: {
    color: "rgba(255,255,255,0.3)",
  },
  info: {
    fontSize: 12,
  },
  founder: {
    fontSize: 11,
    fontStyle: "italic",
  },
});

const showCardStyles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
  },
  season: {
    fontSize: 12,
  },
  meta: {
    fontSize: 11,
    fontStyle: "italic",
  },
});
