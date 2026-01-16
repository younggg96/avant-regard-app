"""
文件上传路由
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.services.file_service import file_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/files", tags=["文件上传"])


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """上传图片"""
    print(f"Upload request - filename: {file.filename}, content_type: {file.content_type}")
    
    # 验证文件类型
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        # 如果没有 content_type，尝试从文件名推断
        if file.filename:
            ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
            mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
            content_type = mime_map.get(ext, "")
        
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"只能上传图片文件 (received: {file.content_type})")
    
    # 限制文件大小 (10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过10MB")
    
    print(f"Uploading image: {len(content)} bytes, type: {content_type}")
    
    # 上传图片
    url = file_service.upload_image(content, file.filename, content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="图片上传失败")
    
    return success({"url": url})
