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
    try:
        result = follow_service.get_following_users(user_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_following_users route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/followers")
async def get_followers(user_id: int):
    """获取用户的粉丝列表"""
    try:
        result = follow_service.get_followers(user_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_followers route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
