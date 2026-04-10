"""
Chat schemas - Pydantic models for chat/messaging
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    SYSTEM = "system"


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: MessageType = MessageType.TEXT


class CreateConversationRequest(BaseModel):
    target_user_id: int


class MessageResponse(BaseModel):
    id: int
    conversationId: int
    senderId: int
    senderName: str = ""
    senderAvatar: Optional[str] = None
    content: str
    messageType: str = "text"
    createdAt: str
    isDeleted: bool = False
    isMine: bool = False


class ConversationParticipant(BaseModel):
    userId: int
    username: str
    avatarUrl: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    participants: List[ConversationParticipant]
    lastMessageText: Optional[str] = None
    lastMessageAt: Optional[str] = None
    unreadCount: int = 0
    otherUser: Optional[ConversationParticipant] = None
    updatedAt: str


class ConversationDetail(BaseModel):
    conversation: ConversationResponse
    messages: List[MessageResponse]
