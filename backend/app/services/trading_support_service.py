"""
PRD 模块 5 · 「联系客服」入口 (PDF p.10 设计要点)。

设计稿明确：售后不写程序化退款流程，统一由客服 IM 人工受理。
本服务的职责就是：
  1. 解析「官方客服」用户 ID（来自 app_config.trading_cs_user_id；缺省时退回到首个 admin）
  2. 复用 chat_service.create_conversation 拿到会话 ID
  3. 把要投诉的订单 / 单品摘要作为一条 order_status 富媒体卡片直接 push 进会话
  4. 返回 conversationId 给前端跳转

这样的好处：
  - 不用维护独立的工单 / dispute 表，运营全程在 IM 里看
  - 客服点开会话就能看到订单上下文（金额、时间、状态），不用反复问
"""
from __future__ import annotations

import json
from typing import Optional
from datetime import datetime

from app.db.supabase import get_supabase_admin
from app.services.chat_service import ChatService
from app.services.order_service import order_service


class TradingSupportService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self.chat = ChatService()

    # ------------------------------------------------------------------
    # CS user id resolution
    # ------------------------------------------------------------------

    def _config_cs_user_id(self) -> Optional[int]:
        try:
            res = (
                self.db.table("app_config")
                .select("value")
                .eq("key", "trading_support")
                .limit(1)
                .execute()
            )
            if res.data:
                value = res.data[0].get("value") or {}
                cs = value.get("csUserId")
                if isinstance(cs, int):
                    return cs
        except Exception as e:
            print(f"[trading_support] read app_config failed: {e}")
        return None

    def _first_admin_user_id(self, exclude_user_id: int) -> Optional[int]:
        try:
            res = (
                self.db.table("users")
                .select("id")
                .eq("is_admin", True)
                .neq("id", exclude_user_id)
                .order("id", desc=False)
                .limit(1)
                .execute()
            )
            if res.data:
                return res.data[0]["id"]
        except Exception as e:
            print(f"[trading_support] read admin user failed: {e}")
        return None

    def resolve_cs_user_id(self, requester_user_id: int) -> Optional[int]:
        return (
            self._config_cs_user_id()
            or self._first_admin_user_id(requester_user_id)
        )

    # ------------------------------------------------------------------
    # Open conversation with seeded context card
    # ------------------------------------------------------------------

    def contact_for_order(self, user_id: int, order_id: int) -> dict:
        """打开「联系客服」会话，并自动推送一张订单上下文卡片。"""
        cs_user_id = self.resolve_cs_user_id(user_id)
        if not cs_user_id:
            raise RuntimeError("尚未配置官方客服账号，请稍后再试")

        order = order_service.get_order(order_id)
        if not order:
            raise ValueError("订单不存在")

        if order.buyerUserId != user_id and order.sellerUserId != user_id:
            raise PermissionError("仅订单双方可联系客服")

        conv_id = self.chat.create_conversation(user_id, cs_user_id)

        # 自动 seed 一张 order_status 卡片，让客服一眼看到上下文
        card_payload = {
            "orderId": order.id,
            "orderNo": order.orderNo,
            "status": order.status,
            "paidPriceCents": order.paidPriceCents,
        }
        try:
            self.chat.send_message(
                conversation_id=conv_id,
                sender_id=user_id,
                content=json.dumps(card_payload, ensure_ascii=False),
                message_type="order_status",
            )
        except Exception as e:
            print(f"[trading_support] seed order card failed: {e}")

        return {"conversationId": conv_id, "csUserId": cs_user_id}

    def contact_for_listing(self, user_id: int, product_id: int) -> dict:
        """详情页 / 鉴定 / 一般咨询的入口：仅推送 product_listing 卡片。"""
        cs_user_id = self.resolve_cs_user_id(user_id)
        if not cs_user_id:
            raise RuntimeError("尚未配置官方客服账号，请稍后再试")

        prod_res = (
            self.db.table("store_products")
            .select("id, title, price_cents, brand, images")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not prod_res.data:
            raise ValueError("商品不存在")
        prod = prod_res.data[0]

        conv_id = self.chat.create_conversation(user_id, cs_user_id)

        card_payload = {
            "productId": prod["id"],
            "title": prod.get("title"),
            "priceCents": prod.get("price_cents"),
            "brand": prod.get("brand"),
            "coverImage": (prod.get("images") or [None])[0],
        }
        try:
            self.chat.send_message(
                conversation_id=conv_id,
                sender_id=user_id,
                content=json.dumps(card_payload, ensure_ascii=False),
                message_type="product_listing",
            )
        except Exception as e:
            print(f"[trading_support] seed product card failed: {e}")

        return {"conversationId": conv_id, "csUserId": cs_user_id}

    def contact_general(self, user_id: int) -> dict:
        """无上下文的一般咨询（Settings → 联系客服）。"""
        cs_user_id = self.resolve_cs_user_id(user_id)
        if not cs_user_id:
            raise RuntimeError("尚未配置官方客服账号，请稍后再试")
        conv_id = self.chat.create_conversation(user_id, cs_user_id)
        return {"conversationId": conv_id, "csUserId": cs_user_id}


trading_support_service = TradingSupportService()
