"""
后台调度器 · 把订单 / 钱包 / 物流的"轮询型"业务任务统一挂在 AsyncIOScheduler 上。

替代之前需要管理员手动 POST /api/admin/orders/scheduler/run 才能跑的人肉 cron,
让生产环境真正按时跑起来。所有任务都满足以下约束:

1. **幂等**:重复执行不会重复入账(基于 DB 唯一索引 / 状态判断)。
2. **失败隔离**:单个任务 raise 不会拖死调度器线程(`coalesce + max_instances=1`)。
3. **可关闭**:`settings.ENABLE_BACKGROUND_SCHEDULER=False` 时整套不启动,
   保留管理员 `/api/admin/orders/scheduler/run` 作为人工兜底入口。
4. **多副本安全**:`max_instances=1` 防止单进程重复触发;跨进程靠 Supabase 端
   的乐观锁 / 唯一索引兜底(后续可按需上 Postgres advisory lock)。
"""
from __future__ import annotations

from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.executors.asyncio import AsyncIOExecutor

from app.core.config import settings


_scheduler: Optional[AsyncIOScheduler] = None


def _safe(label: str):
    """把一次任务执行的异常吃掉并打日志,避免拖死整个调度器。"""

    def decorator(fn):
        def wrapper():
            try:
                result = fn()
                if isinstance(result, int) and result > 0:
                    print(f"[scheduler] {label} done count={result}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[scheduler] {label} error: {e}", flush=True)

        wrapper.__name__ = f"safe_{label}"
        return wrapper

    return decorator


def _register_jobs(sched: AsyncIOScheduler) -> None:
    # 懒导入,避免循环依赖
    from app.services.order_service import order_service
    from app.services.offer_service import offer_service
    from app.services.wallet_service import wallet_service
    from app.services.logistics.service import tracking_service

    sched.add_job(
        _safe("holds_expired")(order_service.expire_holds_due),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_HOLDS_INTERVAL_SECONDS),
        id="holds_expired",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("offers_expired")(offer_service.expire_overdue),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_OFFERS_INTERVAL_SECONDS),
        id="offers_expired",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("orders_refunded_auto")(order_service.expire_overdue_shipments),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_SHIPMENTS_INTERVAL_SECONDS),
        id="orders_refunded_auto",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("orders_auto_confirmed")(order_service.auto_confirm_delivered),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_AUTO_CONFIRM_INTERVAL_SECONDS),
        id="orders_auto_confirmed",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("pending_payouts_released")(wallet_service.release_due_pending),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_WALLET_INTERVAL_SECONDS),
        id="pending_payouts_released",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("orders_settled")(order_service.settle_completed),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_SETTLE_INTERVAL_SECONDS),
        id="orders_settled",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("tracking_pulled")(tracking_service.pull_pending_shipments),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_TRACKING_INTERVAL_SECONDS),
        id="tracking_pulled",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )

    # Batch 5 提醒序列任务
    sched.add_job(
        _safe("confirm_receipt_reminders")(
            order_service.send_confirm_receipt_reminders
        ),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_REMINDERS_INTERVAL_SECONDS),
        id="confirm_receipt_reminders",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("shipping_reminders")(order_service.send_shipping_reminders),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_REMINDERS_INTERVAL_SECONDS),
        id="shipping_reminders",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        _safe("stuck_packages")(order_service.detect_stuck_packages),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_REMINDERS_INTERVAL_SECONDS),
        id="stuck_packages",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )

    from app.services.trade_review_service import trade_review_service

    sched.add_job(
        _safe("reviews_auto_close")(trade_review_service.run_auto_close),
        trigger=IntervalTrigger(seconds=settings.SCHEDULER_REVIEW_AUTO_INTERVAL_SECONDS),
        id="reviews_auto_close",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )


def start_scheduler() -> Optional[AsyncIOScheduler]:
    """lifespan 调用入口。返回 None 表示未启用,调用方无需特别处理。"""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    if not settings.ENABLE_BACKGROUND_SCHEDULER:
        print("[scheduler] disabled by settings.ENABLE_BACKGROUND_SCHEDULER", flush=True)
        return None

    sched = AsyncIOScheduler(
        executors={"default": AsyncIOExecutor()},
        timezone="UTC",
    )
    _register_jobs(sched)
    sched.start()
    _scheduler = sched
    job_ids = [job.id for job in sched.get_jobs()]
    print(f"[scheduler] started jobs={job_ids}", flush=True)
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
        print("[scheduler] stopped", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"[scheduler] stop error: {e}", flush=True)
    finally:
        _scheduler = None
