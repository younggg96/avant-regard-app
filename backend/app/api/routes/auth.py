"""
认证路由 - 使用 Supabase Auth
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from app.services.auth_service import auth_service
from app.services.auth_report_service import (
    auth_report_service,
    AuthReportRateLimitError,
)
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


class SendEmailOtpRequest(BaseModel):
    """发送邮箱验证码请求"""
    email: str = Field(..., min_length=5, max_length=100, description="邮箱地址")


class EmailLoginRequest(BaseModel):
    """邮箱密码登录请求"""
    email: str = Field(..., min_length=5, max_length=100, description="邮箱地址")
    password: str = Field(..., min_length=6, description="密码")


class EmailOtpLoginRequest(BaseModel):
    """邮箱验证码登录请求"""
    email: str = Field(..., min_length=5, max_length=100, description="邮箱地址")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")
    username: Optional[str] = Field(None, min_length=2, max_length=50, description="用户名")


class EmailRegisterRequest(BaseModel):
    """邮箱注册请求"""
    email: str = Field(..., min_length=5, max_length=100, description="邮箱地址")
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    password: str = Field(..., min_length=6, description="密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class EmailResetPasswordRequest(BaseModel):
    """邮箱重置密码请求"""
    email: str = Field(..., min_length=5, max_length=100, description="邮箱地址")
    password: str = Field(..., min_length=6, description="新密码")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class AppleLoginRequest(BaseModel):
    """Apple 登录请求"""
    identityToken: str = Field(..., description="Apple identity token")
    fullName: Optional[str] = Field(None, description="用户全名（仅首次授权时可用）")
    email: Optional[str] = Field(None, description="用户邮箱（仅首次授权时可用）")


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    userId: int = Field(..., description="用户ID")
    oldPassword: str = Field(..., min_length=6, description="当前密码")
    newPassword: str = Field(..., min_length=6, description="新密码")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求"""
    refreshToken: str = Field(..., description="刷新令牌")


# ==================== API 端点 ====================

@router.post("/sms/send")
def send_sms(request: SendSmsRequest):
    """
    发送短信验证码
    使用 Supabase Phone Auth 发送 OTP
    """
    ok, message = auth_service.send_sms_otp(request.phone)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/login-sms")
def login_sms(request: VerifySmsRequest):
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
def login_password(request: LoginPasswordRequest):
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
def register(request: RegisterRequest):
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


@router.post("/email/send")
def send_email_otp(request: SendEmailOtpRequest):
    """发送邮箱验证码"""
    ok, message = auth_service.send_email_otp(request.email)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/login-email")
def login_email(request: EmailLoginRequest):
    """邮箱密码登录"""
    result, err = auth_service.login_with_email_password(
        request.email, request.password
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/login-email-otp")
def login_email_otp(request: EmailOtpLoginRequest):
    """邮箱验证码登录（自动注册）"""
    result, err = auth_service.verify_email_otp(
        request.email, request.code, request.username
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/register-email")
def register_email(request: EmailRegisterRequest):
    """邮箱注册"""
    result, err = auth_service.register_with_email(
        request.email, request.username, request.password, request.code
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/forget-password-email")
def forget_password_email(request: EmailResetPasswordRequest):
    """邮箱重置密码"""
    ok, message = auth_service.reset_email_password(
        request.email, request.password, request.code
    )
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/login-apple")
def login_apple(request: AppleLoginRequest):
    """
    Apple 登录
    使用 Apple Identity Token 通过 Supabase 验证并登录/注册
    """
    result, err = auth_service.login_with_apple(
        request.identityToken,
        request.fullName,
        request.email,
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return success(result)


@router.post("/forget-password")
def forget_password(request: ResetPasswordRequest):
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


@router.post("/change-password")
def change_password(request: ChangePasswordRequest):
    """
    修改密码
    需要验证当前密码
    """
    ok, message = auth_service.change_password(
        request.userId,
        request.oldPassword,
        request.newPassword
    )
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return success(message=message)


@router.post("/refresh")
def refresh_token(request: RefreshTokenRequest):
    """
    刷新令牌
    使用 Supabase refresh token 获取新的 access token
    """
    result, err = auth_service.refresh_session(request.refreshToken)
    if err:
        raise HTTPException(status_code=401, detail=err)
    return success(result)


@router.post("/logout")
def logout():
    """登出"""
    auth_service.sign_out()
    return success(message="登出成功")


# ==================== 登录注册问题反馈 ====================

class AuthIssueReportRequest(BaseModel):
    """登录/注册问题反馈请求（无需登录）"""
    issueType: str = Field(
        ...,
        description="OTP_NOT_RECEIVED | REGISTER_FAILED | LOGIN_FAILED | OTHER",
    )
    contactType: str = Field(..., description="PHONE | EMAIL | OTHER")
    contactValue: str = Field(
        ..., min_length=1, max_length=200, description="可回访的手机号或邮箱"
    )
    description: Optional[str] = Field("", max_length=1000, description="问题描述")
    appVersion: Optional[str] = Field("", max_length=32)
    platform: Optional[str] = Field("", max_length=16, description="ios | android | web")
    deviceInfo: Optional[str] = Field("", max_length=500)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    client = request.client
    return client.host if client else ""


@router.post("/report-issue")
def report_auth_issue(payload: AuthIssueReportRequest, request: Request):
    """
    提交登录/注册问题反馈（公开端点，无需登录）。
    工作人员会通过 contactValue 回访用户。
    """
    try:
        report = auth_report_service.submit_report(
            issue_type=payload.issueType,
            contact_type=payload.contactType,
            contact_value=payload.contactValue,
            description=payload.description or "",
            app_version=payload.appVersion or "",
            platform=payload.platform or "",
            device_info=payload.deviceInfo or "",
            client_ip=_client_ip(request),
        )
        return success(report, message="反馈已提交，我们会尽快与您联系")
    except AuthReportRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("report_auth_issue failed")
        raise HTTPException(status_code=500, detail="提交失败，请稍后重试")
