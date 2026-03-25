"""
Content moderation routes: report + block.
Required by Apple Guideline 1.2 (User-Generated Content).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.services.moderation_service import moderation_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/moderation", tags=["内容审核"])


class ReportContentRequest(BaseModel):
    targetType: str = Field(..., description="POST or COMMENT")
    targetId: int = Field(..., description="Target post or comment ID")
    reason: str = Field(..., description="Report reason category")
    description: Optional[str] = Field("", description="Additional description")


class BlockUserRequest(BaseModel):
    blockedUserId: int = Field(..., description="User ID to block")


@router.post("/report")
async def report_content(
    request: ReportContentRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Report objectionable content (post or comment)"""
    if request.targetType not in ("POST", "COMMENT"):
        raise HTTPException(status_code=400, detail="targetType must be POST or COMMENT")

    try:
        report = moderation_service.report_content(
            reporter_id=current_user_id,
            target_type=request.targetType,
            target_id=request.targetId,
            reason=request.reason,
            description=request.description or "",
        )
        return success(report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/block")
async def block_user(
    request: BlockUserRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Block an abusive user (instantly removes their content from your feed)"""
    if request.blockedUserId == current_user_id:
        raise HTTPException(status_code=400, detail="不能屏蔽自己")

    moderation_service.block_user(current_user_id, request.blockedUserId)
    return success(message="用户已屏蔽")


@router.delete("/block/{blocked_user_id}")
async def unblock_user(
    blocked_user_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Unblock a previously blocked user"""
    moderation_service.unblock_user(current_user_id, blocked_user_id)
    return success(message="已取消屏蔽")


@router.get("/blocked-users")
async def get_blocked_users(
    current_user_id: int = Depends(get_current_user_id),
):
    """Get list of blocked users"""
    users = moderation_service.get_blocked_users(current_user_id)
    return success(users)
