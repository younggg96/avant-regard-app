"""
Feed 推荐服务 — Mixer 层

Responsibilities:
  1. Call get_feed_scored RPC (scoring + dedup + brand boost in SQL)
  2. Fetch show archive cards for interleaving
  3. Mix: insert 1 show card every 8 regular posts (Rule 4)
  4. Handle new-user curated feed (Rule 3)
  5. Batch-fetch user info + interaction states (avoid N+1)
"""

from typing import Optional, List, Set

from app.db.supabase import get_supabase
from app.schemas.post import PostGrade, GRADE_REWARD_MAP

SHOW_INSERT_INTERVAL = 8
NEW_USER_POST_THRESHOLD = 20


class FeedService:
    def __init__(self):
        self.db = get_supabase()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_feed(
        self,
        current_user_id: Optional[int],
        limit: int = 30,
        exclude_ids: Optional[List[int]] = None,
        boost_brand_id: Optional[int] = None,
    ) -> dict:
        """
        Returns mixed feed: { items: [...] }
        Each item is either { type: "post", data: dict }
                        or  { type: "show", data: dict }
        """
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        seen_show_ids = self._extract_seen_show_ids(exclude_ids)

        # Rule 3: new-user curated feed
        if self._is_new_user(current_user_id, exclude_ids):
            curated = self._get_curated_posts(
                current_user_id, blocked_ids, limit, exclude_ids
            )
            if curated:
                shows = self._fetch_show_cards(limit=3, exclude_show_ids=seen_show_ids)
                mixed = self._mix_posts_and_shows(curated, shows)
                return {"items": mixed}

        # Main path: call scored RPC (no OFFSET — dedup via exclude_ids only)
        posts = self._fetch_scored_posts(
            current_user_id, limit, exclude_ids, boost_brand_id, blocked_ids
        )

        show_count = max(1, len(posts) // SHOW_INSERT_INTERVAL)
        shows = self._fetch_show_cards(limit=show_count, exclude_show_ids=seen_show_ids)

        mixed = self._mix_posts_and_shows(posts, shows)
        return {"items": mixed}

    # ------------------------------------------------------------------
    # Data fetching
    # ------------------------------------------------------------------

    def _fetch_scored_posts(
        self,
        user_id: Optional[int],
        limit: int,
        exclude_ids: Optional[List[int]],
        boost_brand_id: Optional[int],
        blocked_ids: set,
    ) -> List[dict]:
        """Call the get_feed_scored RPC. Blocked filtering is now in SQL."""
        params = {
            "p_user_id": user_id,
            "p_exclude_ids": exclude_ids or [],
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
        post_count = 0

        for post in posts:
            mixed.append({"type": "post", "data": post})
            post_count += 1

            if (
                post_count % SHOW_INSERT_INTERVAL == 0
                and show_idx < len(shows)
            ):
                mixed.append({"type": "show", "data": shows[show_idx]})
                show_idx += 1

        return mixed

    # ------------------------------------------------------------------
    # Rule 3: new-user curated feed
    # ------------------------------------------------------------------

    def _is_new_user(
        self, user_id: Optional[int], exclude_ids: Optional[List[int]]
    ) -> bool:
        if not user_id:
            return True
        seen_count = len(exclude_ids) if exclude_ids else 0
        return seen_count < NEW_USER_POST_THRESHOLD

    def _get_curated_posts(
        self,
        current_user_id: Optional[int],
        blocked_ids: set,
        limit: int,
        exclude_ids: Optional[List[int]] = None,
    ) -> List[dict]:
        """
        Rule 3: PM-curated posts for new users.
        Falls back to top-engagement posts if curated list is empty.
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
        Derive a set of show IDs that were likely already shown.
        We encode show card IDs as negative numbers in exclude_ids
        so the client can signal "I already saw show card X".
        Negative IDs → show IDs (absolute value, as string).
        """
        if not exclude_ids:
            return set()
        return {str(abs(eid)) for eid in exclude_ids if eid < 0}


feed_service = FeedService()
