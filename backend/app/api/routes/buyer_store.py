"""
买手店相关 API 路由
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List

from app.core.response import success, error
from app.services.buyer_store_service import buyer_store_service
from app.schemas.buyer_store import (
    BuyerStoreCreate,
    BuyerStoreUpdate,
    NearbyStoreParams,
)
from app.api.deps import get_current_admin_user

router = APIRouter(prefix="/buyer-stores", tags=["买手店"])


@router.get("")
async def get_stores(
    country: Optional[str] = Query(None, description="国家筛选"),
    city: Optional[str] = Query(None, description="城市筛选"),
    brand: Optional[str] = Query(None, description="品牌筛选"),
    style: Optional[str] = Query(None, description="风格筛选"),
    openOnly: Optional[bool] = Query(None, description="仅显示营业中"),
    searchQuery: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页数量"),
):
    """获取买手店列表"""
    stores, total = buyer_store_service.get_all_stores(
        country=country,
        city=city,
        brand=brand,
        style=style,
        open_only=openOnly,
        search_query=searchQuery,
        page=page,
        page_size=pageSize,
    )

    return success({
        "stores": [s.model_dump() for s in stores],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/countries")
async def get_countries():
    """获取所有国家列表"""
    countries = buyer_store_service.get_all_countries()
    return success({"countries": countries})


@router.get("/cities")
async def get_cities(
    country: Optional[str] = Query(None, description="按国家筛选城市"),
):
    """获取所有城市列表"""
    cities = buyer_store_service.get_all_cities(country=country)
    return success({"cities": cities})


@router.get("/styles")
async def get_styles():
    """获取所有风格列表"""
    styles = buyer_store_service.get_all_styles()
    return success({"styles": styles})


@router.get("/search")
async def search_stores(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
):
    """搜索买手店"""
    stores = buyer_store_service.search_stores(keyword=keyword, limit=limit)
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": len(stores),
    })


@router.get("/by-brand/{brand}")
async def get_stores_by_brand(brand: str):
    """根据品牌获取买手店"""
    stores = buyer_store_service.get_stores_by_brand(brand)
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": len(stores),
    })


@router.get("/brand-recommendations/{brand}")
async def get_brand_recommendations(brand: str):
    """获取品牌推荐（包含相关品牌）"""
    recommendation = buyer_store_service.get_brand_recommendations(brand)
    return success({
        "stores": [s.model_dump() for s in recommendation.stores],
        "relatedBrands": recommendation.relatedBrands,
    })


@router.post("/nearby")
async def get_nearby_stores(params: NearbyStoreParams):
    """获取附近的买手店"""
    stores = buyer_store_service.get_nearby_stores(
        latitude=params.latitude,
        longitude=params.longitude,
        radius=params.radius,
    )
    return success({
        "stores": [
            {**s["store"].model_dump(), "distance": s["distance"]}
            for s in stores
        ],
        "total": len(stores),
    })


@router.get("/{store_id}")
async def get_store_by_id(store_id: str):
    """通过 ID 获取买手店详情"""
    store = buyer_store_service.get_store_by_id(store_id)

    if not store:
        return success(None, message="买手店不存在")

    return success(store.model_dump())


# ==================== 管理员接口 ====================


@router.post("")
async def create_store(
    store: BuyerStoreCreate,
    current_user_id: int = Depends(get_current_admin_user),
):
    """创建买手店（管理员）"""
    try:
        new_store = buyer_store_service.create_store(store)
        return success(new_store.model_dump(), message="创建成功")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{store_id}")
async def update_store(
    store_id: str,
    store: BuyerStoreUpdate,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新买手店（管理员）"""
    updated_store = buyer_store_service.update_store(store_id, store)

    if not updated_store:
        raise HTTPException(status_code=404, detail="买手店不存在")

    return success(updated_store.model_dump(), message="更新成功")


@router.delete("/{store_id}")
async def delete_store(
    store_id: str,
    current_user_id: int = Depends(get_current_admin_user),
):
    """删除买手店（管理员）"""
    deleted = buyer_store_service.delete_store(store_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="买手店不存在")

    return success(None, message="删除成功")


@router.post("/batch")
async def batch_create_stores(
    stores: List[BuyerStoreCreate],
    current_user_id: int = Depends(get_current_admin_user),
):
    """批量创建买手店（管理员）"""
    try:
        count = buyer_store_service.batch_create_stores(stores)
        return success({"count": count}, message=f"成功创建 {count} 个买手店")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
