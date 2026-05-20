"""
通知服务
处理 App 内通知和 Push Notification
"""

import os
import json
import httpx
from typing import Optional, List, Dict, Any
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.notification import (
    Notification,
    NotificationActionData,
    NotificationType,
)


class NotificationService:
    def __init__(self):
        self.db = get_supabase_admin()
        # Expo Push Notification API
        self.expo_push_url = "https://exp.host/--/api/v2/push/send"

    def _format_notification(self, data: dict) -> Notification:
        """格式化通知数据"""
        action_data = data.get("action_data", {}) or {}
        return Notification(
            id=data["id"],
            userId=data["user_id"],
            type=data["type"],
            title=data["title"],
            message=data["message"],
            isRead=data["is_read"],
            actionData=NotificationActionData(
                userId=action_data.get("user_id"),
                postId=action_data.get("post_id"),
                collectionId=action_data.get("collection_id"),
                commentId=action_data.get("comment_id"),
                actorName=action_data.get("actor_name"),
                actorAvatar=action_data.get("actor_avatar"),
                postImage=action_data.get("post_image"),
                # 自定义跳转
                navigateTo=action_data.get("navigateTo"),
                navigateParams=action_data.get("navigateParams"),
                externalUrl=action_data.get("externalUrl"),
            ),
            createdAt=data["created_at"],
        )

    def get_notifications(
        self, user_id: int, unread_only: bool = False
    ) -> List[Notification]:
        """获取用户通知列表"""
        query = (
            self.db.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        if unread_only:
            query = query.eq("is_read", False)
        result = query.execute()
        return [self._format_notification(n) for n in result.data or []]

    def get_unread_count(self, user_id: int) -> int:
        """获取未读通知数量"""
        result = (
            self.db.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_read", False)
            .execute()
        )
        return result.count or 0

    def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """标记通知为已读"""
        result = (
            self.db.table("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def mark_all_as_read(self, user_id: int) -> bool:
        """标记所有通知为已读"""
        result = (
            self.db.table("notifications")
            .update({"is_read": True})
            .eq("user_id", user_id)
            .eq("is_read", False)
            .execute()
        )
        return True

    def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """删除通知"""
        result = (
            self.db.table("notifications")
            .delete()
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def clear_all_notifications(self, user_id: int) -> bool:
        """清空所有通知"""
        result = (
            self.db.table("notifications").delete().eq("user_id", user_id).execute()
        )
        return True

    def delete_follow_notification(
        self,
        followed_user_id: int,
        follower_id: int,
    ) -> int:
        """
        删除某用户对另一用户的关注通知。

        在「取消关注」时调用：避免「关注 → 取消 → 再关注」反复操作时，
        同一个 follower 对同一目标累积多条 FOLLOW 通知。

        返回被删除的通知数量。
        """
        try:
            result = (
                self.db.table("notifications")
                .select("id, action_data")
                .eq("user_id", followed_user_id)
                .eq("type", NotificationType.FOLLOW.value)
                .execute()
            )
            ids_to_delete: List[int] = []
            for row in result.data or []:
                ad = row.get("action_data") or {}
                if ad.get("user_id") != follower_id:
                    continue
                ids_to_delete.append(row["id"])

            if not ids_to_delete:
                return 0

            self.db.table("notifications").delete().in_("id", ids_to_delete).execute()
            return len(ids_to_delete)
        except Exception as e:
            print(f"Failed to delete follow notification: {e}")
            return 0

    def delete_like_notification(
        self,
        recipient_id: int,
        actor_id: int,
        post_id: int,
        comment_id: Optional[int] = None,
    ) -> int:
        """
        删除某用户对某帖子/评论的点赞通知。

        在用户取消点赞时调用：避免「点赞 → 取消 → 再点赞」反复操作时，
        同一个 actor 对同一目标累积多条 LIKE 通知。

        - comment_id is None: 仅匹配帖子点赞通知（action_data 不含 comment_id）。
        - comment_id 非空: 仅匹配评论点赞通知。

        返回被删除的通知数量。
        """
        try:
            result = (
                self.db.table("notifications")
                .select("id, action_data")
                .eq("user_id", recipient_id)
                .eq("type", NotificationType.LIKE.value)
                .execute()
            )
            ids_to_delete: List[int] = []
            for row in result.data or []:
                ad = row.get("action_data") or {}
                if ad.get("user_id") != actor_id:
                    continue
                if ad.get("post_id") != post_id:
                    continue
                ad_comment_id = ad.get("comment_id")
                if comment_id is None:
                    if ad_comment_id is not None:
                        continue
                else:
                    if ad_comment_id != comment_id:
                        continue
                ids_to_delete.append(row["id"])

            if not ids_to_delete:
                return 0

            self.db.table("notifications").delete().in_("id", ids_to_delete).execute()
            return len(ids_to_delete)
        except Exception as e:
            print(f"Failed to delete like notification: {e}")
            return 0

    def create_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        action_data: Optional[Dict[str, Any]] = None,
        send_push: bool = True,
    ) -> Optional[Notification]:
        """创建通知（同时保存到数据库和发送推送）"""
        # 不给自己发通知
        if action_data and action_data.get("user_id") == user_id:
            return None

        insert_data = {
            "user_id": user_id,
            "type": notification_type.value,
            "title": title,
            "message": message,
            "is_read": False,
            "action_data": action_data or {},
        }

        result = self.db.table("notifications").insert(insert_data).execute()

        if not result.data:
            return None

        notification = self._format_notification(result.data[0])

        # 发送 Push Notification
        if send_push:
            push_data = self._build_push_payload(notification_type, action_data)
            self._send_push_notification(user_id, title, message, push_data)

        return notification

    def _build_push_payload(
        self,
        notification_type: NotificationType,
        action_data: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        构造推送通知的 data 负载。
        客户端（pushNotificationService.NotificationData）期望 camelCase，
        且需要 `type` 才能在点击时正确跳转。
        """
        ad = action_data or {}
        return {
            "type": notification_type.value.lower(),
            "userId": ad.get("user_id"),
            "postId": ad.get("post_id"),
            "commentId": ad.get("comment_id"),
            "collectionId": ad.get("collection_id"),
            "actorName": ad.get("actor_name"),
            "navigateTo": ad.get("navigateTo"),
            "navigateParams": ad.get("navigateParams"),
            "externalUrl": ad.get("externalUrl"),
        }

    def _send_push_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ):
        """发送 Expo Push Notification"""
        # 获取用户的 push token
        token_result = (
            self.db.table("user_push_tokens")
            .select("push_token")
            .eq("user_id", user_id)
            .execute()
        )

        if not token_result.data:
            return

        for token_data in token_result.data:
            push_token = token_data["push_token"]
            if not push_token or not push_token.startswith("ExponentPushToken"):
                continue

            message = {
                "to": push_token,
                "title": title,
                "body": body,
                "sound": "default",
                "badge": 1,
            }

            if data:
                message["data"] = data

            try:
                with httpx.Client() as client:
                    response = client.post(
                        self.expo_push_url,
                        json=message,
                        headers={
                            "Accept": "application/json",
                            "Accept-Encoding": "gzip, deflate",
                            "Content-Type": "application/json",
                        },
                    )
                    print(f"Push notification sent: {response.status_code}")
            except Exception as e:
                print(f"Failed to send push notification: {e}")

    # ======================= 推送 Token 管理 =======================

    def register_push_token(
        self, user_id: int, push_token: str, platform: str
    ) -> bool:
        """注册用户的推送 Token"""
        # 先删除该用户旧的 token
        self.db.table("user_push_tokens").delete().eq("user_id", user_id).execute()

        # 插入新 token
        try:
            self.db.table("user_push_tokens").insert(
                {
                    "user_id": user_id,
                    "push_token": push_token,
                    "platform": platform,
                }
            ).execute()
            return True
        except Exception as e:
            print(f"Failed to register push token: {e}")
            return False

    def remove_push_token(self, user_id: int) -> bool:
        """移除用户的推送 Token"""
        self.db.table("user_push_tokens").delete().eq("user_id", user_id).execute()
        return True

    # ======================= 通知创建辅助方法 =======================

    def notify_post_liked(
        self,
        post_owner_id: int,
        liker_id: int,
        liker_name: str,
        post_id: int,
        post_title: str,
        liker_avatar: Optional[str] = None,
        post_image: Optional[str] = None,
    ):
        """帖子被点赞通知"""
        if post_owner_id == liker_id:
            return  # 不给自己发通知

        action_data = {
            "user_id": liker_id,
            "post_id": post_id,
            "actor_name": liker_name,
            "actor_avatar": liker_avatar,
            "post_image": post_image,
        }

        # 先清理同一 actor 对同一帖子的旧点赞通知，避免反复点赞累积多条
        self.delete_like_notification(
            recipient_id=post_owner_id,
            actor_id=liker_id,
            post_id=post_id,
        )

        self.create_notification(
            user_id=post_owner_id,
            notification_type=NotificationType.LIKE,
            title=f"{liker_name} 赞了你的帖子",
            message=post_title[:50] + ("..." if len(post_title) > 50 else ""),
            action_data=action_data,
        )

    def notify_post_commented(
        self,
        post_owner_id: int,
        commenter_id: int,
        commenter_name: str,
        post_id: int,
        post_title: str,
        comment_content: str,
        comment_id: int,
        commenter_avatar: Optional[str] = None,
        post_image: Optional[str] = None,
    ):
        """帖子被评论通知"""
        if post_owner_id == commenter_id:
            return  # 不给自己发通知

        action_data = {
            "user_id": commenter_id,
            "post_id": post_id,
            "comment_id": comment_id,
            "actor_name": commenter_name,
            "actor_avatar": commenter_avatar,
            "post_image": post_image,
        }

        self.create_notification(
            user_id=post_owner_id,
            notification_type=NotificationType.COMMENT,
            title=f"{commenter_name} 评论了你的帖子",
            message=comment_content[:50] + ("..." if len(comment_content) > 50 else ""),
            action_data=action_data,
        )

    def notify_comment_liked(
        self,
        comment_owner_id: int,
        liker_id: int,
        liker_name: str,
        post_id: int,
        comment_id: int,
        comment_content: str,
        liker_avatar: Optional[str] = None,
        post_image: Optional[str] = None,
    ):
        """评论被点赞通知"""
        if comment_owner_id == liker_id:
            return  # 不给自己发通知

        action_data = {
            "user_id": liker_id,
            "post_id": post_id,
            "comment_id": comment_id,
            "actor_name": liker_name,
            "actor_avatar": liker_avatar,
            "post_image": post_image,
        }

        # 先清理同一 actor 对同一评论的旧点赞通知，避免反复点赞累积多条
        self.delete_like_notification(
            recipient_id=comment_owner_id,
            actor_id=liker_id,
            post_id=post_id,
            comment_id=comment_id,
        )

        self.create_notification(
            user_id=comment_owner_id,
            notification_type=NotificationType.LIKE,
            title=f"{liker_name} 赞了你的评论",
            message=comment_content[:50] + ("..." if len(comment_content) > 50 else ""),
            action_data=action_data,
        )

    def notify_comment_replied(
        self,
        comment_owner_id: int,
        replier_id: int,
        replier_name: str,
        post_id: int,
        comment_id: int,
        reply_content: str,
        replier_avatar: Optional[str] = None,
        post_image: Optional[str] = None,
    ):
        """评论被回复通知"""
        if comment_owner_id == replier_id:
            return  # 不给自己发通知

        action_data = {
            "user_id": replier_id,
            "post_id": post_id,
            "comment_id": comment_id,
            "actor_name": replier_name,
            "actor_avatar": replier_avatar,
            "post_image": post_image,
        }

        self.create_notification(
            user_id=comment_owner_id,
            notification_type=NotificationType.COMMENT,
            title=f"{replier_name} 回复了你的评论",
            message=reply_content[:50] + ("..." if len(reply_content) > 50 else ""),
            action_data=action_data,
        )

    def notify_user_followed(
        self,
        followed_user_id: int,
        follower_id: int,
        follower_name: str,
        follower_avatar: Optional[str] = None,
    ):
        """被关注通知"""
        if followed_user_id == follower_id:
            return

        action_data = {
            "user_id": follower_id,
            "actor_name": follower_name,
            "actor_avatar": follower_avatar,
        }

        # 先清理同一 follower 的旧关注通知，避免反复关注/取关累积多条
        self.delete_follow_notification(
            followed_user_id=followed_user_id,
            follower_id=follower_id,
        )

        self.create_notification(
            user_id=followed_user_id,
            notification_type=NotificationType.FOLLOW,
            title=f"{follower_name} 关注了你",
            message="点击查看 Ta 的主页",
            action_data=action_data,
        )

    # ======================= 广播通知 =======================

    def broadcast_notification(
        self,
        title: str,
        message: str,
        action_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, int]:
        """
        向所有用户发送广播通知
        Returns: {"success_count": int, "fail_count": int, "total_users": int}
        """
        # 获取所有用户 ID
        users_result = self.db.table("users").select("id").execute()
        all_user_ids = [user["id"] for user in (users_result.data or [])]
        total_users = len(all_user_ids)

        if total_users == 0:
            return {"success_count": 0, "fail_count": 0, "total_users": 0}

        success_count = 0
        fail_count = 0

        # 批量创建通知记录
        notifications_data = []
        for user_id in all_user_ids:
            notifications_data.append({
                "user_id": user_id,
                "type": NotificationType.SYSTEM.value,
                "title": title,
                "message": message,
                "is_read": False,
                "action_data": action_data or {},
            })

        # 批量插入通知
        try:
            result = self.db.table("notifications").insert(notifications_data).execute()
            success_count = len(result.data or [])
            fail_count = total_users - success_count
        except Exception as e:
            print(f"Failed to batch insert notifications: {e}")
            fail_count = total_users

        # 批量发送 Push 通知（payload 保持与单播一致，便于前端点击跳转）
        broadcast_push_data = self._build_push_payload(
            NotificationType.SYSTEM, action_data
        )
        self._send_broadcast_push_notification(title, message, broadcast_push_data)

        return {
            "success_count": success_count,
            "fail_count": fail_count,
            "total_users": total_users,
        }

    def _send_broadcast_push_notification(
        self,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ):
        """向所有注册了 Push Token 的用户发送推送通知"""
        # 获取所有用户的 push token
        token_result = self.db.table("user_push_tokens").select("push_token").execute()

        if not token_result.data:
            return

        # 收集所有有效的 Expo Push Tokens
        messages = []
        for token_data in token_result.data:
            push_token = token_data["push_token"]
            if not push_token or not push_token.startswith("ExponentPushToken"):
                continue

            message = {
                "to": push_token,
                "title": title,
                "body": body,
                "sound": "default",
                "badge": 1,
            }
            if data:
                message["data"] = data
            messages.append(message)

        if not messages:
            return

        # 批量发送（Expo 支持一次最多发送 100 条）
        batch_size = 100
        for i in range(0, len(messages), batch_size):
            batch = messages[i : i + batch_size]
            try:
                with httpx.Client() as client:
                    response = client.post(
                        self.expo_push_url,
                        json=batch,
                        headers={
                            "Accept": "application/json",
                            "Accept-Encoding": "gzip, deflate",
                            "Content-Type": "application/json",
                        },
                    )
                    print(f"Broadcast push notification sent: {response.status_code}, batch size: {len(batch)}")
            except Exception as e:
                print(f"Failed to send broadcast push notification: {e}")


# 单例
notification_service = NotificationService()
