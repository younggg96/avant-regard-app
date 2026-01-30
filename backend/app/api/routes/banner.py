"""
Banner 路由
"""
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Body
from app.services.banner_service import banner_service
from app.services.cache_service import cache_service, CacheService
from app.schemas.banner import BannerCreate, BannerUpdate, BannerResponse
from app.api.deps import get_current_user_id, get_current_admin_user
from app.core.response import success

router = APIRouter(prefix="/banners", tags=["Banner 轮播图"])


# ==================== 公开接口 ====================

@router.get("/active", response_model=None)
async def get_active_banners():
    """获取当前有效的 Banner 列表（前端展示用）"""
    # 尝试从缓存获取
    cache_key = cache_service.get_banners_key()
    cached = cache_service.get(cache_key)
    if cached is not None:
        return success(cached)

    # 从数据库获取
    banners = banner_service.get_active_banners()
    data = [b.model_dump() for b in banners]

    # 缓存结果
    cache_service.set(cache_key, data, CacheService.TTL_MEDIUM)

    return success(data)


# ==================== 管理员接口 ====================

@router.get("/admin/list", response_model=None)
async def get_all_banners(
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取所有 Banner 列表（管理员用）"""
    banners = banner_service.get_all_banners()
    return success([b.model_dump() for b in banners])


@router.get("/admin/{banner_id}", response_model=None)
async def get_banner(
    banner_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取单个 Banner 详情"""
    banner = banner_service.get_banner_by_id(banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    return success(banner.model_dump())


@router.post("/admin", response_model=None)
async def create_banner(
    data: BannerCreate,
    current_user_id: int = Depends(get_current_admin_user)
):
    """创建 Banner"""
    try:
        banner = banner_service.create_banner(data, current_user_id)
        # 清除 Banner 缓存
        cache_service.invalidate_banners()
        return success(banner.model_dump(), message="Banner 创建成功")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/{banner_id}", response_model=None)
async def update_banner(
    banner_id: int,
    data: BannerUpdate,
    current_user_id: int = Depends(get_current_admin_user)
):
    """更新 Banner"""
    banner = banner_service.update_banner(banner_id, data)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    # 清除 Banner 缓存
    cache_service.invalidate_banners()
    return success(banner.model_dump(), message="Banner 更新成功")


@router.delete("/admin/{banner_id}", response_model=None)
async def delete_banner(
    banner_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除 Banner"""
    ok = banner_service.delete_banner(banner_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    # 清除 Banner 缓存
    cache_service.invalidate_banners()
    return success(message="Banner 删除成功")


@router.post("/admin/{banner_id}/toggle", response_model=None)
async def toggle_banner_status(
    banner_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """切换 Banner 启用状态"""
    banner = banner_service.toggle_banner_status(banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner 不存在")
    # 清除 Banner 缓存
    cache_service.invalidate_banners()
    status_text = "启用" if banner.isActive else "禁用"
    return success(banner.model_dump(), message=f"Banner 已{status_text}")


@router.post("/admin/reorder", response_model=None)
async def reorder_banners(
    banner_ids: List[int] = Body(..., embed=True),
    current_user_id: int = Depends(get_current_admin_user)
):
    """重新排序 Banner"""
    ok = banner_service.reorder_banners(banner_ids)
    if not ok:
        raise HTTPException(status_code=500, detail="排序失败")
    # 清除 Banner 缓存
    cache_service.invalidate_banners()
    return success(message="排序成功")
