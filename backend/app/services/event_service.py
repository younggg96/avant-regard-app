"""
活动日历服务 (PRD 论坛改造 M1 / P0)

职责：
- 活动 CRUD（管理员）
- 日历 / 近期活动 / 活动回顾 查询
- 收藏、预约（含兴趣快照）
- 评论 + 返图
- 调度器任务：到期自动转为 ENDED、预约前 2 小时推送提醒
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from typing import Dict, List, Optional, Tuple, Iterable

from app.db.supabase import get_supabase_admin
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventCommentCreate,
    EventSummary,
    EventDetail,
    EventStoreBrief,
    EventCalendarDay,
    EventCalendarResponse,
    EventComment,
    EventCommentUser,
    EventCommentArchiveBrief,
    EventStatus,
    EventType,
)


def _parse_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventService:
    PUBLIC_STATUSES = (EventStatus.PUBLISHED.value, EventStatus.ENDED.value)

    def __init__(self):
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # 格式化
    # ------------------------------------------------------------------
    def _summary(self, row: dict, fav_ids: set, res_ids: set) -> EventSummary:
        return EventSummary(
            id=row["id"],
            title=row["title"],
            coverImage=row.get("cover_image"),
            eventType=row.get("event_type") or EventType.MARKET.value,
            startAt=_parse_dt(row["start_at"]),
            endAt=_parse_dt(row["end_at"]),
            isOnline=bool(row.get("is_online")),
            locationName=row.get("location_name"),
            city=row.get("city"),
            organizer=row.get("organizer"),
            status=row.get("status") or EventStatus.PUBLISHED.value,
            favoriteCount=row.get("favorite_count") or 0,
            reservationCount=row.get("reservation_count") or 0,
            commentCount=row.get("comment_count") or 0,
            isFavorited=row["id"] in fav_ids,
            isReserved=row["id"] in res_ids,
        )

    def _detail(self, row: dict, fav_ids: set, res_ids: set) -> EventDetail:
        base = self._summary(row, fav_ids, res_ids).model_dump()
        store = None
        if row.get("store_id"):
            try:
                s = (
                    self.db.table("buyer_stores")
                    .select("id, name, city, address")
                    .eq("id", row["store_id"])
                    .limit(1)
                    .execute()
                )
                if s.data:
                    sd = s.data[0]
                    store = EventStoreBrief(
                        id=str(sd["id"]),
                        name=sd.get("name") or "",
                        city=sd.get("city"),
                        address=sd.get("address"),
                    )
            except Exception:
                store = None
        return EventDetail(
            **base,
            description=row.get("description") or "",
            images=row.get("images") or [],
            address=row.get("address"),
            country=row.get("country"),
            latitude=row.get("latitude"),
            longitude=row.get("longitude"),
            storeId=row.get("store_id"),
            store=store,
            linkUrl=row.get("link_url"),
            brandIds=row.get("brand_ids") or [],
            organizerUserId=row.get("organizer_user_id"),
            createdBy=row.get("created_by"),
            createdAt=_parse_dt(row.get("created_at")) or _now(),
            updatedAt=_parse_dt(row.get("updated_at")) or _now(),
        )

    def _viewer_sets(self, viewer_id: Optional[int], event_ids: Iterable[int]) -> Tuple[set, set]:
        ids = [i for i in event_ids]
        if not viewer_id or not ids:
            return set(), set()
        fav = (
            self.db.table("event_favorites")
            .select("event_id")
            .eq("user_id", viewer_id)
            .in_("event_id", ids)
            .execute()
        )
        res = (
            self.db.table("event_reservations")
            .select("event_id")
            .eq("user_id", viewer_id)
            .in_("event_id", ids)
            .execute()
        )
        return (
            {r["event_id"] for r in (fav.data or [])},
            {r["event_id"] for r in (res.data or [])},
        )

    def _rows_to_summaries(self, rows: List[dict], viewer_id: Optional[int]) -> List[EventSummary]:
        fav_ids, res_ids = self._viewer_sets(viewer_id, [r["id"] for r in rows])
        return [self._summary(r, fav_ids, res_ids) for r in rows]

    # ------------------------------------------------------------------
    # 查询
    # ------------------------------------------------------------------
    def get_row(self, event_id: int) -> Optional[dict]:
        r = self.db.table("events").select("*").eq("id", event_id).limit(1).execute()
        return r.data[0] if r.data else None

    def get_detail(self, event_id: int, viewer_id: Optional[int], include_hidden: bool = False) -> Optional[EventDetail]:
        row = self.get_row(event_id)
        if not row:
            return None
        if not include_hidden and row.get("status") not in self.PUBLIC_STATUSES:
            return None
        fav_ids, res_ids = self._viewer_sets(viewer_id, [event_id])
        return self._detail(row, fav_ids, res_ids)

    def list_upcoming(
        self,
        viewer_id: Optional[int],
        limit: int = 20,
        page: int = 1,
        event_type: Optional[str] = None,
        city: Optional[str] = None,
    ) -> Tuple[List[EventSummary], int]:
        """近期活动：已发布且尚未结束，按开始时间升序。"""
        now = _iso(_now())
        q = (
            self.db.table("events")
            .select("*", count="exact")
            .eq("status", EventStatus.PUBLISHED.value)
            .gte("end_at", now)
        )
        if event_type:
            q = q.eq("event_type", event_type)
        if city:
            q = q.eq("city", city)
        offset = (max(page, 1) - 1) * limit
        r = q.order("start_at", desc=False).range(offset, offset + limit - 1).execute()
        return self._rows_to_summaries(r.data or [], viewer_id), (r.count or 0)

    def list_reviews(
        self, viewer_id: Optional[int], limit: int = 20, page: int = 1
    ) -> Tuple[List[EventSummary], int]:
        """活动回顾：已结束，按结束时间倒序。"""
        offset = (max(page, 1) - 1) * limit
        r = (
            self.db.table("events")
            .select("*", count="exact")
            .eq("status", EventStatus.ENDED.value)
            .order("end_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return self._rows_to_summaries(r.data or [], viewer_id), (r.count or 0)

    def list_in_range(
        self,
        viewer_id: Optional[int],
        start: datetime,
        end: datetime,
        event_type: Optional[str] = None,
        exclude_online: bool = False,
        with_coords_only: bool = False,
    ) -> List[EventSummary]:
        """时间区间内（有交集）的公开活动。供日历 / 地图使用。"""
        q = (
            self.db.table("events")
            .select("*")
            .in_("status", list(self.PUBLIC_STATUSES))
            .lte("start_at", _iso(end))
            .gte("end_at", _iso(start))
        )
        if event_type:
            q = q.eq("event_type", event_type)
        if exclude_online:
            q = q.eq("is_online", False)
        if with_coords_only:
            q = q.not_.is_("latitude", "null").not_.is_("longitude", "null")
        r = q.order("start_at", desc=False).execute()
        return self._rows_to_summaries(r.data or [], viewer_id)

    def calendar(
        self, month: str, viewer_id: Optional[int], tz_offset_minutes: int = 0
    ) -> EventCalendarResponse:
        """月视图：返回每一天的活动类型集合 + 当月全部活动摘要。

        tz_offset_minutes: 客户端本地时区相对 UTC 的偏移（分钟，东八区为 +480），
        用于把 UTC 时间落到用户本地的日期格子上。
        """
        year, mon = [int(x) for x in month.split("-")[:2]]
        tz = timezone(timedelta(minutes=tz_offset_minutes))
        month_start_local = datetime(year, mon, 1, tzinfo=tz)
        if mon == 12:
            next_month_local = datetime(year + 1, 1, 1, tzinfo=tz)
        else:
            next_month_local = datetime(year, mon + 1, 1, tzinfo=tz)
        month_end_local = next_month_local - timedelta(seconds=1)

        summaries = self.list_in_range(viewer_id, month_start_local, month_end_local)

        days: Dict[str, EventCalendarDay] = {}
        for ev in summaries:
            s_local = ev.startAt.astimezone(tz)
            e_local = ev.endAt.astimezone(tz)
            cur = max(s_local.date(), month_start_local.date())
            last = min(e_local.date(), month_end_local.date())
            while cur <= last:
                key = cur.isoformat()
                day = days.get(key)
                if not day:
                    day = EventCalendarDay(date=key, eventTypes=[], eventIds=[])
                    days[key] = day
                if ev.eventType not in day.eventTypes:
                    day.eventTypes.append(ev.eventType)
                day.eventIds.append(ev.id)
                day.hasFavorite = day.hasFavorite or ev.isFavorited
                day.hasReserved = day.hasReserved or ev.isReserved
                cur = cur + timedelta(days=1)

        return EventCalendarResponse(
            month=f"{year:04d}-{mon:02d}",
            days=sorted(days.values(), key=lambda d: d.date),
            events=summaries,
        )

    # ------------------------------------------------------------------
    # 收藏 / 预约
    # ------------------------------------------------------------------
    def toggle_favorite(self, event_id: int, user_id: int) -> Tuple[bool, int]:
        row = self.get_row(event_id)
        if not row:
            raise ValueError("活动不存在")
        existing = (
            self.db.table("event_favorites")
            .select("id")
            .eq("event_id", event_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing.data:
            self.db.table("event_favorites").delete().eq("id", existing.data[0]["id"]).execute()
            favorited = False
        else:
            self.db.table("event_favorites").insert(
                {
                    "event_id": event_id,
                    "user_id": user_id,
                    "city_snapshot": row.get("city"),
                    "event_type_snapshot": row.get("event_type"),
                }
            ).execute()
            favorited = True
        fresh = self.get_row(event_id) or row
        return favorited, fresh.get("favorite_count") or 0

    def toggle_reservation(self, event_id: int, user_id: int) -> Tuple[bool, int]:
        row = self.get_row(event_id)
        if not row:
            raise ValueError("活动不存在")
        if row.get("status") != EventStatus.PUBLISHED.value:
            raise ValueError("活动已结束，无法预约")
        existing = (
            self.db.table("event_reservations")
            .select("id")
            .eq("event_id", event_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing.data:
            self.db.table("event_reservations").delete().eq("id", existing.data[0]["id"]).execute()
            reserved = False
        else:
            self.db.table("event_reservations").insert(
                {"event_id": event_id, "user_id": user_id}
            ).execute()
            reserved = True
        fresh = self.get_row(event_id) or row
        return reserved, fresh.get("reservation_count") or 0

    def list_user_favorites(
        self, user_id: int, page: int = 1, limit: int = 30
    ) -> Tuple[List[EventSummary], int]:
        offset = (max(page, 1) - 1) * limit
        favs = (
            self.db.table("event_favorites")
            .select("event_id", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        ids = [f["event_id"] for f in (favs.data or [])]
        if not ids:
            return [], (favs.count or 0)
        rows = self.db.table("events").select("*").in_("id", ids).execute().data or []
        order = {eid: i for i, eid in enumerate(ids)}
        rows.sort(key=lambda r: order.get(r["id"], 0))
        return self._rows_to_summaries(rows, user_id), (favs.count or 0)

    def list_user_reservations(
        self, user_id: int, page: int = 1, limit: int = 30
    ) -> Tuple[List[EventSummary], int]:
        offset = (max(page, 1) - 1) * limit
        res = (
            self.db.table("event_reservations")
            .select("event_id", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        ids = [f["event_id"] for f in (res.data or [])]
        if not ids:
            return [], (res.count or 0)
        rows = self.db.table("events").select("*").in_("id", ids).execute().data or []
        order = {eid: i for i, eid in enumerate(ids)}
        rows.sort(key=lambda r: order.get(r["id"], 0))
        return self._rows_to_summaries(rows, user_id), (res.count or 0)

    # ------------------------------------------------------------------
    # 评论 / 返图
    # ------------------------------------------------------------------
    def _users_brief(self, user_ids: List[int]) -> Dict[int, EventCommentUser]:
        out: Dict[int, EventCommentUser] = {}
        ids = list({u for u in user_ids if u})
        if not ids:
            return out
        users = self.db.table("users").select("id, username").in_("id", ids).execute().data or []
        infos = self.db.table("user_info").select("user_id, avatar_url").in_("user_id", ids).execute().data or []
        avatar_map = {i["user_id"]: i.get("avatar_url") for i in infos}
        for u in users:
            out[u["id"]] = EventCommentUser(
                id=u["id"], username=u.get("username") or "", avatarUrl=avatar_map.get(u["id"]) or None
            )
        return out

    def _archive_briefs(self, item_ids: List[int]) -> Dict[int, EventCommentArchiveBrief]:
        out: Dict[int, EventCommentArchiveBrief] = {}
        ids = list({i for i in item_ids if i})
        if not ids:
            return out
        rows = (
            self.db.table("user_archive_items")
            .select("id, title, brand_name, photos")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
        for r in rows:
            photos = r.get("photos") or []
            out[r["id"]] = EventCommentArchiveBrief(
                id=r["id"],
                title=r.get("title"),
                brandName=r.get("brand_name"),
                photo=photos[0] if photos else None,
            )
        return out

    def _format_comments(self, rows: List[dict]) -> List[EventComment]:
        users = self._users_brief([r["user_id"] for r in rows])
        archives = self._archive_briefs([r.get("archive_item_id") for r in rows])
        out: List[EventComment] = []
        for r in rows:
            user = users.get(r["user_id"]) or EventCommentUser(id=r["user_id"], username="")
            out.append(
                EventComment(
                    id=r["id"],
                    eventId=r["event_id"],
                    user=user,
                    content=r.get("content") or "",
                    rating=r.get("rating"),
                    images=r.get("images") or [],
                    archiveItem=archives.get(r.get("archive_item_id")) if r.get("archive_item_id") else None,
                    createdAt=_parse_dt(r.get("created_at")) or _now(),
                )
            )
        return out

    def list_comments(
        self, event_id: int, page: int = 1, limit: int = 20
    ) -> Tuple[List[EventComment], int]:
        offset = (max(page, 1) - 1) * limit
        r = (
            self.db.table("event_comments")
            .select("*", count="exact")
            .eq("event_id", event_id)
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return self._format_comments(r.data or []), (r.count or 0)

    def create_comment(self, event_id: int, user_id: int, body: EventCommentCreate) -> EventComment:
        row = self.get_row(event_id)
        if not row or row.get("status") not in self.PUBLIC_STATUSES:
            raise ValueError("活动不存在")
        if not body.content.strip() and not body.images and body.rating is None:
            raise ValueError("评论内容不能为空")
        if body.archiveItemId is not None:
            owned = (
                self.db.table("user_archive_items")
                .select("id")
                .eq("id", body.archiveItemId)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not owned.data:
                raise ValueError("只能关联自己的档案单品")
        r = (
            self.db.table("event_comments")
            .insert(
                {
                    "event_id": event_id,
                    "user_id": user_id,
                    "content": body.content.strip(),
                    "rating": body.rating,
                    "images": body.images or [],
                    "archive_item_id": body.archiveItemId,
                }
            )
            .execute()
        )
        if not r.data:
            raise RuntimeError("评论失败")
        return self._format_comments(r.data)[0]

    def delete_comment(self, comment_id: int, user_id: int, is_admin: bool = False) -> bool:
        r = self.db.table("event_comments").select("id, user_id").eq("id", comment_id).limit(1).execute()
        if not r.data:
            return False
        if not is_admin and r.data[0]["user_id"] != user_id:
            raise PermissionError("无权删除该评论")
        self.db.table("event_comments").update({"is_deleted": True}).eq("id", comment_id).execute()
        return True

    # ------------------------------------------------------------------
    # 管理员
    # ------------------------------------------------------------------
    @staticmethod
    def _to_row(data, partial: bool = False) -> dict:
        mapping = {
            "title": "title",
            "description": "description",
            "coverImage": "cover_image",
            "images": "images",
            "eventType": "event_type",
            "startAt": "start_at",
            "endAt": "end_at",
            "isOnline": "is_online",
            "locationName": "location_name",
            "address": "address",
            "city": "city",
            "country": "country",
            "latitude": "latitude",
            "longitude": "longitude",
            "storeId": "store_id",
            "organizer": "organizer",
            "linkUrl": "link_url",
            "brandIds": "brand_ids",
            "status": "status",
        }
        src = data.model_dump(exclude_unset=partial)
        row = {}
        for k, col in mapping.items():
            if k not in src:
                continue
            v = src[k]
            if partial and v is None and k not in ("coverImage", "storeId", "linkUrl"):
                # 部分更新时 None 视为「不修改」（少数可清空字段除外）
                continue
            if isinstance(v, datetime):
                v = _iso(v)
            elif hasattr(v, "value"):
                v = v.value
            row[col] = v
        return row

    def admin_create(self, data: EventCreate, admin_id: int) -> EventDetail:
        if data.endAt < data.startAt:
            raise ValueError("结束时间不能早于开始时间")
        row = self._to_row(data)
        if data.eventType == EventType.ONLINE:
            row["is_online"] = True
        row["created_by"] = admin_id
        # 如果活动已经结束却以 PUBLISHED 创建，直接落到 ENDED
        if row.get("status") == EventStatus.PUBLISHED.value and data.endAt < _now():
            row["status"] = EventStatus.ENDED.value
        r = self.db.table("events").insert(row).execute()
        if not r.data:
            raise RuntimeError("创建活动失败")
        return self._detail(r.data[0], set(), set())

    def admin_update(self, event_id: int, data: EventUpdate) -> Optional[EventDetail]:
        current = self.get_row(event_id)
        if not current:
            return None
        row = self._to_row(data, partial=True)
        if not row:
            return self._detail(current, set(), set())
        start = _parse_dt(row.get("start_at") or current["start_at"])
        end = _parse_dt(row.get("end_at") or current["end_at"])
        if start and end and end < start:
            raise ValueError("结束时间不能早于开始时间")
        if row.get("event_type") == EventType.ONLINE.value:
            row["is_online"] = True
        r = self.db.table("events").update(row).eq("id", event_id).execute()
        if not r.data:
            return None
        return self._detail(r.data[0], set(), set())

    def admin_delete(self, event_id: int) -> bool:
        r = self.db.table("events").delete().eq("id", event_id).execute()
        return bool(r.data)

    def admin_list(
        self,
        page: int = 1,
        limit: int = 30,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> Tuple[List[EventSummary], int]:
        offset = (max(page, 1) - 1) * limit
        q = self.db.table("events").select("*", count="exact")
        if status:
            q = q.eq("status", status)
        if keyword:
            q = q.ilike("title", f"%{keyword}%")
        r = q.order("start_at", desc=True).range(offset, offset + limit - 1).execute()
        return self._rows_to_summaries(r.data or [], None), (r.count or 0)

    # ------------------------------------------------------------------
    # 调度器任务
    # ------------------------------------------------------------------
    def mark_ended_due(self) -> int:
        """把 end_at 已过的 PUBLISHED 活动切到 ENDED（活动回顾）。幂等。"""
        now = _iso(_now())
        r = (
            self.db.table("events")
            .update({"status": EventStatus.ENDED.value})
            .eq("status", EventStatus.PUBLISHED.value)
            .lt("end_at", now)
            .execute()
        )
        return len(r.data or [])

    def send_reservation_reminders(self, lead_minutes: int = 120, window_minutes: int = 30) -> int:
        """活动开始前 lead_minutes 分钟推送提醒。

        每次扫描 [now + lead - window, now + lead] 区间开始的活动，
        对尚未发送提醒的预约记录推送并写入 reminder_sent_at（幂等）。
        window 略大于调度间隔，避免漏发；已过开始时间的不再补发。
        """
        from app.services.notification_service import notification_service
        from app.schemas.notification import NotificationType

        now = _now()
        upper = now + timedelta(minutes=lead_minutes)
        lower = upper - timedelta(minutes=window_minutes)
        events = (
            self.db.table("events")
            .select("id, title, start_at, location_name, city, is_online")
            .eq("status", EventStatus.PUBLISHED.value)
            .gte("start_at", _iso(lower))
            .lte("start_at", _iso(upper))
            .execute()
            .data
            or []
        )
        if not events:
            return 0
        sent = 0
        for ev in events:
            pending = (
                self.db.table("event_reservations")
                .select("id, user_id")
                .eq("event_id", ev["id"])
                .is_("reminder_sent_at", "null")
                .execute()
                .data
                or []
            )
            if not pending:
                continue
            start_local = _parse_dt(ev["start_at"])
            where = "线上" if ev.get("is_online") else (ev.get("location_name") or ev.get("city") or "")
            time_text = start_local.strftime("%H:%M") if start_local else ""
            message = f"「{ev['title']}」将于 {time_text} 开始" + (f" · {where}" if where else "")
            for res in pending:
                try:
                    notification_service.create_notification(
                        user_id=res["user_id"],
                        notification_type=NotificationType.SYSTEM,
                        title="活动即将开始",
                        message=message,
                        action_data={
                            "navigateTo": "EventDetail",
                            "navigateParams": {"eventId": ev["id"]},
                            "event_id": ev["id"],
                        },
                        send_push=True,
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"[events] reminder push failed user={res['user_id']} event={ev['id']}: {e}")
                self.db.table("event_reservations").update(
                    {"reminder_sent_at": _iso(now)}
                ).eq("id", res["id"]).execute()
                sent += 1
        return sent


event_service = EventService()
