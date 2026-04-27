"""
用户等级 / 抽奖 / 权益 对外路由

Admin 侧的路由 (升级审批 / 人工赋等级 / 建期 / 开奖) 统一挂在本文件内的
`admin_level_router` 下,在 main.py 一并 include,保持 admin 路径前缀.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_admin_user, get_current_user_id
from app.core.response import success
from app.schemas.level import (
    AdminCreateRoundRequest,
    AdminDrawLotteryRequest,
    AdminGrantLevelRequest,
    AdminReviewUpgradeRequest,
    LevelSpec,
    RedeemTicketRequest,
    RedeemTicketResponse,
)
from app.services.level_service import LEVEL_RULES, level_service
from app.services.lottery_service import lottery_service


# ==================================================================
# 用户路由
# ==================================================================

router = APIRouter(prefix="/levels", tags=["用户等级"])


@router.get("/rules")
async def get_level_rules():
    """静态的等级规则表, 前端 `我的等级` 页面用于渲染全链路说明."""
    return success([s.model_dump() for s in LEVEL_RULES])


@router.get("/me")
async def get_my_level(current_user_id: int = Depends(get_current_user_id)):
    """当前用户等级 + 下一级任务进度 + 已解锁权益."""
    status = level_service.get_status(current_user_id)
    return success(status.model_dump())


@router.get("/users/{user_id}/summary")
async def get_user_level_summary(user_id: int):
    """公开接口: 仅暴露 current_level, 用于他人主页展示徽章."""
    return success({
        "userId": user_id,
        "currentLevel": level_service.get_user_level(user_id),
    })


# ==================================================================
# 抽奖 - 用户
# ==================================================================

lottery_router = APIRouter(prefix="/lottery", tags=["月度抽奖"])


@lottery_router.get("/current")
async def get_current_lottery(
    current_user_id: int = Depends(get_current_user_id),
):
    """当月抽奖概况 + 当前用户的参与/中奖状态. Lv3+ 才能看到 `entered=True`."""
    round_info = lottery_service.get_current_round()
    entry = lottery_service.get_user_entry(current_user_id)

    # Lv3+ 懒进池: 查询时顺便补录一条, 避免新升 Lv3 的人要等到下月
    if level_service.get_user_level(current_user_id) >= 3 and not entry.entered:
        lottery_service.ensure_user_entered_current_round(current_user_id)
        entry = lottery_service.get_user_entry(current_user_id)

    return success({
        "round": round_info.model_dump(),
        "entry": entry.model_dump(),
    })


@lottery_router.get("/history")
async def list_lottery_history(
    limit: int = Query(12, ge=1, le=24),
    _: int = Depends(get_current_user_id),
):
    """最近 N 期的公开信息 (仅用来展示抽奖历史)."""
    rounds = lottery_service.list_rounds(limit)
    return success([r.model_dump() for r in rounds])


# ==================================================================
# 权益 - 核销免费门票
# ==================================================================

benefit_router = APIRouter(prefix="/benefits", tags=["等级权益"])


@benefit_router.get("/me")
async def list_my_benefits(current_user_id: int = Depends(get_current_user_id)):
    """当前用户持有的全部权益 (配额 + 已用量)."""
    benefits = level_service.list_user_benefits(current_user_id)
    return success([b.model_dump() for b in benefits])


@benefit_router.post("/free-ticket/redeem")
async def redeem_free_ticket(
    request: RedeemTicketRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """Lv4 用户点击 `使用免费门票报名` 后调用. 一次调用扣 1 张."""
    try:
        redemption_id, remaining = level_service.redeem_free_ticket(
            user_id=current_user_id,
            object_type=request.objectType,
            object_id=request.objectId,
            meta=request.meta,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return success(RedeemTicketResponse(
        redemptionId=redemption_id,
        remaining=remaining,
    ).model_dump())


# ==================================================================
# Admin 路由
# ==================================================================

admin_level_router = APIRouter(prefix="/admin/levels", tags=["管理员-等级"])


@admin_level_router.get("/upgrade-requests")
async def list_upgrade_requests(_admin: int = Depends(get_current_admin_user)):
    """待审核的 Lv4 升级申请列表."""
    items = level_service.list_pending_requests()
    return success([i.model_dump() for i in items])


@admin_level_router.post("/upgrade-requests/{request_id}/review")
async def review_upgrade_request(
    request_id: int,
    request: AdminReviewUpgradeRequest,
    admin_id: int = Depends(get_current_admin_user),
):
    """Admin 审核 Lv4 升级 (approve=True/False)."""
    ok = level_service.review_upgrade_request(
        request_id=request_id,
        reviewer_id=admin_id,
        approve=request.approve,
        remark=request.remark,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="申请不存在或已处理")
    return success(message="已处理")


@admin_level_router.post("/users/{user_id}/grant")
async def admin_grant_level(
    user_id: int,
    request: AdminGrantLevelRequest,
    admin_id: int = Depends(get_current_admin_user),
):
    """Admin 直接赋等级 (Lv5 专用通道). 只升不降, 若已 >= 目标等级返回 400."""
    ok = level_service.admin_grant_level(
        user_id, request.level, admin_id, request.remark or ""
    )
    if not ok:
        raise HTTPException(status_code=400, detail="无法赋予该等级 (可能已持有或参数非法)")
    return success(message="等级已授予")


# ------ 抽奖管理 ------

admin_lottery_router = APIRouter(prefix="/admin/lottery", tags=["管理员-抽奖"])


@admin_lottery_router.get("/rounds")
async def list_rounds(
    limit: int = Query(24, ge=1, le=60),
    _admin: int = Depends(get_current_admin_user),
):
    rounds = lottery_service.list_rounds(limit)
    return success([r.model_dump() for r in rounds])


@admin_lottery_router.post("/rounds")
async def upsert_round(
    request: AdminCreateRoundRequest,
    _admin: int = Depends(get_current_admin_user),
):
    """建期 / 更新当月奖池. 已开奖的期数拒绝修改."""
    try:
        info = lottery_service.admin_upsert_round(
            month=request.month,
            prize_config=request.prizeConfig,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(info.model_dump())


@admin_lottery_router.post("/rounds/{round_id}/sync-entries")
async def sync_entries(
    round_id: int,
    _admin: int = Depends(get_current_admin_user),
):
    """把所有 Lv3+ 用户补齐进该期抽奖池 (对应 PRD '每月 1 号自动进池')."""
    added = lottery_service.sync_round_entries(round_id)
    return success({"added": added})


@admin_lottery_router.post("/rounds/{round_id}/draw")
async def draw_round(
    round_id: int,
    request: AdminDrawLotteryRequest,
    admin_id: int = Depends(get_current_admin_user),
):
    """开奖 - 严格手动触发. winners=null -> 按 prize_config 随机抽."""
    try:
        count = lottery_service.admin_draw_round(
            round_id=round_id,
            operator_id=admin_id,
            explicit_winners=request.winners,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"winners": count})
