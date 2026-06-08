import React from "react";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { CustomerServiceAvatar } from "../../../components/ui/CustomerServiceAvatar";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Conversation } from "../../../services/chatService";
import { isCustomerServiceUser } from "../../../constants/customerService";
import { formatTime, formatLastMessage } from "../utils";
import { useInteractionStyles } from "../styles";

interface TradingConversationRowProps {
  item: Conversation;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * 互动页「交易」tab 下的交易相关会话行。
 * 与 ConversationRow 同构：左侧保持对端用户的圆形头像（而非商品封面图），
 * 并在用户名旁展示「买家」/ 订单状态标识——让用户在点开会话前即可识别
 * 对端角色与进度。
 */
export const TradingConversationRow = ({
  item,
  onPress,
  onLongPress,
}: TradingConversationRowProps) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useInteractionStyles();

  const other = item.otherUser;
  const hasUnread = item.unreadCount > 0;
  const isCs = isCustomerServiceUser(other?.userId);
  const displayName = isCs
    ? t("interaction.csDisplayName")
    : other?.username || t("interaction.unknownUser");

  const trade = item.tradeContext;
  const role = trade?.counterpartRole;

  // 角色 / 状态标识：对端是买家 → 强调「买家」；我是买家 → 展示订单实时状态。
  const badge = (() => {
    if (role === "buyer") {
      return { text: t("interaction.buyerBadge"), emphasized: true };
    }
    if (role === "seller" && trade?.orderStatus) {
      return {
        text: t(`interaction.tradeStatus.${trade.orderStatus}`, {
          defaultValue: t("interaction.tradeStatusDefault"),
        }),
        emphasized: false,
      };
    }
    return null;
  })();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, hasUnread && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {isCs ? (
            <CustomerServiceAvatar size={48} />
          ) : (
            <UserAvatar uri={other?.avatarUrl} name={other?.username} size={48} />
          )}
          {hasUnread && (
            <NotificationBadge count={item.unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <HStack alignItems="center" flex={1} mr="$sm">
              <Text
                fontSize="$sm"
                fontWeight="$semibold"
                style={{ color: theme.colors.black }}
                numberOfLines={1}
                flexShrink={1}
              >
                {displayName}
              </Text>
              {badge ? (
                <Box
                  style={{
                    backgroundColor: badge.emphasized
                      ? `${theme.colors.accent}1A`
                      : theme.colors.gray100,
                  }}
                  px="$xs"
                  py={1}
                  rounded="$xs"
                  ml={4}
                  flexShrink={0}
                >
                  <Text
                    style={{
                      color: badge.emphasized
                        ? theme.colors.accent
                        : theme.colors.gray600,
                    }}
                    fontSize={9}
                    fontWeight="$medium"
                    numberOfLines={1}
                  >
                    {badge.text}
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <Text fontSize="$xs" style={{ color: theme.colors.gray200 }} flexShrink={0}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </HStack>
          <Text
            fontSize="$sm"
            numberOfLines={1}
            style={{ color: hasUnread ? theme.colors.black : theme.colors.gray300 }}
            fontWeight={hasUnread ? "$medium" : "$normal"}
          >
            {formatLastMessage(item.lastMessageText)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};
