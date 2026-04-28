"use client";

/**
 * /admin/lottery — 月度抽奖管理
 *
 * 落实 PRD 红线:
 *   - 严禁系统自动开奖, 本页是唯一开奖入口
 *   - prize_config 完全 JSONB 驱动, 不写死任何奖品
 *   - OPEN 期数可改奖池 / 同步进池 / 开奖;  DRAWN 锁定
 *
 * UI 流:
 *   1) 卡片列表, 显示期号 / 状态 / 参与数 / 中奖数 / 奖池概览
 *   2) "建期"  -> 输入月份 + 配奖品
 *   3) "改奖池" -> 月份锁死 (避免按 month 查找时误写别期), 只改 prizeConfig
 *   4) "同步进池" -> 批量把所有 Lv3+ 用户拉入当期
 *   5) "开奖" -> 按 prize_config quota 随机抽 (二次确认, 展示每个奖品的 quota)
 */

import { useCallback, useEffect, useState } from "react";
import {
  adminLevelApi,
  type LotteryPrize,
  type LotteryRoundInfo,
} from "@/lib/services/level";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminLotteryPage() {
  const [rounds, setRounds] = useState<LotteryRoundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 编辑器
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorMonth, setEditorMonth] = useState(() => currentMonth());
  // `quota` 允许暂存为 string, 便于 admin 清空后重新输入 (避免 "0" 卡字).
  // 保存前再统一解析为 number.
  type PrizeDraft = Omit<LotteryPrize, "quota"> & { quota: string };
  const [editorPrizes, setEditorPrizes] = useState<PrizeDraft[]>([
    { prizeId: "p1", name: "", quota: "1" },
  ]);

  // 二次确认
  const [drawTarget, setDrawTarget] = useState<LotteryRoundInfo | null>(null);
  const [syncTarget, setSyncTarget] = useState<LotteryRoundInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminLevelApi.listRounds(24);
      setRounds(data);
    } catch (e) {
      console.warn("listRounds failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── editor ──
  const openEditor = (round?: LotteryRoundInfo) => {
    if (round) {
      setEditorMode("edit");
      setEditorMonth(round.month);
      setEditorPrizes(
        round.prizeConfig.length > 0
          ? round.prizeConfig.map((p) => ({
              ...p,
              quota: String(p.quota ?? ""),
            }))
          : [{ prizeId: "p1", name: "", quota: "1" }],
      );
    } else {
      setEditorMode("create");
      setEditorMonth(currentMonth());
      setEditorPrizes([{ prizeId: "p1", name: "", quota: "1" }]);
    }
    setEditorOpen(true);
  };

  const updatePrize = (
    idx: number,
    field: "prizeId" | "name" | "quota",
    value: string,
  ) => {
    setEditorPrizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addPrizeRow = () =>
    setEditorPrizes((prev) => [
      ...prev,
      { prizeId: `p${prev.length + 1}`, name: "", quota: "1" },
    ]);

  const removePrizeRow = (idx: number) =>
    setEditorPrizes((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );

  const saveEditor = async () => {
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(editorMonth.trim())) {
      alert("月份格式必须为 YYYY-MM");
      return;
    }
    const cleaned: LotteryPrize[] = editorPrizes
      .map((p) => {
        const q = parseInt(String(p.quota).trim(), 10);
        return {
          prizeId: p.prizeId.trim(),
          name: p.name.trim(),
          quota: Number.isNaN(q) || q < 0 ? 0 : q,
          meta: p.meta,
        };
      })
      .filter((p) => p.prizeId && p.name && p.quota > 0);
    if (cleaned.length === 0) {
      alert("至少需要一条有效奖品 (prizeId / name / quota > 0)");
      return;
    }
    const ids = new Set<string>();
    for (const p of cleaned) {
      if (ids.has(p.prizeId)) {
        alert(`奖品 ID 重复: ${p.prizeId}`);
        return;
      }
      ids.add(p.prizeId);
    }

    setActionLoading(true);
    try {
      await adminLevelApi.upsertRound(editorMonth.trim(), cleaned);
      setEditorOpen(false);
      load();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存失败 (可能该期已开奖)",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── sync ──
  const doSync = async () => {
    if (!syncTarget) return;
    setActionLoading(true);
    try {
      const res = await adminLevelApi.syncEntries(syncTarget.id);
      alert(`同步完成, 新增 ${res.added} 位参与者`);
      setSyncTarget(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "同步失败");
    } finally {
      setActionLoading(false);
    }
  };

  // ── draw ──
  const doDraw = async () => {
    if (!drawTarget) return;
    setActionLoading(true);
    try {
      const res = await adminLevelApi.drawRound(drawTarget.id, null);
      alert(`已开奖, 共产生 ${res.winners} 位中奖者`);
      setDrawTarget(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "开奖失败");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="月度抽奖"
        description="1 号建期 · 25 号开奖 · 奖池 JSONB 灵活配置"
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openEditor()}>
              建期
            </Button>
            <Button variant="ghost" size="sm" onClick={load}>
              刷新
            </Button>
          </div>
        }
      />

      {rounds.length === 0 ? (
        <EmptyState message="暂无期数" />
      ) : (
        <div className="space-y-3">
          {rounds.map((r) => {
            const isOpen = r.status === "OPEN";
            return (
              <div
                key={r.id}
                className="rounded-lg border border-[var(--border)] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="font-serif text-2xl text-black dark:text-white">
                      {r.month}
                    </div>
                    <StatusBadge active={isOpen}>
                      {r.status === "OPEN"
                        ? "进行中"
                        : r.status === "DRAWN"
                        ? "已开奖"
                        : "已关闭"}
                    </StatusBadge>
                  </div>
                  {isOpen && (
                    <div className="flex gap-1 font-label text-[12px]">
                      <button
                        onClick={() => openEditor(r)}
                        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        改奖池
                      </button>
                      <button
                        onClick={() => setSyncTarget(r)}
                        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        同步进池
                      </button>
                      <button
                        onClick={() => setDrawTarget(r)}
                        className="rounded bg-[var(--ink)] px-2 py-1 text-[var(--canvas)] transition-opacity hover:opacity-80"
                      >
                        开奖
                      </button>
                    </div>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-4 border-y border-[var(--border)] py-3 font-label text-[12px]">
                  <Cell label="参与" value={r.totalEntries} />
                  <Cell label="中奖" value={r.totalWinners} />
                  <Cell label="奖品" value={r.prizeConfig.length} />
                  <Cell
                    label="开奖于"
                    value={
                      r.drawnAt
                        ? new Date(r.drawnAt).toLocaleDateString("zh-CN")
                        : "—"
                    }
                  />
                </dl>

                {r.prizeConfig.length > 0 ? (
                  <ul className="mt-3 space-y-1 font-label text-[12px]">
                    {r.prizeConfig.map((p) => (
                      <li
                        key={p.prizeId}
                        className="flex items-center gap-2 text-[color:var(--ink-muted)]"
                      >
                        <span className="w-10 shrink-0 text-[11px] uppercase tracking-widest">
                          {p.prizeId}
                        </span>
                        <span className="flex-1 truncate text-[var(--ink)]">
                          {p.name}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          × {p.quota}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 font-label text-[12px] italic text-[color:var(--ink-muted)]">
                    奖池尚未配置
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 编辑器 */}
      <FormDialog
        open={editorOpen}
        title={editorMode === "edit" ? "改奖池" : "建期"}
        onClose={() => setEditorOpen(false)}
        wide
      >
        <div className="space-y-4">
          <FormField label="期号 (YYYY-MM)" required>
            <TextInput
              value={editorMonth}
              onChange={setEditorMonth}
              placeholder="例如 2026-04"
              disabled={editorMode === "edit"}
            />
            <p className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
              {editorMode === "edit"
                ? "改奖池时期号锁定, 如需换期请回到列表选择对应期数."
                : "已 DRAWN 的期数不能再改奖池."}
            </p>
          </FormField>

          <FormField label="奖品列表">
            <div className="space-y-2">
              {editorPrizes.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={p.prizeId}
                    onChange={(e) => updatePrize(idx, "prizeId", e.target.value)}
                    placeholder="prizeId"
                    className="h-9 w-24 rounded border border-[var(--border)] bg-[var(--canvas)] px-2 font-label text-[12px] outline-none focus:border-[var(--ink-muted)]"
                  />
                  <input
                    value={p.name}
                    onChange={(e) => updatePrize(idx, "name", e.target.value)}
                    placeholder="奖品名称"
                    className="h-9 flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-2 font-label text-[12px] outline-none focus:border-[var(--ink-muted)]"
                  />
                  <input
                    value={p.quota}
                    onChange={(e) => updatePrize(idx, "quota", e.target.value)}
                    placeholder="名额"
                    inputMode="numeric"
                    className="h-9 w-20 rounded border border-[var(--border)] bg-[var(--canvas)] px-2 text-right font-label text-[12px] tabular-nums outline-none focus:border-[var(--ink-muted)]"
                  />
                  <button
                    onClick={() => removePrizeRow(idx)}
                    disabled={editorPrizes.length <= 1}
                    className="shrink-0 rounded px-2 py-1 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                onClick={addPrizeRow}
                className="w-full rounded border border-dashed border-[var(--border)] py-2 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
              >
                + 新增一行
              </button>
            </div>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditorOpen(false)}
            >
              取消
            </Button>
            <Button size="sm" onClick={saveEditor} loading={actionLoading}>
              保存
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!syncTarget}
        title="同步 Lv3+ 用户进池"
        message={
          syncTarget
            ? `把所有 Lv3+ 用户批量拉入 ${syncTarget.month} 期. 已在池中的用户会跳过.`
            : undefined
        }
        confirmLabel="开始同步"
        loading={actionLoading}
        onConfirm={doSync}
        onCancel={() => setSyncTarget(null)}
      />

      <ConfirmDialog
        open={!!drawTarget}
        title={`开奖 · ${drawTarget?.month ?? ""}`}
        message={
          drawTarget
            ? `按奖池随机抽取 ${drawTarget.prizeConfig.reduce(
                (s, p) => s + (Number(p.quota) || 0),
                0,
              )} 个名额, 来自 ${drawTarget.totalEntries} 位参与者. 开奖后不可撤销.`
            : undefined
        }
        confirmLabel="确认开奖"
        loading={actionLoading}
        onConfirm={doDraw}
        onCancel={() => setDrawTarget(null)}
      />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-label text-[10px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-1 font-serif text-lg text-black dark:text-white">
        {value}
      </div>
    </div>
  );
}
