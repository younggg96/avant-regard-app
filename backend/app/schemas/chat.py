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
    POST_CARD = "post_card"
    STORE_CARD = "store_card"
    BRAND_CARD = "brand_card"
    SHOW_CARD = "show_card"
    USER_CARD = "user_card"
    # PRD 模块 7 · 富媒体卡片
    PRODUCT_LISTING = "product_listing"
    OFFER = "offer"
    ORDER_STATUS = "order_status"
    DISPUTE = "dispute"


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: MessageType = MessageType.TEXT


class CreateConversationRequest(BaseModel):
    target_user_id: int


class BatchDeleteConversationsRequest(BaseModel):
    conversation_ids: List[int] = Field(..., min_length=1, max_length=100)


class MessageResponse(BaseModel):
    id: int
    conversationId: int
    senderId: int
    senderName: str = ""
    senderAvatar: Optional[str] = None
    senderTitle: Optional[str] = None
    content: str
    messageType: str = "text"
    createdAt: str
    isDeleted: bool = False
    isMine: bool = False


class ConversationParticipant(BaseModel):
    userId: int
    username: str
    avatarUrl: Optional[str] = None
    primaryTitle: Optional[str] = None


class TradeContext(BaseModel):
    """会话的交易上下文：用于把「交易/帖子/活动相关」会话归入互动页「交易」tab，
    并在列表行上展示商品封面图 + 角色 / 订单状态标识（无需点开会话）。

    - isTrade:          会话内是否出现过交易 / 分享类富媒体卡片
    - coverImage:       关联商品 / 内容封面图（取最近一张卡片 payload 的封面）
    - counterpartRole:  对端相对当前用户的角色（"buyer" = 对方是买家，我是卖家；
                        "seller" = 对方是卖家，我是买家）；无法判定时为 None
    - orderStatus:      当我作为买家时，关联订单的实时状态（如 paid / shipped）
    - kind:             触发归类的卡片类型（order_status / offer / product_listing 等）
    """
    isTrade: bool = False
    coverImage: Optional[str] = None
    counterpartRole: Optional[str] = None
    orderStatus: Optional[str] = None
    kind: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    participants: List[ConversationParticipant]
    lastMessageText: Optional[str] = None
    lastMessageAt: Optional[str] = None
    unreadCount: int = 0
    myMessageCount: int = 0
    otherUser: Optional[ConversationParticipant] = None
    updatedAt: str
    tradeContext: Optional[TradeContext] = None


class ConversationDetail(BaseModel):
    conversation: ConversationResponse
    messages: List[MessageResponse]
