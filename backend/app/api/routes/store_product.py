"""
商家商品系统 + 店铺主页可配置项 API 路由。

挂在已有的 `/api/store-merchants` prefix 下，和 `store_merchant.py` 并列；
拆成单独文件避免后者继续膨胀到 1000+ 行。

权限模型：
  - 公开 (匿名可访问) ：店铺主页卡片 / 入口卡片 / 分类 / 商品列表 / 商品详情 / 评论列表
  - 登录用户          ：点赞商品、评论、回复、点赞评论
  - 商家本人 (APPROVED)：自己店铺下资源的创建/修改/删除
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.response import success
from app.services.store_merchant_service import store_merchant_service
from app.services.store_profile_service import store_profile_service
from app.services.store_product_service import store_product_service
from app.schemas.store_product import (
    StoreProfileConfigUpsert,
    StoreEntryCardCreate,
    StoreEntryCardUpdate,
    StoreProductCategoryCreate,
    StoreProductCategoryUpdate,
    StoreProductCreate,
    StoreProductUpdate,
    ProductCommentCreate,
)
from app.api.deps import get_current_user, get_current_user_optional


router = APIRouter(prefix="/store-merchants", tags=["商家商品系统"])


# ==========================================================================
# 权限工具
# ==========================================================================


def _assert_merchant_owns(merchant_id: int, user_id: int):
    """校验 merchant_id 归属 user_id 且状态 APPROVED；失败抛 HTTPException。"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != user_id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    return merchant


def _resolve_merchant_by_product(product_id: int, user_id: int):
    """商品维度的所有权校验：根据 product 反查 merchant，再校验归属。"""
    product = store_product_service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    if not product.merchantId:
        raise HTTPException(status_code=500, detail="商品缺少商家关联")
    return _assert_merchant_owns(product.merchantId, user_id)


# ==========================================================================
# 店铺主页卡片配置（StoreProfileCard）
# ==========================================================================


@router.get("/store/{store_id}/profile-config")
async def get_profile_config(store_id: str):
    """公开：获取店铺主页卡片的可配置数据。未配置时返回 null，前端走 Mock 兜底。"""
    config = store_profile_service.get_profile_config(store_id)
    return success(config.model_dump() if config else None)


