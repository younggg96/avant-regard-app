"""
支付通道 webhook 路由 · 三大支付平台异步通知统一入口。

  POST /api/webhooks/stripe   Stripe payment_intent.* / charge.refunded
  POST /api/webhooks/alipay   支付宝异步通知(form-urlencoded)
  POST /api/webhooks/wechat   微信支付 v3 通知
  POST /api/webhooks/mock     Mock provider(开发 / 自动化测试用)

不变量:
  1. 验签失败一律 400,绝不允许未验证的请求推进订单状态。
  2. 事件 → 订单状态机的转换严格幂等:同一事件重复推送不会重复 credit/refund。
  3. 路由层只做"事件提取 + 调用 service",不写业务逻辑;
     真正的状态切换在 order_service.handle_payment_event 里。
"""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Response

from app.services.payment import get_payment_provider_by_name
from app.services.payment.base import (
    WebhookEvent,
    WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    WEBHOOK_EVENT_PAYMENT_FAILED,
    WEBHOOK_EVENT_REFUND_SUCCEEDED,
)
from app.services.order_service import order_service


router = APIRouter(prefix="/webhooks", tags=["交易系统 / 支付回调"])


async def _handle(provider_name: str, request: Request) -> Response:
    provider = get_payment_provider_by_name(provider_name)
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    event = provider.verify_webhook(headers=headers, body=body)
    if event is None:
        # 验签失败 / 未知事件类型一律 400,触发 provider 重试 / 报警。
        raise HTTPException(status_code=400, detail="invalid_or_unrecognized_webhook")

    try:
        order_service.handle_payment_event(event)
    except Exception as e:
        # 业务侧异常应在 service 内吞掉并打日志,这里走到说明是真异常,
        # 必须 5xx 让 provider 重试,否则可能丢单。
        print(f"[webhook] {provider_name} handle event failed: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

    # 各家 provider 期望的 ACK 格式不同:支付宝要 "success",微信要 200 JSON,
    # Stripe 要 200。统一返回 "success",绝大多数 provider 把 2xx 视为已收到。
    return Response(content="success", media_type="text/plain", status_code=200)


@router.post("/stripe")
async def stripe_webhook(request: Request) -> Response:
    return await _handle("stripe", request)


@router.post("/alipay")
async def alipay_webhook(request: Request) -> Response:
    return await _handle("alipay", request)


@router.post("/wechat")
async def wechat_webhook(request: Request) -> Response:
    return await _handle("wechat", request)


@router.post("/mock")
async def mock_webhook(request: Request) -> Response:
    """Mock provider webhook,开发 / 自动化测试时用。

    示例:
        curl -X POST http://localhost:8080/api/webhooks/mock \\
          -H "Content-Type: application/json" \\
          -d '{"type":"payment.succeeded","intent_id":"mock_123_ab","amount_cents":4500,"currency":"CNY"}'
    """
    return await _handle("mock", request)
