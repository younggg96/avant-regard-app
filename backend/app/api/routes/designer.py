"""
设计师路由
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.designer_service import designer_service
from app.api.deps import get_current_user_optional
from app.core.response import success

router = APIRouter(prefix="/designer", tags=["设计师"])


@router.get("/getAllDesignerDetail")
async def get_all_designer_details(
    current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取所有设计师的简要信息列表"""
    result = designer_service.get_all_designer_details(current_user_id)
    return success([d.model_dump() for d in result])


@router.get("/{designer_id}/show-and-images")
async def get_designer_show_and_images(
    designer_id: int,
    current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取单个设计师 + 所有 Show + 所有造型图详情"""
    result = designer_service.get_designer_show_and_images(designer_id, current_user_id)
    if not result:
        raise HTTPException(status_code=404, detail="设计师不存在")
    return success(result.model_dump())


@router.get("/getSingleShow")
async def get_single_show(showId: int = Query(...)):
    """获取单场 show 详情"""
    result = designer_service.get_single_show(showId)
    if not result:
        raise HTTPException(status_code=404, detail="秀场不存在")
    return success(result.model_dump())


@router.get("/options")
async def get_designer_options():
    """获取设计师选项列表（用于用户补全资料）"""
    result = designer_service.get_designer_options()
    return success([d.model_dump() for d in result])
