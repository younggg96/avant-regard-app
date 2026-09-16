"""
数字护照路由。

  POST /api/passport/three-view          AI 三视图生成
  GET  /api/passport/three-view/quota
  POST /api/passport/validate            5.3 有效性检查(单独闸门)
  POST /api/passport/attribute           5.2 识别 + 候选
  POST /api/passport/confirm             5.2 用户确认入库
  GET  /api/passport/attribute/quota

后续的编号与公开验证页(5.4)、鉴定分层(5.5)继续挂在这个 prefix 下。
"""

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user_id
from app.core.response import success
from app.schemas.passport import (
    AttributeRequest,
    AttributeResponse,
    AttributionCandidateItem,
    ConfirmRequest,
    ThreeViewItem,
    ThreeViewQuotaResponse,
    ThreeViewRequest,
    ThreeViewResponse,
    ValidityInfo,
)
from app.services.ai.attribution_service import AttributionError, attribution_service
from app.services.ai.quota_service import quota_service
from app.services.ai.three_view_service import ThreeViewError, three_view_service

router = APIRouter(prefix="/passport", tags=["数字护照"])


# ThreeViewError.code → HTTP 状态码。配额超限必须是 429,前端据此弹
# 「明天再来」而不是当成系统故障重试。
_ERROR_STATUS = {
    "QUOTA_EXCEEDED": 429,
    "BAD_SOURCE": 400,
    "NOT_CONFIGURED": 503,
    "GENERATION_FAILED": 502,
    # 上游连不上是我方基础设施问题，不是用户输入问题，也不该让前端
    # 当成"模型失败"引导用户重试 —— 重试同样连不上。
    "UPSTREAM_UNREACHABLE": 503,
    # key 无效 / 未开通模型。同样是我方配置问题，且重试永远不会好。
    "UPSTREAM_AUTH_FAILED": 503,
}


@router.post("/three-view")
def generate_three_view(
    request: ThreeViewRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """
    由一张单品照生成正 / 侧 / 背三视图。

    三张图并发生成,整体耗时约 20-40s,前端要按长耗时请求处理。
    部分成功也会返回 200,失败的那一张在 views[].error 里。
    """
    try:
        result = three_view_service.generate(current_user_id, request.imageUrl)
    except ThreeViewError as e:
        raise HTTPException(
            status_code=_ERROR_STATUS.get(e.code, 500),
            detail={"code": e.code, "message": str(e)},
        )

    return success(
        ThreeViewResponse(
            sourceUrl=result.source_url,
            views=[
                ThreeViewItem(slug=v.slug, label=v.label, url=v.url, error=v.error)
                for v in result.views
            ],
            model=result.model,
            tokensUsed=result.tokens_used,
            quotaUsed=result.quota_used,
            quotaLimit=result.quota_limit,
        ).model_dump()
    )


@router.get("/three-view/quota")
def get_three_view_quota(
    current_user_id: int = Depends(get_current_user_id),
):
    info = quota_service.get_three_view_info(current_user_id)
    return success(ThreeViewQuotaResponse(used=info.used, limit=info.limit).model_dump())


# =====================================================
# 5.2 / 5.3 · 识别、确认、入库
# =====================================================

# AttributionError.code → HTTP 状态码。
#   NOT_FASHION_ITEM 用 422 而不是 400:请求本身没问题,是内容没过闸门,
#   前端要据此展示「换张图重拍」而不是报系统错误。
_ATTR_ERROR_STATUS = {
    "QUOTA_EXCEEDED": 429,
    "NOT_FASHION_ITEM": 422,
    "BAD_INPUT": 400,
    "BRAND_REQUIRED": 400,
    "NOT_FOUND": 404,
    "FORBIDDEN": 403,
    "ALREADY_CONFIRMED": 409,
    "NOT_CONFIGURED": 503,
    "LLM_FAILED": 502,
    "DB_ERROR": 500,
}


def _attr_http(e: AttributionError) -> HTTPException:
    detail = {"code": e.code, "message": str(e)}
    detail.update(e.payload)
    return HTTPException(
        status_code=_ATTR_ERROR_STATUS.get(e.code, 500), detail=detail
    )


@router.post("/validate")
def validate_photos(
    request: AttributeRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """
    只跑 5.3 有效性闸门,用在「想先给用户一个快速反馈、还不需要候选」的场景。

    结果会被缓存下来:随后对同一组照片调 /attribute 会直接复用这次的模型
    输出,不再调模型也不再扣配额。所以 validate → attribute 连着调总共
    只花一次钱,单独调 /attribute 也一样,两者可以任意组合。
    """
    try:
        result = attribution_service.validate(
            current_user_id, request.photos, request.userHint
        )
    except AttributionError as e:
        raise _attr_http(e)

    return success(
        ValidityInfo(
            isFashionItem=result.is_fashion_item,
            rejectReason=result.reject_reason,
            category=result.category,
            categoryZh=result.category_zh,
            confidence=result.confidence,
        ).model_dump()
    )


@router.post("/attribute")
def attribute(
    request: AttributeRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """
    有效性检查 + 品牌/系列/年份候选。内部已包含 /validate 那一步,
    单独调这一个接口就够,刚 validate 过的话会复用结果、不重复扣配额。

    候选可能为空数组 —— 认不出来是正常结果,前端此时直接展示可编辑表单,
    不要当成错误。图片没过有效性闸门时返回 422。
    """
    try:
        result = attribution_service.attribute(
            current_user_id, request.photos, request.userHint
        )
    except AttributionError as e:
        raise _attr_http(e)

    return success(
        AttributeResponse(
            attributionId=result.attribution_id,
            validity=ValidityInfo(
                isFashionItem=result.validity.is_fashion_item,
                rejectReason=result.validity.reject_reason,
                category=result.validity.category,
                categoryZh=result.validity.category_zh,
                confidence=result.validity.confidence,
            ),
            candidates=[
                AttributionCandidateItem(
                    brandId=c.brand_id,
                    brandName=c.brand_name,
                    showId=c.show_id,
                    season=c.season,
                    year=c.year,
                    title=c.title,
                    evidence=c.evidence,
                    matchedRefs=c.matched_refs,
                    totalRefs=c.total_refs,
                    confidence=c.confidence,
                    matchSource=c.match_source,
                )
                for c in result.candidates
            ],
            visualSummary=result.visual_summary,
            yearRange=result.year_range,
            quotaUsed=result.quota_used,
            quotaLimit=result.quota_limit,
        ).model_dump()
    )


@router.post("/confirm")
def confirm(
    request: ConfirmRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """用户确认(或修改)归因结果并写入 MY ARCHIVE,同时补齐一条标注数据。"""
    try:
        item = attribution_service.confirm(
            current_user_id,
            request.attributionId,
            title=request.title,
            brand_id=request.brandId,
            pending_brand_name=request.pendingBrandName,
            show_id=request.showId,
            release_year=request.releaseYear,
            user_action=request.userAction,
            size=request.size,
            color=request.color,
            condition=request.condition,
            acquired_at=request.acquiredAt,
            acquired_price_cents=request.acquiredPriceCents,
            note=request.note,
            storage_location=request.storageLocation,
            photos=request.photos,
        )
    except AttributionError as e:
        raise _attr_http(e)

    return success(item.model_dump(), message="已加入典藏")


@router.get("/attribute/quota")
def get_attribute_quota(
    current_user_id: int = Depends(get_current_user_id),
):
    info = quota_service.get_attribution_info(current_user_id)
    return success(ThreeViewQuotaResponse(used=info.used, limit=info.limit).model_dump())
