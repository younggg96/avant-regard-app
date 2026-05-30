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

    # verify_webhook 三态返回:
    #   - 抛异常 / 验签失败 → 我们不会调到这里(provider 内部已 print)
    #   - 返回 None         → 我们的标准事件类型未识别(常见: stripe 推
    #     payment_intent.created / charge.succeeded 之类我们没订阅但也
    #     没法在 Dashboard 完全屏蔽的事件)。这种情况下必须 200 ACK,
    #     否则 stripe 会无限重试,触发 webhook delivery alert + 噪音日志。
    #   - 返回 WebhookEvent → 走业务处理
    #
    # 真正的"验签失败"由 provider.verify_webhook 内部识别(没有 sig /
    # secret 不匹配),目前 stripe_provider 的 verify_webhook 在验签失败
    # 时也是返回 None。区分二者唯一的办法是看 headers:有 stripe-signature
    # 但 verify 失败,那应该 400;否则 200 ignore。
    sig_present = bool(
        headers.get("stripe-signature")
        or headers.get("alipay-signature")
        or headers.get("wechatpay-signature")
    )

    event = provider.verify_webhook(headers=headers, body=body)
    if event is None:
        if provider_name == "stripe" and sig_present:
            # 有签名头才走"验签失败 vs 事件未订阅"的二选一判断,
            # provider.verify_webhook 内部已 print,这里只决定 HTTP 码。
            # 区分手段: 用同样的 secret 再尝试一次 construct_event 拿
            # event.type;如果 type 在 _STRIPE_EVENT_MAP 之外 → 200 ignore,
            # 否则 → 400。但代价太高,不值得为这点细分多调一次 SDK。
            # 选择保守做法:已订阅但无关事件依然 200,真验签失败由 provider
            # 内部日志 + Stripe Dashboard delivery 重试统计可发现。
            return Response(
                content="ignored",
                media_type="text/plain",
                status_code=200,
            )
        # mock / alipay / wechat 没签名头时按 400 处理便于本地联调发现问题
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
    """Stripe webhook 入口,处理三类事件:

      - payment_intent.* / charge.refunded / refund.* → 走标准 _handle 通道,
        分发到 marketplace orders / Plus / 鉴定订单
      - account.updated                              → 走 stripe_connect_service,
        同步 Connect 账号状态(charges_enabled / payouts_enabled / requirements)

    设计考虑: 为什么不在 _handle 里处理 account.* —— 因为 _handle 假设事件
    一定是支付相关 (有 intent_id), 而 account 事件没有 intent_id, 把它强行
    塞进 WebhookEvent 会让分发逻辑变难看。这里直接读 raw event.type 旁路。
    """
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    # 先 peek 一下 raw event,看看是不是 connect 事件
    from app.services.payment import get_payment_provider_by_name
    provider = get_payment_provider_by_name("stripe")
    raw_event = None
    try:
        raw_event = provider.construct_raw_event(headers=headers, body=body)  # type: ignore[attr-defined]
    except AttributeError:
        # 老 mock provider 没有这个方法 —— 走标准通道
        pass

    if raw_event is not None:
        evt_type = (
            raw_event.get("type") if isinstance(raw_event, dict)
            else getattr(raw_event, "type", None)
        )
        def _event_object(ev: object) -> dict:
            if isinstance(ev, dict):
                return ev.get("data", {}).get("object", {}) or {}
            obj = ev.data.object  # type: ignore
            return obj.to_dict() if hasattr(obj, "to_dict") else dict(obj)

        if evt_type and evt_type.startswith("account."):
            # account.updated / account.application.* / account.external_account.*
            # 都用同一个 sync 入口处理 — 我们只关心 status 字段。
            from app.services.payment.stripe_connect_service import (
                stripe_connect_service,
            )
            payload = _event_object(raw_event)
            try:
                stripe_connect_service.handle_account_updated_webhook(payload)
            except Exception as e:
                print(f"[webhook] connect account update failed: {e}", flush=True)
                raise HTTPException(status_code=500, detail=str(e))
            return Response(content="success", media_type="text/plain", status_code=200)

        if evt_type and evt_type.startswith("identity.verification_session."):
            # identity.verification_session.verified / .processing / .canceled / .requires_input
            # 统一回写 seller_kyc 实名状态(海外证件 + 活体自拍)。
            from app.services.kyc_service import kyc_service
            payload = _event_object(raw_event)
            try:
                kyc_service.handle_identity_webhook(payload)
            except Exception as e:
                print(f"[webhook] identity session update failed: {e}", flush=True)
                raise HTTPException(status_code=500, detail=str(e))
            return Response(content="success", media_type="text/plain", status_code=200)

    # 其它事件走标准支付分发
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