@router.put("/{merchant_id}/profile-config")
async def upsert_profile_config(
    merchant_id: int,
    data: StoreProfileConfigUpsert,
    current_user_id: int = Depends(get_current_user),
):
    """商家 upsert 主页卡片配置。"""
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    try:
        config = store_profile_service.upsert_profile_config(
            merchant.storeId, merchant.id, data
        )
        return success(config.model_dump(), message="主页配置已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================================================
# 入口卡片（CategoryCards）
# ==========================================================================


@router.get("/store/{store_id}/entry-cards")
async def list_entry_cards_public(store_id: str):
    """公开：列出 PUBLISHED 的入口卡片（按 sort_order）。"""
    cards = store_profile_service.list_entry_cards(store_id)
    return success({"cards": [c.model_dump() for c in cards], "total": len(cards)})


@router.get("/{merchant_id}/entry-cards")
async def list_entry_cards_for_merchant(
    merchant_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """商家后台：列出自己店铺下全部入口卡片（含 HIDDEN）。"""
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    cards = store_profile_service.list_entry_cards(merchant.storeId, include_hidden=True)
    return success({"cards": [c.model_dump() for c in cards], "total": len(cards)})


@router.post("/{merchant_id}/entry-cards")
async def create_entry_card(
    merchant_id: int,
    data: StoreEntryCardCreate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    try:
        card = store_profile_service.create_entry_card(merchant.storeId, merchant.id, data)
        return success(card.model_dump(), message="发布成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/entry-cards/{card_id}")
async def update_entry_card(
    card_id: int,
    data: StoreEntryCardUpdate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant or merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="您不是认证商家")
    try:
        card = store_profile_service.update_entry_card(card_id, merchant.id, data)
        return success(card.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/entry-cards/{card_id}")
async def delete_entry_card(
    card_id: int,
    current_user_id: int = Depends(get_current_user),
):
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant or merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="您不是认证商家")
    if store_profile_service.delete_entry_card(card_id, merchant.id):
        return success(None, message="删除成功")
    raise HTTPException(status_code=404, detail="入口卡片不存在或无权限删除")


# ==========================================================================
# 商品分类
# ==========================================================================


@router.get("/store/{store_id}/product-categories")
async def list_categories_public(
    store_id: str,
    withCount: bool = Query(False, description="是否回填 productCount"),
):
    """公开：店铺下的商品分类（按 sort_order）。"""
    cats = store_profile_service.list_categories(
        store_id, with_product_count=withCount
    )
    return success({"categories": [c.model_dump() for c in cats], "total": len(cats)})


@router.post("/{merchant_id}/product-categories")
async def create_category(
    merchant_id: int,
    data: StoreProductCategoryCreate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    try:
        cat = store_profile_service.create_category(merchant.storeId, merchant.id, data)
        return success(cat.model_dump(), message="分类已创建")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # unique violation -> 分类名重复
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="该分类名已存在")
        raise


@router.put("/product-categories/{category_id}")
async def update_category(
    category_id: int,
    data: StoreProductCategoryUpdate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant or merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="您不是认证商家")
    try:
        cat = store_profile_service.update_category(category_id, merchant.id, data)
        return success(cat.model_dump(), message="分类已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/product-categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user_id: int = Depends(get_current_user),
):
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant or merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="您不是认证商家")
    if store_profile_service.delete_category(category_id, merchant.id):
        return success(None, message="分类已删除")
    raise HTTPException(status_code=404, detail="分类不存在或无权限删除")


# ==========================================================================
# 商品 CRUD
# ==========================================================================


@router.post("/{merchant_id}/products")
async def create_product(
    merchant_id: int,
    data: StoreProductCreate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    try:
        product = store_product_service.create_product(merchant.storeId, merchant.id, data)
        return success(product.model_dump(), message="商品已发布")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    data: StoreProductUpdate,
    current_user_id: int = Depends(get_current_user),
):
    merchant = _resolve_merchant_by_product(product_id, current_user_id)
    try:
        product = store_product_service.update_product(product_id, merchant.id, data)
        return success(product.model_dump(), message="商品已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    merchant = _resolve_merchant_by_product(product_id, current_user_id)
    if store_product_service.delete_product(product_id, merchant.id):
        return success(None, message="商品已删除")
    raise HTTPException(status_code=404, detail="商品不存在或删除失败")


@router.get("/products/{product_id}")
async def get_product_detail(
    product_id: int,
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    product = store_product_service.get_product(product_id, user_id=current_user_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    return success(product.model_dump())


@router.get("/store/{store_id}/products")
async def list_store_products(
    store_id: str,
    categoryId: Optional[int] = Query(None, description="分类 ID"),
    isNew: Optional[bool] = Query(None, description="仅查看新品"),
    hasDiscount: Optional[bool] = Query(None, description="仅查看有折扣"),
    searchQuery: Optional[str] = Query(None, description="关键词搜索 title/brand"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    products, total = store_product_service.list_products(
        store_id,
        category_id=categoryId,
        is_new=isNew,
        has_discount=hasDiscount,
        search_query=searchQuery,
        page=page,
        page_size=pageSize,
        user_id=current_user_id,
    )
    return success({
        "products": [p.model_dump() for p in products],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/{merchant_id}/products")
async def list_merchant_products(
    merchant_id: int,
    status: Optional[str] = Query(None, description="筛选状态；不传则返回全部"),
    categoryId: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """商家后台：列出自家店铺下商品（含草稿/隐藏）。"""
    merchant = _assert_merchant_owns(merchant_id, current_user_id)
    products, total = store_product_service.list_products(
        merchant.storeId,
        status=status if status else "",
        category_id=categoryId,
        page=page,
        page_size=pageSize,
    )
    return success({
        "products": [p.model_dump() for p in products],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==========================================================================
# 商品点赞 (喜欢)
# ==========================================================================


@router.post("/products/{product_id}/like")
async def like_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    ok = store_product_service.like_product(product_id, current_user_id)
    return success({"liked": True if ok else store_product_service.check_product_liked(product_id, current_user_id)})


@router.delete("/products/{product_id}/like")
async def unlike_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    store_product_service.unlike_product(product_id, current_user_id)
    return success({"liked": False})


@router.get("/products/{product_id}/like/check")
async def check_product_like(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    liked = store_product_service.check_product_liked(product_id, current_user_id)
    return success({"liked": liked})


@router.get("/user/liked-products")
async def list_my_liked_products(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    products, total = store_product_service.list_user_liked_products(
        current_user_id, page=page, page_size=pageSize
    )
    return success({
        "products": [p.model_dump() for p in products],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==========================================================================
# 商品「收藏」(Save / Bookmark)
# ==========================================================================
#
# 路径与点赞 / 想要严格对称：
#   POST   /products/{id}/favorite        —— 收藏
#   DELETE /products/{id}/favorite        —— 取消收藏
#   GET    /products/{id}/favorite/check  —— 当前用户是否已收藏
#   GET    /user/favorited-products       —— 当前用户的收藏分页


@router.post("/products/{product_id}/favorite")
async def favorite_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    ok = store_product_service.favorite_product(product_id, current_user_id)
    return success(
        {
            "favorited": True
            if ok
            else store_product_service.check_product_favorited(
                product_id, current_user_id
            )
        },
        message="已收藏" if ok else "已在收藏中",
    )


@router.delete("/products/{product_id}/favorite")
async def unfavorite_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    store_product_service.unfavorite_product(product_id, current_user_id)
    return success({"favorited": False}, message="已取消收藏")


@router.get("/products/{product_id}/favorite/check")
async def check_product_favorited(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    favorited = store_product_service.check_product_favorited(
        product_id, current_user_id
    )
    return success({"favorited": favorited})


@router.get("/user/favorited-products")
async def list_my_favorited_products(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    products, total = store_product_service.list_user_favorited_products(
        current_user_id, page=page, page_size=pageSize
    )
    return success({
        "products": [p.model_dump() for p in products],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==========================================================================
# 商品「想要」(愿望单)
# ==========================================================================
#
# 路径与点赞对称：
#   POST   /products/{id}/want          —— 加入愿望单
#   DELETE /products/{id}/want          —— 移出愿望单
#   GET    /products/{id}/want/check    —— 当前用户是否已加
#   GET    /user/wanted-products        —— 当前用户的愿望单分页


@router.post("/products/{product_id}/want")
async def want_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    ok = store_product_service.want_product(product_id, current_user_id)
    return success(
        {
            "wanted": True
            if ok
            else store_product_service.check_product_wanted(
                product_id, current_user_id
            )
        },
        message="已添加到愿望单" if ok else "已在愿望单中",
    )


@router.delete("/products/{product_id}/want")
async def unwant_product(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    store_product_service.unwant_product(product_id, current_user_id)
    return success({"wanted": False}, message="已从愿望单移除")


@router.get("/products/{product_id}/want/check")
async def check_product_wanted(
    product_id: int,
    current_user_id: int = Depends(get_current_user),
):
    wanted = store_product_service.check_product_wanted(product_id, current_user_id)
    return success({"wanted": wanted})


@router.get("/user/wanted-products")
async def list_my_wanted_products(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    products, total = store_product_service.list_user_wanted_products(
        current_user_id, page=page, page_size=pageSize
    )
    return success({
        "products": [p.model_dump() for p in products],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==========================================================================
# 商品评论
# ==========================================================================


@router.get("/products/{product_id}/comments")
async def list_product_comments(
    product_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    comments, total = store_product_service.list_comments(
        product_id, page=page, page_size=pageSize, user_id=current_user_id
    )
    return success({
        "comments": [c.model_dump() for c in comments],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.post("/products/{product_id}/comments")
async def create_product_comment(
    product_id: int,
    data: ProductCommentCreate,
    current_user_id: int = Depends(get_current_user),
):
    try:
        comment = store_product_service.create_comment(product_id, current_user_id, data)
        return success(comment.model_dump(), message="评论成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/product-comments/{comment_id}")
async def delete_product_comment(
    comment_id: int,
    current_user_id: int = Depends(get_current_user),
):
    if store_product_service.delete_comment(comment_id, current_user_id):
        return success(None, message="评论已删除")
    raise HTTPException(status_code=404, detail="评论不存在或无权限删除")


@router.get("/product-comments/{comment_id}/replies")
async def list_product_comment_replies(comment_id: int):
    replies = store_product_service.list_comment_replies(comment_id)
    return success({"replies": [r.model_dump() for r in replies]})


@router.post("/product-comments/{comment_id}/like")
async def like_product_comment(
    comment_id: int,
    current_user_id: int = Depends(get_current_user),
):
    store_product_service.like_comment(comment_id, current_user_id)
    return success({"liked": True})


@router.delete("/product-comments/{comment_id}/like")
async def unlike_product_comment(
    comment_id: int,
    current_user_id: int = Depends(get_current_user),
):
    store_product_service.unlike_comment(comment_id, current_user_id)
    return success({"liked": False})
