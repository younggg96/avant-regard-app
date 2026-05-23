"""
交易系统 / 单品 (Listing) 路由。

PRD 模块一对应的服务接口，区别于旧的「买手店商品 CRUD」单口：
  - 旧入口 (/api/store-merchants/{merchant_id}/products) 仅服务买手店；
  - 新入口 (/api/listings/*) 同时支持个人 (C2C) 与买手店两种卖家身份。

新接口包含：
  - POST   /listings                       —— 创建草稿（C2C / 买手店统一入口）
  - PATCH  /listings/{id}                  —— 分步保存
  - POST   /listings/{id}/submit           —— 提交审核 (draft → reviewing)
  - POST   /listings/{id}/transition       —— 卖家可触发的状态切换 (上下架等)
  - POST   /listings/batch/offline         —— 批量下架
  - POST   /listings/batch/delete          —— 批量删除草稿/被拒
  - GET    /sellers/me/listings            —— 卖家自己的库存
  - GET    /sellers/me/profile             —— 当前用户的卖家档案
  - PUT    /sellers/me/profile             —— 维护卖家档案
  - GET    /sellers/{user_id}/profile      —— 公开卖家档案（详情页用）
  - GET    /admin/listings/reviewing       —— 管理员审核队列
  - POST   /admin/listings/{id}/review     —— 管理员审核通过 / 拒绝
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.response import success
from app.api.deps import get_current_user, get_current_user_optional, get_current_admin_user
from app.services.store_product_service import store_product_service
from app.services.store_merchant_service import store_merchant_service
from app.services.seller_profile_service import seller_profile_service
from app.services.feature_flags_service import feature_flags_service
from app.schemas.store_product import (
    StoreProductCreate,
    StoreProductUpdate,
    ProductTransition,
    ProductReviewDecision,
    BatchListingAction,
    SellerProfileUpsert,
    ProductStatus,
    SellerKind,
)


router = APIRouter(prefix="/listings", tags=["交易系统 / 单品"])
sellers_router = APIRouter(prefix="/sellers", tags=["交易系统 / 卖家"])
admin_router = APIRouter(prefix="/admin/listings", tags=["交易系统 / 后台审核"])
marketplace_router = APIRouter(prefix="/marketplace", tags=["交易系统 / 交易大厅"])


# ==========================================================================
# Marketplace 公开查询（PRD 模块二）
# ==========================================================================


@marketplace_router.get("/listings")
async def marketplace_listings(
    q: Optional[str] = Query(None, description="关键词"),
    brand: Optional[str] = Query(None),
    categoryId: Optional[int] = Query(None),
    size: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    condition: Optional[str] = Query(None, description="BNWT / NEW_99 / NEW_95 / USED_8 / FLAW"),
    sellerKind: Optional[str] = Query(None, description="merchant / individual"),
    priceMinCents: Optional[int] = Query(None, ge=0),
    priceMaxCents: Optional[int] = Query(None, ge=0),
    sort: str = Query(
        "newest",
        description="newest / price_asc / price_desc / featured",
    ),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    products, total = store_product_service.search_marketplace(
        keyword=q,
        brand=brand,
        category_id=categoryId,
        size=size,
        color=color,
        condition=condition,
        seller_kind=sellerKind,
        price_min_cents=priceMinCents,
        price_max_cents=priceMaxCents,
        sort=sort,
        page=page,
        page_size=pageSize,
        user_id=current_user_id,
    )
    return success(
        {
            "products": [p.model_dump() for p in products],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@marketplace_router.get("/popular-brands")
async def marketplace_popular_brands(
    limit: int = Query(6, ge=1, le=20, description="返回品牌数量"),
):
    """交易大厅顶部「热门品牌」列表。

    按当前在售单品数量降序，仅返回真实有在售商品的品牌。
    每项含 ``name / brandId / imageUrl / listingCount``，前端用于渲染
    PDF 设计稿中横向滚动的圆形品牌头像列表。
    """
    items = store_product_service.get_popular_brands(limit=limit)
    return success({"brands": items})


# ==========================================================================
# 单品 CRUD（草稿 / 分步保存）
# ==========================================================================


def _resolve_seller_context(user_id: int, requested_kind: SellerKind):
    """根据请求声明的卖家类型，解析 store_id / merchant_id。

    返回 (kind, store_id_or_none, merchant_id_or_none)。
    """
    if requested_kind == SellerKind.MERCHANT:
        merchant = store_merchant_service.get_merchant_by_user(user_id)
        if not merchant or merchant.status != "APPROVED":
            raise HTTPException(status_code=403, detail="您不是认证商家")
        return SellerKind.MERCHANT, merchant.storeId, merchant.id
    return SellerKind.INDIVIDUAL, None, None


@router.post("")
async def create_listing(
    data: StoreProductCreate,
    current_user_id: int = Depends(get_current_user),
):
    """创建草稿。

    `sellerKind` 默认为 individual；买手店发布需显式传 merchant。
    任何用户都可以发布个人单品（C2C），但首次发布会自动创建 seller_profiles 记录。
    """
    try:
        kind, store_id, merchant_id = _resolve_seller_context(current_user_id, data.sellerKind)
        # 强制 status=draft；前端如果错传非 draft，由后端忽略
        data.status = ProductStatus.DRAFT
        if kind == SellerKind.MERCHANT:
            product = store_product_service.create_product(store_id, merchant_id, data)
        else:
            product = store_product_service.create_individual_listing(current_user_id, data)
        return success(product.model_dump(), message="草稿已创建")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{product_id}")
async def patch_listing(
    product_id: int,
    data: StoreProductUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """分步保存。状态字段在此处不被允许更改，除非保持当前状态不变。"""
    raw = store_product_service._get_product_raw(product_id)
    if not raw:
        raise HTTPException(status_code=404, detail="商品不存在")
    kind = raw.get("seller_kind", "merchant")
    try:
        if kind == "merchant":
            merchant = store_merchant_service.get_merchant_by_user(current_user_id)
            if not merchant or merchant.id != raw.get("merchant_id"):
                raise HTTPException(status_code=403, detail="无权限操作")
            product = store_product_service.update_product(product_id, merchant.id, data)
        else:
            product = store_product_service.update_listing_by_user(
                product_id, current_user_id, data
            )
        return success(product.model_dump(), message="保存成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{product_id}/submit")
async def submit_listing(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """提交审核（draft → reviewing）。开启 listingAutoApprove 时自动 → active。"""
    raw = store_product_service._get_product_raw(product_id)
    if not raw:
        raise HTTPException(status_code=404, detail="商品不存在")
    kind = raw.get("seller_kind", "merchant")
    if kind == "merchant":
        merchant = store_merchant_service.get_merchant_by_user(current_user_id)
        if not merchant or merchant.id != raw.get("merchant_id"):
            raise HTTPException(status_code=403, detail="无权限操作")
    else:
        if raw.get("seller_user_id") != current_user_id:
            raise HTTPException(status_code=403, detail="无权限操作")

    try:
        auto = feature_flags_service.is_listing_auto_approve()
        product = store_product_service.submit_for_review(
            product_id,
            actor_user_id=current_user_id,
            auto_approve=auto,
        )
        msg = "已通过自动审核并上架" if auto else "已提交审核"
        return success(product.model_dump(), message=msg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{product_id}/transition")
async def transition_listing(
    product_id: int,
    payload: ProductTransition,
    current_user_id: int = Depends(get_current_user),
):
    """卖家可触发的状态切换（如 active → offline）。"""
    raw = store_product_service._get_product_raw(product_id)
    if not raw:
        raise HTTPException(status_code=404, detail="商品不存在")
    kind = raw.get("seller_kind", "merchant")
    if kind == "merchant":
        merchant = store_merchant_service.get_merchant_by_user(current_user_id)
        if not merchant or merchant.id != raw.get("merchant_id"):
            raise HTTPException(status_code=403, detail="无权限操作")
    else:
        if raw.get("seller_user_id") != current_user_id:
            raise HTTPException(status_code=403, detail="无权限操作")
    try:
        product = store_product_service.transition_status(
            product_id,
            payload.target,
            actor_user_id=current_user_id,
            is_admin=False,
            reason=payload.reason,
        )
        return success(product.model_dump(), message="状态已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/offline")
async def batch_offline(
    payload: BatchListingAction,
    current_user_id: int = Depends(get_current_user),
):
    """批量下架（PRD 1.6）。"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    try:
        # 同时尝试两种身份：先按 merchant、再按 individual。
        moved = 0
        if merchant and merchant.status == "APPROVED":
            moved += store_product_service.batch_set_offline(
                payload.productIds,
                actor_user_id=current_user_id,
                merchant_id=merchant.id,
            )
        moved += store_product_service.batch_set_offline(
            payload.productIds,
            actor_user_id=current_user_id,
            seller_user_id=current_user_id,
        )
        return success({"updated": moved}, message=f"已下架 {moved} 件")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/delete")
