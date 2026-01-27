"""
通知服务
处理 App 内通知和 Push Notification
"""

import os
import json
import httpx
from typing import Optional, List, Dict, Any
from app.db.supabase import get_supabase
from app.schemas.notification import (
    Notification,
    NotificationActionData,
    NotificationType,
)


class NotificationService:
    def __init__(self):
        self.db = get_supabase()
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
            self._send_push_notification(user_id, title, message, action_data)

        return notification

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

        self.create_notification(
            user_id=followed_user_id,
            notification_type=NotificationType.FOLLOW,
            title=f"{follower_name} 关注了你",
            message="点击查看 Ta 的主页",
            action_data=action_data,
        )


# 单例
notification_service = NotificationService()
