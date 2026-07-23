"""
用户常用收货地址簿路由。

PRD 模块四 · 支付环节地址管理:
  - GET    /me/addresses          列表(默认在前)
  - GET    /me/addresses/default  当前默认地址
  - POST   /me/addresses          新建
  - PUT    /me/addresses/{id}     更新
  - POST   /me/addresses/{id}/default  置为默认
  - DELETE /me/addresses/{id}     软删除
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.response import success
from app.api.deps import get_current_user
from app.services.address_service import address_service
from app.schemas.address import UserAddressCreate, UserAddressUpdate


router = APIRouter(prefix="/me/addresses", tags=["交易系统 / 地址"])


@router.get("")
def list_my_addresses(user_id: int = Depends(get_current_user)):
    items = address_service.list_for_user(user_id)
    return success({"items": [it.dict() for it in items]})


@router.get("/default")
def get_my_default_address(user_id: int = Depends(get_current_user)):
    item = address_service.get_default(user_id)
    return success(item.dict() if item else None)


@router.post("")
def create_address(
    payload: UserAddressCreate,
    user_id: int = Depends(get_current_user),
):
    try:
        item = address_service.create(user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(item.dict())


@router.put("/{address_id}")
def update_address(
    address_id: int,
    payload: UserAddressUpdate,
    user_id: int = Depends(get_current_user),
):
    try:
        item = address_service.update(user_id, address_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return success(item.dict())


@router.post("/{address_id}/default")
def set_default_address(
    address_id: int,
    user_id: int = Depends(get_current_user),
):
    try:
        item = address_service.set_default(user_id, address_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return success(item.dict())


@router.delete("/{address_id}")
def delete_address(
    address_id: int,
    user_id: int = Depends(get_current_user),
):
    address_service.soft_delete(user_id, address_id)
    return success({"ok": True})
