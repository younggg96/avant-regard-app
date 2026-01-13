"""
API 依赖项 - 使用 Supabase Auth 验证
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase import get_supabase
from app.services.auth_service import auth_service

# Bearer Token 认证
security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    获取当前用户 ID（必须认证）
    使用 Supabase Auth Token 验证
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌"
        )
    
    token = credentials.credentials
    
    try:
        # 使用 Supabase 验证 token
        db = get_supabase()
        response = db.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效或过期的令牌"
            )
        
        # 获取应用用户
        app_user = auth_service.get_user_by_supabase_uid(response.user.id)
        
        if not app_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )
        
        if app_user.get("status") != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账号已被禁用"
            )
        
        return app_user["id"]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌验证失败"
        )


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[int]:
    """获取当前用户 ID（可选认证）"""
    if not credentials:
        return None
    
    try:
        db = get_supabase()
        response = db.auth.get_user(credentials.credentials)
        
        if not response.user:
            return None
        
        app_user = auth_service.get_user_by_supabase_uid(response.user.id)
        
        if app_user:
            return app_user["id"]
        return None
        
    except:
        return None


async def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """获取当前管理员用户 ID"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌"
        )
    
    try:
        db = get_supabase()
        response = db.auth.get_user(credentials.credentials)
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效或过期的令牌"
            )
        
        app_user = auth_service.get_user_by_supabase_uid(response.user.id)
        
        if not app_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )
        
        if not app_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="需要管理员权限"
            )
        
        return app_user["id"]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌验证失败"
        )
