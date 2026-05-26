"""
阿里云市场实名 / 四要素 provider · 通过 AppCode 授权调用。

接入指引:
  1. 在阿里云市场购买:
     - 身份证二要素: idcert.market.alicloudapi.com/idcard
     - 银行卡四要素: bcard4.market.alicloudapi.com/bankcard4
  2. 配置 settings.ALIYUN_VERIFY_APP_CODE
  3. settings.VERIFY_PROVIDER 设为 "aliyun"

返回格式参考阿里云市场文档,典型成功响应:
  { "code": 0, "msg": "成功", "status": "01" }  (01 = 信息一致)
"""
from __future__ import annotations

import json
from typing import Optional

import httpx

from app.core.config import settings
from .base import VerifyProvider, VerifyResult


class AliyunVerifyProvider:
    name = "aliyun"

    def __init__(self) -> None:
        self._app_code = settings.ALIYUN_VERIFY_APP_CODE

    def _live(self) -> bool:
        return bool(self._app_code)

    def _call(
        self,
        url: str,
        params: dict,
        timeout: float = 10.0,
    ) -> Optional[dict]:
        if not self._live():
            return None
        try:
            resp = httpx.get(
                url,
                params=params,
                headers={
                    "Authorization": f"APPCODE {self._app_code}",
                },
                timeout=timeout,
            )
            if resp.status_code != 200:
                print(
                    f"[aliyun-verify] {url} returned {resp.status_code}: {resp.text}",
                    flush=True,
                )
                return None
            return resp.json()
        except Exception as e:
            print(f"[aliyun-verify] call failed: {e}", flush=True)
            return None

    def verify_id_card(self, *, name: str, id_no: str) -> VerifyResult:
        if not self._live():
            return VerifyResult(
                status="provider_error",
                message="实名通道未配置",
            )
        data = self._call(
            settings.ALIYUN_VERIFY_ID2_URL,
            {"cardno": id_no.strip(), "name": name.strip()},
        )
        if not data:
            return VerifyResult(status="provider_error", message="通道暂不可用")
        # 阿里云市场返回结构因服务商不同存在差异,这里取最常见字段。
        status = str(data.get("status") or data.get("result") or "")
        if status in ("01", "0", "True", "true"):
            return VerifyResult(status="passed", raw=data)
        if status in ("02", "false", "False"):
            return VerifyResult(status="mismatch", message="姓名与身份证号不一致", raw=data)
        return VerifyResult(
            status="provider_error",
            message=str(data.get("msg") or "校验失败"),
            raw=data,
        )

    def verify_bank_card4(
        self,
        *,
        name: str,
        id_no: str,
        bank_no: str,
        phone: str,
    ) -> VerifyResult:
        if not self._live():
            return VerifyResult(
                status="provider_error", message="四要素通道未配置"
            )
        data = self._call(
            settings.ALIYUN_BANK4_URL,
            {
                "name": name.strip(),
                "idcard": id_no.strip(),
                "bankcard": bank_no.strip(),
                "mobile": phone.strip(),
            },
        )
        if not data:
            return VerifyResult(status="provider_error", message="通道暂不可用")
        status = str(data.get("status") or data.get("code") or "")
        if status in ("01", "0", "True", "true"):
            return VerifyResult(status="passed", raw=data)
        if status in ("02", "false", "False"):
            return VerifyResult(
                status="mismatch", message="四要素不一致", raw=data
            )
        return VerifyResult(
            status="provider_error",
            message=str(data.get("msg") or "校验失败"),
            raw=data,
        )
