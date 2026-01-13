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
    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图片文件")
    
    # 限制文件大小 (10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过10MB")
    
    # 上传图片
    url = file_service.upload_image(content, file.filename, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="图片上传失败")
    
    return success({"url": url})
