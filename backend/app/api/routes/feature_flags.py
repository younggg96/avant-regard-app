"""
公开的功能开关查询接口: 客户端无需登录即可拉取, 用于决定 UI 是否暴露相关入口.

字段一律 camelCase 与前端契约对齐 (与 maintenance/status 一致):
    {
      "lotteryEnabled": true
    }
"""
from fastapi import APIRouter

from app.core.response import success
from app.services.feature_flags_service import feature_flags_service

router = APIRouter(prefix="/feature-flags", tags=["功能开关"])


@router.get("")
def get_public_feature_flags():
    """公开的功能开关查询接口."""
    return success(feature_flags_service.get_config())
