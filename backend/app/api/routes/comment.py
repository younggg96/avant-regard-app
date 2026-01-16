"""
评论路由
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from app.schemas.comment import CreateCommentRequest, CreateImageReviewRequest
from app.services.comment_service import comment_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(tags=["评论"])


# ==================== 帖子评论 ====================

@router.get("/posts/{post_id}/comments")
async def get_post_comments(post_id: int, include_replies: bool = True):
    """获取帖子评论（包含回复）"""
    result = comment_service.get_post_comments(post_id, include_replies)
    return success([c.model_dump() for c in result])


@router.get("/posts/comments/{comment_id}/replies")
async def get_comment_replies(comment_id: int):
    """获取评论的所有回复"""
    result = comment_service.get_comment_replies(comment_id)
    return success([r.model_dump() for r in result])


@router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: int,
    request: CreateCommentRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """发布评论或回复"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户发表评论")
    
    result = comment_service.create_comment(
        post_id, 
        request.userId, 
        request.content,
        request.parentId,
        request.replyToUserId
    )
    if not result:
        raise HTTPException(status_code=500, detail="评论发布失败")
    return success(result.model_dump())


@router.post("/posts/comments/{comment_id}/like")
async def like_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """点赞评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户点赞")
    
    ok = comment_service.like_comment(comment_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="点赞失败")
    return success(message="点赞成功")


@router.delete("/posts/comments/{comment_id}/like")
async def unlike_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """取消点赞评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权取消其他用户的点赞")
    
    ok = comment_service.unlike_comment(comment_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="取消点赞失败")
    return success(message="取消点赞成功")


@router.delete("/posts/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id)
):
    """删除评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权删除其他用户的评论")
    
    ok = comment_service.delete_comment(comment_id, userId)
    if not ok:
        raise HTTPException(status_code=404, detail="评论不存在或无权删除")
    return success(message="删除成功")


# ==================== 秀场图片评论 ====================

@router.get("/show-images/{image_id}/reviews")
async def get_image_reviews(image_id: int):
    """获取秀场图片评论"""
    result = comment_service.get_image_reviews(image_id)
    return success([r.model_dump() for r in result])


@router.post("/show-images/{image_id}/reviews")
async def create_image_review(
    image_id: int,
    request: CreateImageReviewRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """评论秀场图片"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户发表评论")
    
    result = comment_service.create_image_review(
        image_id, request.userId, request.rating, request.content
    )
    if not result:
        raise HTTPException(status_code=500, detail="评论发布失败")
    return success(result.model_dump())


@router.get("/show-images/users/{user_id}/image-reviews")
async def get_user_image_reviews(user_id: int):
    """获取用户的所有秀场图片评论"""
    result = comment_service.get_user_image_reviews(user_id)
    return success([r.model_dump() for r in result])


@router.delete("/show-images/reviews/{review_id}")
async def delete_image_review(
    review_id: int,
    current_user_id: int = Depends(get_current_user_id)
):
    """删除秀场图片评论"""
    ok = comment_service.delete_image_review(review_id)
    if not ok:
        raise HTTPException(status_code=404, detail="评论不存在")
    return success(message="删除成功")
