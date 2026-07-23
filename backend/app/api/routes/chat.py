"""
Chat routes - REST API + WebSocket for real-time messaging
"""

import asyncio
from typing import Optional, Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from app.schemas.chat import (
    CreateConversationRequest,
    SendMessageRequest,
    BatchDeleteConversationsRequest,
)
from app.services.chat_service import (
    chat_service,
    BlockedUserError,
    format_chat_message_preview,
)
from app.services.moderation_service import moderation_service
from app.services.notification_service import notification_service
from app.schemas.notification import NotificationType
from app.api.deps import get_current_user_id, decode_token_without_expiry
from app.core.response import success, error
from app.db.supabase import get_supabase
from app.services.auth_service import auth_service

router = APIRouter(prefix="/chat", tags=["Chat"])


# ======================= WebSocket Connection Manager =======================

class ConnectionManager:
    """Manages active WebSocket connections grouped by user_id."""

    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            dead = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0


manager = ConnectionManager()


def _get_broadcast_targets(conversation_id: int, sender_id: int) -> list:
    """查会话参与者并过滤拉黑关系。全是同步 DB 调用，调用方须放线程池执行。"""
    participants = (
        get_supabase()
        .table("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversation_id)
        .execute()
    )
    targets = []
    for p in participants.data or []:
        pid = p["user_id"]
        if pid == sender_id:
            continue
        if moderation_service.is_blocked(pid, sender_id) or \
           moderation_service.is_blocked(sender_id, pid):
            continue
        targets.append(pid)
    return targets


def _notify_offline_recipient(
    pid: int, sender_id: int, conversation_id: int, content: str, message_type: str
) -> None:
    """给不在线的接收者发推送通知。同步 DB/HTTP 调用，调用方须放线程池执行。"""
    sender_brief = chat_service._get_user_brief(sender_id)
    preview = format_chat_message_preview(content, message_type)
    notification_service.create_notification(
        user_id=pid,
        notification_type=NotificationType.SYSTEM,
        title=f"{sender_brief['username']} 发来了一条消息",
        message=preview[:100],
        action_data={
            "user_id": sender_id,
            "navigateTo": "Chat",
            "navigateParams": {"conversationId": conversation_id},
            "actor_name": sender_brief["username"],
            "actor_avatar": sender_brief.get("avatar_url"),
        },
        send_push=True,
    )


def _authenticate_ws_token(token: str) -> Optional[int]:
    """Authenticate a WebSocket connection using the same logic as REST deps."""
    try:
        db = get_supabase()
        try:
            response = db.auth.get_user(token)
            supabase_uid = response.user.id if response.user else None
        except Exception:
            supabase_uid = decode_token_without_expiry(token)

        if not supabase_uid:
            return None

        app_user = auth_service.get_user_by_supabase_uid(supabase_uid)
        if not app_user or app_user.get("status") != "ACTIVE":
            return None
        return app_user["id"]
    except Exception:
        return None


# ======================= WebSocket Endpoint =======================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time messaging.
    Connect with: ws://.../api/chat/ws?token=<access_token>

    Client sends JSON:
      {"type": "send_message", "conversation_id": 123, "content": "hello", "message_type": "text"}
      {"type": "mark_read", "conversation_id": 123}
      {"type": "ping"}

    Server pushes JSON:
      {"type": "new_message", "data": {...message...}}
      {"type": "message_sent", "data": {...message...}}
      {"type": "conversation_read", "conversation_id": 123}
      {"type": "pong"}
      {"type": "error", "message": "..."}
    """
    # 鉴权内部是同步 Supabase 调用，放线程池避免阻塞事件循环
    user_id = await asyncio.to_thread(_authenticate_ws_token, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "send_message":
                conv_id = data.get("conversation_id")
                content = data.get("content", "").strip()
                message_type = data.get("message_type", "text")

                if not conv_id or not content:
                    await websocket.send_json({"type": "error", "message": "Missing conversation_id or content"})
                    continue

                try:
                    msg = await asyncio.to_thread(
                        chat_service.send_message, conv_id, user_id, content, message_type
                    )
                except BlockedUserError:
                    await websocket.send_json({"type": "error", "message": "无法发送消息", "blocked": True})
                    continue
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})
                    continue

                if not msg:
                    await websocket.send_json({"type": "error", "message": "Failed to send message"})
                    continue

                msg_dict = msg.model_dump()
                await websocket.send_json({"type": "message_sent", "data": msg_dict})

                try:
                    targets = await asyncio.to_thread(
                        _get_broadcast_targets, conv_id, user_id
                    )
                    for pid in targets:
                        outgoing = msg.model_dump()
                        outgoing["isMine"] = False
                        await manager.send_to_user(pid, {"type": "new_message", "data": outgoing})

                        if not manager.is_online(pid):
                            try:
                                await asyncio.to_thread(
                                    _notify_offline_recipient,
                                    pid, user_id, conv_id, content, message_type,
                                )
                            except Exception as e:
                                print(f"Failed to send chat push notification: {e}")
                except Exception as e:
                    print(f"Failed to broadcast message to participants: {e}")

                # Auto-reply: if the recipient is admin and hasn't replied yet
                try:
                    auto_reply = await asyncio.to_thread(
                        chat_service.send_auto_reply_if_needed, conv_id, user_id
                    )
                    if auto_reply:
                        auto_reply_dict = auto_reply.model_dump()
                        auto_reply_dict["isMine"] = False
                        await websocket.send_json({"type": "new_message", "data": auto_reply_dict})
                except Exception as e:
                    print(f"Auto-reply error: {e}")

            elif msg_type == "mark_read":
                conv_id = data.get("conversation_id")
                if conv_id:
                    try:
                        await asyncio.to_thread(
                            chat_service.mark_conversation_read, conv_id, user_id
                        )
                    except Exception:
                        pass
                    await websocket.send_json({"type": "conversation_read", "conversation_id": conv_id})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)


# ======================= REST API Endpoints =======================

@router.get("/conversations")
def get_conversations(current_user_id: int = Depends(get_current_user_id)):
    """Get all conversations for the current user."""
    try:
        conversations = chat_service.get_conversations(current_user_id)
        return success([c.model_dump() for c in conversations])
    except Exception as e:
        print(f"Chat get_conversations error: {e}")
        return success([])


@router.post("/conversations")
def create_conversation(
    req: CreateConversationRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Create or find a 1-on-1 conversation with another user."""
    if req.target_user_id == current_user_id:
        return error(message="Cannot create conversation with yourself", code=400)

    try:
        target = get_supabase().table("users").select("id").eq("id", req.target_user_id).maybe_single().execute()
        if not target.data:
            return error(message="Target user not found", code=404)

        conv_id = chat_service.create_conversation(current_user_id, req.target_user_id)
        return success({"conversationId": conv_id})
    except Exception as e:
        print(f"Chat create_conversation error: {e}")
        return error(message="Chat service unavailable", code=500)


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    limit: int = Query(50, le=100),
    before_id: Optional[int] = Query(None),
    current_user_id: int = Depends(get_current_user_id),
):
    """Get messages for a conversation (paginated, newest first)."""
    try:
        messages = chat_service.get_messages(conversation_id, current_user_id, limit, before_id)
        return success([m.model_dump() for m in messages])
    except Exception as e:
        print(f"Chat get_messages error: {e}")
        return success([])


