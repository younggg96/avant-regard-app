"""
认证相关的数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional


class LoginRequest(BaseModel):
    """密码登录请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    password: str = Field(..., min_length=6, description="密码")


class LoginSmsRequest(BaseModel):
    """短信验证码登录请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class RegisterRequest(BaseModel):
    """注册请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    password: str = Field(..., min_length=6, description="密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class SendSmsRequest(BaseModel):
    """发送短信请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")


class ForgetPasswordRequest(BaseModel):
    """忘记密码/重置密码请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    password: str = Field(..., min_length=6, description="新密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求"""
    refreshToken: str = Field(..., description="刷新令牌")


class LoginResponse(BaseModel):
    """登录响应"""
    userId: int
    username: str
    phone: str
    admin: bool
    userType: str
    accessToken: str
    refreshToken: str
