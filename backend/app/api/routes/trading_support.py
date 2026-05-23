"""
PRD 模块 5 · 「联系客服」入口路由 (PDF p.10 设计要点)。

  - POST /api/trading-support/contact-order/{orderId}      订单售后入口
  - POST /api/trading-support/contact-listing/{productId}  单品咨询入口
  - POST /api/trading-support/contact                      一般咨询（Settings）
  - PUT  /api/admin/trading-support/cs-user                配置客服 user_id
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.response import success
from app.api.deps import get_current_user, get_current_admin_user
from app.services.trading_support_service import trading_support_service
from app.db.supabase import get_supabase_admin


support_router = APIRouter(prefix="/trading-support", tags=["交易系统 / 联系客服"])
admin_support_router = APIRouter(
    prefix="/admin/trading-support", tags=["交易系统 / 后台客服配置"]
)


@support_router.post("/contact-order/{order_id}")
async def contact_for_order(order_id: int, user_id: int = Depends(get_current_user)):
    try:
        res = trading_support_service.contact_for_order(user_id, order_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return success(res)


@support_router.post("/contact-listing/{product_id}")
async def contact_for_listing(product_id: int, user_id: int = Depends(get_current_user)):
    try:
        res = trading_support_service.contact_for_listing(user_id, product_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return success(res)


@support_router.post("/contact")
async def contact_general(user_id: int = Depends(get_current_user)):
    try:
        res = trading_support_service.contact_general(user_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return success(res)


class SetCsUserRequest(BaseModel):
    csUserId: int


@admin_support_router.put("/cs-user")
async def set_cs_user(body: SetCsUserRequest, admin_id: int = Depends(get_current_admin_user)):
    db = get_supabase_admin()
    db.table("app_config").upsert(
        {
            "key": "trading_support",
            "value": {"csUserId": body.csUserId},
            "updated_by": admin_id,
        },
        on_conflict="key",
    ).execute()
    return success({"csUserId": body.csUserId})


@admin_support_router.get("/cs-user")
async def get_cs_user(_admin=Depends(get_current_admin_user)):
    return success(
        {"csUserId": trading_support_service._config_cs_user_id()}
    )
