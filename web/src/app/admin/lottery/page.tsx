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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      alert(t("admin.monthFormatError"));
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
      alert(t("admin.atLeastOnePrize"));
      return;
    }
    const ids = new Set<string>();
    for (const p of cleaned) {
      if (ids.has(p.prizeId)) {
        alert(t("admin.duplicatePrizeId", { id: p.prizeId }));
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
          : t("admin.saveFailed"),
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
      alert(t("admin.syncComplete", { count: res.added }));
      setSyncTarget(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.syncFailed"));
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
      alert(t("admin.drawComplete", { count: res.winners }));
      setDrawTarget(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.drawFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title={t("admin.lottery")}
        description={t("admin.lotteryDesc")}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openEditor()}>
              {t("admin.createRound")}
            </Button>
            <Button variant="ghost" size="sm" onClick={load}>
              {t("admin.refresh")}
            </Button>
          </div>
        }
      />

      {rounds.length === 0 ? (
        <EmptyState message={t("admin.noRounds")} />
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
                        ? t("admin.statusOpen")
                        : r.status === "DRAWN"
                        ? t("admin.statusDrawn")
                        : t("admin.statusClosed")}
                    </StatusBadge>
                  </div>
                  {isOpen && (
                    <div className="flex gap-1 font-label text-[12px]">
                      <button
                        onClick={() => openEditor(r)}
                        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.editPrize")}
                      </button>
                      <button
                        onClick={() => setSyncTarget(r)}
                        className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.syncEntries")}
                      </button>
                      <button
                        onClick={() => setDrawTarget(r)}
                        className="rounded bg-[var(--ink)] px-2 py-1 text-[var(--canvas)] transition-opacity hover:opacity-80"
                      >
                        {t("admin.draw")}
                      </button>
                    </div>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-4 border-y border-[var(--border)] py-3 font-label text-[12px]">
                  <Cell label={t("admin.participation")} value={r.totalEntries} />
                  <Cell label={t("admin.winners")} value={r.totalWinners} />
                  <Cell label={t("admin.prizes")} value={r.prizeConfig.length} />
                  <Cell
                    label={t("admin.drawnAt")}
                    value={
                      r.drawnAt
                        ? new Date(r.drawnAt).toLocaleDateString()
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
                    {t("admin.prizeNotConfigured")}
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
        title={editorMode === "edit" ? t("admin.editPrize") : t("admin.createRound")}
        onClose={() => setEditorOpen(false)}
        wide
      >
        <div className="space-y-4">
          <FormField label={t("admin.roundLabel")} required>
            <TextInput
              value={editorMonth}
              onChange={setEditorMonth}
              placeholder={t("admin.roundPlaceholder")}
              disabled={editorMode === "edit"}
            />
            <p className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
              {editorMode === "edit"
                ? t("admin.roundEditNote")
                : t("admin.roundCreateNote")}
            </p>
          </FormField>

          <FormField label={t("admin.prizeList")}>
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
                    placeholder={t("admin.prizeName")}
                    className="h-9 flex-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-2 font-label text-[12px] outline-none focus:border-[var(--ink-muted)]"
                  />
                  <input
                    value={p.quota}
                    onChange={(e) => updatePrize(idx, "quota", e.target.value)}
                    placeholder={t("admin.prizeQuota")}
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
                {t("admin.addRow")}
              </button>
            </div>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditorOpen(false)}
            >
              {t("admin.cancel")}
            </Button>
            <Button size="sm" onClick={saveEditor} loading={actionLoading}>
              {t("admin.save")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!syncTarget}
        title={t("admin.syncTitle")}
        message={
          syncTarget
            ? t("admin.syncMsg", { month: syncTarget.month })
            : undefined
        }
        confirmLabel={t("admin.startSync")}
        loading={actionLoading}
        onConfirm={doSync}
        onCancel={() => setSyncTarget(null)}
      />

      <ConfirmDialog
        open={!!drawTarget}
        title={t("admin.drawTitle", { month: drawTarget?.month ?? "" })}
        message={
          drawTarget
            ? t("admin.drawMsg", {
                quota: drawTarget.prizeConfig.reduce(
                  (s, p) => s + (Number(p.quota) || 0),
                  0,
                ),
                entries: drawTarget.totalEntries,
              })
            : undefined
        }
        confirmLabel={t("admin.confirmDraw")}
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
