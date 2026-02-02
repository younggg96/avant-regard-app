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
)
from app.services.user_service import user_service
from app.services.file_service import file_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/user-info", tags=["用户信息"])


@router.get("/search")
async def search_users(
    keyword: str = Query(..., description="搜索关键词（用户名或用户ID）"),
    limit: int = Query(20, description="返回数量限制"),
):
    """搜索用户（支持用户名模糊搜索和用户ID精确搜索）"""
    results = user_service.search_users(keyword=keyword, limit=limit)
    return success([r.model_dump() for r in results])


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
        favoriteBrandIds=request.favoriteBrandIds,
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
    )
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result.model_dump())
