"""
活动日历路由 (PRD 论坛改造 M1 / P0)

公开：  GET /events/upcoming  GET /events/reviews  GET /events/calendar  GET /events/map  GET /events/{id}
用户：  收藏 / 预约 切换、我的收藏 / 预约、评论
管理员：/events/admin/* CRUD（仅 is_admin）
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user, get_current_user_optional, get_current_admin_user
from app.core.response import success
from app.db.supabase import get_supabase_admin
from app.schemas.event import EventCreate, EventUpdate, EventCommentCreate
from app.services.event_service import event_service


router = APIRouter(prefix="/events", tags=["活动日历"])


# ==================== 公开 ====================

@router.get("/upcoming", response_model=None)
def list_upcoming(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    eventType: Optional[str] = None,
    city: Optional[str] = None,
    viewer_id: Optional[int] = Depends(get_current_user_optional),
):
    """近期活动（已发布且未结束）"""
    items, total = event_service.list_upcoming(
        viewer_id, limit=pageSize, page=page, event_type=eventType, city=city
    )
    return success({"items": [i.model_dump() for i in items], "total": total})


@router.get("/reviews", response_model=None)
def list_reviews(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    viewer_id: Optional[int] = Depends(get_current_user_optional),
):
    """活动回顾（已结束）"""
    items, total = event_service.list_reviews(viewer_id, limit=pageSize, page=page)
    return success({"items": [i.model_dump() for i in items], "total": total})


@router.get("/calendar", response_model=None)
def calendar(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    tzOffset: int = Query(0, ge=-14 * 60, le=14 * 60, description="客户端时区偏移（分钟，东八区 480）"),
    viewer_id: Optional[int] = Depends(get_current_user_optional),
):
    """月视图：每一天的活动类型（分色圆圈）+ 当月活动列表"""
    data = event_service.calendar(month, viewer_id, tz_offset_minutes=tzOffset)
    return success(data.model_dump())


@router.get("/map", response_model=None)
def events_for_map(
    range: str = Query("month", pattern=r"^(week|month|quarter)$"),
    eventType: Optional[str] = None,
    viewer_id: Optional[int] = Depends(get_current_user_optional),
):
    """地图活动图层：只返回有坐标的线下活动（线上活动不进地图）。"""
    now = datetime.now(timezone.utc)
    days = {"week": 7, "month": 31, "quarter": 92}[range]
    items = event_service.list_in_range(
        viewer_id,
        start=now,
        end=now + timedelta(days=days),
        event_type=eventType,
        exclude_online=True,
        with_coords_only=True,
    )
    # 地图需要坐标，摘要里没有，补一次
    ids = [i.id for i in items]
    coords = {}
    if ids:
        rows = (
            get_supabase_admin()
            .table("events")
            .select("id, latitude, longitude, store_id, address")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
        coords = {r["id"]: r for r in rows}
    out = []
    for i in items:
        d = i.model_dump()
        c = coords.get(i.id, {})
        d.update(
            {
                "latitude": c.get("latitude"),
                "longitude": c.get("longitude"),
                "storeId": c.get("store_id"),
                "address": c.get("address"),
            }
        )
        out.append(d)
    return success({"items": out})


# ==================== 用户：我的收藏 / 预约 ====================
# 放在 /{event_id} 之前，避免路径冲突

@router.get("/me/favorites", response_model=None)
def my_favorites(
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
    user_id: int = Depends(get_current_user),
):
    items, total = event_service.list_user_favorites(user_id, page=page, limit=pageSize)
    return success({"items": [i.model_dump() for i in items], "total": total})


@router.get("/me/reservations", response_model=None)
def my_reservations(
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
    user_id: int = Depends(get_current_user),
):
    items, total = event_service.list_user_reservations(user_id, page=page, limit=pageSize)
    return success({"items": [i.model_dump() for i in items], "total": total})


# ==================== 管理员 ====================

@router.get("/admin/list", response_model=None)
def admin_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    _admin: int = Depends(get_current_admin_user),
):
    items, total = event_service.admin_list(page=page, limit=pageSize, status=status, keyword=keyword)
    return success({"items": [i.model_dump() for i in items], "total": total})


@router.get("/admin/{event_id}", response_model=None)
def admin_get(event_id: int, _admin: int = Depends(get_current_admin_user)):
    detail = event_service.get_detail(event_id, None, include_hidden=True)
    if not detail:
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(detail.model_dump())


@router.post("/admin", response_model=None)
def admin_create(data: EventCreate, admin_id: int = Depends(get_current_admin_user)):
    try:
        detail = event_service.admin_create(data, admin_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(detail.model_dump(), message="活动创建成功")


@router.put("/admin/{event_id}", response_model=None)
def admin_update(event_id: int, data: EventUpdate, _admin: int = Depends(get_current_admin_user)):
    try:
        detail = event_service.admin_update(event_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not detail:
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(detail.model_dump(), message="活动更新成功")


@router.delete("/admin/{event_id}", response_model=None)
def admin_delete(event_id: int, _admin: int = Depends(get_current_admin_user)):
    if not event_service.admin_delete(event_id):
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(message="活动已删除")


@router.post("/admin/scheduler/run", response_model=None)
def admin_run_scheduler(_admin: int = Depends(get_current_admin_user)):
    """人工兜底：立刻执行到期转回顾 + 预约提醒"""
    ended = event_service.mark_ended_due()
    reminded = event_service.send_reservation_reminders()
    return success({"ended": ended, "reminded": reminded})


# ==================== 单个活动 ====================

@router.get("/{event_id}", response_model=None)
def get_event(event_id: int, viewer_id: Optional[int] = Depends(get_current_user_optional)):
    detail = event_service.get_detail(event_id, viewer_id)
    if not detail:
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(detail.model_dump())


@router.post("/{event_id}/favorite", response_model=None)
def toggle_favorite(event_id: int, user_id: int = Depends(get_current_user)):
    try:
        favorited, count = event_service.toggle_favorite(event_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return success({"isFavorited": favorited, "favoriteCount": count})


@router.post("/{event_id}/reserve", response_model=None)
def toggle_reservation(event_id: int, user_id: int = Depends(get_current_user)):
    try:
        reserved, count = event_service.toggle_reservation(event_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"isReserved": reserved, "reservationCount": count})


@router.get("/{event_id}/comments", response_model=None)
def list_comments(
    event_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    items, total = event_service.list_comments(event_id, page=page, limit=pageSize)
    return success({"items": [i.model_dump() for i in items], "total": total})


@router.post("/{event_id}/comments", response_model=None)
def create_comment(event_id: int, body: EventCommentCreate, user_id: int = Depends(get_current_user)):
    try:
        comment = event_service.create_comment(event_id, user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(comment.model_dump(), message="评论成功")


@router.delete("/{event_id}/comments/{comment_id}", response_model=None)
def delete_comment(event_id: int, comment_id: int, user_id: int = Depends(get_current_user)):
    is_admin = False
    try:
        u = get_supabase_admin().table("users").select("is_admin").eq("id", user_id).limit(1).execute()
        is_admin = bool(u.data and u.data[0].get("is_admin"))
    except Exception:
        pass
    try:
        ok = event_service.delete_comment(comment_id, user_id, is_admin=is_admin)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="评论不存在")
    return success(message="已删除")
