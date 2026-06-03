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
  - POST   /listings/batch/delete          —— 批量删除草稿/被拒/已下架
  - GET    /sellers/me/listings            —— 卖家自己的库存
  - GET    /sellers/me/profile             —— 当前用户的卖家档案
  - PUT    /sellers/me/profile             —— 维护卖家档案
  - GET    /sellers/{user_id}/profile      —— 公开卖家档案（详情页用）
  - GET    /admin/listings/reviewing       —— 管理员审核队列
  - POST   /admin/listings/{id}/review     —— 管理员审核通过 / 拒绝
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

from app.core.response import success
from app.api.deps import get_current_user, get_current_user_optional, get_current_admin_user
from app.services.store_product_service import store_product_service
from app.services.store_merchant_service import store_merchant_service
from app.services.seller_profile_service import seller_profile_service
from app.services.user_service import user_service
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


def _split_csv(value: Optional[str]) -> Optional[list]:
    """把 ?brand=A,B,C 这种逗号串解成 trim 后的非空列表；空串/None → None."""
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return parts or None


def _split_csv_int(value: Optional[str]) -> Optional[list]:
    """逗号串解成整数列表；非整数项忽略。"""
    raw = _split_csv(value)
    if not raw:
        return None
    out: list[int] = []
    for r in raw:
        try:
            out.append(int(r))
        except (TypeError, ValueError):
            continue
    return out or None


