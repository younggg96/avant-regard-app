"""
用户等级系统 Schema
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


# ==================== 行为枚举 ====================

class LevelAction(str, Enum):
    """规则引擎支持的用户行为类型. 新增行为必须同步更新 LEVEL_RULES."""
    POST_CREATED       = "post_created"
    COMMUNITY_FOLLOWED = "community_followed"
    POST_LIKED         = "post_liked"
    USER_FOLLOWED      = "user_followed"
    WANT_CLICKED       = "want_clicked"
    STORE_COMMENTED    = "store_commented"
    ARCHIVE_UPLOADED   = "archive_uploaded"


# ==================== 任务描述 (前端展示用) ====================

class LevelTaskSpec(BaseModel):
    """单个升级任务的目标描述"""
    action: str = Field(..., description="行为 key (对应 counters 里的字段)")
    target: int = Field(..., description="达标需要的累计次数")
    label:  str = Field(..., description="给用户看的任务文案")


class LevelSpec(BaseModel):
    """某个等级的完整定义"""
    level:     int
    title:     str
    subtitle:  str                = ""
    tasks:     List[LevelTaskSpec] = []
    benefit:   Optional[str]      = None
    # 'AUTO'   - 系统自动升级 (Lv1/2/3)
    # 'AUDIT'  - 达标后进入审核队列 (Lv4)
    # 'MANUAL' - 仅 admin 人工赋予 (Lv5)
    mode:      str                = "AUTO"


# ==================== 状态响应 ====================

class LevelTaskProgress(BaseModel):
    """单个任务的当前进度"""
    action:    str
    label:     str
    target:    int
    progress:  int
    completed: bool


class UserLevelStatus(BaseModel):
    """当前用户等级总览 (我的等级页面用)"""
    userId:           int
    currentLevel:     int
    pendingLevel:     Optional[int] = None
    lastLevelUpAt:    Optional[str] = None
    nextLevel:        Optional[int] = None
    nextLevelTitle:   Optional[str] = None
    nextLevelBenefit: Optional[str] = None
    # 距离 nextLevel 的任务进度;已完成或已到顶时为空数组
    nextTasks:        List[LevelTaskProgress] = []
    # 已解锁的权益列表
    benefits:         List["UserBenefitInfo"] = []


# ==================== 抽奖 ====================

class LotteryPrize(BaseModel):
    """奖品配置项 (lottery_rounds.prize_config 中的一项)"""
    prizeId: str
    name:    str
    quota:   int = Field(..., ge=0, description="总名额")
    meta:    Optional[Dict[str, Any]] = None


class LotteryRoundInfo(BaseModel):
    """抽奖期数信息"""
    id:            int
    month:         str     # 'YYYY-MM'
    status:        str     # OPEN / DRAWN / CLOSED
    prizeConfig:   List[LotteryPrize] = []
    drawnAt:       Optional[str]      = None
    totalEntries:  int                = 0
    totalWinners:  int                = 0


class LotteryEntryInfo(BaseModel):
    """用户在某一期的参与/中奖状态"""
    roundId:    int
    month:      str
    entered:    bool
    isWinner:   bool
    prizeId:    Optional[str]          = None
    prizeName:  Optional[str]          = None
    prizeMeta:  Optional[Dict[str, Any]] = None
    roundStatus: str                    = "OPEN"


class AdminDrawWinnerRequest(BaseModel):
    """Admin 开奖时手动指派的单条中奖信息"""
    userId:   int
    prizeId:  str


class AdminDrawLotteryRequest(BaseModel):
    """Admin 开奖请求:  winners 为 null 表示按 prize_config 随机抽"""
    winners: Optional[List[AdminDrawWinnerRequest]] = None


class AdminCreateRoundRequest(BaseModel):
    """Admin 建期 / 更新奖池请求"""
    month:       Optional[str] = Field(None, description="'YYYY-MM',不传则取当月")
    prizeConfig: List[LotteryPrize] = []


# ==================== 权益 ====================

class UserBenefitInfo(BaseModel):
    """用户持有的权益"""
    benefitId:    int
    benefitType:  str
    name:         str
    description:  str = ""
    quota:        int
    used:         int
    remaining:    int


class RedeemTicketRequest(BaseModel):
    """核销免费门票"""
    objectType: str              = "EVENT"
    objectId:   Optional[str]    = None
    meta:       Optional[Dict[str, Any]] = None


class RedeemTicketResponse(BaseModel):
    redemptionId: int
    remaining:    int


# ==================== 升级审批 ====================

class UpgradeRequestInfo(BaseModel):
    id:          int
    userId:      int
    username:    Optional[str] = None
    targetLevel: int
    status:      str
    remark:      str = ""
    createdAt:   str
    reviewedAt:  Optional[str] = None


class AdminReviewUpgradeRequest(BaseModel):
    approve: bool
    remark:  str = ""


class AdminGrantLevelRequest(BaseModel):
    """Admin 直接赋予等级 (用于 Lv5)"""
    level:  int = Field(..., ge=1, le=5)
    remark: str = ""


class AdminBackfillRequest(BaseModel):
    """存量用户等级回填请求.

    - user_id=None + limit=None  -> 全量扫描
    - user_id=X                  -> 单用户回填
    - limit=N                    -> 最多处理 N 人 (用于分批压测)
    """
    userId: Optional[int] = None
    dryRun: bool          = False
    limit:  Optional[int] = None
    offset: int           = 0


# 允许 forward reference
UserLevelStatus.model_rebuild()
