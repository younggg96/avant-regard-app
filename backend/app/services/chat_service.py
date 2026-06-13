"""
Chat service - handles conversation and message business logic
"""

import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from app.db.supabase import get_supabase, get_supabase_admin
from app.services.moderation_service import moderation_service
from app.schemas.chat import (
    MessageResponse,
    ConversationResponse,
    ConversationParticipant,
    TradeContext,
)

logger = logging.getLogger(__name__)

# 触发「交易」归类的富媒体卡片类型：订单 / 出价 / 售后 / 商品 / 各类分享卡片。
# 出现其中任意一种消息，会话即被视为「交易 / 帖子 / 活动相关」，
# 在互动页归入「交易」tab（而非「私信」）。与前端 chatService 保持一致。
_TRADE_CARD_TYPES = (
    "order_status",
    "offer",
    "dispute",
    "product_listing",
    "post_card",
    "store_card",
    "brand_card",
    "show_card",
)


class BlockedUserError(Exception):
    """Raised when a message is rejected due to a block relationship."""
    pass


# Human-readable previews for card-type chat messages. Keep these labels in sync
# with the frontend (`frontend/src/screens/Interaction/utils.ts#formatLastMessage`)
# so notifications, push payloads, and conversation previews stay consistent.
_CARD_TYPE_LABELS: Dict[str, str] = {
    "post_card": "[帖子分享]",
    "store_card": "[店铺分享]",
    "brand_card": "[品牌分享]",
    "show_card": "[秀场分享]",
    "user_card": "[名片分享]",
    "product_listing": "[商品]",
    "offer": "[出价]",
    "order_status": "[订单]",
    "dispute": "[售后]",
    "image": "[图片]",
}


def _infer_card_type(parsed: Dict[str, Any]) -> Optional[str]:
    """Guess card type from JSON payload when message_type is missing or 'text'."""
    if isinstance(parsed.get("postId"), str):
        return "post_card"
    if isinstance(parsed.get("storeId"), str):
        return "store_card"
    if isinstance(parsed.get("brandId"), int):
        return "brand_card"
    if isinstance(parsed.get("showId"), str):
        return "show_card"
    if isinstance(parsed.get("userId"), int) and isinstance(parsed.get("username"), str):
        return "user_card"
    if isinstance(parsed.get("disputeId"), int):
        return "dispute"
    if isinstance(parsed.get("offerId"), int):
        return "offer"
    if isinstance(parsed.get("orderId"), int) and isinstance(parsed.get("orderNo"), str):
        return "order_status"
    if isinstance(parsed.get("productId"), int) and isinstance(parsed.get("title"), str):
        return "product_listing"
    return None


def format_chat_message_preview(content: str, message_type: str = "text") -> str:
    """Return a human-readable preview for a chat message.

    Card-type messages store their payload as a JSON string in `content`; showing
    that raw JSON in a notification or list preview is not useful, so we fall back
    to a localized label (e.g. "[帖子分享]"). Plain text messages are returned as-is.
    """
    label = _CARD_TYPE_LABELS.get(message_type)
    if not label and content.strip().startswith("{"):
        try:
            parsed = json.loads(content)
        except (ValueError, TypeError):
            parsed = None
        if isinstance(parsed, dict):
            inferred = _infer_card_type(parsed)
            if inferred:
                label = _CARD_TYPE_LABELS.get(inferred)
    if label:
        title = _extract_card_title(content)
        return f"{label} {title}" if title else label
    return content or ""


def _extract_card_title(content: str) -> Optional[str]:
    """Pull a short title out of a card JSON payload, if present."""
    if not content:
        return None
    try:
        parsed = json.loads(content)
    except (ValueError, TypeError):
        return None
    if not isinstance(parsed, dict):
        return None
    for key in ("title", "name", "brandName", "username", "orderNo", "reason"):
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    product = parsed.get("product")
    if isinstance(product, dict):
        title = product.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()
    return None


