"""
文件上传路由
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.services.file_service import file_service, FileService
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/files", tags=["文件上传"])

IMAGE_MIME_MAP = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
}
VIDEO_MIME_MAP = {
    "mp4": "video/mp4", "mov": "video/quicktime",
    "m4v": "video/x-m4v", "webm": "video/webm",
}

def _infer_content_type(filename: str | None, declared: str | None) -> str:
    """从文件名或声明的 content_type 推断实际 MIME 类型"""
    if declared and (declared.startswith("image/") or declared.startswith("video/")):
        return declared
    if filename:
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        merged = {**IMAGE_MIME_MAP, **VIDEO_MIME_MAP}
        if ext in merged:
            return merged[ext]
    return declared or ""


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """上传图片"""
    print(f"Upload request - filename: {file.filename}, content_type: {file.content_type}")

    content_type = _infer_content_type(file.filename, file.content_type)
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"只能上传图片文件 (received: {file.content_type})")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过10MB")

    print(f"Uploading image: {len(content)} bytes, type: {content_type}")
    url = file_service.upload_image(content, file.filename, content_type)

    if not url:
        raise HTTPException(status_code=500, detail="图片上传失败")
    return success({"url": url})


@router.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """上传视频"""
    print(f"Upload video request - filename: {file.filename}, content_type: {file.content_type}")

    content_type = _infer_content_type(file.filename, file.content_type)
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail=f"只能上传视频文件 (received: {file.content_type})")

    content = await file.read()
    max_video_size = 100 * 1024 * 1024  # 100 MB
    if len(content) > max_video_size:
        raise HTTPException(status_code=400, detail="视频大小不能超过100MB")

    print(f"Uploading video: {len(content)} bytes, type: {content_type}")
    url = file_service.upload_video(content, file.filename, content_type)

    if not url:
        raise HTTPException(status_code=500, detail="视频上传失败")
    return success({"url": url, "mediaType": "video"})
