"""
ai_post_service_logs 数据访问层。

抽出来主要是为了:
  - 单元测试可以 mock 这一层而不动 supabase client。
  - generate / regenerate 都要写日志 + 后续回填 post_id,统一在这里做。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.db.supabase import get_supabase


class AIPostLogRepo:
    def __init__(self):
        self.db = get_supabase()

    def insert(
        self,
        *,
        user_id: int,
        mode: str,
        prompt_snapshot: Dict[str, Any],
        prompt_version: str,
        model_provider: str,
        model_name: str,
        model_response: Optional[Dict[str, Any]] = None,
        tokens_used: Optional[int] = None,
        cost_cents: Optional[int] = None,
        status: str = "success",
        error_message: Optional[str] = None,
        regenerated_from_log_id: Optional[int] = None,
    ) -> int:
        """写一条日志,返回 log_id。"""
        result = (
            self.db.table("ai_post_service_logs")
            .insert(
                {
                    "user_id": user_id,
                    "mode": mode,
                    "prompt_snapshot": prompt_snapshot,
                    "prompt_version": prompt_version,
                    "model_provider": model_provider,
                    "model_name": model_name,
                    "model_response": model_response,
                    "tokens_used": tokens_used,
                    "cost_cents": cost_cents,
                    "status": status,
                    "error_message": error_message,
                    "regenerated_from_log_id": regenerated_from_log_id,
                }
            )
            .execute()
        )
        if not result.data:
            raise RuntimeError("写入 ai_post_service_logs 失败")
        return result.data[0]["log_id"]

    def get(self, log_id: int) -> Optional[Dict[str, Any]]:
        result = (
            self.db.table("ai_post_service_logs")
            .select("*")
            .eq("log_id", log_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def attach_post(self, log_id: int, post_id: int) -> None:
        self.db.table("ai_post_service_logs").update({"post_id": post_id}).eq(
            "log_id", log_id
        ).execute()


ai_post_log_repo = AIPostLogRepo()