@marketplace_router.get("/listings")
async def marketplace_listings(
    q: Optional[str] = Query(None, description="关键词"),
    brand: Optional[str] = Query(None, description="单值或 CSV: nike,adidas"),
    categoryId: Optional[str] = Query(None, description="单值或 CSV 整数 ID 列表"),
    category: Optional[str] = Query(
        None,
        description="按 PRD 6 大类名称(外套/上衣/裤装/鞋履/包袋/配饰)模糊匹配 store_product_categories.name；CSV",
    ),
    size: Optional[str] = Query(None, description="单值或 CSV: M,L,42"),
    color: Optional[str] = Query(None, description="单值或 CSV"),
    condition: Optional[str] = Query(
        None,
        description="BNWT / NEW_99 / NEW_95 / USED_8 / FLAW；支持 CSV 多选",
    ),
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
    """Marketplace 列表查询 —— 全部维度都支持单值或 CSV 多选。

    多选语义：所有命中任一选项的单品都返回（OR 语义），与 PRD 设计稿
    "可多选" 一致。
    """
    products, total = store_product_service.search_marketplace(
        keyword=q,
        brands=_split_csv(brand),
        category_ids=_split_csv_int(categoryId),
        category_kinds=_split_csv(category),
        sizes=_split_csv(size),
        colors=_split_csv(color),
        conditions=_split_csv(condition),
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


@marketplace_router.get("/search-suggestions")
async def marketplace_search_suggestions(
    q: str = Query(..., min_length=1, description="搜索关键词（支持品牌/单品/秀场模糊匹配）"),
    limit: int = Query(8, ge=1, le=20, description="建议条数"),
):
    """交易大厅搜索下拉建议。

    聚合品牌名、款式系列、秀场关键词（FW07 等）、单品标题，按热度排序。
    """
    items = store_product_service.get_marketplace_search_suggestions(
        keyword=q,
        limit=limit,
    )
    return success({"suggestions": [s.model_dump() for s in items]})


@marketplace_router.get("/popular-brands")
async def marketplace_popular_brands(
    limit: int = Query(6, ge=1, le=20, description="返回品牌数量"),
    rotate: bool = Query(
        True,
        description="是否按当前 UTC 日期对前 30 名候选池洗牌；默认 True，保证每天首屏顺序不同",
    ),
):
    """交易大厅顶部「热门品牌」列表。

    按当前在售单品数量降序取前 30 名为候选池，再按当天 UTC 日期为种子打乱后取
    前 ``limit``。这样保证每天首屏顺序不同，但当天内多次刷新顺序一致。
    每项含 ``name / brandId / imageUrl / listingCount``，前端用于渲染
    PDF 设计稿中横向滚动的圆形品牌头像列表。
    """
    items = store_product_service.get_popular_brands(limit=limit, daily_rotate=rotate)
    return success({"brands": items})


@marketplace_router.get("/curated")
async def marketplace_curated(
    limit: int = Query(10, ge=1, le=20, description="返回单品数量"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """交易大厅顶部「大家都在看」 —— 管理员手动策展的精选单品。

    返回管理员通过 admin 后台标记 ``is_curated=TRUE`` 的 active 单品，
    按 ``curated_sort_order`` asc 排序。前端展示在 marketplace 顶部、热门品牌下方。
    """
    items = store_product_service.list_curated_products(
        limit=limit, user_id=current_user_id
    )
    return success({"products": [p.model_dump() for p in items]})


# ==========================================================================
# 智能定价 / 客服联系（PRD 1.4 + 1.6）
# ==========================================================================


@marketplace_router.get("/brand-price-range")
async def brand_price_range(
    brand: str = Query(..., description="品牌名"),
    condition: Optional[str] = Query(
        None,
        description="成色（BNWT / NEW_99 / NEW_95 / USED_8 / FLAW）；可空",
    ),
    _user_id: Optional[int] = Depends(get_current_user_optional),
):
    """根据品牌 (+ 可选成色) 返回 P25 / P50 / P75 历史价格区间。

    数据源是 brand_price_history 视图（active + sold 的真实成交价）。
    无历史样本时返回 ``source: 'fallback'`` 占位区间，前端走兜底 UI。
    """
    result = store_product_service.suggest_brand_price_range(
        brand=brand, condition=condition
    )
    return success(result.model_dump())


@marketplace_router.get("/support-contact")
async def get_support_contact():
    """找不到品牌 / 秀场时引导联系小客服。"""
    info = store_product_service.get_support_contact()
    return success(info.model_dump())


@marketplace_router.get("/all-brands")
async def marketplace_all_brands(
    keyword: Optional[str] = Query(None, description="关键词（品牌名/创始人/国家）"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
):
    """平台已录入的所有品牌列表（marketplace 顶部「更多」展开模态框用）。

    每项含 ``brandId / name / imageUrl / category / country / listingCount``。
    与 ``GET /api/brands`` 的区别：本接口顺手把每个品牌的在售单品数算出来，
    避免前端 N+1 拉取。
    """
    items, total = store_product_service.list_all_platform_brands(
        keyword=keyword, page=page, page_size=pageSize
    )
    return success(
        {
            "brands": items,
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


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
    """提交审核（draft → reviewing）。开启 listingAutoApprove 时自动 → active。

    PRD 「实名认证 · 没实名不能上架」:
      - C2C 个人卖家:必须 seller_kyc.status='approved' 才能 submit;
      - 买手店:走 store_merchant 自带认证流程,这里不强制 seller_kyc。
    """
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
        # 个人 C2C 卖家强制实名门。
        # is_identity_verified 统一判定:seller_kyc.approved(中国阿里云二要素 /
        # 海外 Stripe Identity)或 海外 Stripe Connect active(自带 KYC, 短路)。
        from app.services.kyc_service import kyc_service
        if not kyc_service.is_identity_verified(current_user_id):
            raise HTTPException(
                status_code=403,
                detail="请先完成实名认证后再上架(我的钱包 → 实名认证)",
            )

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
    """批量删除草稿 / 被拒 / 已下架商品（PRD 1.6）。"""
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


@sellers_router.get("/me/listings/summary")
async def my_listings_summary(
    current_user_id: int = Depends(get_current_user),
):
    """当前用户各 listing 状态的数量汇总（卖家管理后台顶部统计卡片）。"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    counts = store_product_service.seller_listings_status_summary(
        seller_user_id=current_user_id,
    )
    if merchant and merchant.status == "APPROVED":
        merchant_counts = store_product_service.seller_listings_status_summary(
            merchant_id=merchant.id,
        )
        for key, value in merchant_counts.items():
            counts[key] = counts.get(key, 0) + value
    return success(counts)


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


@sellers_router.get("/{user_id}/listings")
async def list_user_public_listings(
    user_id: int,
    status: str = Query("active", description="active / sold —— 他人主页仅公开这两种"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """他人主页「在售」tab —— 公开 listing 列表。

    隐私：目标用户开启 hide_sales 且访问者不是本人时返回 403。
    仅返回 active / sold，避免草稿/审核中泄露。
    """
    if current_user_id != user_id:
        privacy = user_service.get_privacy_settings(user_id)
        if privacy and privacy.hideSales:
            raise HTTPException(status_code=403, detail="用户已隐藏在售列表")

    if status not in ("active", "sold"):
        status = "active"

    merchant = store_merchant_service.get_merchant_by_user(user_id)
    products_all: list = []
    total = 0
    p, t = store_product_service.list_seller_listings(
        seller_user_id=user_id, status=status, page=page, page_size=pageSize
    )
    products_all.extend(p)
    total += t
    if merchant and merchant.status == "APPROVED":
        p2, t2 = store_product_service.list_seller_listings(
            merchant_id=merchant.id, status=status, page=page, page_size=pageSize
        )
        products_all.extend(p2)
        total += t2

    products_all.sort(key=lambda x: x.createdAt or "", reverse=True)
    return success(
        {
            "products": [p.model_dump() for p in products_all],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@sellers_router.get("/me/drafts/count")
async def my_draft_count(
    current_user_id: int = Depends(get_current_user),
):
    """返回当前用户的 individual 草稿数量 + 上限。

    用于发布入口提示 "草稿 (3 / 5)"，超限时按钮置灰。
    """
    count = store_product_service._count_open_drafts(current_user_id)
    return success({"count": count, "limit": 5})


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


# ==========================================================================
# 「大家都在看」管理员策展（migration 065）
# ==========================================================================


class _CuratedSetBody(BaseModel):
    """管理员设置/取消「大家都在看」 的请求体。"""
    isCurated: bool
    sortOrder: Optional[int] = None  # is_curated=True 时可选；None 自动追加到末尾


@admin_router.put("/{product_id}/curated")
async def admin_set_curated(
    product_id: int,
    payload: _CuratedSetBody,
    _admin_id: int = Depends(get_current_admin_user),
):
    """管理员把单品标记为「大家都在看」 / 取消标记。

    - is_curated=True 时，可选 sortOrder（asc，越小越靠前）；不传则自动追加到末尾。
    - is_curated=False 时，sortOrder 一并清空。
    """
    try:
        product = store_product_service.admin_set_curated(
            product_id,
            is_curated=payload.isCurated,
            sort_order=payload.sortOrder,
        )
        return success(product.model_dump(), message="策展状态已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
