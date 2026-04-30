"use client";

/**
 * /admin/levels — 等级审批 + 手动授予
 *
 * 落实 PRD 两条"人工管控"红线:
 *   1) Lv4 升级工单审批:  列出所有 PENDING, 通过 / 拒绝二次确认.
 *   2) Lv5 手动授予:      输入 userId + 等级 + 备注, 直接赋级.
 *
 * 审批通过后:  user_levels.current_level 由服务端升级,  权益自动发放,
 * level_upgrade_requests 落一条 APPROVED 审计记录.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adminLevelApi,
  type BackfillResponse,
  type BackfillSummary,
  type BackfillUserResult,
  type LevelUserRow,
  type UpgradeRequestInfo,
} from "@/lib/services/level";
import { LEVEL_OPTIONS, LEVEL_TITLES } from "@/lib/levels/titles";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
  Pagination,
  PromptDialog,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";

const LEVEL_USERS_PAGE_SIZE = 20;

type LevelFilterValue = `L${0 | 1 | 2 | 3 | 4 | 5}`;

/** 统一抽取异常消息, 避免在几个 catch 里重复写同一行三元. */
function getErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function ErrorBanner({ message, prefix }: { message: string; prefix: string }) {
  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 font-label text-[12px] leading-5 text-red-600">
      {prefix}: {message}
    </div>
  );
}

