"use client";

/**
 * /me/level — 我的等级看板.
 *
 * 与移动端 `MyLevelScreen` 对齐:
 *   - 顶部: 当前等级徽章 + 下一级任务进度
 *   - 中部: 已解锁权益列表  (只读, Lv4 免费门票的核销需在事件报名页触发, 与 PRD 一致)
 *   - 下部: 月度抽奖状态  (Lv3+ 可见)
 *   - 最后: 全等级时间线  (静态 LEVEL_RULES)
 *
 * 数据全部从 `/api/levels/me` + `/api/lottery/current` + `/api/levels/rules` 拉取,
 * 单页无手动核销按钮, 严守 "高价值权益红线" 人工/事件页触发.
 */

import useSWR from "swr";
import { useAuthStore } from "@/lib/auth/store";
import {
  levelApi,
  type LevelSpec,
  type UserLevelStatus,
  type CurrentLotteryPayload,
} from "@/lib/services/level";
import { LevelBadge } from "@/components/user/LevelBadge";

export default function MyLevelPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId;

  const { data: status, isLoading: loadingStatus } = useSWR(
    userId ? ["level-me", userId] : null,
    () => levelApi.getMyLevel(),
    { refreshInterval: 60_000 },
  );

  const { data: rules } = useSWR(["level-rules"], () => levelApi.getRules());

  const currentLevel = status?.currentLevel ?? 0;
  const eligibleForLottery = currentLevel >= 3;

  const { data: lottery } = useSWR(
    eligibleForLottery ? ["lottery-current"] : null,
    () => levelApi.getCurrentLottery(),
  );

  if (!userId) return null;

  return (
    <section className="min-w-0">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-black dark:text-white md:text-3xl">
            我的等级
          </h1>
          <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            只升不降, 保护你的每一步付出
          </p>
        </div>
        <LevelBadge level={currentLevel} />
      </header>

      {loadingStatus || !status ? (
        <div className="rounded border border-[var(--border)] p-8 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
          正在载入…
        </div>
      ) : (
        <>
          <CurrentLevelCard status={status} />
          <NextLevelProgress status={status} />
          <BenefitsSection status={status} />
          {eligibleForLottery && <LotterySection data={lottery} />}
          {rules && <LevelTimeline rules={rules} current={currentLevel} />}
        </>
      )}
    </section>
  );
}

// ───────────────────────────── 子组件 ─────────────────────────────

function CurrentLevelCard({ status }: { status: UserLevelStatus }) {
  const pending = status.pendingLevel;
  return (
    <div className="mb-6 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          当前等级
        </span>
        <LevelBadge level={status.currentLevel || 0} />
        {status.currentLevel === 0 && (
          <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
            (尚未开始)
          </span>
        )}
      </div>
      {status.lastLevelUpAt && (
        <p className="mt-2 font-label text-[11px] text-[color:var(--ink-muted)]">
          上次升级于 {new Date(status.lastLevelUpAt).toLocaleString("zh-CN")}
        </p>
      )}
      {pending && pending === 4 && (
        <p className="mt-3 rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[12px] text-[color:var(--ink-muted)]">
          Lv4 档案已达标, 正在等待运营审核.
        </p>
      )}
    </div>
  );
}

