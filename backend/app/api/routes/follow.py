"""
关注路由
"""
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.follow import FollowUserRequest, FollowBrandRequest, BatchFollowBrandsRequest
from app.services.follow_service import follow_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/follow", tags=["关注"])


# ==================== 用户关注 ====================

@router.post("/user")
def follow_user(
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
def unfollow_user(
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
def get_following_users(user_id: int):
    """获取用户关注的用户列表"""
    try:
        result = follow_service.get_following_users(user_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_following_users route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/followers")
def get_followers(user_id: int):
    """获取用户的粉丝列表"""
    try:
        result = follow_service.get_followers(user_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_followers route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/following/count")
def get_following_count(user_id: int):
    """获取用户关注的用户数量"""
    count = follow_service.get_following_count(user_id)
    return success(count)


@router.get("/user/{user_id}/followers/count")
def get_followers_count(user_id: int):
    """获取用户的粉丝数量"""
    count = follow_service.get_followers_count(user_id)
    return success(count)


@router.get("/user/{follower_id}/is-following/{target_user_id}")
def is_following_user(follower_id: int, target_user_id: int):
    """检查是否关注了某个用户"""
    is_following = follow_service.is_following_user(follower_id, target_user_id)
    return success(is_following)


@router.get("/users/{user_id}/mutual-follows")
def get_mutual_follows(user_id: int):
    """获取互相关注的用户列表"""
    try:
        result = follow_service.get_mutual_follows(user_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_mutual_follows route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/mutual-follows/count")
def get_mutual_follows_count(user_id: int):
    """获取互相关注的用户数量"""
    count = follow_service.get_mutual_follows_count(user_id)
    return success(count)


@router.get("/user/{user_id}/is-mutual/{target_user_id}")
def is_mutual_follow(user_id: int, target_user_id: int):
    """检查两个用户是否互相关注"""
    result = follow_service.is_mutual_follow(user_id, target_user_id)
    return success(result)


# ==================== 品牌关注 ====================

@router.post("/brand")
def follow_brand(
    request: FollowBrandRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """关注品牌"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户关注品牌")
    
    ok = follow_service.follow_brand(request.userId, request.brandId)
    if not ok:
        raise HTTPException(status_code=400, detail="关注品牌失败（可能已关注）")
    return success(message="关注品牌成功")


@router.delete("/brand")
def unfollow_brand(
    request: FollowBrandRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """取消关注品牌"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权取消其他用户的品牌关注")
    
    ok = follow_service.unfollow_brand(request.userId, request.brandId)
    if not ok:
        raise HTTPException(status_code=400, detail="取消关注品牌失败")
    return success(message="取消关注品牌成功")


@router.post("/brand/batch")
def batch_follow_brands(
    request: BatchFollowBrandsRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """批量关注品牌（选择喜欢的品牌后自动关注）"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户关注品牌")
    
    count = follow_service.batch_follow_brands(request.userId, request.brandIds)
    return success(data=count, message=f"成功关注 {count} 个品牌")


@router.get("/users/{user_id}/following-brands")
def get_following_brands(user_id: int):
    """获取用户关注的品牌列表"""
    try:
        result = follow_service.get_following_brands(user_id)
        return success([b.model_dump() for b in result])
    except Exception as e:
        print(f"Error in get_following_brands route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brand/{brand_id}/followers")
def get_brand_followers(brand_id: int):
    """获取品牌的关注者列表"""
    try:
        result = follow_service.get_brand_followers(brand_id)
        return success([u.model_dump() for u in result])
    except Exception as e:
        print(f"Error in get_brand_followers route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/brand/{brand_id}/followers/count")
def get_brand_followers_count(brand_id: int):
    """获取品牌的关注者数量"""
    count = follow_service.get_brand_followers_count(brand_id)
    return success(count)


@router.get("/user/{user_id}/is-following-brand/{brand_id}")
def is_following_brand(user_id: int, brand_id: int):
    """检查用户是否关注了某个品牌"""
    is_following = follow_service.is_following_brand(user_id, brand_id)
    return success(is_following)


@router.get("/user/{user_id}/following-brand-ids")
def get_following_brand_ids(user_id: int):
    """获取用户关注的品牌 ID 列表"""
    brand_ids = follow_service.get_following_brand_ids(user_id)
    return success(brand_ids)
