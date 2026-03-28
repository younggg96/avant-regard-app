"""
文件上传服务

NOTE: Storage operations use a dedicated Supabase client (without the
custom httpx transport shared by the REST/PostgREST client).  The shared
httpx client has its ``base_url`` mutated to ``/rest/v1`` by PostgREST,
which causes Storage requests to hit the wrong endpoint (404).
"""

import uuid
from typing import Optional
from datetime import datetime


def _get_storage_client():
    """Return a Supabase admin client dedicated to Storage.

    A plain ``create_client`` call (no custom httpx_client) avoids the
    base_url conflict between PostgREST and the Storage sub-client.
    """
    from supabase import create_client
    from app.core.config import settings

    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


class FileService:
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"}
    ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-m4v", "video/webm"}

    def __init__(self):
        self.db = _get_storage_client()
        self.bucket_name = "images"
        self._bucket_checked: dict[str, bool] = {}

    def _ensure_bucket_exists(self, bucket: str = None):
        """确保存储桶存在且为公开状态"""
        bucket = bucket or self.bucket_name
        if bucket in self._bucket_checked:
            return self._bucket_checked[bucket]

        try:
            buckets = self.db.storage.list_buckets()
            bucket_names = [b.name for b in buckets] if buckets else []
            print(f"[FileService] Existing buckets: {bucket_names}")

            if bucket not in bucket_names:
                print(f"[FileService] Creating bucket: {bucket}")
                self.db.storage.create_bucket(
                    bucket, options={"public": True}
                )
                print(f"[FileService] Bucket '{bucket}' created successfully")
            else:
                existing = next(
                    (b for b in buckets if b.name == bucket), None
                )
                is_public = getattr(existing, "public", None)
                if is_public is False:
                    print(f"[FileService] Bucket '{bucket}' exists but is not public, updating...")
                    self.db.storage.update_bucket(
                        bucket, options={"public": True}
                    )
                    print(f"[FileService] Bucket '{bucket}' updated to public")

            self._bucket_checked[bucket] = True
        except Exception as e:
            print(f"[FileService] Error checking/creating bucket: {e}")
            import traceback
            print(f"[FileService] Bucket check traceback: {traceback.format_exc()}")
            self._bucket_checked[bucket] = False

        return self._bucket_checked.get(bucket, False)

    def _upload_to_bucket(
        self, bucket: str, file_content: bytes, filename: str, content_type: str
    ) -> Optional[str]:
        """通用上传方法：将文件上传到指定 bucket"""
        if not self._ensure_bucket_exists(bucket):
            print(f"[FileService] Bucket '{bucket}' check failed, cannot upload")
            return None

        ext = filename.split(".")[-1] if "." in filename else "bin"
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d')}/{uuid.uuid4()}.{ext}"

        try:
            print(
                f"[FileService] Uploading to '{bucket}': {unique_filename}, "
                f"content_type: {content_type}, size: {len(file_content)} bytes"
            )

            result = self.db.storage.from_(bucket).upload(
                unique_filename, file_content, {"content-type": content_type}
            )

            print(f"[FileService] Upload result type: {type(result)}")
            print(f"[FileService] Upload result: {result}")

            if isinstance(result, dict):
                if result.get("error"):
                    print(f"[FileService] Upload failed with error: {result.get('error')}")
                    return None
                if result.get("path"):
                    public_url = self.db.storage.from_(bucket).get_public_url(result["path"])
                    print(f"[FileService] Public URL: {public_url}")
                    return public_url

            if hasattr(result, "error") and result.error:
                print(f"[FileService] Upload failed with error: {result.error}")
                return None

            public_url = self.db.storage.from_(bucket).get_public_url(unique_filename)
            print(f"[FileService] Public URL: {public_url}")
            return public_url
        except Exception as e:
            import traceback
            print(f"[FileService] Upload error: {e}")
            print(f"[FileService] Traceback: {traceback.format_exc()}")
            return None

    def upload_image(
        self, file_content: bytes, filename: str, content_type: str
    ) -> Optional[str]:
        """上传图片到 Supabase Storage"""
        return self._upload_to_bucket(self.bucket_name, file_content, filename, content_type)

    def upload_video(
        self, file_content: bytes, filename: str, content_type: str
    ) -> Optional[str]:
        """上传视频到 Supabase Storage（videos 桶）"""
        return self._upload_to_bucket("videos", file_content, filename, content_type)

    def delete_image(self, file_path: str) -> bool:
        """删除图片"""
        try:
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
