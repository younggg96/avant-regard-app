"""
Feed 推荐服务 — 三段式槽位分发 (3-Stage Mixer)

Pipeline (driven by the client-supplied `skip` cursor):

  Stage 1 — 首屏保鲜区 (slots 1..STAGE1_SIZE)
    • Pure freshness: ORDER BY created_at DESC. No personalization.
    • Lightly cached (shared across users, filtered client-side by block / exclude).

  Stage 2 — 黄金推荐区 (slots STAGE1_SIZE+1 .. STAGE1_SIZE+STAGE2_SIZE)
    • Hacker-News-style scoring via `get_feed_scored` RPC
      Score = (likes + 2*saves + 3*wants) / (age_hours + 2)^1.2
      × 2  if posted within 24 h
      × 10 if post matches `boost_brand_id` (session-only brand affinity)
    • Recall is hard-bounded to the last 30 days (no full-table scan).
    • Show Archive card inserted every SHOW_INSERT_INTERVAL posts (Rule 4).
    • New users: this slot is entirely replaced by PM-curated posts (Rule 3).

  Stage 3 — 长尾兜底区 (slots STAGE1_SIZE+STAGE2_SIZE+1 ..)
    • Cursor-paginated via `get_feed_longtail` RPC.
    • Plain chronological ORDER BY created_at DESC, 90-day window.
    • No show interleaving, no brand boost — releases compute.

Global rules:
  • Rule 1 (dedup)       : caller-supplied `exclude_ids` is passed to every RPC;
                           stage-1 IDs are appended before calling stage-2 so the
                           first-page response never repeats a post.
  • Cache invalidation   : stage-1 cache is invalidated whenever a post is written
                           (see `cache_service.invalidate_posts`, already wired in
                           PostService).
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

from app.db.supabase import get_supabase
from app.schemas.post import PostGrade, GRADE_REWARD_MAP
from app.services.cache_service import cache_service

# -- Slot layout ---------------------------------------------------------------
STAGE1_SIZE = 6           # Fresh (slots 1..6)
STAGE2_SIZE = 20          # Scored (slots 7..27)
STAGE2_END = STAGE1_SIZE + STAGE2_SIZE  # 26 — boundary at which we switch to stage 3

# -- Mixer knobs ---------------------------------------------------------------
SHOW_INSERT_INTERVAL = 8

# -- Rule 3 new-user cutoff ----------------------------------------------------
# A user is "new" when their account is younger than this many days OR they are
# anonymous. We intentionally do NOT derive this from exclude_ids, because that
# array is reset on pull-to-refresh and would misclassify every refresh as a
# fresh session.
NEW_USER_REGISTRATION_DAYS = 7
NEW_USER_CACHE_TTL_SEC = 300  # 5 min — acceptable staleness vs. DB hit savings

# -- Stage 1 cache -------------------------------------------------------------
# We over-fetch so per-user dedup / block filtering still yields STAGE1_SIZE.
STAGE1_FETCH_MULTIPLIER = 5
STAGE1_CACHE_KEY = "feed:stage1:fresh"
STAGE1_CACHE_TTL = 30  # seconds — short enough to feel fresh, long enough to deflect hot-spot load
# Ungraded posts are included if they were created within this horizon, matching
# the scored RPC so Stage 1 never hides brand-new un-graded content.
STAGE1_UNGRADED_HORIZON = timedelta(hours=1)


class FeedService:
    def __init__(self):
        self.db = get_supabase()
        # In-process TTL cache: user_id -> (is_new_user, cached_at_epoch)
        # Small dict; fine at single-process scale. Process restart is OK —
        # worst case one extra DB round-trip per user.
        self._new_user_cache: Dict[int, Tuple[bool, float]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_feed(
        self,
        current_user_id: Optional[int],
        limit: int = 30,
        exclude_ids: Optional[List[int]] = None,
        boost_brand_id: Optional[int] = None,
        skip: int = 0,
        force_fresh: bool = False,
    ) -> dict:
        """
        Return mixed feed items: { items: [{type, data}] }

        `skip` is the number of *post* items the client has already consumed.
        It is the sole signal we use to pick a stage:
          skip == 0             → stage 1 + stage 2 (first page)
          skip >= STAGE2_END    → stage 3 (long-tail loadMore)
          0 < skip < STAGE2_END → treated as stage-2 continuation (rare; e.g. a
                                  prior partial page). Same code path as stage 2.

        `force_fresh` (set by pull-to-refresh) bypasses — and repopulates — the
        Stage 1 cache pool so the client always sees the absolute latest posts.
        """
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        seen_show_ids = self._extract_seen_show_ids(exclude_ids)
        exclude_set = list(exclude_ids or [])

        if skip >= STAGE2_END:
            return self._serve_stage3(
                limit=limit,
                exclude_ids=exclude_set,
                blocked_ids=blocked_ids,
            )

        return self._serve_first_page(
            current_user_id=current_user_id,
            limit=limit,
            exclude_ids=exclude_set,
            boost_brand_id=boost_brand_id,
            blocked_ids=blocked_ids,
            seen_show_ids=seen_show_ids,
            skip=skip,
            force_fresh=force_fresh,
        )

    # ------------------------------------------------------------------
    # Stage 1 + 2: first page
    # ------------------------------------------------------------------

    def _serve_first_page(
        self,
        current_user_id: Optional[int],
        limit: int,
        exclude_ids: List[int],
        boost_brand_id: Optional[int],
        blocked_ids: set,
        seen_show_ids: Set[str],
        skip: int,
        force_fresh: bool = False,
    ) -> dict:
        # How many slots of stage 1 are still unfilled for this client?
        stage1_needed = max(0, STAGE1_SIZE - skip)
        stage2_needed = STAGE2_SIZE if skip <= STAGE1_SIZE else max(0, STAGE2_END - skip)
        # Never exceed the caller's requested limit.
        total_cap = min(limit, stage1_needed + stage2_needed)
        if total_cap <= 0:
            return {"items": []}

        # ---- Stage 1: freshness -------------------------------------------------
        stage1_posts: List[dict] = []
        if stage1_needed > 0:
            stage1_posts = self._fetch_fresh_posts(
                needed=stage1_needed,
                exclude_ids=exclude_ids,
                blocked_ids=blocked_ids,
                force_fresh=force_fresh,
            )

        # Rule 1 extension: stage-2 must not repeat stage-1.
        exclude_for_stage2 = exclude_ids + [p["id"] for p in stage1_posts]

        # ---- Stage 2: scored (or curated for new users) ------------------------
        stage2_posts: List[dict] = []
        remaining = total_cap - len(stage1_posts)
        if remaining > 0 and stage2_needed > 0:
            stage2_limit = min(remaining, stage2_needed)
            if self._is_new_user(current_user_id):
                stage2_posts = self._get_curated_posts(
                    current_user_id=current_user_id,
                    blocked_ids=blocked_ids,
                    limit=stage2_limit,
                    exclude_ids=exclude_for_stage2,
                )
            if not stage2_posts:
                stage2_posts = self._fetch_scored_posts(
                    user_id=current_user_id,
                    limit=stage2_limit,
                    exclude_ids=exclude_for_stage2,
                    boost_brand_id=boost_brand_id,
                    blocked_ids=blocked_ids,
                )
            # If Stage 2 (and the curated fallback) came up empty — e.g. every
            # recent post is already in exclude_ids — fall through to the
            # long-tail RPC so the client keeps getting content instead of
            # terminating the feed prematurely.
            if not stage2_posts:
                stage3_rows = self._fetch_longtail_posts(
                    limit=stage2_limit,
                    exclude_ids=exclude_for_stage2,
                    blocked_ids=blocked_ids,
                )
                stage2_posts = stage3_rows

        # ---- Mix ----------------------------------------------------------------
        # Shows only interleave inside stage-2 (Rule 4 — stage-1 stays pristine).
        show_count = max(0, len(stage2_posts) // SHOW_INSERT_INTERVAL)
        shows = (
            self._fetch_show_cards(limit=show_count, exclude_show_ids=seen_show_ids)
            if show_count > 0
            else []
        )

        items: List[dict] = [{"type": "post", "data": p} for p in stage1_posts]
        items.extend(self._mix_posts_and_shows(stage2_posts, shows))
        return {"items": items}

    # ------------------------------------------------------------------
    # Stage 3: long-tail
    # ------------------------------------------------------------------

    def _serve_stage3(
        self,
        limit: int,
        exclude_ids: List[int],
        blocked_ids: set,
    ) -> dict:
        posts = self._fetch_longtail_posts(
            limit=limit, exclude_ids=exclude_ids, blocked_ids=blocked_ids
        )
        return {"items": [{"type": "post", "data": p} for p in posts]}

    def _fetch_longtail_posts(
        self,
        limit: int,
        exclude_ids: List[int],
        blocked_ids: set,
    ) -> List[dict]:
        """Raw long-tail RPC call — reused by Stage 3 and by the Stage-2 empty fallback."""
        params = {
            "p_exclude_ids": exclude_ids,
            "p_blocked_ids": list(blocked_ids),
            "p_limit": limit,
        }
        result = self.db.rpc("get_feed_longtail", params).execute()
        return result.data or []

    # ------------------------------------------------------------------
    # Data fetching
    # ------------------------------------------------------------------

    def _fetch_fresh_posts(
        self,
        needed: int,
        exclude_ids: List[int],
        blocked_ids: set,
        force_fresh: bool = False,
    ) -> List[dict]:
        """
        Stage 1: the N freshest posts. Lightly cached across users.
        The cache holds a pool of ~STAGE1_FETCH_MULTIPLIER × STAGE1_SIZE recent
        posts so per-user exclusion still leaves enough rows.

        When `force_fresh` is True (pull-to-refresh), the cache is bypassed and
        the pool is re-populated from the DB so users always see the absolute
        latest posts on refresh.
        """
        pool = self._load_fresh_pool(force_fresh=force_fresh)
        exclude_set = set(exclude_ids)
        blocked_set = set(blocked_ids) if blocked_ids else set()
        out: List[dict] = []
        for row in pool:
            if row["id"] in exclude_set:
                continue
            if blocked_set and row["user_id"] in blocked_set:
                continue
            out.append(row)
            if len(out) >= needed:
                break
        return out

    def _load_fresh_pool(self, force_fresh: bool = False) -> List[dict]:
        if not force_fresh:
            cached = cache_service.get(STAGE1_CACHE_KEY)
            if cached is not None:
                return cached

        fetch_limit = STAGE1_SIZE * STAGE1_FETCH_MULTIPLIER
        ungraded_cutoff = (
            datetime.now(timezone.utc) - STAGE1_UNGRADED_HORIZON
        ).isoformat()

        # Match get_feed_scored's grade filter: include graded posts OR
        # ungraded-but-recent posts awaiting async grading, so that brand-new
        # un-graded content still shows up in the freshness lane.
        result = (
            self.db.table("posts")
            .select("*")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .is_("community_id", "null")
            .or_(
                f"grade.in.(A,B,C),and(grade.is.null,created_at.gte.{ungraded_cutoff})"
            )
            .order("created_at", desc=True)
            .limit(fetch_limit)
            .execute()
        )
        pool = result.data or []
        # Always write back — this also refreshes TTL for subsequent concurrent
        # readers when we were invoked via force_fresh.
        cache_service.set(STAGE1_CACHE_KEY, pool, STAGE1_CACHE_TTL)
        return pool

    def _fetch_scored_posts(
        self,
        user_id: Optional[int],
        limit: int,
        exclude_ids: List[int],
        boost_brand_id: Optional[int],
        blocked_ids: set,
    ) -> List[dict]:
        """Stage 2: call get_feed_scored RPC (HN decay + 24h + brand boost)."""
        params = {
            "p_user_id": user_id,
            "p_exclude_ids": exclude_ids,
            "p_boost_brand_id": boost_brand_id,
            "p_blocked_ids": list(blocked_ids),
            "p_limit": limit,
        }
        result = self.db.rpc("get_feed_scored", params).execute()
        return result.data or []

    def _fetch_show_cards(
        self, limit: int = 5, exclude_show_ids: Optional[Set[str]] = None
    ) -> List[dict]:
        """Fetch recent approved shows, skipping already-seen ones."""
        if limit <= 0:
            return []
        fetch_limit = limit + len(exclude_show_ids or set())
        result = (
            self.db.table("shows")
            .select("id, brand_name, season, year, cover_image, category, title")
            .eq("status", "APPROVED")
            .order("created_at", desc=True)
            .limit(fetch_limit)
            .execute()
        )
        rows = result.data or []
        if exclude_show_ids:
            rows = [r for r in rows if str(r["id"]) not in exclude_show_ids]
        return rows[:limit]

    # ------------------------------------------------------------------
    # Mixer (Rule 4)
    # ------------------------------------------------------------------

    @staticmethod
    def _mix_posts_and_shows(
        posts: List[dict], shows: List[dict]
    ) -> List[dict]:
        """Insert 1 show card every SHOW_INSERT_INTERVAL posts."""
        mixed: List[dict] = []
        show_idx = 0
        for i, post in enumerate(posts, start=1):
            mixed.append({"type": "post", "data": post})
            if i % SHOW_INSERT_INTERVAL == 0 and show_idx < len(shows):
                mixed.append({"type": "show", "data": shows[show_idx]})
                show_idx += 1
        return mixed

    # ------------------------------------------------------------------
    # Rule 3: new-user curated feed
    # ------------------------------------------------------------------

    def _is_new_user(self, user_id: Optional[int]) -> bool:
        """
        Rule 3 gate. Anonymous users and accounts younger than
        NEW_USER_REGISTRATION_DAYS are considered new and receive the
        PM-curated feed in Stage 2.

        We deliberately do NOT look at `exclude_ids` length here: that array
        is session-local and cleared on every pull-to-refresh, so it would
        mis-flag long-time users as "new" on each refresh.
        """
        if not user_id:
            return True

        now = time.time()
        cached = self._new_user_cache.get(user_id)
        if cached and (now - cached[1]) < NEW_USER_CACHE_TTL_SEC:
            return cached[0]

        is_new = self._fetch_user_is_new(user_id)
        self._new_user_cache[user_id] = (is_new, now)
        return is_new

    def _fetch_user_is_new(self, user_id: int) -> bool:
        try:
            result = (
                self.db.table("users")
                .select("created_at")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            created_at_raw = (result.data or {}).get("created_at") if result else None
            if not created_at_raw:
                return False
            # Supabase returns ISO-8601 with either Z suffix or explicit offset.
            created_at = datetime.fromisoformat(
                str(created_at_raw).replace("Z", "+00:00")
            )
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            return (
                datetime.now(timezone.utc) - created_at
            ) < timedelta(days=NEW_USER_REGISTRATION_DAYS)
        except Exception as e:
            # Fail-closed: if we can't read the user, assume they're NOT new so
            # we don't override the scored feed with curated for every request.
            print(f"[FeedService] _fetch_user_is_new failed for {user_id}: {e}")
            return False

    def _get_curated_posts(
        self,
        current_user_id: Optional[int],
        blocked_ids: set,
        limit: int,
        exclude_ids: Optional[List[int]] = None,
    ) -> List[dict]:
        """
        Rule 3: PM-curated "入门必看" posts for new users.
        Falls back to top-engagement posts if the curated list is empty.
        Respects exclude_ids to avoid repeats on refresh.
        """
        curated_ids = self._load_curated_post_ids()
        exclude_set = set(exclude_ids) if exclude_ids else set()

        if curated_ids:
            filtered_ids = [pid for pid in curated_ids if pid not in exclude_set]
            if not filtered_ids:
                return []
            result = (
                self.db.table("posts")
                .select("*")
                .in_("id", filtered_ids)
                .eq("status", "PUBLISHED")
                .eq("audit_status", "APPROVED")
                .is_("community_id", "null")
                .execute()
            )
            rows = result.data or []
            id_order = {pid: i for i, pid in enumerate(filtered_ids)}
            rows.sort(key=lambda r: id_order.get(r["id"], 999))
        else:
            query = (
                self.db.table("posts")
                .select("*")
                .eq("status", "PUBLISHED")
                .eq("audit_status", "APPROVED")
                .is_("community_id", "null")
                .in_("grade", ["A", "B"])
                .order("like_count", desc=True)
                .limit(limit + len(exclude_set))
            )
            result = query.execute()
            rows = result.data or []
            if exclude_set:
                rows = [r for r in rows if r["id"] not in exclude_set]

        blocked_id_set = blocked_ids if isinstance(blocked_ids, set) else set(blocked_ids)
        if blocked_id_set:
            rows = [r for r in rows if r["user_id"] not in blocked_id_set]
        return rows[:limit]

    def _load_curated_post_ids(self) -> List[int]:
        try:
            result = (
                self.db.table("app_config")
                .select("value")
                .eq("key", "curated_feed_ids")
                .maybe_single()
                .execute()
            )
            if result.data and result.data.get("value"):
                val = result.data["value"]
                if isinstance(val, list):
                    return [int(x) for x in val]
                if isinstance(val, dict) and "ids" in val:
                    return [int(x) for x in val["ids"]]
        except Exception as e:
            print(f"[FeedService] Failed to load curated IDs: {e}")
        return []

    # ------------------------------------------------------------------
    # Batch user info + interaction state (avoids N+1)
    # ------------------------------------------------------------------

    def batch_enrich_posts(
        self, posts: List[dict], current_user_id: Optional[int]
    ) -> List[dict]:
        """
        Batch-fetch username, avatar, and interaction states for a list of posts.
        Single query per dimension instead of per-post N+1.
        """
        if not posts:
            return posts

        user_ids = list({p["user_id"] for p in posts})
        post_ids = [p["id"] for p in posts]

        username_map = self._batch_fetch_usernames(user_ids)
        avatar_map = self._batch_fetch_avatars(user_ids)

        liked_set: set = set()
        favorited_set: set = set()
        wanted_set: set = set()
        if current_user_id:
            liked_set = self._batch_check_liked(post_ids, current_user_id)
            favorited_set = self._batch_check_favorited(post_ids, current_user_id)
            wanted_set = self._batch_check_wanted(post_ids, current_user_id)

        for p in posts:
            uid = p["user_id"]
            pid = p["id"]
            p["_username"] = username_map.get(uid, "")
            p["_avatar_url"] = avatar_map.get(uid)
            p["_liked_by_me"] = pid in liked_set
            p["_favorited_by_me"] = pid in favorited_set
            p["_wanted_by_me"] = pid in wanted_set

        return posts

    def _batch_fetch_usernames(self, user_ids: List[int]) -> dict:
        if not user_ids:
            return {}
        result = (
            self.db.table("users")
            .select("id, username")
            .in_("id", user_ids)
            .execute()
        )
        return {r["id"]: r["username"] for r in (result.data or [])}

    def _batch_fetch_avatars(self, user_ids: List[int]) -> dict:
        if not user_ids:
            return {}
        result = (
            self.db.table("user_info")
            .select("user_id, avatar_url")
            .in_("user_id", user_ids)
            .execute()
        )
        return {r["user_id"]: r.get("avatar_url") for r in (result.data or [])}

    def _batch_check_liked(self, post_ids: List[int], user_id: int) -> set:
        result = (
            self.db.table("post_likes")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
            .execute()
        )
        return {r["post_id"] for r in (result.data or [])}

    def _batch_check_favorited(self, post_ids: List[int], user_id: int) -> set:
        result = (
            self.db.table("post_favorites")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
            .execute()
        )
        return {r["post_id"] for r in (result.data or [])}

    def _batch_check_wanted(self, post_ids: List[int], user_id: int) -> set:
        result = (
            self.db.table("post_wants")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
            .execute()
        )
        return {r["post_id"] for r in (result.data or [])}

    # ------------------------------------------------------------------
    # Formatting
    # ------------------------------------------------------------------

    def format_post(self, post_data: dict, current_user_id: Optional[int] = None) -> dict:
        """Format post with all fields the frontend PostCard expects."""
        grade_value = post_data.get("grade")
        grade_reward = None
        if grade_value:
            try:
                grade_reward = GRADE_REWARD_MAP.get(PostGrade(grade_value), 0)
            except (ValueError, KeyError):
                pass

        return {
            "id": post_data["id"],
            "userId": post_data["user_id"],
            "username": post_data.get("_username", ""),
            "avatarUrl": post_data.get("_avatar_url"),
            "postType": (post_data.get("post_type") or "ARTICLES").strip(),
            "status": post_data["status"],
            "auditStatus": post_data.get("audit_status"),
            "title": post_data.get("title", ""),
            "contentText": post_data.get("content_text", ""),
            "imageUrls": post_data.get("image_urls") or [],
            "coverWidth": post_data.get("cover_width"),
            "coverHeight": post_data.get("cover_height"),
            "likeCount": post_data.get("like_count", 0),
            "favoriteCount": post_data.get("favorite_count", 0),
            "commentCount": post_data.get("comment_count", 0),
            "wantCount": post_data.get("want_count", 0),
            "createdAt": post_data.get("created_at"),
            "updatedAt": post_data.get("updated_at"),
            "productName": post_data.get("product_name"),
            "brandName": post_data.get("brand_name"),
            "rating": post_data.get("rating"),
            "showIds": post_data.get("show_ids") or [],
            "brandIds": post_data.get("brand_ids") or [],
            "itemBrand": post_data.get("item_brand"),
            "itemBrandId": post_data.get("item_brand_id"),
            "itemCategory": post_data.get("item_category"),
            "itemSizes": post_data.get("item_sizes") or [],
            "itemColors": post_data.get("item_colors") or [],
            "communityId": post_data.get("community_id"),
            "grade": grade_value,
            "gradeReward": grade_reward,
            "feedScore": post_data.get("feed_score"),
            "likedByMe": post_data.get("_liked_by_me", False),
            "favoritedByMe": post_data.get("_favorited_by_me", False),
            "wantedByMe": post_data.get("_wanted_by_me", False),
        }

    def format_show_card(self, show_data: dict) -> dict:
        return {
            "id": show_data["id"],
            "brandName": show_data.get("brand_name", ""),
            "season": show_data.get("season", ""),
            "year": show_data.get("year"),
            "coverImage": show_data.get("cover_image"),
            "category": show_data.get("category"),
            "title": show_data.get("title"),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_blocked_user_ids(self, user_id: Optional[int]) -> set:
        if not user_id:
            return set()
        try:
            from app.services.moderation_service import moderation_service
            return set(moderation_service.get_blocked_user_ids(user_id))
        except Exception:
            return set()

    @staticmethod
    def _extract_seen_show_ids(exclude_ids: Optional[List[int]]) -> Set[str]:
        """
        Negative IDs in `exclude_ids` encode already-seen show card IDs
        (the client flips sign so we can carry both in a single array).
        """
        if not exclude_ids:
            return set()
        return {str(abs(eid)) for eid in exclude_ids if eid < 0}


feed_service = FeedService()
