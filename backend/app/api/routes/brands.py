"""
品牌相关 API 路由
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.core.response import success
from app.services.brand_service import brand_service
from app.services.cache_service import cache_service, CacheService

router = APIRouter(prefix="/brands", tags=["品牌"])


@router.get("")
async def get_brands(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    category: Optional[str] = Query(None, description="品牌分类"),
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页数量"),
):
    """获取品牌列表"""
    # 尝试从缓存获取
    cache_key = cache_service.get_brands_list_key(
        keyword=keyword, category=category, page=page, page_size=pageSize
    )
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    brands, total = brand_service.get_all_brands(
        keyword=keyword,
        category=category,
        page=page,
        page_size=pageSize,
    )

    result = {
        "brands": [b.model_dump() for b in brands],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }

    # 缓存结果
    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)


@router.get("/categories")
async def get_brand_categories():
    """获取品牌分类列表"""
    # 尝试从缓存获取
    cache_key = cache_service.get_brand_categories_key()
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    categories = brand_service.get_brand_categories()
    result = {"categories": categories}

    # 缓存结果（静态数据，缓存时间长）
    cache_service.set(cache_key, result, CacheService.TTL_STATIC)

    return success(result)


@router.get("/search")
async def search_brands(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
):
    """搜索品牌"""
    # 搜索结果不缓存，因为关键词组合太多
    brands = brand_service.search_brands(keyword=keyword, limit=limit)
    return success({
        "brands": [b.model_dump() for b in brands],
        "total": len(brands),
    })


@router.get("/{brand_id}")
async def get_brand_by_id(brand_id: int):
    """通过 ID 获取品牌详情"""
    # 尝试从缓存获取
    cache_key = cache_service.get_brand_key(brand_id)
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    brand = brand_service.get_brand_by_id(brand_id)

    if not brand:
        return success(None, message="品牌不存在")

    result = brand.model_dump()

    # 缓存结果
    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)


@router.get("/by-name/{name}")
async def get_brand_by_name(name: str):
    """通过名称获取品牌详情"""
    # 尝试从缓存获取
    cache_key = cache_service.get_brand_by_name_key(name)
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    brand = brand_service.get_brand_by_name(name)

    if not brand:
        return success(None, message="品牌不存在")

    result = brand.model_dump()

    # 缓存结果
    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)
