"""
PRD 模块三 · 履历 / 价格基准 / 多收藏夹 API。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.response import success
from app.api.deps import get_current_user, get_current_user_optional
from app.services.provenance_service import provenance_service
from app.services.store_product_service import store_product_service
from app.schemas.provenance import (
    UserCollectionCreate,
    UserCollectionUpdate,
)


router = APIRouter(prefix="/listings", tags=["交易系统 / 履历"])
collections_router = APIRouter(prefix="/users/me/collections", tags=["交易系统 / 收藏夹"])
price_router = APIRouter(prefix="/listings/price-history", tags=["交易系统 / 价格基准"])


# ---- Provenance ----


@router.get("/{product_id}/provenance")
async def list_provenance(
    product_id: int,
    _user_id: Optional[int] = Depends(get_current_user_optional),
):
    events = provenance_service.list_events(product_id)
    return success({"events": [e.model_dump() for e in events]})


# ---- Price history ----


@price_router.get("")
async def price_history_summary(
    brand: str = Query(...),
    categoryId: Optional[int] = Query(None),
    size: Optional[str] = Query(None),
    condition: Optional[str] = Query(None),
    months: int = Query(6, ge=1, le=24),
    _user_id: Optional[int] = Depends(get_current_user_optional),
):
    summary = provenance_service.summarize_recent_prices(
        brand_name=brand,
        category_id=categoryId,
        size=size,
        condition=condition,
        months=months,
    )
    return success(summary.model_dump())


# ---- Collections ----


@collections_router.get("")
async def list_my_collections(
    current_user_id: int = Depends(get_current_user),
):
    cols = provenance_service.list_my_collections(current_user_id)
    return success({"collections": [c.model_dump() for c in cols]})


@collections_router.post("")
async def create_collection(
    data: UserCollectionCreate,
    current_user_id: int = Depends(get_current_user),
):
    try:
        c = provenance_service.create_collection(current_user_id, data)
        return success(c.model_dump(), message="收藏夹已创建")
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="同名收藏夹已存在")
        raise


@collections_router.put("/{collection_id}")
async def update_collection(
    collection_id: int,
    data: UserCollectionUpdate,
    current_user_id: int = Depends(get_current_user),
):
    try:
        c = provenance_service.update_collection(collection_id, current_user_id, data)
        return success(c.model_dump(), message="收藏夹已更新")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@collections_router.delete("/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user_id: int = Depends(get_current_user),
):
    if provenance_service.delete_collection(collection_id, current_user_id):
        return success(None, message="收藏夹已删除")
    raise HTTPException(status_code=404, detail="收藏夹不存在")


@collections_router.post("/{collection_id}/items/{product_id}")
async def add_to_collection(
    collection_id: int,
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """把商品加入指定收藏夹（如果用户尚未收藏，先创建一条 favorite 记录）。"""
    # 复用 favorite 接口幂等添加，然后改 collection_id
    store_product_service.favorite_product(product_id, current_user_id)
    provenance_service.move_favorite_to_collection(
        product_id=product_id,
        user_id=current_user_id,
        collection_id=collection_id,
    )
    return success(None, message="已加入收藏夹")


@collections_router.delete("/{collection_id}/items/{product_id}")
async def remove_from_collection(
    collection_id: int,
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """从指定收藏夹移除（不影响"默认收藏夹"）。"""
    provenance_service.move_favorite_to_collection(
        product_id=product_id,
        user_id=current_user_id,
        collection_id=None,
    )
    return success(None, message="已从收藏夹移除")
