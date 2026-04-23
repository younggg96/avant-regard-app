"""
维护模式公共路由：前端无需登录即可轮询当前维护状态。
"""
from fastapi import APIRouter

from app.core.response import success
from app.services.maintenance_service import maintenance_service

router = APIRouter(prefix="/maintenance", tags=["维护模式"])


@router.get("/status")
async def get_maintenance_status():
    """公开的维护模式状态查询接口。"""
    return success(maintenance_service.get_config())
