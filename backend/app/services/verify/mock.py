"""
Mock 实名 / 四要素 provider · 开发 / 自动化测试用。

规则:
  - 任何 18 位身份证号 + 至少 2 字姓名 → passed
  - 银行卡 ≥ 12 位 + 手机号 11 位 → passed
  - 否则 → invalid
"""
from __future__ import annotations

import re

from .base import VerifyProvider, VerifyResult


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
