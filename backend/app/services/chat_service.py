"""
Chat service - handles conversation and message business logic
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.db.supabase import get_supabase
from app.services.moderation_service import moderation_service
from app.schemas.chat import (
    MessageResponse,
    ConversationResponse,
    ConversationParticipant,
)

logger = logging.getLogger(__name__)


class BlockedUserError(Exception):
    """Raised when a message is rejected due to a block relationship."""
    pass


class ChatService:
    def __init__(self):
        self.db = get_supabase()

    def _get_user_brief(self, user_id: int) -> Dict[str, Any]:
        """Fetch username and avatar for a user."""
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
        return {
            "id": user.get("id", user_id),
            "username": user.get("username", ""),
            "avatar_url": avatar,
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

        conv_result = (
            self.db.table("conversations")
            .insert({"last_message_text": None, "last_message_at": None})
            .execute()
        )
        conv_id = conv_result.data[0]["id"]

        self.db.table("conversation_participants").insert([
            {"conversation_id": conv_id, "user_id": user_id},
            {"conversation_id": conv_id, "user_id": target_user_id},
        ]).execute()

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

            results.append(ConversationResponse(
                id=conv_id,
                participants=participants,
                lastMessageText=conv.get("last_message_text"),
                lastMessageAt=conv.get("last_message_at"),
                unreadCount=unread,
                otherUser=other_user,
                updatedAt=conv.get("updated_at", conv.get("created_at", "")),
            ))

        return results

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
    ) -> Optional[MessageResponse]:
        """Send a message in a conversation."""
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

        return MessageResponse(
            id=msg["id"],
            conversationId=msg["conversation_id"],
            senderId=sender_id,
            senderName=sender["username"],
            senderAvatar=sender.get("avatar_url"),
            content=msg["content"],
            messageType=msg.get("message_type", "text"),
            createdAt=msg["created_at"],
            isDeleted=False,
            isMine=True,
        )

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
