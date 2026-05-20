"""
认证服务 - 完全使用 Supabase Auth
"""

import logging
from datetime import datetime
from typing import Optional, Tuple

import httpx

from app.db.supabase import get_supabase, get_supabase_admin
from app.core.config import settings
from app.core.security import hash_password, verify_password
from supabase_auth.errors import AuthApiError

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    def _format_phone(self, phone: str) -> str:
        """格式化手机号为国际格式"""
        if phone.startswith("+"):
            return phone
        if len(phone) == 11 and phone.startswith("1"):
            return f"+86{phone}"
        return f"+{phone}"

    def _get_or_create_app_user(
        self, supabase_user_id: str, phone: str, username: str = None
    ) -> dict:
        """获取或创建应用用户记录。

        users / user_info 表受 RLS 保护, anon key 写入会被拒(42501).
        统一用 db_admin (service_role) 做写入, 读取也用 admin 避免行可见性差异.
        """
        admin = self.db_admin
        result = (
            admin.table("users")
            .select("*")
            .eq("supabase_uid", supabase_user_id)
            .execute()
        )

        if result.data:
            return result.data[0]

        clean_phone = phone.replace("+86", "").replace("+1", "").lstrip("+")
        result = admin.table("users").select("*").eq("phone", phone).execute()
        if result.data:
            admin.table("users").update({"supabase_uid": supabase_user_id}).eq(
                "id", result.data[0]["id"]
            ).execute()
            return result.data[0]

        user_data = {
            "supabase_uid": supabase_user_id,
            "phone": phone,
            "username": username or f"用户{phone[-4:]}",
            "is_admin": False,
            "user_type": "USER",
            "status": "ACTIVE",
        }

        result = admin.table("users").insert(user_data).execute()

        if result.data:
            user = result.data[0]
            admin.table("user_info").insert(
                {"user_id": user["id"], "bio": "", "location": "", "avatar_url": ""}
            ).execute()
            return user

        return None

    def send_sms_otp(self, phone: str) -> Tuple[bool, str]:
        """
        发送短信验证码
        使用 Supabase Auth OTP
        """
        try:
            formatted_phone = self._format_phone(phone)
            logger.info(f"Sending OTP to: {formatted_phone} (original: {phone})")

            # 使用 Supabase 发送 OTP
            response = self.db.auth.sign_in_with_otp({"phone": formatted_phone})
            logger.info(f"OTP sent successfully to: {formatted_phone}")

            return True, "验证码发送成功"

        except AuthApiError as e:
            logger.error(f"AuthApiError sending OTP to {formatted_phone}: {str(e)}")
            return False, f"发送失败: {str(e)}"
        except Exception as e:
            logger.error(f"Exception sending OTP to {formatted_phone}: {str(e)}")
            return False, f"发送失败: {str(e)}"

    def verify_sms_otp(
        self, phone: str, code: str, username: str = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        验证短信验证码并登录/注册
        返回 Supabase session 和应用用户信息
        """
        try:
            formatted_phone = self._format_phone(phone)

            # 验证 OTP
            response = self.db.auth.verify_otp(
                {"phone": formatted_phone, "token": code, "type": "sms"}
            )

            if not response.user:
                return None, "验证码错误或已过期"

            # 获取或创建应用用户
            app_user = self._get_or_create_app_user(
                supabase_user_id=response.user.id, phone=phone, username=username
            )

            if not app_user:
                return None, "创建用户失败"

            # 返回完整的登录信息
            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user["phone"],
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None

        except AuthApiError as e:
            return None, f"验证失败: {str(e)}"
        except Exception as e:
            return None, f"验证失败: {str(e)}"

    def login_with_password(
        self, phone: str, password: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        使用手机号和密码登录
        注意：需要在 Supabase 中启用密码登录
        """
        try:
            formatted_phone = self._format_phone(phone)

            # 使用 Supabase 密码登录
            response = self.db.auth.sign_in_with_password(
                {"phone": formatted_phone, "password": password}
            )

            if not response.user:
                return None, "用户名或密码错误"

            # 获取应用用户
            app_user = self._get_or_create_app_user(
                supabase_user_id=response.user.id, phone=phone
            )

            if not app_user:
                return None, "获取用户信息失败"

            if app_user.get("status") != "ACTIVE":
                return None, "账号已被禁用"

            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user["phone"],
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None

        except AuthApiError as e:
            error_msg = str(e)
            if "Invalid login credentials" in error_msg:
                return None, "手机号或密码错误"
            return None, f"登录失败: {error_msg}"
        except Exception as e:
            return None, f"登录失败: {str(e)}"

    def register_with_password(
        self, phone: str, username: str, password: str, code: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        使用手机号、密码和验证码注册
        先验证 OTP，然后更新用户密码
        """
        try:
            formatted_phone = self._format_phone(phone)

            # 先验证 OTP
            response = self.db.auth.verify_otp(
                {"phone": formatted_phone, "token": code, "type": "sms"}
            )

            if not response.user:
                return None, "验证码错误或已过期"

            # 尝试更新用户密码
            try:
                self.db.auth.update_user({"password": password})
            except AuthApiError as pwd_err:
                error_msg = str(pwd_err)
                # 如果是"密码相同"错误，说明用户已存在且密码正确，直接继续
                if "same" in error_msg.lower() or "different" in error_msg.lower():
                    pass  # 密码已设置，继续注册流程
                else:
                    return None, f"设置密码失败: {error_msg}"

            # 创建应用用户
            app_user = self._get_or_create_app_user(
                supabase_user_id=response.user.id, phone=phone, username=username
            )

            # 更新用户名
            if app_user and username:
                self.db_admin.table("users").update({"username": username}).eq(
                    "id", app_user["id"]
                ).execute()
                app_user["username"] = username

            if not app_user:
                return None, "创建用户失败"

            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user["phone"],
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None

        except AuthApiError as e:
            error_msg = str(e)
            if "expired" in error_msg.lower() or "invalid" in error_msg.lower():
                return None, "验证码已过期，请重新发送"
            return None, f"注册失败: {error_msg}"
        except Exception as e:
            return None, f"注册失败: {str(e)}"

    def _get_or_create_email_user(
        self, supabase_user_id: str, email: str, username: str = None
    ) -> dict:
        """Get or create an app user record for email-based auth.

        users / user_info 表受 RLS 保护, 使用 service_role 客户端避免 42501.
        """
        admin = self.db_admin
        result = (
            admin.table("users")
            .select("*")
            .eq("supabase_uid", supabase_user_id)
            .execute()
        )
        if result.data:
            return result.data[0]

        result = admin.table("users").select("*").eq("email", email).execute()
        if result.data:
            admin.table("users").update(
                {"supabase_uid": supabase_user_id}
            ).eq("id", result.data[0]["id"]).execute()
            return result.data[0]

        user_data = {
            "supabase_uid": supabase_user_id,
            "email": email,
            "username": username or f"用户{email.split('@')[0][:8]}",
            "is_admin": False,
            "user_type": "USER",
            "status": "ACTIVE",
        }
        result = admin.table("users").insert(user_data).execute()
        if result.data:
            user = result.data[0]
            admin.table("user_info").insert(
                {"user_id": user["id"], "bio": "", "location": "", "avatar_url": ""}
            ).execute()
            return user
        return None

    def send_email_otp(self, email: str) -> Tuple[bool, str]:
        """Send OTP to an email address via Supabase Auth.

        Bypasses the supabase-py client to use a longer HTTP timeout,
        because MemfireDB's SMTP relay can take 10-20s.
        """
        try:
            logger.info(f"Sending email OTP to: {email}")
            response = httpx.post(
                f"{settings.SUPABASE_URL}/auth/v1/otp",
                json={"email": email},
                headers={
                    "apikey": settings.SUPABASE_KEY,
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            logger.info(
                f"Email OTP response: status={response.status_code}, body={response.text}"
            )
            if response.status_code == 200:
                logger.info(f"Email OTP sent successfully to: {email}")
                return True, "验证码发送成功"
            error_data = response.json()
            msg = (
                error_data.get("msg")
                or error_data.get("error_description")
                or error_data.get("message")
                or str(response.status_code)
            )
            logger.error(f"Email OTP API error for {email}: {msg} | full: {error_data}")
            return False, f"发送失败: {msg}"
        except httpx.TimeoutException:
            logger.warning(f"Email OTP request timed out for {email}, email may still be sent")
            return True, "验证码发送成功"
        except Exception as e:
            logger.error(f"Exception sending email OTP to {email}: {str(e)}")
            return False, f"发送失败: {str(e)}"

    def verify_email_otp(
        self, email: str, code: str, username: str = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        """Verify email OTP and login/register the user."""
        norm_email = (email or "").strip().lower()
        norm_code = (code or "").strip()
        logger.info(
            f"verify_email_otp: email={norm_email!r} code_len={len(norm_code)}"
        )

        response = None
        last_err: Optional[Exception] = None
        for otp_type in ("email", "signup"):
            try:
                response = self.db.auth.verify_otp(
                    {"email": norm_email, "token": norm_code, "type": otp_type}
                )
                if response and response.user:
                    break
            except (AuthApiError, Exception) as e:
                last_err = e
                logger.warning(
                    f"verify_email_otp: type={otp_type} failed: {e!s}"
                )
                continue

        if response is None or not getattr(response, "user", None):
            if last_err is not None:
                msg = str(last_err).lower()
                if "expired" in msg or "invalid" in msg:
                    return None, "验证码错误或已过期"
            return None, "验证码错误或已过期"

        try:
            app_user = self._get_or_create_email_user(
                supabase_user_id=response.user.id,
                email=norm_email,
                username=username,
            )
        except Exception as e:
            logger.exception(f"verify_email_otp: upsert failed: {e!s}")
            return None, f"创建用户失败: {str(e)}"

        if not app_user:
            return None, "创建用户失败"

        return {
            "userId": app_user["id"],
            "username": app_user["username"],
            "phone": app_user.get("phone", ""),
            "is_admin": app_user.get("is_admin", False),
            "userType": app_user.get("user_type", "USER"),
            "accessToken": response.session.access_token,
            "refreshToken": response.session.refresh_token,
            "expiresAt": response.session.expires_at,
        }, None

    def login_with_email_password(
        self, email: str, password: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        """Login with email and password via Supabase Auth."""
        try:
            response = self.db.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            if not response.user:
                return None, "邮箱或密码错误"

            app_user = self._get_or_create_email_user(
                supabase_user_id=response.user.id, email=email
            )
            if not app_user:
                return None, "获取用户信息失败"
            if app_user.get("status") != "ACTIVE":
                return None, "账号已被禁用"

            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user.get("phone", ""),
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None
        except AuthApiError as e:
            error_msg = str(e)
            if "Invalid login credentials" in error_msg:
                return None, "邮箱或密码错误"
            return None, f"登录失败: {error_msg}"
        except Exception as e:
            return None, f"登录失败: {str(e)}"

    def register_with_email(
        self, email: str, username: str, password: str, code: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        """Register with email, OTP verification, and password."""
        norm_email = (email or "").strip().lower()
        norm_code = (code or "").strip()
        logger.info(
            f"register_with_email: email={norm_email!r} username={username!r} "
            f"code_len={len(norm_code)}"
        )

        response = None
        last_err: Optional[Exception] = None
        # Supabase 的 verify_otp 对邮箱有两种 type：
        #   - 'signup': 新用户首次确认
        #   - 'email':  通用邮箱 OTP（已存在用户重新认证）
        # 用户是先 send_email_otp 再 register-email, 服务端 send 默认会
        # should_create_user=true, 但是否生成 signup token 取决于用户是否已存在.
        # 这里两种都尝试, 提高兼容性.
        for otp_type in ("email", "signup"):
            try:
                response = self.db.auth.verify_otp(
                    {"email": norm_email, "token": norm_code, "type": otp_type}
                )
                if response and response.user:
                    logger.info(
                        f"register_with_email: verify_otp ok type={otp_type} "
                        f"user_id={response.user.id}"
                    )
                    break
            except AuthApiError as e:
                last_err = e
                logger.warning(
                    f"register_with_email: verify_otp type={otp_type} failed: {e!s}"
                )
                continue
            except Exception as e:
                last_err = e
                logger.warning(
                    f"register_with_email: verify_otp type={otp_type} crashed: {e!s}"
                )
                continue

        if response is None or not getattr(response, "user", None):
            if last_err is not None:
                msg = str(last_err).lower()
                if "expired" in msg or "invalid" in msg or "token has expired" in msg:
                    return None, "验证码错误或已过期，请重新发送"
                if "rate limit" in msg or "too many" in msg:
                    return None, "请求过于频繁，请稍后重试"
            return None, "验证码错误或已过期"

        try:
            self.db.auth.update_user({"password": password})
        except AuthApiError as pwd_err:
            error_msg = str(pwd_err)
            logger.warning(
                f"register_with_email: update_user(password) failed: {error_msg}"
            )
            # "same as existing password" 与 "different from old password" 可忽略;
            # 其余例如 session missing 等说明 verify_otp 没拿到 session.
            lower = error_msg.lower()
            if "same" not in lower and "different" not in lower:
                if "session" in lower or "not authenticated" in lower:
                    return None, "验证码已通过但会话丢失，请重新发送验证码后重试"
                return None, f"设置密码失败: {error_msg}"
        except Exception as e:
            logger.exception(f"register_with_email: update_user crashed: {e!s}")
            return None, f"设置密码失败: {str(e)}"

        try:
            app_user = self._get_or_create_email_user(
                supabase_user_id=response.user.id,
                email=norm_email,
                username=username,
            )
            if app_user and username:
                self.db_admin.table("users").update({"username": username}).eq(
                    "id", app_user["id"]
                ).execute()
                app_user["username"] = username
        except Exception as e:
            logger.exception(f"register_with_email: upsert app user failed: {e!s}")
            return None, f"创建用户失败: {str(e)}"

        if not app_user:
            return None, "创建用户失败"

        return {
            "userId": app_user["id"],
            "username": app_user["username"],
            "phone": app_user.get("phone", ""),
            "is_admin": app_user.get("is_admin", False),
            "userType": app_user.get("user_type", "USER"),
            "accessToken": response.session.access_token,
            "refreshToken": response.session.refresh_token,
            "expiresAt": response.session.expires_at,
        }, None

    def reset_email_password(
        self, email: str, new_password: str, code: str
    ) -> Tuple[bool, str]:
        """Reset password via email OTP."""
        try:
            response = self.db.auth.verify_otp(
                {"email": email, "token": code, "type": "email"}
            )
            if not response.user:
                return False, "验证码错误或已过期"
            self.db.auth.update_user({"password": new_password})
            return True, "密码重置成功"
        except AuthApiError as e:
            return False, f"重置失败: {str(e)}"
        except Exception as e:
            return False, f"重置失败: {str(e)}"

    def login_with_apple(
        self, identity_token: str, full_name: str = None, email: str = None
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        Apple Sign-In: verify the identity token via Supabase and login/register the user.
        Apple only provides the user's name on the first sign-in.
        """
        try:
            response = self.db.auth.sign_in_with_id_token({
                "provider": "apple",
                "token": identity_token,
            })

            if not response.user:
                return None, "Apple 登录验证失败"

            username = full_name or f"Apple用户{response.user.id[:6]}"

            app_user = self._get_or_create_apple_user(
                supabase_user_id=response.user.id,
                email=email or response.user.email,
                username=username,
            )

            if not app_user:
                return None, "创建用户失败"

            if app_user.get("status") != "ACTIVE":
                return None, "账号已被禁用"

            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user.get("phone", ""),
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None

        except AuthApiError as e:
            error_msg = str(e)
            if "invalid" in error_msg.lower():
                return None, "Apple 登录凭证无效，请重试"
            return None, f"Apple 登录失败: {error_msg}"
        except Exception as e:
            return None, f"Apple 登录失败: {str(e)}"

    def _get_or_create_apple_user(
        self, supabase_user_id: str, email: str = None, username: str = None
    ) -> dict:
        """Get or create an app user record for Apple Sign-In (no phone required).

        users / user_info 表受 RLS 保护, 使用 service_role 客户端避免 42501.
        """
        admin = self.db_admin
        result = (
            admin.table("users")
            .select("*")
            .eq("supabase_uid", supabase_user_id)
            .execute()
        )

        if result.data:
            user = result.data[0]
            if username and user.get("username", "").startswith("Apple用户"):
                admin.table("users").update({"username": username}).eq(
                    "id", user["id"]
                ).execute()
                user["username"] = username
            return user

        if email:
            result = admin.table("users").select("*").eq("email", email).execute()
            if result.data:
                admin.table("users").update(
                    {"supabase_uid": supabase_user_id}
                ).eq("id", result.data[0]["id"]).execute()
                return result.data[0]

        user_data = {
            "supabase_uid": supabase_user_id,
            "email": email or "",
            "username": username or f"Apple用户{supabase_user_id[:6]}",
            "is_admin": False,
            "user_type": "USER",
            "status": "ACTIVE",
        }

        result = admin.table("users").insert(user_data).execute()

        if result.data:
            user = result.data[0]
            admin.table("user_info").insert(
                {"user_id": user["id"], "bio": "", "location": "", "avatar_url": ""}
            ).execute()
            return user

        return None

    def refresh_session(
        self, refresh_token: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        刷新 session
        """
        try:
            response = self.db.auth.refresh_session(refresh_token)

            if not response.session:
                return None, "刷新令牌无效或已过期"

            # 获取应用用户
            result = (
                self.db.table("users")
                .select("*")
                .eq("supabase_uid", response.user.id)
                .execute()
            )

            if not result.data:
                return None, "用户不存在"

            app_user = result.data[0]

            return {
                "userId": app_user["id"],
                "username": app_user["username"],
                "phone": app_user["phone"],
                "is_admin": app_user.get("is_admin", False),
                "userType": app_user.get("user_type", "USER"),
                "accessToken": response.session.access_token,
                "refreshToken": response.session.refresh_token,
                "expiresAt": response.session.expires_at,
            }, None

        except AuthApiError as e:
            return None, f"刷新失败: {str(e)}"
        except Exception as e:
            return None, f"刷新失败: {str(e)}"

    def reset_password(
        self, phone: str, new_password: str, code: str
    ) -> Tuple[bool, str]:
        """
        重置密码
        """
        try:
            formatted_phone = self._format_phone(phone)

            # 验证 OTP
            response = self.db.auth.verify_otp(
                {"phone": formatted_phone, "token": code, "type": "sms"}
            )

            if not response.user:
                return False, "验证码错误或已过期"

            # 更新密码
            self.db.auth.update_user({"password": new_password})

            return True, "密码重置成功"

        except AuthApiError as e:
            return False, f"重置失败: {str(e)}"
        except Exception as e:
            return False, f"重置失败: {str(e)}"

    def change_password(
        self, user_id: int, old_password: str, new_password: str
    ) -> Tuple[bool, str]:
        """Change password for an authenticated user by verifying old password first."""
        try:
            result = (
                self.db.table("users")
                .select("*")
                .eq("id", user_id)
                .execute()
            )

            if not result.data:
                return False, "用户不存在"

            app_user = result.data[0]
            phone = app_user.get("phone")
            email = app_user.get("email")

            if phone:
                formatted_phone = self._format_phone(phone)
                response = self.db.auth.sign_in_with_password(
                    {"phone": formatted_phone, "password": old_password}
                )
            elif email:
                response = self.db.auth.sign_in_with_password(
                    {"email": email, "password": old_password}
                )
            else:
                return False, "未找到账号登录信息，无法修改密码"

            if not response.user:
                return False, "当前密码错误"

            self.db.auth.update_user({"password": new_password})
            return True, "密码修改成功"

        except AuthApiError as e:
            error_msg = str(e)
            if "invalid" in error_msg.lower():
                return False, "当前密码错误"
            return False, f"修改失败: {error_msg}"
        except Exception as e:
            return False, f"修改失败: {str(e)}"

    def sign_out(self) -> bool:
        """登出"""
        try:
            self.db.auth.sign_out()
            return True
        except:
            return False

    def get_user_by_id(self, user_id: int) -> Optional[dict]:
        """根据应用用户ID获取用户"""
        result = self.db.table("users").select("*").eq("id", user_id).execute()
        if result.data:
            return result.data[0]
        return None

    def get_user_by_supabase_uid(self, supabase_uid: str) -> Optional[dict]:
        """根据 Supabase UID 获取用户"""
        result = (
            self.db.table("users")
            .select("*")
            .eq("supabase_uid", supabase_uid)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None


# 单例
auth_service = AuthService()
