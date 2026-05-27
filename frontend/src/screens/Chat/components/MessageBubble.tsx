import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { CustomerServiceAvatar } from "../../../components/ui/CustomerServiceAvatar";
import { isCustomerServiceUser } from "../../../constants/customerService";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import type { ActionSheetAction } from "../../../components/ui/ActionSheet";
import { Message } from "../../../services/chatService";
import { useAuthStore } from "../../../store/authStore";
import { PostSharePayload, StoreSharePayload, BrandSharePayload, ShowSharePayload, UserSharePayload } from "../../../components/ShareToChatModal";
import { formatMessageTime } from "../utils";
import { DateSeparator } from "./DateSeparator";
import { useChatStyles } from "../styles";
import HalfStarRating from "../../../components/HalfStarRating";
import {
  tryParseProductListingCard,
  tryParseOfferCard,
  tryParseOrderStatusCard,
  tryParseDisputeCard,
  ProductListingCardView,
  OfferCardView,
  OrderStatusCardView,
  DisputeCardView,
} from "./TradingCards";

interface MessageBubbleProps {
  message: Message;
  showTime: boolean;
  isLast: boolean;
  /** 当前会话对方的 userId。用于判定「这是不是客服会话」,
   * 进而决定订单卡片是否要展示客服退款按钮(避免 admin 在普通私聊里也看到退款按钮)。 */
  otherUserId?: number;
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

function tryParseUserCard(content: string): UserSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.userId === "number" && typeof parsed.username === "string") {
      return parsed;
    }
  } catch { }
  return null;
}

