/**
 * 用户等级 / 抽奖 / 权益 API 客户端
 *
 * 对应后端 backend/app/api/routes/level.py 的 router + lottery_router + benefit_router.
 * 统一走 http.ts 的 `request(...)` 封装:
 *   - 自动解包 {code, message, data} 信封
 *   - 自动在 401 时刷新 token
 *   - 瞬时 5xx 自动重试
 */

import { request } from "./http";

// ==================== 类型 ====================

export interface LevelTaskSpec {
  action: string;
  target: number;
  label: string;
}

export interface LevelSpec {
  level: number;
  title: string;
  subtitle: string;
  tasks: LevelTaskSpec[];
  benefit: string | null;
  mode: "AUTO" | "AUDIT" | "MANUAL";
}

export interface LevelTaskProgress {
  action: string;
  label: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface UserBenefitInfo {
  benefitId: number;
  benefitType: string;
  name: string;
  description: string;
  quota: number;
  used: number;
  remaining: number;
}

export interface UserLevelStatus {
  userId: number;
  currentLevel: number;
  pendingLevel: number | null;
  lastLevelUpAt: string | null;
  nextLevel: number | null;
  nextLevelTitle: string | null;
  nextLevelBenefit: string | null;
  nextTasks: LevelTaskProgress[];
  benefits: UserBenefitInfo[];
}

export interface LotteryPrize {
  prizeId: string;
  name: string;
  quota: number;
  meta?: Record<string, unknown> | null;
}

export interface LotteryRoundInfo {
  id: number;
  month: string;
  status: "OPEN" | "DRAWN" | "CLOSED";
  prizeConfig: LotteryPrize[];
  drawnAt: string | null;
  totalEntries: number;
  totalWinners: number;
}

export interface LotteryEntryInfo {
  roundId: number;
  month: string;
  entered: boolean;
  isWinner: boolean;
  prizeId: string | null;
  prizeName: string | null;
  prizeMeta: Record<string, unknown> | null;
  roundStatus: "OPEN" | "DRAWN" | "CLOSED";
}

export interface CurrentLotteryPayload {
  /**
   * Admin 全站开关. true = 抽奖功能已开启;
   * false / 缺省 = 已被关闭 (后端默认), `round` / `entry` 为 null,
   * 客户端必须隐藏所有抽奖入口与卡片.
   */
  enabled?: boolean;
  round: LotteryRoundInfo | null;
  entry: LotteryEntryInfo | null;
}

export interface RedeemTicketResponse {
  redemptionId: number;
  remaining: number;
}

export interface UpgradeRequestInfo {
  id: number;
  userId: number;
  username: string | null;
  targetLevel: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remark: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface BackfillUserResult {
  userId: number;
  beforeLevel: number;
  afterLevel: number;
  pendingLevel: number | null;
  counters: Record<string, number>;
  dryRun: boolean;
}

export interface BackfillSummary {
  scanned: number;
  upgraded: number;
  pendingCreated: number;
  errors: number;
  levelDistribution: Record<string, number>;
  dryRun: boolean;
}

export type BackfillResponse =
  | { scope: "single"; user: BackfillUserResult }
  | { scope: "all"; summary: BackfillSummary };

// ==================== 用户侧 ====================

export const levelService = {
  /** 获取静态规则表, 渲染「我的等级」页面的总览 */
  getRules: () => request<LevelSpec[]>("/api/levels/rules"),

  /** 获取当前登录用户的完整等级状态 (含任务进度 & 权益) */
  getMyLevel: () => request<UserLevelStatus>("/api/levels/me"),

  /** 公开接口: 他人主页徽章用 */
  getUserLevel: (userId: number) =>
    request<{ userId: number; currentLevel: number }>(
      `/api/levels/users/${userId}/summary`
    ),

  /** 当月抽奖概况 + 自己的参与/中奖状态 */
  getCurrentLottery: () =>
    request<CurrentLotteryPayload>("/api/lottery/current"),

  /** 最近 N 期的历史 */
  getLotteryHistory: (limit = 12) =>
    request<LotteryRoundInfo[]>(`/api/lottery/history?limit=${limit}`),

  /** 权益列表 (与 /levels/me 里的 benefits 一致, 单独拉用于核销页) */
  getMyBenefits: () => request<UserBenefitInfo[]>("/api/benefits/me"),

  /** Lv4 免费门票核销 */
  redeemFreeTicket: (payload: {
    objectType?: string;
    objectId?: string;
    meta?: Record<string, unknown>;
  }) =>
    request<RedeemTicketResponse>("/api/benefits/free-ticket/redeem", {
      method: "POST",
      body: JSON.stringify({
        objectType: payload.objectType ?? "EVENT",
        objectId: payload.objectId,
        meta: payload.meta,
      }),
    }),
};

// ==================== Admin 侧 ====================

export const adminLevelService = {
  listUpgradeRequests: () =>
    request<UpgradeRequestInfo[]>("/api/admin/levels/upgrade-requests"),

  reviewUpgradeRequest: (
    requestId: number,
    approve: boolean,
    remark = ""
  ) =>
    request<null>(
      `/api/admin/levels/upgrade-requests/${requestId}/review`,
      {
        method: "POST",
        body: JSON.stringify({ approve, remark }),
      }
    ),

  grantLevel: (userId: number, level: number, remark = "") =>
    request<null>(`/api/admin/levels/users/${userId}/grant`, {
      method: "POST",
      body: JSON.stringify({ level, remark }),
    }),

  listRounds: (limit = 24) =>
    request<LotteryRoundInfo[]>(
      `/api/admin/lottery/rounds?limit=${limit}`
    ),

  upsertRound: (month: string | null, prizeConfig: LotteryPrize[]) =>
    request<LotteryRoundInfo>("/api/admin/lottery/rounds", {
      method: "POST",
      body: JSON.stringify({ month, prizeConfig }),
    }),

  syncEntries: (roundId: number) =>
    request<{ added: number }>(
      `/api/admin/lottery/rounds/${roundId}/sync-entries`,
      { method: "POST" }
    ),

  drawRound: (
    roundId: number,
    winners: Array<{ userId: number; prizeId: string }> | null = null
  ) =>
    request<{ winners: number }>(
      `/api/admin/lottery/rounds/${roundId}/draw`,
      { method: "POST", body: JSON.stringify({ winners }) }
    ),

  /**
   * 存量用户等级回填 (幂等).
   *
   * - 不传 userId / limit -> 全量扫描
   * - 传 userId           -> 仅该用户
   * - dryRun=true         -> 只计算不写库
   */
  backfillLevels: (payload: {
    userId?: number;
    dryRun?: boolean;
    limit?: number;
    offset?: number;
  } = {}) =>
    request<BackfillResponse>("/api/admin/levels/backfill", {
      method: "POST",
      body: JSON.stringify({
        userId: payload.userId ?? null,
        dryRun: payload.dryRun ?? false,
        limit: payload.limit ?? null,
        offset: payload.offset ?? 0,
      }),
    }),
};
