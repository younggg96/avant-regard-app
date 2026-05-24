"""
用户服务
"""
import logging
from typing import Optional, List
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.user import UserInfo, UserProfileInfo, UserPrivacySettings

logger = logging.getLogger(__name__)


def _sanitize_remote_url(value) -> Optional[str]:
    """最后一道防线：拒绝写入非 http(s) 的 avatar / cover URL。

    移动端 ImagePicker 会给出 `file:///var/mobile/.../ImagePicker/xxx.jpg`，
    而 web 的 `next/image` 只接受 http(s)。历史上出现过客户端在上传尚未完成时
    就把 `file://` URI 带进 `avatarUrl` / `coverUrl` 字段的情况，一旦写入
    就会把该用户的每一张被引用头像的页面在 SSR 阶段整体 500。

    返回：
        - 合法 http(s) 字符串 → 原值（带 trim）
        - 空串 → 空串（允许用户主动清空）
        - 其它 → None（外层用 None 忽略，保持现有值不变）
    """
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if trimmed == "":
        return ""
    lower = trimmed.lower()
    if lower.startswith("http://") or lower.startswith("https://"):
        return trimmed
    logger.warning(
        "Rejected non-http(s) image URL in user profile update: %r", trimmed
    )
    return None


class UserService:
    def __init__(self):
        # users / user_info / user_titles / brand_follows 等表都启用了 RLS,
        # 应用层(API)在 deps.get_current_user_id 里已用 JWT 完成鉴权;
        # 业务层用 service_role 客户端旁路 RLS, 避免 SELECT/UPDATE 返回空导致 404/500.
        self.db_admin = get_supabase_admin()
        self.db = self.db_admin

    def _get_primary_title(self, user_id: int) -> Optional[str]:
        """获取用户的主头衔"""
        try:
            result = (
                self.db.table("user_titles")
                .select("title")
                .eq("user_id", user_id)
                .eq("is_primary", True)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]["title"]
        except Exception:
            pass
        return None

    def get_user_info(self, user_id: int) -> Optional[UserInfo]:
        """获取用户信息"""
        user_result = self.db.table("users").select("id, username").eq("id", user_id).execute()
        if not user_result.data:
            return None
        user = user_result.data[0]

        info_result = self.db.table("user_info").select("*").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]

        primary_title = self._get_primary_title(user_id)

        return UserInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            coverUrl=info.get("cover_url", ""),
            primaryTitle=primary_title,
            preferredLanguage=info.get("preferred_language"),
            preferredTheme=info.get("preferred_theme", "system"),
            preferredCurrency=info.get("preferred_currency"),
        )

    def update_user_info(self, user_id: int, **kwargs) -> Optional[UserInfo]:
        """更新用户信息"""
        update_data = {}
        user_update = {}
        
        # 分离用户表和用户信息表的字段
        if "username" in kwargs and kwargs["username"]:
            user_update["username"] = kwargs["username"]
        if "bio" in kwargs and kwargs["bio"] is not None:
            update_data["bio"] = kwargs["bio"]
        if "location" in kwargs and kwargs["location"] is not None:
            update_data["location"] = kwargs["location"]
        if "avatarUrl" in kwargs and kwargs["avatarUrl"] is not None:
            sanitized = _sanitize_remote_url(kwargs["avatarUrl"])
            if sanitized is not None:
                update_data["avatar_url"] = sanitized
        if "coverUrl" in kwargs and kwargs["coverUrl"] is not None:
            sanitized = _sanitize_remote_url(kwargs["coverUrl"])
            if sanitized is not None:
                update_data["cover_url"] = sanitized
        
        # 更新用户表
        if user_update:
            self.db.table("users").update(user_update).eq("id", user_id).execute()
        
        # 更新用户信息表
        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()
        
        return self.get_user_info(user_id)

    def get_user_type(self, user_id: int) -> Optional[dict]:
        """获取用户类型（轻量查询，仅查 users 表）"""
        result = self.db.table("users").select("id, is_admin, user_type").eq("id", user_id).execute()
        if not result.data:
            return None
        user = result.data[0]
        return {
            "userId": user["id"],
            "isAdmin": user.get("is_admin", False),
            "userType": user.get("user_type", "USER"),
        }

    def get_user_profile(self, user_id: int) -> Optional[UserProfileInfo]:
        """获取用户完整资料"""
        # 获取用户基本信息
        user_result = self.db.table("users").select("id, username, user_type").eq("id", user_id).execute()
        if not user_result.data:
            return None
        user = user_result.data[0]
        
        # 获取用户详细信息
        info_result = self.db.table("user_info").select("*").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]
        
        # 获取用户关注的品牌
        followed_brands_result = (
            self.db.table("brand_follows")
            .select("brand_id")
            .eq("user_id", user_id)
            .execute()
        )
        followed_brand_ids = [item["brand_id"] for item in followed_brands_result.data] if followed_brands_result.data else []
        
        return UserProfileInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            coverUrl=info.get("cover_url", ""),
            gender=info.get("gender", "OTHER"),
            age=info.get("age", 0),
            preference=info.get("preference", ""),
            followedBrandIds=followed_brand_ids,
            profileCompleted=info.get("profile_completed", False),
            userType=user.get("user_type", "USER"),
        )

    def update_user_profile(self, user_id: int, **kwargs) -> Optional[UserProfileInfo]:
        """更新用户资料"""
        update_data = {}
        user_update = {}
        
        # 分离用户表和用户信息表的字段
        if "username" in kwargs and kwargs["username"]:
            user_update["username"] = kwargs["username"]
        if "bio" in kwargs and kwargs["bio"] is not None:
            update_data["bio"] = kwargs["bio"]
        if "location" in kwargs and kwargs["location"] is not None:
            update_data["location"] = kwargs["location"]
        if "avatarUrl" in kwargs and kwargs["avatarUrl"] is not None:
            sanitized = _sanitize_remote_url(kwargs["avatarUrl"])
            if sanitized is not None:
                update_data["avatar_url"] = sanitized
        if "coverUrl" in kwargs and kwargs["coverUrl"] is not None:
            sanitized = _sanitize_remote_url(kwargs["coverUrl"])
            if sanitized is not None:
                update_data["cover_url"] = sanitized
        if "gender" in kwargs and kwargs["gender"] is not None:
            update_data["gender"] = kwargs["gender"]
        if "age" in kwargs and kwargs["age"] is not None:
            update_data["age"] = kwargs["age"]
        if "preference" in kwargs and kwargs["preference"] is not None:
            update_data["preference"] = kwargs["preference"]
        # 支持直接设置 profileCompleted
        if "profileCompleted" in kwargs and kwargs["profileCompleted"] is not None:
            update_data["profile_completed"] = kwargs["profileCompleted"]
        
        # 更新用户表
        if user_update:
            self.db.table("users").update(user_update).eq("id", user_id).execute()
        
        # 更新用户信息表
        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()
        
        # 更新关注的品牌（如果提供）
        if "followedBrandIds" in kwargs and kwargs["followedBrandIds"] is not None:
            followed_brand_ids = kwargs["followedBrandIds"]
            
            # 先删除现有的品牌关注
            self.db.table("brand_follows").delete().eq("user_id", user_id).execute()
            
            # 插入新的品牌关注（最多5个）
            if followed_brand_ids:
                brand_ids_to_insert = followed_brand_ids[:5]
                for brand_id in brand_ids_to_insert:
                    self.db.table("brand_follows").upsert(
                        {"user_id": user_id, "brand_id": brand_id},
                        on_conflict="user_id,brand_id"
                    ).execute()
        
        return self.get_user_profile(user_id)

    def upload_avatar(self, user_id: int, avatar_url: str) -> Optional[UserInfo]:
        """更新用户头像"""
        sanitized = _sanitize_remote_url(avatar_url)
        if not sanitized:
            # 空字符串或非法 URL 一律拒绝写入，保留现有头像不变。
            return self.get_user_info(user_id)
        self.db.table("user_info").update({"avatar_url": sanitized}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def upload_cover(self, user_id: int, cover_url: str) -> Optional[UserInfo]:
        """更新用户封面图片"""
        sanitized = _sanitize_remote_url(cover_url)
        if not sanitized:
            return self.get_user_info(user_id)
        self.db.table("user_info").update({"cover_url": sanitized}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def search_users(self, keyword: str, limit: int = 20) -> List[UserInfo]:
        """
        搜索用户（支持用户名模糊搜索和用户ID精确搜索）
        """
        import re
        
        results = []
        
        # 清理搜索关键词，移除可能导致查询问题的特殊字符
        clean_keyword = re.sub(r'[%_\\]', '', keyword.strip())
        if not clean_keyword:
            return results
        
        try:
            # 尝试按用户ID精确搜索
            if clean_keyword.isdigit():
                user_id = int(clean_keyword)
                user_info = self._get_user_info_or_basic(user_id)
                if user_info:
                    results.append(user_info)
            
            # 按用户名模糊搜索
            user_result = (
                self.db.table("users")
                .select("id, username")
                .ilike("username", f"*{clean_keyword}*")
                .limit(limit)
                .execute()
            )
            
            if user_result.data:
                # 批量获取用户详细信息以减少请求次数
                user_ids = [user["id"] for user in user_result.data 
                           if not any(r.userId == user["id"] for r in results)]
                
                if user_ids:
                    info_result = (
                        self.db.table("user_info")
                        .select("*")
                        .in_("user_id", user_ids)
                        .execute()
                    )
                    
                    # 创建 user_id 到 info 的映射
                    info_map = {info["user_id"]: info for info in info_result.data} if info_result.data else {}
                    
                    for user in user_result.data:
                        # 跳过已添加的用户（如果通过ID搜索到的话）
                        if any(r.userId == user["id"] for r in results):
                            continue
                        
                        info = info_map.get(user["id"])
                        if info:
                            results.append(UserInfo(
                                userId=user["id"],
                                infoId=info["id"],
                                username=user["username"],
                                bio=info.get("bio", ""),
                                location=info.get("location", ""),
                                avatarUrl=info.get("avatar_url", ""),
                                coverUrl=info.get("cover_url", "")
                            ))
                        else:
                            # 即使没有 user_info 记录，也返回用户基本信息
                            results.append(UserInfo(
                                userId=user["id"],
                                infoId=0,  # 没有 user_info 记录
                                username=user["username"],
                                bio="",
                                location="",
                                avatarUrl="",
                                coverUrl=""
                            ))
        except Exception as e:
            print(f"[UserService] search_users error: {e}")
            # 如果搜索失败，返回空列表而不是抛出异常
            return []
        
        return results[:limit]
    
    def _get_user_info_or_basic(self, user_id: int) -> Optional[UserInfo]:
        """获取用户信息，如果没有 user_info 记录则返回基本信息"""
        # 获取用户基本信息
        user_result = self.db.table("users").select("id, username").eq("id", user_id).execute()
        if not user_result.data:
            return None
        user = user_result.data[0]
        
        # 获取用户详细信息
        info_result = self.db.table("user_info").select("*").eq("user_id", user_id).execute()
        if info_result.data:
            info = info_result.data[0]
            return UserInfo(
                userId=user["id"],
                infoId=info["id"],
                username=user["username"],
                bio=info.get("bio", ""),
                location=info.get("location", ""),
                avatarUrl=info.get("avatar_url", ""),
                coverUrl=info.get("cover_url", ""),
                primaryTitle=self._get_primary_title(user_id),
                preferredLanguage=info.get("preferred_language"),
                preferredTheme=info.get("preferred_theme", "system"),
                preferredCurrency=info.get("preferred_currency"),
            )
        else:
            return UserInfo(
                userId=user["id"],
                infoId=0,
                username=user["username"],
                bio="",
                location="",
                avatarUrl="",
                coverUrl="",
                primaryTitle=self._get_primary_title(user_id),
                preferredTheme="system",
            )

    def get_contribution_leaderboard(self, limit: int = 20) -> List[dict]:
        """获取 Archive 贡献榜：统计每个用户上传的秀场/品牌/买手店数量"""
        from collections import defaultdict

        contribution_counts: defaultdict[int, int] = defaultdict(int)

        # 1) shows: created_by, status = APPROVED or NULL (legacy data)
        shows_result = (
            self.db.table("shows")
            .select("created_by")
            .or_("status.eq.APPROVED,status.is.null")
            .not_.is_("created_by", "null")
            .execute()
        )
        if shows_result.data:
            for row in shows_result.data:
                uid = row.get("created_by")
                if uid:
                    contribution_counts[uid] += 1

        # 2) brand_submissions: user_id, status = APPROVED
        brands_result = (
            self.db.table("brand_submissions")
            .select("user_id")
            .eq("status", "APPROVED")
            .execute()
        )
        if brands_result.data:
            for row in brands_result.data:
                uid = row.get("user_id")
                if uid:
                    contribution_counts[uid] += 1

        # 3) user_submitted_stores: user_id, status = APPROVED
        stores_result = (
            self.db.table("user_submitted_stores")
            .select("user_id")
            .eq("status", "APPROVED")
            .execute()
        )
        if stores_result.data:
            for row in stores_result.data:
                uid = row.get("user_id")
                if uid:
                    contribution_counts[uid] += 1

        if not contribution_counts:
            return []

        sorted_users = sorted(contribution_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        user_ids = [uid for uid, _ in sorted_users]

        users_result = self.db.table("users").select("id, username").in_("id", user_ids).execute()
        user_map = {u["id"]: u for u in users_result.data} if users_result.data else {}

        info_result = self.db.table("user_info").select("user_id, avatar_url").in_("user_id", user_ids).execute()
        info_map = {i["user_id"]: i for i in info_result.data} if info_result.data else {}

        leaderboard = []
        for rank, (uid, count) in enumerate(sorted_users, start=1):
            user_data = user_map.get(uid, {})
            info_data = info_map.get(uid, {})
            leaderboard.append({
                "rank": rank,
                "userId": uid,
                "username": user_data.get("username", ""),
                "avatarUrl": info_data.get("avatar_url", ""),
                "contributionCount": count,
            })

        return leaderboard

    def update_language_preference(self, user_id: int, language: str) -> Optional[UserInfo]:
        """更新用户语言偏好"""
        info_result = self.db.table("user_info").select("id").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        self.db.table("user_info").update({"preferred_language": language}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def update_theme_preference(self, user_id: int, theme: str) -> Optional[UserInfo]:
        """更新用户主题偏好"""
        if theme not in ("system", "light", "dark"):
            return None
        info_result = self.db.table("user_info").select("id").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        self.db.table("user_info").update({"preferred_theme": theme}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def update_currency_preference(
        self, user_id: int, currency: str
    ) -> Optional[UserInfo]:
        """更新用户展示币种偏好。

        和 update_theme_preference 对称：仅在 user_info 行存在时才更新；
        若数据库 CHECK 约束尚未应用（旧环境），这里也做一次入参校验兜底。
        """
        if currency not in ("CNY", "USD"):
            return None
        info_result = (
            self.db.table("user_info").select("id").eq("user_id", user_id).execute()
        )
        if not info_result.data:
            return None
        self.db.table("user_info").update(
            {"preferred_currency": currency}
        ).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def get_privacy_settings(self, user_id: int) -> Optional[UserPrivacySettings]:
        """获取用户隐私设置"""
        info_result = self.db.table("user_info").select("hide_following, hide_followers, hide_likes, hide_wishlist, hide_sales").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]

        return UserPrivacySettings(
            userId=user_id,
            hideFollowing=info.get("hide_following", False),
            hideFollowers=info.get("hide_followers", False),
            hideLikes=info.get("hide_likes", False),
            hideWishlist=info.get("hide_wishlist", False),
            hideSales=info.get("hide_sales", False),
        )

    def update_privacy_settings(self, user_id: int, **kwargs) -> Optional[UserPrivacySettings]:
        """更新用户隐私设置"""
        update_data = {}

        if "hideFollowing" in kwargs and kwargs["hideFollowing"] is not None:
            update_data["hide_following"] = kwargs["hideFollowing"]
        if "hideFollowers" in kwargs and kwargs["hideFollowers"] is not None:
            update_data["hide_followers"] = kwargs["hideFollowers"]
        if "hideLikes" in kwargs and kwargs["hideLikes"] is not None:
            update_data["hide_likes"] = kwargs["hideLikes"]
        if "hideWishlist" in kwargs and kwargs["hideWishlist"] is not None:
            update_data["hide_wishlist"] = kwargs["hideWishlist"]
        if "hideSales" in kwargs and kwargs["hideSales"] is not None:
            update_data["hide_sales"] = kwargs["hideSales"]

        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()

        return self.get_privacy_settings(user_id)

    def delete_account(self, user_id: int) -> bool:
        """
        Self-service account deletion.
        Deletes the app user record (cascade handles related data)
        and removes the Supabase Auth user.
        """
        user_result = (
            self.db.table("users")
            .select("id, supabase_uid")
            .eq("id", user_id)
            .execute()
        )
        if not user_result.data:
            return False

        supabase_uid = user_result.data[0].get("supabase_uid")

        self.db_admin.table("users").delete().eq("id", user_id).execute()

        if supabase_uid:
            try:
                self.db_admin.auth.admin.delete_user(supabase_uid)
            except Exception as e:
                logger.warning(f"Failed to delete Supabase Auth user {supabase_uid}: {e}")

        return True


# 单例
user_service = UserService()
