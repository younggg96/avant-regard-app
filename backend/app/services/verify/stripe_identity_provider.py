"""
Stripe Identity provider —— 海外(美国等)证件 + 活体自拍实名。

为什么不用"姓名 + 证件号"二要素:
  - 美国没有可商用的"姓名 + SSN"廉价比对接口(合规上也不允许这么用),
    KYC 标准范式是"证件影像 OCR + 活体自拍人脸比对",由第三方托管,
    平台不存证件影像 / SSN,大幅降低合规负担。
  - 我们北美版已经集成 Stripe(收单 + Connect 放款),复用同一套
    STRIPE_API_KEY / webhook 体系,接入成本最低。

集成方式(跳转式 / hosted):
  - create_session: 创建 VerificationSession,带 return_url, Stripe 返回一个
    托管页 url。前端用 expo-web-browser 打开,用户在 stripe.com 完成证件 +
    自拍,Stripe 跳回 return_url(走我们的跳板页 → App deep link)。
  - retrieve_session: 前端跳回 App 后主动拉一次状态(防 webhook 延迟)。
  - parse_webhook_object: identity.verification_session.* 事件入口。

环境变量:
  - STRIPE_API_KEY            复用 stripe_provider / stripe_connect_service
  - 没装 stripe SDK / 没 API_KEY → create/retrieve 抛 RuntimeError,
    路由层捕获并 503 提示用户。
"""
from __future__ import annotations

import os
from typing import Optional, Dict, Any

from .base import VerifySession


try:  # pragma: no cover - optional dep
    import stripe  # type: ignore
    _HAS_STRIPE = True
except Exception:  # pragma: no cover
    stripe = None  # type: ignore
    _HAS_STRIPE = False


# 与 stripe_connect_service 对齐, 避免不同 endpoint 上 API 版本漂移。
_STRIPE_API_VERSION = "2026-04-22.dahlia"


def _ensure_live() -> None:
    if not _HAS_STRIPE:
        raise RuntimeError("stripe SDK 未安装,无法使用 Stripe Identity")
    api_key = os.getenv("STRIPE_API_KEY")
    if not api_key:
        raise RuntimeError("STRIPE_API_KEY 未配置,无法使用 Stripe Identity")
    stripe.api_key = api_key  # type: ignore
    try:
        stripe.api_version = _STRIPE_API_VERSION  # type: ignore
    except Exception:
        pass


# Stripe 会话 status → 我们统一的 VerifySession.status
_STATUS_MAP = {
    "requires_input": "requires_input",
    "processing": "processing",
    "verified": "verified",
    "canceled": "canceled",
}


def _get(obj: Any, k: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(k, default)
    return getattr(obj, k, default)


class StripeIdentityProvider:
    name = "stripe_identity"

    def _to_session(self, obj: Any) -> VerifySession:
        sid = _get(obj, "id")
        raw_status = str(_get(obj, "status") or "")
        status = _STATUS_MAP.get(raw_status, "processing")

        verified_name: Optional[str] = None
        verified_country: Optional[str] = None
        # verified_outputs 仅在 verified 且开通 SSN/姓名收集时有值。
        outputs = _get(obj, "verified_outputs")
        if outputs:
            if hasattr(outputs, "to_dict"):
                outputs = outputs.to_dict()
            if isinstance(outputs, dict):
                name = outputs.get("first_name"), outputs.get("last_name")
                if any(name):
                    verified_name = " ".join([p for p in name if p]).strip() or None
                addr = outputs.get("address") or {}
                if isinstance(addr, dict):
                    verified_country = addr.get("country")

        last_error = _get(obj, "last_error")
        message = ""
        if last_error:
            if hasattr(last_error, "to_dict"):
                last_error = last_error.to_dict()
            if isinstance(last_error, dict):
                message = str(last_error.get("reason") or "")

        return VerifySession(
            session_id=str(sid),
            provider=self.name,
            status=status,
            client_secret=_get(obj, "client_secret"),
            url=_get(obj, "url"),
            verified_name=verified_name,
            verified_country=verified_country,
            message=message,
            raw=obj if isinstance(obj, dict) else {},
        )

    def create_session(
        self,
        *,
        user_id: int,
        return_url: Optional[str] = None,
        email: Optional[str] = None,
    ) -> VerifySession:
        _ensure_live()
        params: Dict[str, Any] = {
            "type": "document",
            # 把 user_id 写进 metadata, webhook 回来时反查本地用户。
            "metadata": {"appUserId": str(user_id)},
            # 收集证件持有人姓名,verified 后回填 seller_kyc.real_name。
            "options": {"document": {"require_matching_selfie": True}},
        }
        if return_url:
            params["return_url"] = return_url
        if email:
            params["provided_details"] = {"email": email}
        session = stripe.identity.VerificationSession.create(**params)  # type: ignore
        return self._to_session(session)

    def retrieve_session(self, session_id: str) -> VerifySession:
        _ensure_live()
        session = stripe.identity.VerificationSession.retrieve(session_id)  # type: ignore
        return self._to_session(session)

    def parse_webhook_object(self, obj: Dict[str, Any]) -> VerifySession:
        return self._to_session(obj)
