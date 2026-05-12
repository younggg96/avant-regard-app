/**
 * Web 端用户等级 / 月度抽奖 / 权益 API 客户端.
 *
 * 对齐 frontend/src/services/levelService.ts 的类型与方法语义,
 * 确保 iOS / Android / Web 走同一套后端契约.
 *
 * 使用场景:
 *   - `levelApi.*`         → 用户侧 (我的等级页, 主页徽章, 月度抽奖入口)
 *   - `adminLevelApi.*`    → 运营侧 (Lv4 审批, Lv5 授予, 月度开奖)
 */

import { apiClient } from "../api-client";

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
   * Admin 全站开关. true = 抽奖功能开启;
   * false / 缺省 = 已被关闭 (后端默认), `round` / `entry` 为 null,
   * 客户端必须隐藏所有抽奖入口与卡片.
   */
  enabled?: boolean;
  round: LotteryRoundInfo | null;
  entry: LotteryEntryInfo | null;
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

export interface RedeemTicketResponse {
  redemptionId: number;
  remaining: number;
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

export interface LevelUserRow {
  userId: number;
  username: string;
  avatarUrl: string;
  currentLevel: number;
  pendingLevel: number | null;
  lastLevelUpAt: string | null;
  merchant?: { storeId: number; status: string } | null;
}

export interface ListLevelUsersResponse {
  users: LevelUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== 用户侧 ====================

export const levelApi = {
  getRules: () => apiClient.get<LevelSpec[]>("/api/levels/rules"),

  getMyLevel: () => apiClient.get<UserLevelStatus>("/api/levels/me"),

  getUserLevel: (userId: number | string) =>
    apiClient.get<{ userId: number; currentLevel: number }>(
      `/api/levels/users/${userId}/summary`,
    ),

  getCurrentLottery: () =>
    apiClient.get<CurrentLotteryPayload>("/api/lottery/current"),

  getLotteryHistory: (limit = 12) =>
    apiClient.get<LotteryRoundInfo[]>(`/api/lottery/history`, { limit }),

  getMyBenefits: () => apiClient.get<UserBenefitInfo[]>("/api/benefits/me"),

  /**
   * Lv4 免费门票核销.
   *
   * **红线提醒**: 本方法**只能在事件报名页**(未来实装)被调用,
   * "我的等级"页严禁暴露核销按钮. 这一约束在 iOS 端同样生效,
   * 这里留此方法是为了未来 Web 事件页接入时走同一契约.
   */
  redeemFreeTicket: (payload: {
    objectType?: string;
    objectId?: string;
    meta?: Record<string, unknown>;
  }) =>
    apiClient.post<RedeemTicketResponse>(
      "/api/benefits/free-ticket/redeem",
      {
        objectType: payload.objectType ?? "EVENT",
        objectId: payload.objectId,
        meta: payload.meta,
      },
    ),
};

// ==================== Admin 侧 ====================

export const adminLevelApi = {
  listUpgradeRequests: () =>
    apiClient.get<UpgradeRequestInfo[]>("/api/admin/levels/upgrade-requests"),

  reviewUpgradeRequest: (
    requestId: number,
    approve: boolean,
    remark = "",
  ) =>
    apiClient.post<null>(
      `/api/admin/levels/upgrade-requests/${requestId}/review`,
      { approve, remark },
    ),

  grantLevel: (userId: number, level: number, remark = "") =>
    apiClient.post<null>(`/api/admin/levels/users/${userId}/grant`, {
      level,
      remark,
    }),

  listRounds: (limit = 24) =>
    apiClient.get<LotteryRoundInfo[]>("/api/admin/lottery/rounds", { limit }),

  upsertRound: (month: string | null, prizeConfig: LotteryPrize[]) =>
    apiClient.post<LotteryRoundInfo>("/api/admin/lottery/rounds", {
      month,
      prizeConfig,
    }),

  syncEntries: (roundId: number) =>
    apiClient.post<{ added: number }>(
      `/api/admin/lottery/rounds/${roundId}/sync-entries`,
    ),

  drawRound: (
    roundId: number,
    winners: Array<{ userId: number; prizeId: string }> | null = null,
  ) =>
    apiClient.post<{ winners: number }>(
      `/api/admin/lottery/rounds/${roundId}/draw`,
      { winners },
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
    apiClient.post<BackfillResponse>("/api/admin/levels/backfill", {
      userId: payload.userId ?? null,
      dryRun: payload.dryRun ?? false,
      limit: payload.limit ?? null,
      offset: payload.offset ?? 0,
    }),

  /**
   * 分页拉所有用户等级 (current_level 降序).
   *
   * @param level  `null` = 全部, `0` = 仅 Lv0 (未达 Lv1), `1..5` = 精确等级
   */
  listUsersByLevel: (payload: {
    page?: number;
    pageSize?: number;
    level?: number | null;
  } = {}) => {
    const query: Record<string, string | number> = {
      page: payload.page ?? 1,
      pageSize: payload.pageSize ?? 20,
    };
    if (payload.level !== undefined && payload.level !== null) {
      query.level = payload.level;
    }
    return apiClient.get<ListLevelUsersResponse>(
      "/api/admin/levels/users",
      query,
    );
  },
};