@router.post("/conversations/{conversation_id}/messages")
async def send_message_rest(
    conversation_id: int,
    req: SendMessageRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Send a message via REST (alternative to WebSocket)."""
    try:
        msg = await asyncio.to_thread(
            chat_service.send_message,
            conversation_id, current_user_id, req.content, req.message_type.value,
        )
        if not msg:
            return error(message="Failed to send message or not a participant", code=403)
    except BlockedUserError:
        return error(message="无法发送消息", code=403)
    except Exception as e:
        print(f"Chat send_message error: {e}")
        return error(message="Failed to send message", code=500)

    msg_dict = msg.model_dump()

    try:
        targets = await asyncio.to_thread(
            _get_broadcast_targets, conversation_id, current_user_id
        )
        for pid in targets:
            outgoing = msg.model_dump()
            outgoing["isMine"] = False
            await manager.send_to_user(pid, {"type": "new_message", "data": outgoing})
    except Exception as e:
        print(f"Failed to push message to WS clients: {e}")

    # Auto-reply: if the recipient is admin and hasn't replied yet
    try:
        auto_reply = await asyncio.to_thread(
            chat_service.send_auto_reply_if_needed, conversation_id, current_user_id
        )
        if auto_reply:
            auto_reply_dict = auto_reply.model_dump()
            auto_reply_dict["isMine"] = False
            await manager.send_to_user(current_user_id, {"type": "new_message", "data": auto_reply_dict})
    except Exception as e:
        print(f"Auto-reply error: {e}")

    return success(msg_dict)


@router.post("/conversations/{conversation_id}/read")
def mark_read(
    conversation_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Mark a conversation as read."""
    try:
        chat_service.mark_conversation_read(conversation_id, current_user_id)
        return success({"marked": True})
    except Exception as e:
        print(f"Chat mark_read error: {e}")
        return success({"marked": False})


@router.post("/conversations/{conversation_id}/unread")
def mark_unread(
    conversation_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Mark a conversation as unread."""
    try:
        chat_service.mark_conversation_unread(conversation_id, current_user_id)
        return success({"marked": True})
    except Exception as e:
        print(f"Chat mark_unread error: {e}")
        return success({"marked": False})


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete a conversation for the current user."""
    try:
        deleted = chat_service.delete_conversation(conversation_id, current_user_id)
        if not deleted:
            return error(message="Not a participant", code=403)
        return success({"deleted": True})
    except Exception as e:
        print(f"Chat delete_conversation error: {e}")
        return error(message="Failed to delete conversation", code=500)


@router.post("/conversations/batch-delete")
def batch_delete_conversations(
    req: BatchDeleteConversationsRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete multiple conversations at once."""
    try:
        deleted_ids = chat_service.delete_conversations_batch(
            req.conversation_ids, current_user_id
        )
        return success({"deletedIds": deleted_ids})
    except Exception as e:
        print(f"Chat batch_delete_conversations error: {e}")
        return error(message="Failed to delete conversations", code=500)


@router.get("/unread-count")
def get_unread_count(current_user_id: int = Depends(get_current_user_id)):
    """Get total unread message count across all conversations."""
    try:
        count = chat_service.get_total_unread_count(current_user_id)
        return success({"count": count})
    except Exception as e:
        print(f"Chat get_unread_count error: {e}")
        return success({"count": 0})