class ChatService:
    def __init__(self):
        self.db = get_supabase_admin()

    def _get_user_brief(self, user_id: int) -> Dict[str, Any]:
        """Fetch username, avatar, and primary title for a user."""
        try:
            result = (
                self.db.table("users")
                .select("id, username")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            user = result.data or {}
        except Exception:
            user = {}
        avatar = None
        try:
            info_result = (
                self.db.table("user_info")
                .select("avatar_url")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if info_result.data:
                avatar = info_result.data.get("avatar_url")
        except Exception:
            pass
        primary_title = None
        try:
            title_result = (
                self.db.table("user_titles")
                .select("title")
                .eq("user_id", user_id)
                .eq("is_primary", True)
                .limit(1)
                .execute()
            )
            if title_result.data:
                primary_title = title_result.data[0]["title"]
        except Exception:
            pass
        return {
            "id": user.get("id", user_id),
            "username": user.get("username", ""),
            "avatar_url": avatar,
            "primary_title": primary_title,
        }

    def find_existing_conversation(self, user_id: int, target_user_id: int) -> Optional[int]:
        """Find an existing 1-on-1 conversation between two users."""
        my_convs = (
            self.db.table("conversation_participants")
            .select("conversation_id")
            .eq("user_id", user_id)
            .execute()
        )
        if not my_convs.data:
            return None

        my_conv_ids = [r["conversation_id"] for r in my_convs.data]

        for conv_id in my_conv_ids:
            participants = (
                self.db.table("conversation_participants")
                .select("user_id")
                .eq("conversation_id", conv_id)
                .execute()
            )
            if participants.data and len(participants.data) == 2:
                user_ids = {p["user_id"] for p in participants.data}
                if user_ids == {user_id, target_user_id}:
                    return conv_id
        return None

    def create_conversation(self, user_id: int, target_user_id: int) -> int:
        """Create a new 1-on-1 conversation, or return existing one."""
        existing = self.find_existing_conversation(user_id, target_user_id)
        if existing:
            return existing

        # 不传显式 null, 避免部分 PostgREST 版本对 NULL 列 insert 异常。
        conv_result = self.db.table("conversations").insert({}).execute()
        if not conv_result.data:
            raise RuntimeError("Failed to create conversation row")
        conv_id = conv_result.data[0]["id"]

        part_result = self.db.table("conversation_participants").insert([
            {"conversation_id": conv_id, "user_id": user_id},
            {"conversation_id": conv_id, "user_id": target_user_id},
        ]).execute()
        if not part_result.data:
            # 参与者写入失败时清理孤儿会话, 避免留下空 conversation。
            try:
                self.db.table("conversations").delete().eq("id", conv_id).execute()
            except Exception:
                pass
            raise RuntimeError("Failed to add conversation participants")

        return conv_id

    def get_conversations(self, user_id: int) -> List[ConversationResponse]:
        """Get all conversations for a user, ordered by last activity."""
        my_convs = (
            self.db.table("conversation_participants")
            .select("conversation_id, last_read_at")
            .eq("user_id", user_id)
            .execute()
        )
        if not my_convs.data:
            return []

        conv_read_map = {
            r["conversation_id"]: r["last_read_at"] for r in my_convs.data
        }
        conv_ids = list(conv_read_map.keys())

        conversations = (
            self.db.table("conversations")
            .select("*")
            .in_("id", conv_ids)
            .order("last_message_at", desc=True, nullsfirst=False)
            .execute()
        )

        results = []
        blocked_ids = set(moderation_service.get_blocked_user_ids(user_id))
        blocked_by_ids = self._get_users_who_blocked(user_id)
        all_blocked = blocked_ids | blocked_by_ids

        for conv in conversations.data or []:
            conv_id = conv["id"]
            participants_data = (
                self.db.table("conversation_participants")
                .select("user_id")
                .eq("conversation_id", conv_id)
                .execute()
            )
            participants = []
            other_user = None
            skip = False
            for p in participants_data.data or []:
                uid = p["user_id"]
                brief = self._get_user_brief(uid)
                participant = ConversationParticipant(
                    userId=uid,
                    username=brief["username"],
                    avatarUrl=brief["avatar_url"],
                    primaryTitle=brief.get("primary_title"),
                )
                participants.append(participant)
                if uid != user_id:
                    other_user = participant
                    if uid in all_blocked:
                        skip = True

            if skip:
                continue

            last_read = conv_read_map.get(conv_id)
            unread = 0
            if last_read:
                unread_result = (
                    self.db.table("messages")
                    .select("id", count="exact")
                    .eq("conversation_id", conv_id)
                    .neq("sender_id", user_id)
                    .gt("created_at", last_read)
                    .eq("is_deleted", False)
                    .execute()
                )
                unread = unread_result.count or 0
            elif conv.get("last_message_at"):
                unread_result = (
                    self.db.table("messages")
                    .select("id", count="exact")
                    .eq("conversation_id", conv_id)
                    .neq("sender_id", user_id)
                    .eq("is_deleted", False)
                    .execute()
                )
                unread = unread_result.count or 0

            my_msg_result = (
                self.db.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", conv_id)
                .eq("sender_id", user_id)
                .eq("is_deleted", False)
                .execute()
            )
            my_message_count = my_msg_result.count or 0

            trade_context = self._derive_trade_context(conv_id, user_id)

            results.append(ConversationResponse(
                id=conv_id,
                participants=participants,
                lastMessageText=conv.get("last_message_text"),
                lastMessageAt=conv.get("last_message_at"),
                unreadCount=unread,
                myMessageCount=my_message_count,
                otherUser=other_user,
                updatedAt=conv.get("updated_at", conv.get("created_at", "")),
                tradeContext=trade_context,
            ))

        return results

    def _derive_trade_context(
        self, conversation_id: int, user_id: int
    ) -> Optional[TradeContext]:
        """根据会话内最近一张交易 / 分享卡片，推导会话的交易上下文。

        用途：互动页据此把会话归入「交易」tab，并在列表行直接展示商品封面图、
        对端角色（买家 / 卖家）与订单状态——无需用户点开会话。

        实现说明：
          - 仅查最近一条「卡片类」消息（1 次查询），避免拉全量历史；
          - 封面图直接取卡片 payload 里的 ``product.coverImage``，零额外查询；
          - 角色 / 订单状态需要区分买卖双方，故对 order_status / offer 卡片
            分别查 ``orders`` / ``offers`` 表（仅交易会话才会触发，成本可控）；
          - 任意环节异常都吞掉并返回 None，会话退化为普通私信，绝不阻断列表。
        """
        try:
            res = (
                self.db.table("messages")
                .select("content, message_type")
                .eq("conversation_id", conversation_id)
                .eq("is_deleted", False)
                .in_("message_type", list(_TRADE_CARD_TYPES))
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception:
            return None

        if not res.data:
            return None

        row = res.data[0]
        kind = row.get("message_type")
        payload = self._safe_json(row.get("content"))

        cover = None
        if isinstance(payload, dict):
            product = payload.get("product")
            if isinstance(product, dict):
                cover = product.get("coverImage") or product.get("image")

        counterpart_role: Optional[str] = None
        order_status: Optional[str] = None

        try:
            if kind in ("order_status", "dispute") and isinstance(payload, dict):
                counterpart_role, order_status = self._order_role_and_status(
                    payload.get("orderId"), user_id
                )
            elif kind == "offer" and isinstance(payload, dict):
                counterpart_role = self._offer_counterpart_role(
                    payload.get("offerId"), payload.get("productId"), user_id
                )
            elif isinstance(payload, dict) and payload.get("productId"):
                counterpart_role = self._product_owner_role(
                    payload.get("productId"), user_id
                )
        except Exception:
            counterpart_role = None
            order_status = None

        return TradeContext(
            isTrade=True,
            coverImage=cover,
            counterpartRole=counterpart_role,
            orderStatus=order_status,
            kind=kind,
        )

    @staticmethod
    def _safe_json(content: Optional[str]) -> Any:
        if not content:
            return None
        try:
            return json.loads(content)
        except (ValueError, TypeError):
            return None

    @classmethod
    def _extract_card_cover(cls, content: Optional[str]) -> Optional[str]:
        """从 trade card 的 JSON content 里取商品封面,供通知缩略图使用。"""
        payload = cls._safe_json(content)
        if isinstance(payload, dict):
            product = payload.get("product")
            if isinstance(product, dict):
                return product.get("coverImage") or product.get("image")
        return None

    def _order_role_and_status(
        self, order_id: Any, user_id: int
    ) -> Tuple[Optional[str], Optional[str]]:
        """根据订单买卖双方判定对端角色 + 返回订单实时状态。

        返回 (counterpart_role, order_status)：
          - 我是卖家 → 对端是买家 ("buyer")
          - 我是买家 → 对端是卖家 ("seller")
          - 两侧都附带订单实时 status：列表行的角标和「最后一条消息」预览
            都要用实时状态覆盖卡片 content 里发送时刻的状态快照
            （如支付后那张 pending_payment 卡，要显示成「待发货」）。
        """
        if not order_id:
            return None, None
        res = (
            self.db.table("orders")
            .select("buyer_user_id, seller_user_id, seller_merchant_id, status")
            .eq("id", order_id)
            .maybe_single()
            .execute()
        )
        order = res.data or {}
        if not order:
            return None, None
        buyer_id = order.get("buyer_user_id")
        seller_id = order.get("seller_user_id") or self._merchant_user_id(
            order.get("seller_merchant_id")
        )
        if user_id == seller_id:
            return "buyer", order.get("status")
        if user_id == buyer_id:
            return "seller", order.get("status")
        return None, None

    def _offer_counterpart_role(
        self, offer_id: Any, product_id: Any, user_id: int
    ) -> Optional[str]:
        """出价卡片：优先用 offers 表的买卖 user_id 判角色，兜底用商品归属。"""
        if offer_id:
            res = (
                self.db.table("offers")
                .select("buyer_user_id, seller_user_id")
                .eq("id", offer_id)
                .maybe_single()
                .execute()
            )
            offer = res.data or {}
            if offer:
                if user_id == offer.get("seller_user_id"):
                    return "buyer"
                if user_id == offer.get("buyer_user_id"):
                    return "seller"
        return self._product_owner_role(product_id, user_id)

    def _product_owner_role(self, product_id: Any, user_id: int) -> Optional[str]:
        """商品 / 分享卡片：商品归属者即卖家。我是卖家→对端买家；否则对端卖家。"""
        if not product_id:
            return None
        try:
            res = (
                self.db.table("store_products")
                .select("seller_user_id, merchant_id")
                .eq("id", product_id)
                .maybe_single()
                .execute()
            )
        except Exception:
            return None
        product = res.data or {}
        if not product:
            return None
        owner_id = product.get("seller_user_id") or self._merchant_user_id(
            product.get("merchant_id")
        )
        if owner_id is None:
            return None
        return "buyer" if user_id == owner_id else "seller"

    def _merchant_user_id(self, merchant_id: Any) -> Optional[int]:
        """买手店卖家 → 取 merchant.user_id（与 order_service 口径一致）。"""
        if not merchant_id:
            return None
        try:
            from app.services.store_merchant_service import store_merchant_service
            merchant = store_merchant_service.get_merchant_by_id(merchant_id)
            if merchant:
                return getattr(merchant, "userId", None)
        except Exception:
            return None
        return None

    def get_messages(
        self,
        conversation_id: int,
        user_id: int,
        limit: int = 50,
        before_id: Optional[int] = None,
    ) -> List[MessageResponse]:
        """Get messages for a conversation (paginated)."""
        if not self._is_participant(conversation_id, user_id):
            return []

        query = (
            self.db.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if before_id:
            query = query.lt("id", before_id)

        result = query.execute()
        messages = []
        user_cache: Dict[int, Dict] = {}

        for msg in reversed(result.data or []):
            sid = msg["sender_id"]
            if sid not in user_cache:
                user_cache[sid] = self._get_user_brief(sid)
            sender = user_cache[sid]

            messages.append(MessageResponse(
                id=msg["id"],
                conversationId=msg["conversation_id"],
                senderId=sid,
                senderName=sender["username"],
                senderAvatar=sender.get("avatar_url"),
                senderTitle=sender.get("primary_title"),
                content=msg["content"],
                messageType=msg.get("message_type", "text"),
                createdAt=msg["created_at"],
                isDeleted=msg.get("is_deleted", False),
                isMine=(sid == user_id),
            ))

        return messages

    def send_message(
        self,
        conversation_id: int,
        sender_id: int,
        content: str,
        message_type: str = "text",
        *,
        send_push: bool = False,
        push_title: Optional[str] = None,
        push_navigate_to: Optional[str] = None,
        push_navigate_params: Optional[Dict[str, Any]] = None,
    ) -> Optional[MessageResponse]:
        """Send a message in a conversation.

        ``send_push=True`` 时同步给对端发一条 Expo push 通知（用 ``format_chat_message_preview``
        生成 body），并把整条记录写入 in-app `notifications` 表，方便对方在通知列表里看到。
        默认 ``push_navigate_to="Chat"`` —— 点击通知直达本会话。
        程序化发送 trade card（订单 / 出价 / 售后等）请显式传 ``send_push=True``，
        与用户手动发文字消息保持一致的触达体验。
        """
        if not self._is_participant(conversation_id, sender_id):
            return None

        other_id = self._get_other_participant(conversation_id, sender_id)
        if other_id:
            if moderation_service.is_blocked(sender_id, other_id) or \
               moderation_service.is_blocked(other_id, sender_id):
                raise BlockedUserError("无法发送消息")

        result = (
            self.db.table("messages")
            .insert({
                "conversation_id": conversation_id,
                "sender_id": sender_id,
                "content": content,
                "message_type": message_type,
            })
            .execute()
        )

        if not result.data:
            return None

        msg = result.data[0]
        sender = self._get_user_brief(sender_id)

        if send_push and other_id and other_id != sender_id:
            self._dispatch_message_push(
                recipient_id=other_id,
                sender_id=sender_id,
                sender_username=sender.get("username") or "",
                conversation_id=conversation_id,
                content=content,
                message_type=message_type,
                push_title=push_title,
                push_navigate_to=push_navigate_to,
                push_navigate_params=push_navigate_params,
            )

        return MessageResponse(
            id=msg["id"],
            conversationId=msg["conversation_id"],
            senderId=sender_id,
            senderName=sender["username"],
            senderAvatar=sender.get("avatar_url"),
            senderTitle=sender.get("primary_title"),
            content=msg["content"],
            messageType=msg.get("message_type", "text"),
            createdAt=msg["created_at"],
            isDeleted=False,
            isMine=True,
        )

    def _dispatch_message_push(
        self,
        *,
        recipient_id: int,
        sender_id: int,
        sender_username: str,
        conversation_id: int,
        content: str,
        message_type: str,
        push_title: Optional[str],
        push_navigate_to: Optional[str],
        push_navigate_params: Optional[Dict[str, Any]],
    ) -> None:
        """把一条 trade card / 系统消息推送到对端（in-app + Expo push）。失败静默。

        注意：本方法在 ``chat_service`` 内引用 ``notification_service``（反向方向 OK）；
        为避免顶层循环依赖，函数体内延迟 import。
        """
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType

            preview = format_chat_message_preview(content, message_type)
            navigate_to = push_navigate_to or "Chat"
            navigate_params = push_navigate_params or {"conversationId": conversation_id}
            title = push_title or (sender_username or "新消息")
            action_data: Dict[str, Any] = {
                "user_id": sender_id,
                "navigateTo": navigate_to,
                "navigateParams": navigate_params,
                "conversationId": conversation_id,
                "messageType": message_type,
            }
            # trade card(offer / order_status / dispute…)的 content 是带商品摘要的
            # JSON;把商品封面提出来作为通知缩略图(postImage),让交易类通知列表
            # 显示对应单品图片,而不是回落到彩色图标。
            cover = self._extract_card_cover(content)
            if cover:
                action_data["postImage"] = cover
            notification_service.create_notification(
                user_id=recipient_id,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=(preview or "")[:120],
                action_data=action_data,
                send_push=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("dispatch_message_push failed: %s", e)

    def mark_conversation_read(self, conversation_id: int, user_id: int) -> bool:
        """Mark all messages in a conversation as read for a user."""
        result = (
            self.db.table("conversation_participants")
            .update({"last_read_at": datetime.utcnow().isoformat()})
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def mark_conversation_unread(self, conversation_id: int, user_id: int) -> bool:
        """Reset last_read_at so the conversation appears unread."""
        result = (
            self.db.table("conversation_participants")
            .update({"last_read_at": "2000-01-01T00:00:00"})
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def delete_conversation(self, conversation_id: int, user_id: int) -> bool:
        """Delete a conversation: remove participant row; if no participants left, remove conv + messages."""
        if not self._is_participant(conversation_id, user_id):
            return False

        self.db.table("conversation_participants") \
            .delete() \
            .eq("conversation_id", conversation_id) \
            .eq("user_id", user_id) \
            .execute()

        remaining = (
            self.db.table("conversation_participants")
            .select("id", count="exact")
            .eq("conversation_id", conversation_id)
            .execute()
        )
        if (remaining.count or 0) == 0:
            self.db.table("messages") \
                .delete() \
                .eq("conversation_id", conversation_id) \
                .execute()
            self.db.table("conversations") \
                .delete() \
                .eq("id", conversation_id) \
                .execute()

        return True

    def delete_conversations_batch(self, conversation_ids: list[int], user_id: int) -> list[int]:
        """Delete multiple conversations at once. Returns list of successfully deleted ids."""
        deleted = []
        for cid in conversation_ids:
            if self.delete_conversation(cid, user_id):
                deleted.append(cid)
        return deleted

    def delete_message(self, message_id: int, user_id: int) -> Optional[int]:
        """Soft-delete a single message.

        只有消息的发送者本人可以删除自己发出的那条消息（与微信 / 闲鱼的「删除」
        语义一致）。采用软删除（``is_deleted=True``）而非物理删除，方便审计 / 举报
        留痕，``get_messages`` 已经按 ``is_deleted=False`` 过滤，所以删除后双方都
        不会再拉到这条记录。

        返回该消息所属的 ``conversation_id``（用于 WS 广播给对端），无权限或不存在
        时返回 ``None``。
        """
        result = (
            self.db.table("messages")
            .select("id, sender_id, conversation_id")
            .eq("id", message_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None

        msg = result.data
        if msg["sender_id"] != user_id:
            return None

        conversation_id = msg["conversation_id"]
        if not self._is_participant(conversation_id, user_id):
            return None

        self.db.table("messages") \
            .update({"is_deleted": True}) \
            .eq("id", message_id) \
            .execute()

        return conversation_id

    def get_total_unread_count(self, user_id: int) -> int:
        """Get total unread message count across all conversations."""
        conversations = self.get_conversations(user_id)
        return sum(c.unreadCount for c in conversations)

    def _is_participant(self, conversation_id: int, user_id: int) -> bool:
        """Check if a user is a participant of a conversation."""
        result = (
            self.db.table("conversation_participants")
            .select("id")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data is not None

    def _get_other_participant(self, conversation_id: int, user_id: int) -> Optional[int]:
        """Get the other participant's user_id in a 1-on-1 conversation."""
        result = (
            self.db.table("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conversation_id)
            .neq("user_id", user_id)
            .execute()
        )
        if result.data and len(result.data) == 1:
            return result.data[0]["user_id"]
        return None

    def _get_users_who_blocked(self, user_id: int) -> set:
        """Get set of user IDs who have blocked the given user."""
        result = (
            self.db.table("user_blocks")
            .select("blocker_id")
            .eq("blocked_id", user_id)
            .execute()
        )
        return {r["blocker_id"] for r in result.data or []}

    # ===================== Auto-Reply =====================

    @staticmethod
    def _default_auto_reply_config() -> dict:
        return {
            "enabled": True,
            "message": (
                "您好，感谢您联系 Avant Regard 客服！\n\n"
                "我们已收到您的消息，会尽快回复。\n"
                "如需紧急帮助，请发送邮件至：support@avantregard.com\n\n"
                "工作时间：周一至周五 9:00-18:00（北京时间）"
            ),
            "email": "support@avantregard.com",
        }

    def get_auto_reply_config(self) -> dict:
        """Get CS auto-reply configuration."""
        try:
            result = (
                self.db.table("app_config")
                .select("value")
                .eq("key", "cs_auto_reply")
                .maybe_single()
                .execute()
            )
            if result.data and result.data.get("value"):
                return result.data["value"]
        except Exception as e:
            logger.warning(f"Failed to load auto-reply config: {e}")
        return self._default_auto_reply_config()

    def set_auto_reply_config(self, config: dict) -> dict:
        """Update CS auto-reply configuration."""
        self.db.table("app_config").upsert(
            {"key": "cs_auto_reply", "value": config},
            on_conflict="key",
        ).execute()
        return config

    def _is_admin_user(self, user_id: int) -> bool:
        """Check if a user is an admin."""
        try:
            result = (
                self.db.table("users")
                .select("is_admin")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            return bool(result.data and result.data.get("is_admin"))
        except Exception:
            return False

    def _admin_has_messages(self, conversation_id: int, admin_id: int) -> bool:
        """Check if admin has already sent any message in a conversation."""
        try:
            result = (
                self.db.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", conversation_id)
                .eq("sender_id", admin_id)
                .eq("is_deleted", False)
                .limit(1)
                .execute()
            )
            return (result.count or 0) > 0
        except Exception:
            return True

    def send_auto_reply_if_needed(
        self, conversation_id: int, sender_id: int
    ) -> Optional[MessageResponse]:
        """Send auto-reply if the recipient is admin and hasn't replied yet."""
        other_id = self._get_other_participant(conversation_id, sender_id)
        if not other_id:
            return None

        if not self._is_admin_user(other_id):
            return None

        config = self.get_auto_reply_config()
        if not config.get("enabled"):
            return None

        if self._admin_has_messages(conversation_id, other_id):
            return None

        message_text = config.get("message", "").strip()
        if not message_text:
            return None

        try:
            return self.send_message(
                conversation_id=conversation_id,
                sender_id=other_id,
                content=message_text,
                message_type="text",
            )
        except BlockedUserError:
            return None
        except Exception as e:
            logger.warning(f"Failed to send auto-reply: {e}")
            return None


chat_service = ChatService()
