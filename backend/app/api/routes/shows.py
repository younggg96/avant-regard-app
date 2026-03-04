"""
秀场相关 API 路由
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional

from app.core.response import success
from app.services.show_service import show_service
from app.services.cache_service import cache_service, CacheService
from app.schemas.show import CreateShowRequest
from app.api.deps import get_current_user_id, get_current_admin_user

router = APIRouter(prefix="/shows", tags=["秀场"])


@router.get("")
async def get_shows(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    brand: Optional[str] = Query(None, description="品牌名称"),
    year: Optional[int] = Query(None, description="年份"),
    category: Optional[str] = Query(None, description="秀场类别"),
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页数量"),
):
    """获取秀场列表"""
    # 尝试从缓存获取
    cache_key = cache_service.get_shows_list_key(
        keyword=keyword, brand=brand, year=year, category=category,
        page=page, page_size=pageSize
    )
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    shows, total = show_service.get_all_shows(
        keyword=keyword,
        brand=brand,
        year=year,
        category=category,
        page=page,
        page_size=pageSize,
    )

    result = {
        "shows": [s.model_dump() for s in shows],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }

    # 缓存结果
    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)


@router.get("/categories")
async def get_show_categories():
    """获取秀场类别列表"""
    # 尝试从缓存获取
    cache_key = cache_service.get_show_categories_key()
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    categories = show_service.get_show_categories()
    result = {"categories": categories}

    # 缓存结果（静态数据，缓存时间长）
    cache_service.set(cache_key, result, CacheService.TTL_STATIC)

    return success(result)


@router.get("/years")
async def get_show_years():
    """获取秀场年份列表"""
    # 尝试从缓存获取
    cache_key = cache_service.get_show_years_key()
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    years = show_service.get_show_years()
    result = {"years": years}

    # 缓存结果（静态数据，缓存时间长）
    cache_service.set(cache_key, result, CacheService.TTL_STATIC)

    return success(result)


@router.get("/search")
async def search_shows(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
):
    """搜索秀场"""
    # 搜索结果不缓存，因为关键词组合太多
    shows = show_service.search_shows(keyword=keyword, limit=limit)
    return success({
        "shows": [s.model_dump() for s in shows],
        "total": len(shows),
    })


@router.get("/by-brand/{brand_name}")
async def get_shows_by_brand(brand_name: str):
    """获取某品牌的所有秀场"""
    # 尝试从缓存获取
    cache_key = cache_service.get_shows_by_brand_key(brand_name)
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    shows = show_service.get_shows_by_brand(brand_name)
    result = {
        "shows": [s.model_dump() for s in shows],
        "total": len(shows),
    }

    # 缓存结果
    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)


@router.post("")
async def create_show(
    data: CreateShowRequest,
    user_id: int = Depends(get_current_user_id),
):
    """创建秀场（需要登录，状态为 PENDING 等待审核）"""
    show = show_service.create_show(data, user_id)
    return success(show.model_dump())


@router.get("/admin/pending")
async def get_pending_shows(
    _admin_id: int = Depends(get_current_admin_user),
):
    """获取待审核秀场列表（管理员）"""
    shows = show_service.get_pending_shows()
    return success({
        "shows": [s.model_dump() for s in shows],
        "total": len(shows),
    })


@router.post("/admin/{show_id}/approve")
async def approve_show(
    show_id: str,
    _admin_id: int = Depends(get_current_admin_user),
):
    """审核通过秀场（管理员）"""
    show = show_service.approve_show(show_id)

    cache_service.delete(cache_service.get_shows_by_brand_key(show.brand))

    return success(show.model_dump())


@router.post("/admin/{show_id}/reject")
async def reject_show(
    show_id: str,
    reason: Optional[str] = Query(None, description="拒绝原因"),
    _admin_id: int = Depends(get_current_admin_user),
):
    """拒绝秀场（管理员）"""
    show = show_service.reject_show(show_id, reason)
    return success(show.model_dump())


@router.get("/by-url")
async def get_show_by_url(url: str = Query(..., description="秀场链接")):
    """通过 URL 获取秀场详情"""
    show = show_service.get_show_by_url(url)

    if not show:
        return success(None, message="秀场不存在")

    return success(show.model_dump())


@router.get("/{show_id}")
async def get_show_by_id(show_id: str):
    """通过 ID 获取秀场详情"""
    cache_key = cache_service.get_show_key(show_id)
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    show = show_service.get_show_by_id(show_id)

    if not show:
        return success(None, message="秀场不存在")

    result = show.model_dump()

    cache_service.set(cache_key, result, CacheService.TTL_LONG)

    return success(result)
