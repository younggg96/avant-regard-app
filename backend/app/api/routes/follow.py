"""
关注路由
"""
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.follow import FollowUserRequest
from app.services.follow_service import follow_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/follow", tags=["关注"])


# ==================== 用户关注 ====================

@router.post("/user")
async def follow_user(
    request: FollowUserRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """关注用户"""
    if request.followerId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户关注")
    
    ok = follow_service.follow_user(request.followerId, request.targetUserId)
    if not ok:
        raise HTTPException(status_code=400, detail="关注失败（可能已关注或不能关注自己）")
    return success(message="关注成功")


@router.delete("/user")
async def unfollow_user(
    request: FollowUserRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """取消关注用户"""
    if request.followerId != current_user_id:
        raise HTTPException(status_code=403, detail="无权取消其他用户的关注")
    
    ok = follow_service.unfollow_user(request.followerId, request.targetUserId)
    if not ok:
        raise HTTPException(status_code=400, detail="取消关注失败")
    return success(message="取消关注成功")


@router.get("/users/{user_id}/following-users")
async def get_following_users(user_id: int):
    """获取用户关注的用户列表"""
    result = follow_service.get_following_users(user_id)
    return success([u.model_dump() for u in result])


@router.get("/user/{user_id}/following/count")
async def get_following_count(user_id: int):
    """获取用户关注的用户数量"""
    count = follow_service.get_following_count(user_id)
    return success(count)


@router.get("/user/{user_id}/followers/count")
async def get_followers_count(user_id: int):
    """获取用户的粉丝数量"""
    count = follow_service.get_followers_count(user_id)
    return success(count)


@router.get("/user/{follower_id}/is-following/{target_user_id}")
async def is_following_user(follower_id: int, target_user_id: int):
    """检查是否关注了某个用户"""
    is_following = follow_service.is_following_user(follower_id, target_user_id)
    return success(is_following)


# ==================== 设计师关注 ====================

@router.post("/designers/{designer_id}")
async def follow_designer(
    designer_id: int,
    current_user_id: int = Depends(get_current_user_id)
):
    """关注设计师"""
    ok = follow_service.follow_designer(current_user_id, designer_id)
    if not ok:
        raise HTTPException(status_code=400, detail="关注失败（可能已关注）")
    return success(message="关注成功")


@router.delete("/designers/{designer_id}")
async def unfollow_designer(
    designer_id: int,
    current_user_id: int = Depends(get_current_user_id)
):
    """取消关注设计师"""
    ok = follow_service.unfollow_designer(current_user_id, designer_id)
    if not ok:
        raise HTTPException(status_code=400, detail="取消关注失败")
    return success(message="取消关注成功")


@router.get("/users/{user_id}/following-designers")
async def get_following_designers(user_id: int):
    """获取用户关注的设计师列表"""
    result = follow_service.get_following_designers(user_id)
    return success([d.model_dump() for d in result])


@router.get("/users/{user_id}/following-designers/count")
async def get_following_designers_count(user_id: int):
    """获取用户关注的设计师数量"""
    count = follow_service.get_following_designers_count(user_id)
    return success(count)


@router.get("/designer/{user_id}/is-following/{designer_id}")
async def is_following_designer(user_id: int, designer_id: int):
    """检查是否关注了某个设计师"""
    is_following = follow_service.is_following_designer(user_id, designer_id)
    return success(is_following)


@router.get("/designer/{designer_id}/followers/count")
async def get_designer_followers_count(designer_id: int):
    """获取设计师的粉丝数量"""
    count = follow_service.get_designer_followers_count(designer_id)
    return success(count)
