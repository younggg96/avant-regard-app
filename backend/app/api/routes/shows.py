"""
秀场相关 API 路由
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.core.response import success
from app.services.show_service import show_service

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
    shows, total = show_service.get_all_shows(
        keyword=keyword,
        brand=brand,
        year=year,
        category=category,
        page=page,
        page_size=pageSize,
    )

    return success({
        "shows": [s.model_dump() for s in shows],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/categories")
async def get_show_categories():
    """获取秀场类别列表"""
    categories = show_service.get_show_categories()
    return success({"categories": categories})


@router.get("/years")
async def get_show_years():
    """获取秀场年份列表"""
    years = show_service.get_show_years()
    return success({"years": years})


@router.get("/search")
async def search_shows(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
):
    """搜索秀场"""
    shows = show_service.search_shows(keyword=keyword, limit=limit)
    return success({
        "shows": [s.model_dump() for s in shows],
        "total": len(shows),
    })


@router.get("/by-brand/{brand_name}")
async def get_shows_by_brand(brand_name: str):
    """获取某品牌的所有秀场"""
    shows = show_service.get_shows_by_brand(brand_name)
    return success({
        "shows": [s.model_dump() for s in shows],
        "total": len(shows),
    })


@router.get("/by-url")
async def get_show_by_url(url: str = Query(..., description="秀场链接")):
    """通过 URL 获取秀场详情"""
    show = show_service.get_show_by_url(url)

    if not show:
        return success(None, message="秀场不存在")

    return success(show.model_dump())


@router.get("/{show_id}")
async def get_show_by_id(show_id: int):
    """通过 ID 获取秀场详情"""
    show = show_service.get_show_by_id(show_id)

    if not show:
        return success(None, message="秀场不存在")

    return success(show.model_dump())
