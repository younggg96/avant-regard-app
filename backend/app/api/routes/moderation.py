"""
Content moderation routes: report + block.
Required by Apple Guideline 1.2 (User-Generated Content).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from app.services.moderation_service import moderation_service, DuplicateReportError
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/moderation", tags=["内容审核"])


class ReportContentRequest(BaseModel):
    targetType: str = Field(..., description="POST, COMMENT, MESSAGE, or USER")
    targetId: int = Field(..., description="Target ID")
    reason: str = Field(..., description="Report reason category")
    description: Optional[str] = Field("", description="Additional description")


class BlockUserRequest(BaseModel):
    blockedUserId: int = Field(..., description="User ID to block")


VALID_REPORT_TYPES = {"POST", "COMMENT", "MESSAGE", "USER"}


@router.post("/report")
def report_content(
    request: ReportContentRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Report objectionable content (post, comment, message, or user)"""
    if request.targetType not in VALID_REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"targetType must be one of {', '.join(VALID_REPORT_TYPES)}",
        )

    try:
        report = moderation_service.report_content(
            reporter_id=current_user_id,
            target_type=request.targetType,
            target_id=request.targetId,
            reason=request.reason,
            description=request.description or "",
        )
        return success(report)
    except DuplicateReportError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/block")
def block_user(
    request: BlockUserRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Block an abusive user (instantly removes their content from your feed)"""
    if request.blockedUserId == current_user_id:
        raise HTTPException(status_code=400, detail="不能屏蔽自己")

    moderation_service.block_user(current_user_id, request.blockedUserId)
    return success(message="用户已屏蔽")


@router.delete("/block/{blocked_user_id}")
def unblock_user(
    blocked_user_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Unblock a previously blocked user"""
    moderation_service.unblock_user(current_user_id, blocked_user_id)
    return success(message="已取消屏蔽")


@router.get("/blocked-users")
def get_blocked_users(
    current_user_id: int = Depends(get_current_user_id),
):
    """Get list of blocked users"""
    users = moderation_service.get_blocked_users(current_user_id)
    return success(users)


@router.get("/my-reports")
def get_my_reports(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user_id),
):
    """Get the current user's own report history"""
    result = moderation_service.get_my_reports(
        user_id=current_user_id, page=page, page_size=pageSize
    )
    return success(result)
