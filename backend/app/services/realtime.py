"""Realtime (WebSocket) 连接管理 + 跨线程广播调度。

把 ``ConnectionManager`` 从 ``app.api.routes.chat`` 抽到这个中立模块，目的有二：

1. **打通交易消息的实时推送**：``chat_service`` / ``order_service`` / ``offer_service``
   等 service 层在程序化发卡片（发货 / 退款 / 出价 / 售后等）时，可以直接复用
   同一个 ``manager`` 把消息广播给在线用户——而不会与 ``chat.py`` 形成循环 import
   （``chat.py`` 本来就要 import ``chat_service``）。
2. **跨线程安全**：service 层的广播可能由 async 路由触发（运行在主事件循环），
   也可能由后台调度器线程触发（订单超时自动确认 / 自动退款等）。统一用
   ``schedule_send_to_user`` + ``run_coroutine_threadsafe`` 投递到启动时捕获的
   主事件循环，避免「no running event loop」。
"""

import asyncio
import logging
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


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


# ======================= 跨线程广播调度 =======================

_loop: Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    """在应用启动（lifespan）里把主事件循环存下来，供 service 层跨线程广播用。"""
    global _loop
    _loop = loop


def schedule_send_to_user(user_id: int, payload: dict) -> None:
    """线程安全地把一条 WS 消息投递给某个用户，不阻塞调用方。

    - 由 async 路由（主循环线程）调用：照样安全，``run_coroutine_threadsafe``
      会通过 ``call_soon_threadsafe`` 排进事件循环。
    - 由后台调度器线程调用：投递到启动时捕获的主循环。
    - 没有任何可用循环时静默跳过（用户终归会通过 push / 重新进入聊天拿到消息）。
    """
    loop = _loop
    if loop is None or loop.is_closed():
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
    if loop is None:
        logger.warning("realtime: no event loop available, skip WS broadcast to user %s", user_id)
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.send_to_user(user_id, payload), loop)
    except Exception as e:  # noqa: BLE001
        logger.warning("realtime: failed to schedule WS broadcast to user %s: %s", user_id, e)
