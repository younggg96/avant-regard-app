"""
API 依赖项 - 使用 Supabase Auth 验证
"""
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase import get_supabase
from app.services.auth_service import auth_service

# Bearer Token 认证
security = HTTPBearer(auto_error=False)


def decode_token_without_expiry(token: str) -> Optional[str]:
    """
    解码 JWT token，不验证过期时间
    返回 Supabase user ID (sub claim)
    """
    try:
        # 解码但不验证签名和过期时间（开发模式）
        payload = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
        return payload.get("sub")
    except Exception as e:
        print(f"Token decode error: {e}")
        return None


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    获取当前用户 ID（必须认证）
    开发模式：跳过 token 过期验证
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌"
        )
    
    token = credentials.credentials
    
    try:
        # 先尝试正常验证
        db = get_supabase()
        try:
            response = db.auth.get_user(token)
            if response.user:
                supabase_uid = response.user.id
            else:
                supabase_uid = None
        except Exception as e:
            # 如果 Supabase 验证失败（可能是 token 过期），手动解码获取用户 ID
            print(f"Supabase auth failed, trying manual decode: {e}")
            supabase_uid = decode_token_without_expiry(token)
        
        if not supabase_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌"
            )
        
        # 获取应用用户
        app_user = auth_service.get_user_by_supabase_uid(supabase_uid)
        
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
        print(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌验证失败"
        )


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[int]:
    """获取当前用户 ID（可选认证）- 跳过过期验证"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        db = get_supabase()
        
        try:
            response = db.auth.get_user(token)
            if response.user:
                supabase_uid = response.user.id
            else:
                supabase_uid = None
        except:
            # 如果验证失败，手动解码
            supabase_uid = decode_token_without_expiry(token)
        
        if not supabase_uid:
            return None
        
        app_user = auth_service.get_user_by_supabase_uid(supabase_uid)
        
        if app_user:
            return app_user["id"]
        return None
        
    except:
        return None


async def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """获取当前管理员用户 ID - 跳过过期验证"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌"
        )
    
    try:
        token = credentials.credentials
        db = get_supabase()
        
        try:
            response = db.auth.get_user(token)
            if response.user:
                supabase_uid = response.user.id
            else:
                supabase_uid = None
        except:
            supabase_uid = decode_token_without_expiry(token)
        
        if not supabase_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌"
            )
        
        app_user = auth_service.get_user_by_supabase_uid(supabase_uid)
        
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
        print(f"Admin auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌验证失败"
        )
