"""
管理员路由
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field, field_validator, model_validator
from app.services.admin_service import admin_service
from app.services.cache_service import cache_service
from app.services.notification_service import notification_service
from app.services.moderation_service import moderation_service
from app.services.maintenance_service import maintenance_service
from app.services.feature_flags_service import feature_flags_service
from app.api.deps import get_current_admin_user
from app.core.response import success

router = APIRouter(prefix="/admin", tags=["管理员"])


# ==================== 请求模型 ====================

class CreateCommunityRequest(BaseModel):
    """创建社区请求"""
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    iconUrl: str = ""
    coverUrl: str = ""
    category: str = "GENERAL"
    isOfficial: bool = False
    sortOrder: int = 0


class UpdateCommunityRequest(BaseModel):
    """更新社区请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    iconUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    category: Optional[str] = None
    isOfficial: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class BatchDeletePostsRequest(BaseModel):
    """批量删除帖子请求"""
    postIds: List[int]


class UpdateBrandRequest(BaseModel):
    """更新品牌请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    foundedYear: Optional[str] = None
    founder: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    # AI 发帖助手 (V3 #25): 把品牌挂到一个风格上,Q2 卡片来源。
    # 传 0 / null 都按"清空关联"处理 (DB 设 NULL)。
    primaryStyleId: Optional[int] = None


# ==================== Styles ====================

class CreateStyleRequest(BaseModel):
    """创建风格请求 (V3 #25)。

    name / description 用 i18n 字典; 至少要给 en, 否则后端 047 的 CHECK 约束
    会拒绝写入。其他 locale 选填。
    """
    slug: str = Field(..., min_length=1, max_length=100,
                      description="稳定标识符,前端 i18n key 与 URL slug")
    nameI18n: Dict[str, str] = Field(..., description='{"en": "Avant-garde", "zh": "先锋"}')
    descriptionI18n: Dict[str, str] = Field(default_factory=dict)
    coverUrl: Optional[str] = None
    sortOrder: int = 0
    isActive: bool = True

    @field_validator("nameI18n")
    @classmethod
    def must_have_en(cls, v: Dict[str, str]) -> Dict[str, str]:
        if not v or not (v.get("en") or "").strip():
            raise ValueError("nameI18n 至少需要 en 文案")
        return v


class UpdateStyleRequest(BaseModel):
    """更新风格请求,所有字段可选。"""
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    nameI18n: Optional[Dict[str, str]] = None
    descriptionI18n: Optional[Dict[str, str]] = None
    coverUrl: Optional[str] = None
    sortOrder: Optional[int] = None
    isActive: Optional[bool] = None


class BroadcastNotificationRequest(BaseModel):
    """广播通知请求"""
    title: str = Field(..., min_length=1, max_length=100, description="通知标题")
    message: str = Field(..., min_length=1, max_length=500, description="通知内容")
    actionData: Optional[Dict[str, Any]] = Field(None, description="可选的操作数据")


class UpdateAutoReplyRequest(BaseModel):
    """客服自动回复配置"""
    enabled: bool = Field(..., description="是否启用自动回复")
    message: str = Field("", description="自动回复内容")
    email: str = Field("", description="客服邮箱")


# ==================== 帖子审核 ====================

@router.get("/posts/all")
async def get_all_posts(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    auditStatus: Optional[str] = Query(None),
    postType: Optional[str] = Query(None),
    userId: Optional[int] = Query(None, description="只看该用户发布的帖子"),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取所有帖子（支持搜索、筛选、分页）"""
    result = admin_service.get_all_posts(
        page=page,
        page_size=pageSize,
        keyword=keyword,
        status=status,
        audit_status=auditStatus,
        post_type=postType,
        user_id=userId,
    )
    return success(result)


@router.get("/posts/reported")
async def get_reported_posts(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取被投诉的帖子列表"""
    result = admin_service.get_reported_posts(page=page, page_size=pageSize)
    return success(result)


@router.get("/posts/pending")
async def get_pending_posts(
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取待审核帖子列表"""
    result = admin_service.get_pending_posts()
    return success([p.model_dump() for p in result])


class BatchRegradeRequest(BaseModel):
    """批量评级请求"""
    postIds: Optional[List[int]] = Field(default=None, description="指定帖子ID列表（为空则评级所有已发布帖子）")
    ungradedOnly: bool = Field(False, description="仅评级未评级的帖子")


@router.post("/posts/batch-regrade")
async def batch_regrade_posts(
    request: BatchRegradeRequest = Body(...),
    current_user_id: int = Depends(get_current_admin_user),
):
    """批量触发帖子评级"""
    from app.services.grading_service import batch_grade_posts
    count = batch_grade_posts(
        post_ids=request.postIds,
        ungraded_only=request.ungradedOnly,
    )
    return success({"triggered": count})


@router.post("/posts/{post_id}/approve")
async def approve_post(
    post_id: int,
    remark: str = Query(None),
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核通过帖子"""
    ok = admin_service.approve_post(post_id, remark)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="审核通过")


@router.post("/posts/{post_id}/reject")
async def reject_post(
    post_id: int,
    remark: str = Query(None),
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核拒绝帖子"""
    ok = admin_service.reject_post(post_id, remark)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="审核拒绝")


@router.delete("/posts/{post_id}")
async def admin_delete_post(
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员删除帖子"""
    ok = admin_service.admin_delete_post(post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="帖子删除成功")


@router.post("/posts/{post_id}/regrade")
async def regrade_post(
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员手动触发帖子重新评级"""
    from app.services.grading_service import grade_post_async
    grade_post_async(post_id)
    return success(message="评级已触发")


# ==================== 评论管理 ====================

@router.get("/comments")
async def get_all_comments(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取所有评论（分页）"""
    result = admin_service.get_all_comments(page, pageSize)
    return success(result)


@router.get("/comments/post/{post_id}")
async def get_comments_by_post(
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取指定帖子的所有评论"""
    result = admin_service.get_comments_by_post(post_id)
    return success(result)


@router.get("/comments/user/{user_id}")
async def get_comments_by_user(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取指定用户的所有评论"""
    result = admin_service.get_comments_by_user(user_id)
    return success(result)


@router.delete("/comments/{comment_id}")
async def admin_delete_comment(
    comment_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员删除评论"""
    ok = admin_service.admin_delete_comment(comment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="评论不存在")
    return success(message="评论删除成功")


# ==================== 用户管理 ====================

# 用户管理路由放在 /api/auth/admin 路径下
admin_user_router = APIRouter(prefix="/auth/admin", tags=["管理员-用户管理"])


@admin_user_router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除用户及其所有关联数据"""
    ok = admin_service.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(message="用户删除成功")


# ==================== 社区管理 ====================

@router.get("/communities")
async def get_all_communities(
    include_inactive: bool = Query(True, description="是否包含未激活的社区"),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取所有社区（管理员）"""
    result = admin_service.get_all_communities(include_inactive)
    return success(result)


@router.get("/communities/{community_id}")
async def get_community_detail(
    community_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取社区详情（管理员）"""
    result = admin_service.get_community_by_id(community_id)
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result)


@router.post("/communities")
async def create_community(
    request: CreateCommunityRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """创建社区（管理员）"""
    result = admin_service.create_community(
        name=request.name,
        slug=request.slug,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category,
        is_official=request.isOfficial,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=500, detail="创建社区失败")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(result)


@router.put("/communities/{community_id}")
async def update_community(
    community_id: int,
    request: UpdateCommunityRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """更新社区（管理员）"""
    result = admin_service.update_community(
        community_id=community_id,
        name=request.name,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category,
        is_official=request.isOfficial,
        is_active=request.isActive,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(result)


@router.delete("/communities/{community_id}")
async def delete_community(
    community_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除社区（管理员）"""
    ok = admin_service.delete_community(community_id)
    if not ok:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(message="社区删除成功")


# ==================== 社区帖子管理 ====================

@router.get("/communities/{community_id}/posts")
async def get_community_posts(
    community_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取社区内的所有帖子（管理员）"""
    # 先检查社区是否存在
    community = admin_service.get_community_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    result = admin_service.get_community_posts(community_id, page, pageSize)
    return success(result)


@router.delete("/communities/{community_id}/posts/{post_id}")
async def delete_community_post(
    community_id: int,
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除社区内的指定帖子（管理员）"""
    ok = admin_service.delete_community_post(community_id, post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在或不属于该社区")
    return success(message="帖子删除成功")


@router.post("/communities/{community_id}/posts/batch-delete")
async def batch_delete_community_posts(
    community_id: int,
    request: BatchDeletePostsRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """批量删除社区内的帖子（管理员）"""
    # 先检查社区是否存在
    community = admin_service.get_community_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    result = admin_service.batch_delete_community_posts(community_id, request.postIds)
    return success(result)


# ==================== 品牌提交审核 ====================

@router.get("/brand-submissions/pending")
async def get_pending_brand_submissions(
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取待审核品牌提交列表"""
    result = admin_service.get_pending_brand_submissions()
    return success(result)


@router.post("/brand-submissions/{submission_id}/approve")
async def approve_brand_submission(
    submission_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核通过品牌提交"""
    try:
        ok = admin_service.approve_brand_submission(submission_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"品牌插入失败: {str(e)}")
    if not ok:
        raise HTTPException(status_code=404, detail="提交记录不存在或已审核")
    return success(message="品牌审核通过")


@router.post("/brand-submissions/{submission_id}/reject")
async def reject_brand_submission(
    submission_id: int,
    reason: str = Query(None),
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核拒绝品牌提交"""
    ok = admin_service.reject_brand_submission(submission_id, reason)
    if not ok:
        raise HTTPException(status_code=404, detail="提交记录不存在或已审核")
    return success(message="品牌审核已拒绝")


# ==================== 品牌管理 ====================

@router.get("/brands")
async def get_all_brands_admin(
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取品牌列表（管理员）"""
    result = admin_service.get_all_brands_admin(keyword=keyword, page=page, page_size=pageSize)
    return success(result)


@router.put("/brands/{brand_id}")
async def update_brand(
    brand_id: int,
    request: UpdateBrandRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """更新品牌信息（管理员）"""
    result = admin_service.update_brand(
        brand_id,
        name=request.name,
        category=request.category,
        founded_year=request.foundedYear,
        founder=request.founder,
        country=request.country,
        website=request.website,
        # primaryStyleId 透传到 service; 0 视为"清空关联", None 视为"不改"
        primary_style_id=request.primaryStyleId,
    )
    if not result:
        raise HTTPException(status_code=404, detail="品牌不存在")

    cache_service.invalidate_brands()
    return success(result)


@router.delete("/brands/{brand_id}")
async def delete_brand(
    brand_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除品牌（管理员）"""
    ok = admin_service.delete_brand(brand_id)
    if not ok:
        raise HTTPException(status_code=404, detail="品牌不存在")

    cache_service.invalidate_brands()
    return success(message="品牌删除成功")


# ==================== 品牌图片审核 ====================

class AdminUploadBrandImageRequest(BaseModel):
    imageUrl: str


class ToggleBrandImageSelectedRequest(BaseModel):
    selected: bool


@router.post("/brand-images/{image_id}/toggle-select")
async def toggle_brand_image_selected(
    image_id: int,
    request: ToggleBrandImageSelectedRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """切换品牌图片选中状态（管理员）"""
    image = admin_service.toggle_brand_image_selected(image_id, request.selected)
    cache_service.invalidate_brands()
    return success(image)


@router.get("/brand-images/pending")
async def get_pending_brand_images(
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取待审核品牌图片"""
    images = admin_service.get_pending_brand_images()
    return success({"images": images, "total": len(images)})


@router.post("/brand-images/{image_id}/approve")
async def approve_brand_image(
    image_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核通过品牌图片"""
    image = admin_service.approve_brand_image(image_id)
    cache_service.invalidate_brands()
    return success(image)


@router.post("/brand-images/{image_id}/reject")
async def reject_brand_image(
    image_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """拒绝品牌图片"""
    image = admin_service.reject_brand_image(image_id)
    return success(image)


@router.delete("/brand-images/{image_id}")
async def delete_brand_image(
    image_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除品牌图片"""
    ok = admin_service.delete_brand_image(image_id)
    if not ok:
        raise HTTPException(status_code=404, detail="图片不存在")
    cache_service.invalidate_brands()
    return success(message="图片已删除")


@router.post("/brands/{brand_id}/images")
async def admin_upload_brand_image(
    brand_id: int,
    request: AdminUploadBrandImageRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员上传品牌图片（直接 APPROVED）"""
    image = admin_service.admin_upload_brand_image(brand_id, request.imageUrl, current_user_id)
    cache_service.invalidate_brands()
    return success(image)


@router.get("/brands/{brand_id}/images")
async def get_brand_images_admin(
    brand_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取品牌的所有已审核图片（管理员）"""
    images = admin_service.get_brand_images(brand_id)
    return success({"images": images, "total": len(images)})


# ==================== 广播通知 ====================

@router.post("/notifications/broadcast")
async def broadcast_notification(
    request: BroadcastNotificationRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """
    向所有用户发送广播通知（管理员）
    - 同时创建 App 内通知和发送 Push 推送
    """
    result = notification_service.broadcast_notification(
        title=request.title,
        message=request.message,
        action_data=request.actionData,
    )
    
    return success({
        "successCount": result["success_count"],
        "failCount": result["fail_count"],
        "totalUsers": result["total_users"],
    })


# ==================== 用户列表 ====================

@router.get("/users")
async def get_users(
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取用户列表（支持搜索、分页）"""
    result = admin_service.get_users(
        keyword=keyword, page=page, page_size=pageSize
    )
    return success(result)


# ==================== 用户全量数据查询（用户管理 → 用户详情） ====================
#
# 配合前端 admin 用户详情聚合页：
#   GET /api/admin/users/{id}/overview        档案 + 各业务域数据量
#   GET /api/admin/users/{id}/trade-reviews   交易互评（含未公开）
#   GET /api/admin/users/{id}/disputes        售后仲裁（发起的 + 被动卷入的）
# 聊天 / 订单 / 帖子 / 评论明细分别复用：
#   GET /api/admin/chat/conversations?userId=
#   GET /api/admin/orders?userId=
#   GET /api/admin/posts/all?userId=
#   GET /api/admin/comments/user/{id}

@router.get("/users/{user_id}/overview")
async def get_user_overview(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 用户全量数据总览（档案 + 聊天/交易/内容/风控数据量）"""
    result = admin_service.get_user_overview(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(result)


@router.get("/users/{user_id}/trade-reviews")
async def get_user_trade_reviews(
    user_id: int,
    role: str = Query("all", description="all / written / received"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 该用户相关的交易互评（含 visible=false 的未公开评价）"""
    if role not in ("all", "written", "received"):
        raise HTTPException(status_code=400, detail="无效的 role 参数")
    result = admin_service.get_user_trade_reviews(
        user_id, role=role, page=page, page_size=pageSize
    )
    return success(result)


@router.get("/users/{user_id}/disputes")
async def get_user_disputes(
    user_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 该用户相关的售后仲裁单"""
    result = admin_service.get_user_disputes(
        user_id, page=page, page_size=pageSize
    )
    return success(result)


# ==================== 举报管理 ====================

@router.get("/reports")
async def get_reports(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取举报记录列表"""
    result = admin_service.get_reports(
        status=status, page=page, page_size=pageSize
    )
    return success(result)


class UpdateReportStatusRequest(BaseModel):
    status: str = Field(..., description="REVIEWED / RESOLVED / DISMISSED")


@router.put("/reports/{report_id}")
async def update_report_status(
    report_id: int,
    request: UpdateReportStatusRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新举报状态"""
    if request.status not in ("REVIEWED", "RESOLVED", "DISMISSED"):
        raise HTTPException(status_code=400, detail="无效的状态值")
    ok = admin_service.update_report_status(report_id, request.status)
    if not ok:
        raise HTTPException(status_code=404, detail="举报记录不存在")
    return success(message="状态已更新")


@router.delete("/chat/messages/{message_id}")
async def admin_delete_chat_message(
    message_id: int,
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员删除聊天消息，返回消息发送者信息"""
    result = admin_service.admin_delete_chat_message(message_id)
    if not result:
        raise HTTPException(status_code=404, detail="消息不存在")
    return success(result)


# ==================== 聊天审计 (admin only, read-only) ====================
#
# 给运营 / 风控用的「全站聊天检索」入口。三个 endpoint 都强制走 admin 鉴权,
# 业务逻辑完全在 ``admin_service`` 里, 这里只做参数校验和 HTTP 包装。
#
#   GET /api/admin/chat/conversations
#       列出会话, 支持 keyword(用户名 / 邮箱 / 手机号 / userId) 或 userId 精确过滤。
#       不传任何过滤参数则返回\"全站最近活跃的会话\"。
#
#   GET /api/admin/chat/conversations/{id}
#       看某个会话的参与者 + 消息列表。这里不过滤 is_deleted, 让 admin 也能看到
#       软删除内容(便于事后审计)。支持 before_id 分页(往更早的消息翻)。
#
#   GET /api/admin/chat/messages/search
#       按关键字搜消息内容(仅 text 类型, 卡片类 content 是 JSON,搜了没用)。
#       命中消息会带上所在会话参与者, 让搜索结果可读。


@router.get("/chat/conversations")
async def admin_list_chat_conversations(
    keyword: Optional[str] = Query(None, description="按用户名/邮箱/手机号/用户ID模糊匹配"),
    userId: Optional[int] = Query(None, description="只看该用户参与的会话"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 列出聊天会话(可按用户/关键字筛选)"""
    result = admin_service.list_chat_conversations(
        keyword=keyword,
        user_id=userId,
        page=page,
        page_size=pageSize,
    )
    return success(result)


@router.get("/chat/conversations/{conversation_id}")
async def admin_get_chat_conversation(
    conversation_id: int,
    beforeId: Optional[int] = Query(None, description="分页用,只返回 id < beforeId 的更早消息"),
    limit: int = Query(100, ge=1, le=200),
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 查看具体会话的参与者 + 消息内容(含已软删除消息)"""
    result = admin_service.get_chat_conversation_detail(
        conversation_id,
        before_id=beforeId,
        limit=limit,
    )
    if not result:
        raise HTTPException(status_code=404, detail="会话不存在")
    return success(result)


@router.get("/chat/messages/search")
async def admin_search_chat_messages(
    keyword: str = Query(..., min_length=1, description="消息内容关键字(仅匹配 text 类型)"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员: 按内容关键字搜聊天消息"""
    result = admin_service.search_chat_messages(
        keyword,
        page=page,
        page_size=pageSize,
    )
    return success(result)


# ==================== 用户头衔管理 ====================

class AddUserTitleRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="头衔名称")


@router.get("/users/{user_id}/titles")
async def get_user_titles(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取用户的所有头衔（管理员）"""
    titles = admin_service.get_user_titles(user_id)
    return success(titles)


@router.post("/users/{user_id}/titles")
async def add_user_title(
    user_id: int,
    request: AddUserTitleRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """给用户添加头衔（管理员）"""
    try:
        title = admin_service.add_user_title(user_id, request.title, current_user_id)
        return success(title)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/titles/{title_id}")
async def remove_user_title(
    title_id: int,
    current_user_id: int = Depends(get_current_admin_user),
):
    """删除用户头衔（管理员）"""
    ok = admin_service.remove_user_title(title_id)
    if not ok:
        raise HTTPException(status_code=404, detail="头衔不存在")
    return success(message="头衔已删除")


# ==================== 屏蔽关系 ====================

@router.get("/blocks")
async def get_all_blocks(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取所有屏蔽关系"""
    result = admin_service.get_all_blocks(page=page, page_size=pageSize)
    return success(result)


# ==================== 客服自动回复 ====================

@router.get("/cs-auto-reply")
async def get_auto_reply_config(
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取客服自动回复配置"""
    from app.services.chat_service import chat_service
    config = chat_service.get_auto_reply_config()
    return success(config)


@router.put("/cs-auto-reply")
async def update_auto_reply_config(
    request: UpdateAutoReplyRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新客服自动回复配置"""
    from app.services.chat_service import chat_service
    config = chat_service.set_auto_reply_config({
        "enabled": request.enabled,
        "message": request.message,
        "email": request.email,
    })
    return success(config)


# ==================== 推荐算法配置 ====================

VALID_GRADES = {"A", "B", "C", "D"}


def _normalize_grades(value: List[str]) -> List[str]:
    """Deduplicate, uppercase, and validate grade codes."""
    if not isinstance(value, list):
        raise ValueError("grades 必须是数组")
    cleaned = []
    for g in value:
        if not isinstance(g, str):
            raise ValueError("grades 元素必须是字符串")
        code = g.strip().upper()
        if code not in VALID_GRADES:
            raise ValueError(f"无效的评级: {g}（合法值：A/B/C/D）")
        if code not in cleaned:
            cleaned.append(code)
    return sorted(cleaned)


class PoolRatiosConfig(BaseModel):
    core: float = Field(0.5, ge=0, le=1)
    discovery: float = Field(0.3, ge=0, le=1)
    random: float = Field(0.2, ge=0, le=1)

    @model_validator(mode="after")
    def _ratios_sum_to_one(self) -> "PoolRatiosConfig":
        total = self.core + self.discovery + self.random
        if abs(total - 1.0) > 0.005:
            raise ValueError(
                f"三个池的比例之和必须等于 1.0（当前为 {total:.3f}）"
            )
        return self


class CorePoolConfig(BaseModel):
    grades: List[str] = ["A", "B", "C"]

    @field_validator("grades")
    @classmethod
    def _validate(cls, v: List[str]) -> List[str]:
        normalized = _normalize_grades(v)
        if not normalized:
            raise ValueError("核心池至少选择一个评级")
        return normalized


class DiscoveryPoolConfig(BaseModel):
    enabled: bool = True


class RandomPoolConfig(BaseModel):
    grades: List[str] = ["A", "B"]

    @field_validator("grades")
    @classmethod
    def _validate(cls, v: List[str]) -> List[str]:
        normalized = _normalize_grades(v)
        if not normalized:
            raise ValueError("随机池至少选择一个评级")
        return normalized


class ColdStartConfig(BaseModel):
    days: int = Field(7, ge=1, le=90)
    grades: List[str] = ["A", "B"]

    @field_validator("grades")
    @classmethod
    def _validate(cls, v: List[str]) -> List[str]:
        normalized = _normalize_grades(v)
        if not normalized:
            raise ValueError("冷启动至少选择一个评级")
        return normalized


class RecommendConfigRequest(BaseModel):
    pool_ratios: PoolRatiosConfig = PoolRatiosConfig()
    core_pool: CorePoolConfig = CorePoolConfig()
    discovery_pool: DiscoveryPoolConfig = DiscoveryPoolConfig()
    random_pool: RandomPoolConfig = RandomPoolConfig()
    cold_start: ColdStartConfig = ColdStartConfig()


# ==================== 维护模式 ====================

class MaintenanceConfigRequest(BaseModel):
    """维护模式配置更新请求"""
    enabled: bool = Field(..., description="是否开启维护模式")
    message: Optional[str] = Field(
        None,
        max_length=500,
        description="展示给用户的维护提示文案；留空则沿用已有文案",
    )


@router.get("/maintenance")
async def get_maintenance_config(
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取维护模式配置（管理员）"""
    return success(maintenance_service.get_config())


@router.put("/maintenance")
async def update_maintenance_config(
    request: MaintenanceConfigRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新维护模式配置（管理员）"""
    config = maintenance_service.set_config(
        enabled=request.enabled, message=request.message
    )
    return success(config)


# ==================== 功能开关 ====================

class FeatureFlagsRequest(BaseModel):
    """功能开关更新请求.

    所有字段可选, None 表示保留原值. 当前仅暴露 ``lotteryEnabled`` 一项.
    """

    lotteryEnabled: Optional[bool] = Field(
        None,
        description="是否对所有 App / Web 用户开启月度抽奖入口与相关内容",
    )
    listingAutoApprove: Optional[bool] = Field(
        None,
        description="是否对新提交的交易单品自动通过审核（dev / 内测）",
    )


@router.get("/feature-flags")
async def get_feature_flags(
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取全站功能开关 (管理员)."""
    return success(feature_flags_service.get_config())


@router.put("/feature-flags")
async def update_feature_flags(
    request: FeatureFlagsRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新全站功能开关 (管理员)."""
    config = feature_flags_service.set_config(
        lottery_enabled=request.lotteryEnabled,
        listing_auto_approve=request.listingAutoApprove,
    )
    return success(config)


@router.get("/stats/growth")
async def get_growth_stats(
    days: int = Query(default=30, ge=7, le=90),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取最近 N 天用户/帖子/评论增长曲线数据"""
    data = admin_service.get_growth_stats(days)
    return success(data)


@router.get("/stats/demographics")
async def get_demographics(
    _admin_id: int = Depends(get_current_admin_user),
):
    """用户画像统计：性别 / 年龄段 / 地区分布"""
    return success(admin_service.get_demographics())


@router.get("/recommend-config")
async def get_recommend_config(
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取推荐算法配置"""
    from app.services.post_service import post_service
    config = post_service._load_recommend_config()
    return success(config)


@router.put("/recommend-config")
async def update_recommend_config(
    request: RecommendConfigRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新推荐算法配置"""
    # Use the service-role client: app_config has RLS enabled and the anon
    # role has no INSERT/UPDATE policy, so writing via get_supabase() fails with
    # "new row violates row-level security policy". Admin writes bypass RLS.
    from app.db.supabase import get_supabase_admin
    db = get_supabase_admin()
    config = request.model_dump()
    try:
        db.table("app_config").upsert(
            {"key": "recommend_config", "value": config},
            on_conflict="key",
        ).execute()
    except Exception as exc:  # noqa: BLE001 — translate to clean envelope
        # Supabase/PostgREST errors arrive as dict-like objects whose str() is
        # unreadable for end users. Re-raise a plain RuntimeError with a clear
        # hint; the global Exception handler will wrap it in the standard
        # {code, message, data} envelope that the admin UI already understands.
        raise RuntimeError(
            f"保存推荐配置失败：{exc}（请确认 app_config 表已创建）"
        ) from exc
    return success(config)


# ==================== Styles 风格字典 (V3 #25) ====================
#
# 用于 AI 发帖助手 Q1 风格选项 + brand.primary_style_id 的关联池。
# 047 migration 已 seed 10 个基线,此后通过这一组接口由 admin 手工维护。

@router.get("/styles")
async def list_styles(
    current_user_id: int = Depends(get_current_admin_user),
):
    """列出所有风格 (含 inactive),按 sort_order 升序。"""
    return success(admin_service.list_styles())


@router.post("/styles")
async def create_style(
    request: CreateStyleRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """创建风格。slug 必须唯一,name_i18n 至少含 en (047 CHECK 约束)。"""
    result = admin_service.create_style(
        slug=request.slug,
        name_i18n=request.nameI18n,
        description_i18n=request.descriptionI18n,
        cover_url=request.coverUrl,
        sort_order=request.sortOrder,
        is_active=request.isActive,
    )
    if not result:
        raise HTTPException(status_code=400, detail="创建风格失败 (可能 slug 已存在)")
    return success(result)


@router.put("/styles/{style_id}")
async def update_style(
    style_id: int,
    request: UpdateStyleRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新风格。所有字段可选,只更新非 None 的。"""
    result = admin_service.update_style(
        style_id,
        slug=request.slug,
        name_i18n=request.nameI18n,
        description_i18n=request.descriptionI18n,
        cover_url=request.coverUrl,
        sort_order=request.sortOrder,
        is_active=request.isActive,
    )
    if not result:
        raise HTTPException(status_code=404, detail="风格不存在")
    return success(result)


@router.delete("/styles/{style_id}")
async def delete_style(
    style_id: int,
    current_user_id: int = Depends(get_current_admin_user),
):
    """删除风格。下挂的 brands.primary_style_id 由 047 ON DELETE SET NULL 约束清空。"""
    ok = admin_service.delete_style(style_id)
    if not ok:
        raise HTTPException(status_code=404, detail="风格不存在")
    return success(None)
