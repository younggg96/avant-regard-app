"""
文件上传服务
"""

import uuid
from typing import Optional
from datetime import datetime
from app.db.supabase import get_supabase_admin


class FileService:
    def __init__(self):
        # 使用 service role 客户端绕过 RLS
        self.db = get_supabase_admin()
        self.bucket_name = "images"
        self._bucket_checked = False

    def _ensure_bucket_exists(self):
        """确保存储桶存在"""
        if self._bucket_checked:
            return

        try:
            # 列出所有 bucket
            buckets = self.db.storage.list_buckets()
            bucket_names = [b.name for b in buckets] if buckets else []
            print(f"[FileService] Existing buckets: {bucket_names}")

            if self.bucket_name not in bucket_names:
                print(f"[FileService] Creating bucket: {self.bucket_name}")
                # 创建公开的 bucket
                self.db.storage.create_bucket(
                    self.bucket_name, options={"public": True}
                )
                print(f"[FileService] Bucket '{self.bucket_name}' created successfully")

            self._bucket_checked = True
        except Exception as e:
            print(f"[FileService] Error checking/creating bucket: {e}")
            # 即使创建失败也标记为已检查，避免重复尝试
            self._bucket_checked = True

    def upload_image(
        self, file_content: bytes, filename: str, content_type: str
    ) -> Optional[str]:
        """上传图片到 Supabase Storage"""
        # 确保 bucket 存在
        self._ensure_bucket_exists()

        # 生成唯一文件名
        ext = filename.split(".")[-1] if "." in filename else "jpg"
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d')}/{uuid.uuid4()}.{ext}"

        try:
            print(
                f"[FileService] Uploading image: {unique_filename}, content_type: {content_type}, size: {len(file_content)} bytes"
            )

            # 上传到 Supabase Storage
            result = self.db.storage.from_(self.bucket_name).upload(
                unique_filename, file_content, {"content-type": content_type}
            )

            print(f"[FileService] Upload result type: {type(result)}")
            print(f"[FileService] Upload result: {result}")

            # 检查上传结果 - 新版 supabase-py 返回的是字典
            if isinstance(result, dict):
                if result.get("error"):
                    print(
                        f"[FileService] Upload failed with error: {result.get('error')}"
                    )
                    return None
                # 成功时 result 包含 path
                if result.get("path"):
                    public_url = self.db.storage.from_(self.bucket_name).get_public_url(
                        result["path"]
                    )
                    print(f"[FileService] Public URL: {public_url}")
                    return public_url

            # 检查是否有 error 属性（旧版本兼容）
            if hasattr(result, "error") and result.error:
                print(f"[FileService] Upload failed with error: {result.error}")
                return None

            # 获取公开 URL
            public_url = self.db.storage.from_(self.bucket_name).get_public_url(
                unique_filename
            )
            print(f"[FileService] Public URL: {public_url}")
            return public_url
        except Exception as e:
            import traceback

            print(f"[FileService] Upload error: {e}")
            print(f"[FileService] Traceback: {traceback.format_exc()}")
            return None

    def delete_image(self, file_path: str) -> bool:
        """删除图片"""
        try:
            # 从 URL 中提取文件路径
            if self.bucket_name in file_path:
                path_parts = file_path.split(f"{self.bucket_name}/")
                if len(path_parts) > 1:
                    file_path = path_parts[1]

            self.db.storage.from_(self.bucket_name).remove([file_path])
            return True
        except Exception as e:
            print(f"Delete error: {e}")
            return False


# 单例
file_service = FileService()
