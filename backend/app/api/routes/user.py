"""
用户路由
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from app.schemas.user import (
    UserInfo,
    UserProfileInfo,
    UpdateUserInfoRequest,
    UpdateUserProfileRequest,
    UserPrivacySettings,
    UpdatePrivacySettingsRequest,
    UpdateLanguageRequest,
)
from app.services.user_service import user_service
from app.services.file_service import file_service
from app.api.deps import get_current_user_id
from app.core.response import success
from app.db.supabase import get_supabase

router = APIRouter(prefix="/user-info", tags=["用户信息"])


@router.get("/search")
async def search_users(
    keyword: str = Query(..., description="搜索关键词（用户名或用户ID）"),
    limit: int = Query(20, description="返回数量限制"),
):
    """搜索用户（支持用户名模糊搜索和用户ID精确搜索）"""
    results = user_service.search_users(keyword=keyword, limit=limit)
    return success([r.model_dump() for r in results])


@router.get("/contribution-leaderboard")
async def get_contribution_leaderboard(
    limit: int = Query(20, description="返回数量限制"),
):
    """获取 Archive 贡献榜"""
    leaderboard = user_service.get_contribution_leaderboard(limit=limit)
    return success(leaderboard)


@router.get("/{user_id}")
async def get_user_info(user_id: int):
    """获取用户信息"""
    result = user_service.get_user_info(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.put("/{user_id}")
async def update_user_info(
    user_id: int,
    request: UpdateUserInfoRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新用户信息"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户信息")

    result = user_service.update_user_info(
        user_id,
        username=request.username,
        bio=request.bio,
        location=request.location,
        avatarUrl=request.avatarUrl,
        coverUrl=request.coverUrl,
    )
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.post("/{user_id}/avatar")
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """上传用户头像"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户头像")

    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图片文件")

    # 上传图片
    content = await file.read()
    avatar_url = file_service.upload_image(content, file.filename, file.content_type)

    if not avatar_url:
        raise HTTPException(status_code=500, detail="头像上传失败")

    # 更新用户头像
    result = user_service.upload_avatar(user_id, avatar_url)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.post("/{user_id}/cover")
async def upload_cover(
    user_id: int,
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """上传用户封面图片"""
    print(f"[Upload Cover] user_id: {user_id}, current_user_id: {current_user_id}")

    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户封面")

    # 验证文件类型
    print(
        f"[Upload Cover] file content_type: {file.content_type}, filename: {file.filename}"
    )
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail=f"只能上传图片文件，当前类型: {file.content_type}"
        )

    # 上传图片
    content = await file.read()
    print(f"[Upload Cover] file size: {len(content)} bytes")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件内容为空")

    cover_url = file_service.upload_image(content, file.filename, file.content_type)

    if not cover_url:
        raise HTTPException(
            status_code=500, detail="封面上传失败，请检查 Supabase Storage 配置"
        )

    print(f"[Upload Cover] cover_url: {cover_url}")

    # 更新用户封面
    result = user_service.upload_cover(user_id, cover_url)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.get("/{user_id}/profile")
async def get_user_profile(user_id: int):
    """获取用户完整资料"""
    result = user_service.get_user_profile(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.get("/{user_id}/user-type")
async def get_user_type(user_id: int):
    """获取用户类型（轻量接口，仅查 users 表）"""
    result = user_service.get_user_type(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result)


@router.put("/{user_id}/profile")
async def update_user_profile(
    user_id: int,
    request: UpdateUserProfileRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新用户资料"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户资料")

    result = user_service.update_user_profile(
        user_id,
        username=request.username,
        bio=request.bio,
        location=request.location,
        avatarUrl=request.avatarUrl,
        coverUrl=request.coverUrl,
        gender=request.gender.value if request.gender else None,
        age=request.age,
        preference=request.preference,
        followedBrandIds=request.followedBrandIds,
        profileCompleted=request.profileCompleted,
    )
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.get("/{user_id}/privacy")
async def get_privacy_settings(user_id: int):
    """获取用户隐私设置"""
    result = user_service.get_privacy_settings(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.put("/{user_id}/privacy")
async def update_privacy_settings(
    user_id: int,
    request: UpdatePrivacySettingsRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新用户隐私设置"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户隐私设置")

    result = user_service.update_privacy_settings(
        user_id,
        hideFollowing=request.hideFollowing,
        hideFollowers=request.hideFollowers,
        hideLikes=request.hideLikes,
        hideWishlist=request.hideWishlist,
    )
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.put("/{user_id}/language")
async def update_language_preference(
    user_id: int,
    request: UpdateLanguageRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新用户语言偏好"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户设置")

    result = user_service.update_language_preference(user_id, request.language)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())


@router.delete("/{user_id}/account")
async def delete_account(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """Self-service account deletion (Apple Guideline 5.1.1(v))"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权删除其他用户账户")

    ok = user_service.delete_account(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(message="账户已永久删除")


# ==================== 用户头衔 ====================

@router.get("/{user_id}/titles")
async def get_user_titles(user_id: int):
    """获取用户的所有头衔（公开接口）"""
    db = get_supabase()
    result = (
        db.table("user_titles")
        .select("*")
        .eq("user_id", user_id)
        .order("is_primary", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    titles = [
        {
            "id": t["id"],
            "userId": t["user_id"],
            "title": t["title"],
            "isPrimary": t.get("is_primary", False),
            "createdAt": t.get("created_at"),
        }
        for t in result.data or []
    ]
    return success(titles)


@router.put("/{user_id}/titles/{title_id}/set-primary")
async def set_primary_title(
    user_id: int,
    title_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """设置主头衔"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户头衔")

    db = get_supabase()

    title_result = (
        db.table("user_titles")
        .select("id")
        .eq("id", title_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not title_result.data:
        raise HTTPException(status_code=404, detail="头衔不存在")

    db.table("user_titles").update(
        {"is_primary": False}
    ).eq("user_id", user_id).eq("is_primary", True).execute()

    db.table("user_titles").update(
        {"is_primary": True}
    ).eq("id", title_id).execute()

    return success(message="主头衔已更新")


@router.put("/{user_id}/titles/clear-primary")
async def clear_primary_title(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """取消主头衔展示"""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户头衔")

    db = get_supabase()
    db.table("user_titles").update(
        {"is_primary": False}
    ).eq("user_id", user_id).eq("is_primary", True).execute()

    return success(message="已取消主头衔展示")
