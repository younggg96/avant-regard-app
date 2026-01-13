"""
认证路由 - 使用 Supabase Auth
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.auth_service import auth_service
from app.core.response import success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["认证"])


# ==================== 请求模型 ====================

class SendSmsRequest(BaseModel):
    """发送短信请求"""
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")


class VerifySmsRequest(BaseModel):
    """验证短信请求（用于登录/注册）"""
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")
    username: Optional[str] = Field(None, min_length=2, max_length=50, description="用户名（注册时使用）")


class LoginPasswordRequest(BaseModel):
    """密码登录请求"""
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")
    password: str = Field(..., min_length=6, description="密码")


class RegisterRequest(BaseModel):
    """注册请求"""
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    password: str = Field(..., min_length=6, description="密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")
    password: str = Field(..., min_length=6, description="新密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求"""
    refreshToken: str = Field(..., description="刷新令牌")


# ==================== API 端点 ====================

@router.post("/sms/send")
async def send_sms(request: SendSmsRequest):
    """
    发送短信验证码
    使用 Supabase Phone Auth 发送 OTP
    """
    ok, message = auth_service.send_sms_otp(request.phone)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/login-sms")
async def login_sms(request: VerifySmsRequest):
    """
    短信验证码登录/注册
    验证成功后自动登录，如果用户不存在则自动注册
    """
    result, err = auth_service.verify_sms_otp(
        request.phone,
        request.code,
        request.username
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/login")
async def login_password(request: LoginPasswordRequest):
    """
    密码登录
    需要用户已设置密码
    """
    result, err = auth_service.login_with_password(
        request.phone,
        request.password
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/register")
async def register(request: RegisterRequest):
    """
    用户注册
    需要先发送验证码，验证后设置密码
    """
    logger.info(f"Register request: phone={request.phone}, username={request.username}, code={request.code}")
    result, err = auth_service.register_with_password(
        request.phone,
        request.username,
        request.password,
        request.code
    )
    if err:
        logger.error(f"Register failed: {err}")
        raise HTTPException(status_code=400, detail=err)
    logger.info(f"Register success: user_id={result.get('userId')}")
    return success(result)


@router.post("/forget-password")
async def forget_password(request: ResetPasswordRequest):
    """
    忘记密码/重置密码
    需要先发送验证码
    """
    ok, message = auth_service.reset_password(
        request.phone,
        request.password,
        request.code
    )
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest):
    """
    刷新令牌
    使用 Supabase refresh token 获取新的 access token
    """
    result, err = auth_service.refresh_session(request.refreshToken)
    if err:
        raise HTTPException(status_code=401, detail=err)
    return success(result)


@router.post("/logout")
async def logout():
    """登出"""
    auth_service.sign_out()
    return success(message="登出成功")