export default function AdminLevelsPage() {
  const { t } = useTranslation();

  const LEVEL_FILTER_OPTIONS = [5, 4, 3, 2, 1, 0].map((lv) => ({
    value: `L${lv}` as LevelFilterValue,
    label: lv === 0 ? t("admin.lv0NotReached") : `Lv${lv} · ${LEVEL_TITLES[lv] ?? ""}`,
  }));

  const [items, setItems] = useState<UpgradeRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 通过 / 拒绝
  const [approveTarget, setApproveTarget] = useState<UpgradeRequestInfo | null>(null);
  const [rejectTarget, setRejectTarget] = useState<UpgradeRequestInfo | null>(null);

  // 手动赋级
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState<number>(5);
  const [grantRemark, setGrantRemark] = useState("");

  // 存量回填
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillUserId, setBackfillUserId] = useState("");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResponse | null>(null);
  const [confirmBackfillLive, setConfirmBackfillLive] = useState(false);

  // 所有用户等级总览 (按 current_level 降序分页)
  const [levelUsers, setLevelUsers] = useState<LevelUserRow[]>([]);
  const [levelUsersTotal, setLevelUsersTotal] = useState(0);
  const [levelUsersPage, setLevelUsersPage] = useState(1);
  const [levelUsersLoading, setLevelUsersLoading] = useState(false);
  const [levelUsersError, setLevelUsersError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilterValue | undefined>(undefined);

  const filterLevelValue = useMemo<number | null>(() => {
    if (!levelFilter) return null;
    return Number(levelFilter.slice(1));
  }, [levelFilter]);

  const levelUsersTotalPages = Math.max(
    1,
    Math.ceil(levelUsersTotal / LEVEL_USERS_PAGE_SIZE),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setRequestsError(null);
    try {
      const data = await adminLevelApi.listUpgradeRequests();
      setItems(data);
    } catch (e) {
      console.warn("listUpgradeRequests failed", e);
      setItems([]);
      setRequestsError(getErrorMessage(e, t("admin.actionFailed")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 所有用户等级列表 · 随筛选 / 翻页 重新拉取.
  //
  // 用单调自增 token 防竞态: 快速切换筛选时, 只认"最后一次"发起的结果,
  // 避免慢响应覆盖掉新结果导致 UI 和筛选条件错位.
  const levelUsersReqTokenRef = useRef(0);
  const loadLevelUsers = useCallback(async () => {
    const token = ++levelUsersReqTokenRef.current;
    setLevelUsersLoading(true);
    setLevelUsersError(null);
    try {
      const res = await adminLevelApi.listUsersByLevel({
        page:     levelUsersPage,
        pageSize: LEVEL_USERS_PAGE_SIZE,
        level:    filterLevelValue,
      });
      if (token !== levelUsersReqTokenRef.current) return;
      setLevelUsers(res.users);
      setLevelUsersTotal(res.total);
    } catch (e) {
      if (token !== levelUsersReqTokenRef.current) return;
      console.warn("listUsersByLevel failed", e);
      setLevelUsers([]);
      setLevelUsersTotal(0);
      setLevelUsersError(getErrorMessage(e, t("admin.actionFailed")));
    } finally {
      if (token === levelUsersReqTokenRef.current) {
        setLevelUsersLoading(false);
      }
    }
  }, [levelUsersPage, filterLevelValue]);

  useEffect(() => {
    loadLevelUsers();
  }, [loadLevelUsers]);

  const handleLevelFilterChange = (v: LevelFilterValue | undefined) => {
    setLevelFilter(v);
    setLevelUsersPage(1);
  };

  // ── approve ──
  const doApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      await adminLevelApi.reviewUpgradeRequest(approveTarget.id, true);
      setItems((prev) => prev.filter((p) => p.id !== approveTarget.id));
      setApproveTarget(null);
      // 用户 current_level 跳了, 底表要跟着刷新, 否则看到的等级是旧的.
      loadLevelUsers();
    } catch (e) {
      alert(getErrorMessage(e, t("admin.approveFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  // ── reject ──
  const doReject = async (remark: string) => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await adminLevelApi.reviewUpgradeRequest(rejectTarget.id, false, remark);
      setItems((prev) => prev.filter((p) => p.id !== rejectTarget.id));
      setRejectTarget(null);
      // 拒绝也会把 user_levels.pending_level 清掉, 底表"待审核"列要同步.
      loadLevelUsers();
    } catch (e) {
      alert(getErrorMessage(e, t("admin.actionFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  // ── grant ──
  const doGrant = async () => {
    const uid = parseInt(grantUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      alert(t("admin.invalidUserId"));
      return;
    }
    if (grantLevel < 1 || grantLevel > 5) {
      alert(t("admin.levelRange"));
      return;
    }
    if (!confirm(t("admin.confirmGrantMsg", { id: uid, level: grantLevel }))) return;

    setActionLoading(true);
    try {
      await adminLevelApi.grantLevel(uid, grantLevel, grantRemark);
      alert(t("admin.granted"));
      setGrantOpen(false);
      setGrantUserId("");
      setGrantRemark("");
      load();
      loadLevelUsers();
    } catch (e) {
      alert(getErrorMessage(e, t("admin.grantFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  // ── 存量回填 ──
  const runBackfill = async (opts: { dryRun: boolean; userId?: number }) => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const res = await adminLevelApi.backfillLevels({
        userId: opts.userId,
        dryRun: opts.dryRun,
      });
      setBackfillResult(res);
      // 落库的回填会批量升级 / 新建 PENDING, 两张表都要刷.
      if (!opts.dryRun) {
        load();
        loadLevelUsers();
      }
    } catch (e) {
      alert(getErrorMessage(e, t("admin.backfillFailed")));
    } finally {
      setBackfillLoading(false);
    }
  };

  const runBackfillSingle = () => {
    const uid = parseInt(backfillUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      alert(t("admin.invalidUserId"));
      return;
    }
    runBackfill({ dryRun: false, userId: uid });
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title={t("admin.levels")}
        description={t("admin.levelsDesc")}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setBackfillOpen(true)}>
              {t("admin.backfill")}
            </Button>
            <Button size="sm" onClick={() => setGrantOpen(true)}>
              {t("admin.manualGrant")}
            </Button>
            <Button variant="ghost" size="sm" onClick={load}>
              {t("admin.refresh")}
            </Button>
          </div>
        }
      />

      {/* Lv4 待审批队列 */}
      <div className="mb-3 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {t("admin.lv4Pending")} · {requestsError ? "—" : t("admin.itemCount", { count: items.length })}
      </div>

      {requestsError ? (
        <div className="mb-3">
          <ErrorBanner message={requestsError} prefix={t("admin.apiError")} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState message={t("admin.noPendingRequests")} />
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-4 px-4 py-3 font-label"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px]">
                  @{it.username ?? `user#${it.userId}`}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[color:var(--ink-muted)]">
                  <StatusBadge active>{t("admin.targetLevel", { level: it.targetLevel })}</StatusBadge>
                  <span>user id: {it.userId}</span>
                  <span>·</span>
                  <span>
                    {new Date(it.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
                <div className="flex shrink-0 items-center gap-1 text-[12px]">
                <button
                  onClick={() => setApproveTarget(it)}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  {t("admin.approve")}
                </button>
                <button
                  onClick={() => setRejectTarget(it)}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  {t("admin.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 所有用户等级总览 · current_level 降序 */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("admin.allUserLevels")} · {levelUsersError ? "—" : t("admin.totalPeople", { count: levelUsersTotal })}
          </div>
          <Button variant="ghost" size="sm" onClick={loadLevelUsers}>
            {t("admin.refresh")}
          </Button>
        </div>

        <div className="mb-3">
          <FilterChips<LevelFilterValue>
            options={LEVEL_FILTER_OPTIONS}
            value={levelFilter}
            onChange={handleLevelFilterChange}
            allLabel={t("admin.allLevels")}
          />
        </div>

        {levelUsersError ? (
          <div className="mb-3">
            <ErrorBanner message={levelUsersError} prefix={t("admin.apiError")} />
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full font-label text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colUser")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colType")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colLevel")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colPending")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colLastUpgrade")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {levelUsersError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-600">
                    {t("admin.apiErrorDetail")}
                  </td>
                </tr>
              ) : levelUsersLoading && levelUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--ink-muted)]">
                    {t("admin.loading")}
                  </td>
                </tr>
              ) : levelUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--ink-muted)]">
                    {t("admin.noMatchingUsers")}
                  </td>
                </tr>
              ) : (
                levelUsers.map((u) => {
                  const level = u.currentLevel ?? 0;
                  const title = LEVEL_TITLES[level];
                  const isMerchant = u.merchant?.status === "APPROVED";
                  return (
                    <tr
                      key={u.userId}
                      className="transition-colors hover:bg-[var(--canvas-soft)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.avatarUrl}
                              alt={u.username}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--canvas-raised)] text-[11px] text-[color:var(--ink-muted)]">
                              {u.username?.slice(0, 1) || "?"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate">
                              @{u.username || `user#${u.userId}`}
                            </div>
                            <div className="text-[11px] text-[color:var(--ink-muted)]">
                              ID {u.userId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isMerchant ? (
                          <span className="inline-flex items-center rounded-full border border-[var(--ink)] bg-transparent px-2 py-0.5 font-label text-[11px] tracking-[0.08em] text-[var(--ink)]">
                            {t("admin.merchant")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[var(--canvas-raised)] px-2 py-0.5 font-label text-[11px] tracking-[0.08em] text-[color:var(--ink-muted)]">
                            USER
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {level >= 1 && title ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--ink)] px-2 py-0.5 font-label text-[11px] tracking-[0.1em] text-[var(--canvas)]">
                            <span className="font-semibold">Lv{level}</span>
                            <span className="opacity-80">· {title}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-[color:var(--ink-muted)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.pendingLevel ? (
                          <StatusBadge active>
                            pending Lv{u.pendingLevel}
                          </StatusBadge>
                        ) : (
                          <span className="text-[12px] text-[color:var(--ink-muted)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                        {u.lastLevelUpAt
                          ? new Date(u.lastLevelUpAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={levelUsersPage}
          totalPages={levelUsersTotalPages}
          onChange={setLevelUsersPage}
        />
      </section>

      <ConfirmDialog
        open={!!approveTarget}
        title={t("admin.confirmApprove")}
        message={
          approveTarget
            ? t("admin.approveMsg", { username: approveTarget.username ?? approveTarget.userId, level: approveTarget.targetLevel })
            : undefined
        }
        confirmLabel={t("admin.approve")}
        loading={actionLoading}
        onConfirm={doApprove}
        onCancel={() => setApproveTarget(null)}
      />

      <PromptDialog
        open={!!rejectTarget}
        title={t("admin.rejectReason")}
        placeholder={t("admin.rejectReasonExample")}
        confirmLabel={t("admin.confirmReject")}
        loading={actionLoading}
        onConfirm={doReject}
        onCancel={() => setRejectTarget(null)}
      />

      <FormDialog
        open={grantOpen}
        title={t("admin.grantTitle")}
        onClose={() => setGrantOpen(false)}
      >
        <div className="space-y-4">
          <p className="font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("admin.grantDesc")}
          </p>
          <FormField label={t("admin.userId")} required>
            <TextInput
              value={grantUserId}
              onChange={setGrantUserId}
              placeholder={t("admin.userIdPlaceholder")}
            />
          </FormField>
          <FormField label={t("admin.targetLevelLabel")}>
            <div className="flex flex-wrap gap-1.5">
              {LEVEL_OPTIONS.map((opt) => {
                const active = grantLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setGrantLevel(opt.value)}
                    className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                      active
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                        : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </FormField>
          <FormField label={t("admin.remarkLabel")}>
            <TextInput
              value={grantRemark}
              onChange={setGrantRemark}
              placeholder={t("admin.remarkPlaceholder")}
              multiline
              rows={2}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setGrantOpen(false)}
            >
              {t("admin.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={doGrant}
              loading={actionLoading}
            >
              {t("admin.grant")}
            </Button>
          </div>
        </div>
      </FormDialog>

      {/* 存量用户等级回填 */}
      <FormDialog
        open={backfillOpen}
        title={t("admin.backfillTitle")}
        onClose={() => {
          setBackfillOpen(false);
          setBackfillResult(null);
        }}
      >
        <div className="space-y-4">
          <div className="rounded border border-[var(--border)] bg-[var(--canvas-raised)] p-3 font-label text-[12px] leading-5 text-[color:var(--ink-muted)]">
            <p className="font-semibold text-[color:var(--ink)]">{t("admin.backfillRedline")}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>{t("admin.backfillRule1")}</li>
              <li>{t("admin.backfillRule2")}</li>
              <li>{t("admin.backfillRule3")}</li>
              <li>{t("admin.backfillRule4")}</li>
            </ul>
          </div>

          {/* 全量 */}
          <div className="space-y-2">
            <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {t("admin.fullScan")}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => runBackfill({ dryRun: true })}
                loading={backfillLoading}
              >
                {t("admin.dryRun")}
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmBackfillLive(true)}
                loading={backfillLoading}
              >
                {t("admin.runFullBackfill")}
              </Button>
            </div>
          </div>

          {/* 单用户 */}
          <div className="space-y-2">
            <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {t("admin.singleUserBackfill")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TextInput
                  value={backfillUserId}
                  onChange={setBackfillUserId}
                  placeholder={t("admin.userId")}
                />
              </div>
              <Button
                size="sm"
                onClick={runBackfillSingle}
                loading={backfillLoading}
              >
                {t("admin.execute")}
              </Button>
            </div>
          </div>

          {/* 结果 */}
          {backfillResult && (
            <div className="rounded border border-[var(--border)] bg-[var(--canvas)] p-3 font-label text-[12px] leading-5 text-[var(--ink)]">
              {backfillResult.scope === "single"
                ? renderSingleResult(backfillResult.user, t)
                : renderSummaryResult(backfillResult.summary, t)}
            </div>
          )}
        </div>
      </FormDialog>

      <ConfirmDialog
        open={confirmBackfillLive}
        title={t("admin.confirmFullBackfill")}
        message={t("admin.fullBackfillMsg")}
        confirmLabel={t("admin.executeNow")}
        loading={backfillLoading}
        onConfirm={() => {
          setConfirmBackfillLive(false);
          runBackfill({ dryRun: false });
        }}
        onCancel={() => setConfirmBackfillLive(false)}
      />
    </div>
  );
}

function renderSingleResult(u: BackfillUserResult, t: (k: string) => string) {
  return (
    <div className="space-y-1">
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultUser")}</span> #{u.userId}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultLevel")}</span> Lv
        {u.beforeLevel} → Lv{u.afterLevel}
        {u.pendingLevel ? ` (pending Lv${u.pendingLevel})` : ""}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">counters:</span>{" "}
        <code className="text-[11px]">{JSON.stringify(u.counters)}</code>
      </div>
      {u.dryRun && (
        <div className="pt-1 text-[color:var(--ink-muted)]">
          {t("admin.dryRunNote")}
        </div>
      )}
    </div>
  );
}

function renderSummaryResult(s: BackfillSummary, t: (k: string) => string) {
  return (
    <div className="space-y-1">
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultScanned")}</span> {s.scanned}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultUpgraded")}</span>{" "}
        {s.upgraded}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultPendingCreated")}</span>{" "}
        {s.pendingCreated}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultErrors")}</span> {s.errors}
      </div>
      <div>
        <span className="text-[color:var(--ink-muted)]">{t("admin.resultDistribution")}</span>{" "}
        <code className="text-[11px]">{JSON.stringify(s.levelDistribution)}</code>
      </div>
      {s.dryRun && (
        <div className="pt-1 text-[color:var(--ink-muted)]">
          {t("admin.dryRunNote")}
        </div>
      )}
    </div>
  );
}
