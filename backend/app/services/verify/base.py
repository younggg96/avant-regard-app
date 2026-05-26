"""
实名认证 / 银行卡四要素 协议。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Dict, Any


@dataclass
class VerifyResult:
    """统一验证结果。

    status:
      - "passed"        校验通过,可继续业务
      - "mismatch"      字段不一致(例如身份证号与姓名不匹配)
      - "invalid"       字段格式错误 / 银行卡不存在
      - "provider_error" 通道临时故障,业务侧应让用户重试
    """
    status: str
    message: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.status == "passed"


class VerifyProvider(Protocol):
    name: str

    def verify_id_card(self, *, name: str, id_no: str) -> VerifyResult:
        """身份证二要素:姓名 + 身份证号。"""
        ...

    def verify_bank_card4(
        self,
        *,
        name: str,
        id_no: str,
        bank_no: str,
        phone: str,
    ) -> VerifyResult:
        """银行卡四要素:姓名 + 身份证 + 银行卡 + 手机号。"""
        ...
