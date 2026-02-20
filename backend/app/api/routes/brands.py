"""
品牌相关 API 路由
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional

from app.core.response import success
from app.services.brand_service import brand_service
from app.services.cache_service import cache_service, CacheService
from pydantic import BaseModel
from app.schemas.brand import BrandSubmitRequest
from app.api.deps import get_current_user_id

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


@router.post("/submit")
async def submit_brand(
    request: BrandSubmitRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """用户提交品牌（需登录）"""
    submission = brand_service.submit_brand(
        user_id=current_user_id,
        name=request.name,
        category=request.category,
        founded_year=request.foundedYear,
        founder=request.founder,
        country=request.country,
        website=request.website,
        cover_image=request.coverImage,
    )
    return success(submission.model_dump())


@router.get("/my-submissions")
async def get_my_submissions(
    current_user_id: int = Depends(get_current_user_id),
):
    """获取当前用户的品牌提交记录"""
    submissions = brand_service.get_user_submissions(current_user_id)
    return success([s.model_dump() for s in submissions])


class UploadBrandImageRequest(BaseModel):
    imageUrl: str


@router.post("/{brand_id}/images")
async def upload_brand_image(
    brand_id: int,
    request: UploadBrandImageRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """用户上传品牌图片（需登录，状态为 PENDING 等待审核）"""
    brand = brand_service.get_brand_by_id(brand_id)
    if not brand:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="品牌不存在")

    image = brand_service.add_brand_image(brand_id, request.imageUrl, current_user_id)
    return success(image.model_dump())


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