async def batch_delete(
    payload: BatchListingAction,
    current_user_id: int = Depends(get_current_user),
):
    """批量删除草稿 / 被拒商品（PRD 1.6）。"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    try:
        deleted = 0
        if merchant and merchant.status == "APPROVED":
            deleted += store_product_service.batch_delete_drafts(
                payload.productIds, merchant_id=merchant.id
            )
        deleted += store_product_service.batch_delete_drafts(
            payload.productIds, seller_user_id=current_user_id
        )
        return success({"deleted": deleted}, message=f"已删除 {deleted} 件")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================================================
# 卖家管理后台
# ==========================================================================


@sellers_router.get("/me/listings")
async def list_my_listings(
    status: Optional[str] = Query(None, description="active / draft / reviewing / sold / offline / rejected"),
    sellerKind: Optional[str] = Query(None, description="merchant / individual；不传则返回该用户的所有身份"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """当前用户的卖家库存。

    - 个人卖家：以 seller_user_id=当前用户 检索。
    - 同时是认证商家：默认合并买手店与个人两种身份的 listing；通过 sellerKind
      参数可以收敛到单一身份。
    """
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    products_all: list = []
    total = 0
    if sellerKind in (None, "individual"):
        p, t = store_product_service.list_seller_listings(
            seller_user_id=current_user_id, status=status, page=page, page_size=pageSize
        )
        products_all.extend(p)
        total += t
    if sellerKind in (None, "merchant") and merchant and merchant.status == "APPROVED":
        p, t = store_product_service.list_seller_listings(
            merchant_id=merchant.id, status=status, page=page, page_size=pageSize
        )
        products_all.extend(p)
        total += t

    # 排序：created_at desc（如果时间戳缺失则保留入参顺序）
    products_all.sort(key=lambda x: x.createdAt or "", reverse=True)
    return success(
        {
            "products": [p.model_dump() for p in products_all],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@sellers_router.get("/me/profile")
async def get_my_seller_profile(
    current_user_id: int = Depends(get_current_user),
):
    profile = seller_profile_service.get(current_user_id)
    return success(profile.model_dump() if profile else None)


@sellers_router.put("/me/profile")
async def upsert_my_seller_profile(
    data: SellerProfileUpsert,
    current_user_id: int = Depends(get_current_user),
):
    profile = seller_profile_service.upsert(current_user_id, data)
    return success(profile.model_dump(), message="档案已更新")


@sellers_router.get("/{user_id}/profile")
async def get_seller_profile_public(
    user_id: int,
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """公开卖家档案，供商品详情页弹窗 / 信用浮层使用。"""
    profile = seller_profile_service.get(user_id)
    return success(profile.model_dump() if profile else None)


# ==========================================================================
# 管理员审核
# ==========================================================================


@admin_router.get("")
async def admin_list_all_products(
    status: Optional[str] = Query(None, description="按状态过滤"),
    q: Optional[str] = Query(None, description="搜索关键词（标题/品牌）"),
    sellerKind: Optional[str] = Query(None, description="merchant / individual"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=200),
    _admin_id: int = Depends(get_current_admin_user),
):
    """管理员后台：列出所有商品（支持按状态/搜索/卖家类型过滤）。"""
    products, total = store_product_service.admin_list_all_products(
        status=status,
        search_query=q,
        seller_kind=sellerKind,
        page=page,
        page_size=pageSize,
    )
    return success(
        {
            "products": [p.model_dump() for p in products],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@admin_router.post("")
async def admin_create_product(
    data: StoreProductCreate,
    admin_id: int = Depends(get_current_admin_user),
):
    """管理员创建商品。"""
    try:
        product = store_product_service.admin_create_product(data)
        return success(product.model_dump(), message="商品已创建")
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@admin_router.put("/{product_id}")
async def admin_update_product(
    product_id: int,
    data: StoreProductUpdate,
    admin_id: int = Depends(get_current_admin_user),
):
    """管理员更新商品（跳过所有权校验）。"""
    try:
        product = store_product_service.admin_update_product(product_id, data)
        return success(product.model_dump(), message="商品已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@admin_router.delete("/{product_id}")
async def admin_delete_product(
    product_id: int,
    admin_id: int = Depends(get_current_admin_user),
):
    """管理员删除商品（跳过所有权校验）。"""
    ok = store_product_service.admin_delete_product(product_id)
    if not ok:
        raise HTTPException(status_code=404, detail="商品不存在或已删除")
    return success(None, message="商品已删除")


@admin_router.get("/reviewing")
async def admin_list_reviewing(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    _admin_id: int = Depends(get_current_admin_user),
):
    products, total = store_product_service.list_reviewing(page=page, page_size=pageSize)
    return success(
        {
            "products": [p.model_dump() for p in products],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@admin_router.post("/{product_id}/review")
async def admin_review(
    product_id: int,
    decision: ProductReviewDecision,
    admin_id: int = Depends(get_current_admin_user),
):
    target = ProductStatus.ACTIVE if decision.decision == "approved" else ProductStatus.REJECTED
    try:
        product = store_product_service.transition_status(
            product_id,
            target,
            actor_user_id=admin_id,
            is_admin=True,
            reason=decision.reason,
        )
        return success(product.model_dump(), message="审核已记录")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
