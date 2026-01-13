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

    def upload_image(self, file_content: bytes, filename: str, content_type: str) -> Optional[str]:
        """上传图片到 Supabase Storage"""
        # 生成唯一文件名
        ext = filename.split(".")[-1] if "." in filename else "jpg"
        unique_filename = f"{datetime.utcnow().strftime('%Y%m%d')}/{uuid.uuid4()}.{ext}"
        
        try:
            # 上传到 Supabase Storage
            result = self.db.storage.from_(self.bucket_name).upload(
                unique_filename,
                file_content,
                {"content-type": content_type}
            )
            
            # 获取公开 URL
            public_url = self.db.storage.from_(self.bucket_name).get_public_url(unique_filename)
            return public_url
        except Exception as e:
            print(f"Upload error: {e}")
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
