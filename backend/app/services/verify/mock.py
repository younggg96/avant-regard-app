"""
Mock 实名 / 四要素 provider · 开发 / 自动化测试用。

规则:
  - 任何 18 位身份证号 + 至少 2 字姓名 → passed
  - 银行卡 ≥ 12 位 + 手机号 11 位 → passed
  - 否则 → invalid
"""
from __future__ import annotations

import re
import uuid
from typing import Dict, Any, Optional

from .base import VerifyProvider, VerifyResult, VerifySession


_ID_RE = re.compile(r"^\d{17}[\dXx]$")
_BANK_RE = re.compile(r"^\d{12,19}$")
_PHONE_RE = re.compile(r"^1\d{10}$")


class MockVerifyProvider:
    name = "mock"

    def verify_id_card(self, *, name: str, id_no: str) -> VerifyResult:
        if not name or len(name.strip()) < 2:
            return VerifyResult(status="invalid", message="姓名格式错误")
        if not _ID_RE.match(id_no or ""):
            return VerifyResult(status="invalid", message="身份证号格式错误")
        return VerifyResult(status="passed", raw={"stub": True})

    def verify_bank_card4(
        self,
        *,
        name: str,
        id_no: str,
        bank_no: str,
        phone: str,
    ) -> VerifyResult:
        if not _ID_RE.match(id_no or ""):
            return VerifyResult(status="invalid", message="身份证号格式错误")
        if not _BANK_RE.match(bank_no or ""):
            return VerifyResult(status="invalid", message="银行卡号格式错误")
        if not _PHONE_RE.match(phone or ""):
            return VerifyResult(status="invalid", message="手机号格式错误")
        if not name or len(name.strip()) < 2:
            return VerifyResult(status="invalid", message="姓名格式错误")
        return VerifyResult(status="passed", raw={"stub": True})


class MockIdentitySessionProvider:
    """Mock 会话式实名 · 开发 / 自动化测试用。

    create_session 立刻返回一个 verified 的会话(本地无法真正拉起 Stripe 托管页),
    业务层据此把 status 直接标 approved, 方便联调上架门 + 钱包 + 提现流程。
    """
    name = "mock_identity"

    def create_session(
        self,
        *,
        user_id: int,
        return_url: Optional[str] = None,
        email: Optional[str] = None,
    ) -> VerifySession:
        sid = f"vs_mock_{user_id}_{uuid.uuid4().hex[:8]}"
        return VerifySession(
            session_id=sid,
            provider=self.name,
            status="verified",
            client_secret=f"{sid}_secret",
            url=None,
            verified_name="Mock Verified",
            verified_country="US",
            raw={"stub": True},
        )

    def retrieve_session(self, session_id: str) -> VerifySession:
        return VerifySession(
            session_id=session_id,
            provider=self.name,
            status="verified",
            verified_name="Mock Verified",
            verified_country="US",
            raw={"stub": True},
        )

    def parse_webhook_object(self, obj: Dict[str, Any]) -> VerifySession:
        return VerifySession(
            session_id=str(obj.get("id") or "vs_mock"),
            provider=self.name,
            status=str(obj.get("status") or "verified"),
            raw=obj,
        )