function NextLevelProgress({ status }: { status: UserLevelStatus }) {
  if (!status.nextLevel || status.nextTasks.length === 0) {
    return (
      <div className="mb-6 rounded border border-[var(--border)] p-6 font-label text-[13px] text-[color:var(--ink-muted)]">
        已达到顶级 Lv5, 感谢你的持续参与.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded border border-[var(--border)] p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            下一级
          </div>
          <div className="mt-1 font-serif text-lg text-black dark:text-white">
            Lv{status.nextLevel} · {status.nextLevelTitle ?? ""}
          </div>
        </div>
        {status.nextLevelBenefit && (
          <div className="max-w-[60%] text-right font-label text-[12px] text-[color:var(--ink-muted)]">
            解锁: {status.nextLevelBenefit}
          </div>
        )}
      </div>
      <ul className="space-y-3">
        {status.nextTasks.map((t) => {
          const pct = Math.min(100, (t.progress / Math.max(1, t.target)) * 100);
          return (
            <li key={t.action}>
              <div className="mb-1 flex items-center justify-between font-label text-[12px]">
                <span className={t.completed ? "text-[var(--ink)]" : "text-[color:var(--ink-muted)]"}>
                  {t.label}
                </span>
                <span className="tabular-nums text-[color:var(--ink-muted)]">
                  {t.progress} / {t.target}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-[var(--canvas-raised)]">
                <div
                  className="h-full bg-[var(--ink)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BenefitsSection({ status }: { status: UserLevelStatus }) {
  if (status.benefits.length === 0) {
    return (
      <div className="mb-6 rounded border border-[var(--border)] p-6 font-label text-[13px] text-[color:var(--ink-muted)]">
        完成相应等级后, 权益会出现在这里.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded border border-[var(--border)] p-6">
      <div className="mb-3 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        我的权益
      </div>
      <ul className="space-y-3">
        {status.benefits.map((b) => {
          const exhausted = b.remaining <= 0;
          const isFreeTicket = b.benefitType === "FREE_TICKET_LV4";
          return (
            <li
              key={b.benefitId}
              className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-label text-[13px]">{b.name}</div>
                {b.description && (
                  <div className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
                    {b.description}
                  </div>
                )}
                {isFreeTicket && (
                  <div className="mt-2 font-label text-[11px] text-[color:var(--ink-muted)]">
                    {exhausted ? "已用完" : "在活动报名页点「使用免费门票」核销"}
                  </div>
                )}
              </div>
              <div className="shrink-0 font-label text-[12px] tabular-nums text-[color:var(--ink-muted)]">
                剩余 {b.remaining} / {b.quota}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LotterySection({
  data,
}: {
  data: CurrentLotteryPayload | undefined;
}) {
  if (!data) {
    return (
      <div className="mb-6 rounded border border-[var(--border)] p-6 font-label text-[13px] text-[color:var(--ink-muted)]">
        正在同步月度抽奖信息…
      </div>
    );
  }

  const { round, entry } = data;
  const drawn = round.status === "DRAWN";

  return (
    <div className="mb-6 rounded border border-[var(--border)] p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            月度抽奖
          </div>
          <div className="mt-1 font-serif text-lg text-black dark:text-white">
            {round.month}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-label text-[11px] ${
            drawn
              ? "bg-[var(--canvas-raised)] text-[color:var(--ink-muted)]"
              : "bg-[var(--ink)] text-[var(--canvas)]"
          }`}
        >
          {drawn ? "已开奖" : "进行中"}
        </span>
      </div>

      <div className="mb-4 font-label text-[12px] text-[color:var(--ink-muted)]">
        {entry.entered
          ? `你已在本期抽奖池中 (参与人数 ${round.totalEntries})`
          : "你目前尚未进入本期抽奖池 (下次访问将自动加入)"}
      </div>

      {entry.isWinner ? (
        <div className="rounded border border-[var(--ink)] p-4">
          <div className="font-label text-[11px] uppercase tracking-widest text-[var(--ink)]">
            中奖
          </div>
          <div className="mt-1 font-serif text-[16px] text-black dark:text-white">
            {entry.prizeName ?? "请联系运营领取"}
          </div>
        </div>
      ) : drawn ? (
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          本期开奖于 {round.drawnAt ? new Date(round.drawnAt).toLocaleString("zh-CN") : "--"},
          未中奖. 下月继续.
        </div>
      ) : (
        <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
          本月 25 日由运营手动开奖, 中奖者会收到站内通知.
        </div>
      )}
    </div>
  );
}

function LevelTimeline({
  rules,
  current,
}: {
  rules: LevelSpec[];
  current: number;
}) {
  return (
    <div className="rounded border border-[var(--border)] p-6">
      <div className="mb-4 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        等级路线
      </div>
      <ol className="space-y-4">
        {rules.map((r) => {
          const reached = current >= r.level;
          return (
            <li
              key={r.level}
              className={`rounded border p-4 ${
                reached
                  ? "border-[var(--ink)] bg-[var(--canvas-soft)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                    Lv{r.level}
                  </span>
                  <span className="font-serif text-[15px] text-black dark:text-white">
                    {r.title}
                  </span>
                </div>
                <span className="font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                  {r.mode === "AUTO"
                    ? "自动升级"
                    : r.mode === "AUDIT"
                    ? "运营审核"
                    : "人工授予"}
                </span>
              </div>
              <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
                {r.subtitle}
              </div>
              {r.tasks.length > 0 && (
                <ul className="mt-2 list-disc pl-5 font-label text-[12px] text-[color:var(--ink-muted)]">
                  {r.tasks.map((t) => (
                    <li key={t.action}>
                      {t.label} · 达标 {t.target}
                    </li>
                  ))}
                </ul>
              )}
              {r.benefit && (
                <div className="mt-2 font-label text-[12px] text-[var(--ink)]">
                  权益: {r.benefit}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