export const MessageBubble = ({
  message,
  showTime,
  isLast,
  otherUserId,
  onReportMessage,
  onReportUser,
}: MessageBubbleProps) => {
  const { t } = useTranslation();
  const isMine = message.isMine;
  const isCsSender = isCustomerServiceUser(message.senderId);
  const [showMenu, setShowMenu] = useState(false);
  const navigation = useNavigation();
  const styles = useChatStyles();
  const titleStyles = useThemedStyles(makeTitleStyles);
  const cardStyles = useThemedStyles(makeCardStyles);
  const storeCardStyles = useThemedStyles(makeStoreCardStyles);
  const brandCardStyles = useThemedStyles(makeBrandCardStyles);
  const showCardStyles = useThemedStyles(makeShowCardStyles);
  const userCardStyles = useThemedStyles(makeUserCardStyles);
  // 客服身份判定：必须同时满足
  //   1) 当前登录账号是 admin
  //   2) 当前会话对方是官方客服账号(CS_USER_ID)
  // 否则普通 admin 跟卖家私聊买东西时也会看到「退款」按钮,既越权又违反产品意图。
  // 仅在「客服窗口」里才允许客服触发主动退款,与 PRD 模块 7 IM 售后流程一致。
  const isAdmin = useAuthStore((s) => !!s.user?.is_admin);
  const isCsConversation = isCustomerServiceUser(otherUserId);
  const isCustomerService = isAdmin && isCsConversation;

  const canReport = !isMine && (onReportMessage || onReportUser);

  const isPostCard = message.messageType === "post_card";
  const postCard = isPostCard ? tryParsePostCard(message.content) : null;

  const isStoreCard = message.messageType === "store_card";
  const storeCard = isStoreCard ? tryParseStoreCard(message.content) : null;

  const isBrandCard = message.messageType === "brand_card";
  const brandCard = isBrandCard ? tryParseBrandCard(message.content) : null;

  const isShowCard = message.messageType === "show_card";
  const showCard = isShowCard ? tryParseShowCard(message.content) : null;

  const isUserCard = message.messageType === "user_card";
  const userCard = isUserCard ? tryParseUserCard(message.content) : null;

  const productListingCard =
    message.messageType === "product_listing"
      ? tryParseProductListingCard(message.content)
      : null;
  const offerCard =
    message.messageType === "offer" ? tryParseOfferCard(message.content) : null;
  const orderStatusCard =
    message.messageType === "order_status"
      ? tryParseOrderStatusCard(message.content)
      : null;
  const disputeCard =
    message.messageType === "dispute"
      ? tryParseDisputeCard(message.content)
      : null;

  const menuActions = useMemo<ActionSheetAction[]>(() => {
    const list: ActionSheetAction[] = [];
    if (onReportMessage) {
      list.push({
        label: t("chat.reportMessage"),
        icon: <Ionicons name="flag-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportMessage(message),
      });
    }
    if (onReportUser) {
      list.push({
        label: t("chat.reportUser"),
        icon: <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportUser(message),
      });
    }
    return list;
  }, [message, onReportMessage, onReportUser, t]);

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

  const handleUserCardPress = () => {
    if (!userCard) return;
    (navigation.navigate as any)("UserProfile", { userId: userCard.userId });
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
    if (productListingCard) {
      return (
        <ProductListingCardView
          data={productListingCard}
          isMine={isMine}
          onPress={() =>
            (navigation.navigate as any)("StoreProductDetail", {
              productId: productListingCard.productId,
            })
          }
        />
      );
    }
    if (offerCard) {
      return (
        <OfferCardView
          data={offerCard}
          isMine={isMine}
          onPress={() => (navigation.navigate as any)("MyOffers")}
        />
      );
    }
    // 普通 order_status 卡片(PENDING_PAYMENT / PAID / SHIPPED / REFUNDED…):
    // 按 message sender 走左 / 右气泡。终结里程碑(DELIVERED / COMPLETED /
    // SETTLED)走组件主 return 上方的居中分支,不会进入 renderContent。
    if (orderStatusCard) {
      return (
        <OrderStatusCardView
          data={orderStatusCard}
          isMine={isMine}
          isCustomerService={isCustomerService}
          onPress={() =>
            (navigation.navigate as any)("OrderDetail", {
              orderId: orderStatusCard.orderId,
            })
          }
          onPay={
            // pending_payment 卡的 Pay now 按钮:按"我是买家"判定。
            // 现在 pending_payment 是 seller → buyer,所以买家视角下 isMine=false。
            // 旧消息可能仍然是 buyer → seller(sender=buyer,isMine=true),
            // 两种情况都允许:status===pending_payment 时给两边都展示按钮,
            // 卖家点了会被后端 PermissionError 兜底,UX 上稍微宽松一些以兼容历史数据。
            orderStatusCard.status === "pending_payment"
              ? () =>
                  (navigation.navigate as any)("Payment", {
                    orderId: orderStatusCard.orderId,
                  })
              : undefined
          }
        />
      );
    }
    if (disputeCard) {
      return (
        <DisputeCardView
          data={disputeCard}
          isMine={isMine}
          onPress={() =>
            (navigation.navigate as any)("OrderDetail", {
              orderId: disputeCard.orderId,
            })
          }
        />
      );
    }
    if (userCard) {
      const metaParts = [userCard.primaryTitle, userCard.location].filter(Boolean) as string[];
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            userCardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handleUserCardPress}
          activeOpacity={0.7}
        >
          <View style={userCardStyles.body}>
            <UserAvatar
              uri={userCard.avatarUrl}
              name={userCard.username}
              size={52}
            />
            <View style={userCardStyles.info}>
              <Text
                style={[
                  cardStyles.title,
                  isMine ? cardStyles.titleMine : cardStyles.titleOther,
                ]}
                numberOfLines={1}
              >
                {userCard.username}
              </Text>
              {metaParts.length > 0 && (
                <Text
                  style={[
                    userCardStyles.meta,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {metaParts.join(" · ")}
                </Text>
              )}
              {userCard.bio ? (
                <Text
                  style={[
                    userCardStyles.bio,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={2}
                >
                  {userCard.bio}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[cardStyles.footer, userCardStyles.footer]}>
            <View style={cardStyles.authorRow}>
              <Ionicons
                name="person-outline"
                size={14}
                color={isMine ? `${theme.colors.textInverted}8C` : theme.colors.gray200}
              />
              <Text
                style={[
                  cardStyles.authorName,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
                numberOfLines={1}
              >
                {t("chat.userProfile")}
              </Text>
            </View>
            <View style={cardStyles.tapHint}>
              <Text
                style={[
                  cardStyles.tapHintText,
                  isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                ]}
              >
                {t("chat.view")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={isMine ? `${theme.colors.textInverted}80` : theme.colors.gray200}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

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
                color={isMine ? `${theme.colors.textInverted}4D` : theme.colors.gray200}
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
                  color={isMine ? `${theme.colors.textInverted}8C` : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {t("chat.showLabel")}
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  {t("chat.view")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? `${theme.colors.textInverted}80` : theme.colors.gray200}
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
                  color={isMine ? `${theme.colors.textInverted}8C` : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {t("chat.brandLabel")}
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  {t("chat.view")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? `${theme.colors.textInverted}80` : theme.colors.gray200}
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
          {storeCard.imageUrl && (
            <OptimizedImage
              uri={storeCard.imageUrl}
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
                  inactiveColor={isMine ? `${theme.colors.textInverted}33` : theme.colors.gray100}
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
                  color={isMine ? `${theme.colors.textInverted}8C` : theme.colors.gray200}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {t("chat.storeLabel")}
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  {t("chat.view")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? `${theme.colors.textInverted}80` : theme.colors.gray200}
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
              {postCard.title || t("chat.sharePost")}
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
                  {t("chat.view")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? `${theme.colors.textInverted}80` : theme.colors.gray200}
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

  // order_status 卡片渲染分两类:
  //   - DELIVERED / COMPLETED / SETTLED 是「交易终结里程碑」,后端只发 1 张,
  //     前端居中渲染成「系统提示卡」(无左右气泡 / 无头像 / 不区分 sender),
  //     和微信 / 闲鱼那种"已签收 / 已完成 / 已结算"的居中卡片一致。
  //   - PENDING_PAYMENT / PAID / SHIPPED / REFUNDED / REFUNDED_AUTO 是「双方
  //     轮流推动的对话事件」,后端固定方向只发 1 张,前端按 sender 决定
  //     左右气泡,跟普通消息一样。
  const isSystemOrderCard =
    !!orderStatusCard &&
    (orderStatusCard.status === "delivered" ||
      orderStatusCard.status === "completed" ||
      orderStatusCard.status === "settled");

  if (orderStatusCard && isSystemOrderCard) {
    return (
      <View style={styles.messageWrapper}>
        {showTime && (
          <DateSeparator dateStr={formatMessageTime(message.createdAt)} />
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={canReport ? () => setShowMenu(true) : undefined}
          delayLongPress={400}
          style={cardStyles.systemRow}
        >
          <View style={cardStyles.systemGroup}>
            <OrderStatusCardView
              data={orderStatusCard}
              isMine={false}
              isCustomerService={isCustomerService}
              onPress={() =>
                (navigation.navigate as any)("OrderDetail", {
                  orderId: orderStatusCard.orderId,
                })
              }
            />
          </View>
        </TouchableOpacity>

        <ActionSheet
          visible={showMenu}
          actions={menuActions}
          onClose={() => setShowMenu(false)}
        />
      </View>
    );
  }

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
            {isCsSender ? (
              <CustomerServiceAvatar size={36} />
            ) : (
              <UserAvatar
                uri={message.senderAvatar}
                name={message.senderName}
                size={36}
              />
            )}
          </View>
        )}

        <View style={isMine ? styles.bubbleGroupRight : styles.bubbleGroupLeft}>
          {!isMine && message.senderTitle && !isCsSender ? (
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

const makeTitleStyles = (t: AppTheme) => StyleSheet.create({
  badge: {
    backgroundColor: t.colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: t.colors.gray600,
  },
});

const makeCardStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    width: 220,
  },
  containerMine: {
    backgroundColor: t.colors.text,
  },
  containerOther: {
    backgroundColor: t.colors.card,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  image: {
    width: "100%",
    height: 140,
    backgroundColor: t.colors.gray100,
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
    color: t.colors.textInverted,
  },
  titleOther: {
    color: t.colors.text,
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
    color: `${t.colors.textInverted}8C`,
  },
  textSubtle: {
    color: t.colors.gray200,
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
  systemRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  systemGroup: {
    maxWidth: "82%",
    alignItems: "center",
  },
});

const makeStoreCardStyles = (t: AppTheme) => StyleSheet.create({
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
    backgroundColor: `${t.colors.textInverted}26`,
  },
  tagOther: {
    backgroundColor: t.colors.gray50,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
  },
  tagTextMine: {
    color: `${t.colors.textInverted}B3`,
  },
  tagTextOther: {
    color: t.colors.gray400,
  },
});

const makeBrandCardStyles = (t: AppTheme) => StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.gray50,
  },
  initial: {
    fontSize: 36,
    fontWeight: "300",
    color: t.colors.gray300,
    letterSpacing: 2,
  },
  initialMine: {
    color: `${t.colors.textInverted}4D`,
  },
  info: {
    fontSize: 12,
  },
  founder: {
    fontSize: 11,
    fontStyle: "italic",
  },
});

const makeShowCardStyles = (t: AppTheme) => StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.gray50,
  },
  season: {
    fontSize: 12,
  },
  meta: {
    fontSize: 11,
    fontStyle: "italic",
  },
});

const makeUserCardStyles = (_t: AppTheme) => StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  meta: {
    fontSize: 12,
  },
  bio: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  footer: {
    marginTop: 4,
  },
});
