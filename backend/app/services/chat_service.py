"""
Chat service - handles conversation and message business logic
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from app.db.supabase import get_supabase
from app.schemas.chat import (
    MessageResponse,
    ConversationResponse,
    ConversationParticipant,
)


class ChatService:
    def __init__(self):
        self.db = get_supabase()

    def _get_user_brief(self, user_id: int) -> Dict[str, Any]:
        """Fetch username and avatar for a user."""
        result = (
            self.db.table("users")
            .select("id, username")
            .eq("id", user_id)
            .single()
            .execute()
        )
        user = result.data or {}
        avatar = None
        info_result = (
            self.db.table("user_info")
            .select("avatar_url")
            .eq("user_id", user_id)
            .maybeSingle()
            .execute()
        )
        if info_result.data:
            avatar = info_result.data.get("avatar_url")
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
            .maybeSingle()
            .execute()
        )
        return result.data is not None


chat_service = ChatService()
