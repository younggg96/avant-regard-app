import type { TFunction } from "i18next";
import type { Conversation } from "../services/chatService";
import { isCustomerServiceUser } from "../constants/customerService";

export function getConversationChatParams(c: Conversation, t: TFunction) {
  const otherUserId = c.otherUser?.userId;
  const isCs = isCustomerServiceUser(otherUserId);

  return {
    conversationId: c.id,
    otherUserName: isCs
      ? t("interaction.csDisplayName")
      : (c.otherUser?.username || t("chat.title")),
    otherUserId,
  };
}

export function getCustomerServiceChatParams(
  conversationId: number,
  csUserId: number,
  t: TFunction,
) {
  return {
    conversationId,
    otherUserName: t("interaction.csDisplayName"),
    otherUserId: csUserId,
  };
}
