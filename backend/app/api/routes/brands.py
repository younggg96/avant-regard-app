"""
品牌相关 API 路由
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.core.response import success
from app.services.brand_service import brand_service

router = APIRouter(prefix="/brands", tags=["品牌"])


@router.get("")
async def get_brands(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    category: Optional[str] = Query(None, description="品牌分类"),
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页数量"),
):
    """获取品牌列表"""
    brands, total = brand_service.get_all_brands(
        keyword=keyword,
        category=category,
        page=page,
        page_size=pageSize,
    )

    return success({
        "brands": [b.model_dump() for b in brands],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/categories")
async def get_brand_categories():
    """获取品牌分类列表"""
    categories = brand_service.get_brand_categories()
    return success({"categories": categories})


@router.get("/search")
async def search_brands(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
):
    """搜索品牌"""
    brands = brand_service.search_brands(keyword=keyword, limit=limit)
    return success({
        "brands": [b.model_dump() for b in brands],
        "total": len(brands),
    })


@router.get("/{brand_id}")
async def get_brand_by_id(brand_id: int):
    """通过 ID 获取品牌详情"""
    brand = brand_service.get_brand_by_id(brand_id)

    if not brand:
        return success(None, message="品牌不存在")

    return success(brand.model_dump())


@router.get("/by-name/{name}")
async def get_brand_by_name(name: str):
    """通过名称获取品牌详情"""
    brand = brand_service.get_brand_by_name(name)

    if not brand:
        return success(None, message="品牌不存在")

    return success(brand.model_dump())
