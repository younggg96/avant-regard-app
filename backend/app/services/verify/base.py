"""
实名认证 / 银行卡四要素 协议。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Dict, Any, Optional


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


@dataclass
class VerifySession:
    """会话式(证件 + 活体自拍)实名验证句柄。

    中国大陆走"姓名 + 身份证号"同步二要素(VerifyResult);海外(美国等)走
    证件影像 + 活体自拍的异步流程,由第三方(Stripe Identity 等)托管,
    平台只持有会话标识 + 状态,不落证件影像 / SSN。

    status:
      - "requires_input" 已创建,等待用户上传证件 / 完成自拍
      - "processing"     已提交,正在比对
      - "verified"       通过
      - "canceled"       已取消 / 失败,需要重新发起
      - "requires_action" 需要用户补充材料(可重新拉起同一会话)
    """
    session_id: str
    provider: str
    status: str
    # 嵌入式 SDK(client_secret)与跳转式(url)二选一,按 provider 能力返回。
    client_secret: Optional[str] = None
    url: Optional[str] = None
    # verified 时第三方回传的核验姓名 / 证件国别,用于落库展示。
    verified_name: Optional[str] = None
    verified_country: Optional[str] = None
    message: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.status == "verified"


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


class IdentitySessionProvider(Protocol):
    """会话式实名验证 provider(证件影像 + 活体自拍)。

    实现方负责创建第三方会话、查询会话状态、解析 webhook 回调。
    """
    name: str

    def create_session(
        self,
        *,
        user_id: int,
        return_url: Optional[str] = None,
        email: Optional[str] = None,
    ) -> VerifySession:
        """创建一次实名会话,返回 client_secret(嵌入式)或 url(跳转式)。"""
        ...

    def retrieve_session(self, session_id: str) -> VerifySession:
        """按会话 ID 拉取最新状态。"""
        ...

    def parse_webhook_object(self, obj: Dict[str, Any]) -> VerifySession:
        """把 webhook 推来的会话对象解析成统一 VerifySession。"""
        ...
