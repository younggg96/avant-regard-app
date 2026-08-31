"use client";

/**
 * /me/merchant/[merchantId]/dashboard —— 商家「数据看板」.
 *
 * 三段式布局:
 *   - Overview     : 顶部汇总卡 (我想去 / 我去过 累计 + 今日 / 评分均值)
 *   - 粉丝画像 Tab : 城市分布 / 24h 活跃时段 / Top 3 偏好品牌
 *   - 地推数据 Tab : 我想去 / 我去过 7 天趋势折线 + 点击「我去过」数字打开
 *                    打卡评论列表 (店主可直接在评论区回复)
 *
 * 数据全部走后端 `/api/store-merchants/{merchantId}/insights/*`,
 * 鉴权由后端 `_ensure_merchant_owner` 兜底, 前端 useSWR 只关心呈现.
 *
 * 设计取舍:
 *   - 评论回复复用 buyer_store_comments 表 (POST /api/buyer-stores/{storeId}/
 *     comments + parentId), 不再单独造一套, 走原有评论回复流程.
 *   - 24h 活跃时段用纯 CSS 柱状图 + 阴影, 视觉上对应需求文档 "活跃时段:
 *     24 小时热力条" —— 不引第三方图表库. 折线图复用既有
 *     `@/components/admin/LineChart`.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Button,
  EmptyState,
  FormDialog,
  LoadingState,
} from "@/components/admin/ui";
import { LineChart } from "@/components/admin/LineChart";
import {
  storeMerchantService,
  type BrandClickBreakdown,
  type BrandStatsResponse,
  type BrandStatsWindow,
  type FanProfile,
  type InsightsOverview,
  type PromotionStats,
  type TopProductItem,
  type VisitComment,
  type VisitCommentReply,
} from "@/lib/services/store-merchant";
import {
  createBuyerStoreComment,
  getBuyerStoreCommentReplies,
} from "@/lib/services/buyer-store";
import { useAuthStore } from "@/lib/auth/store";

// ───────────────────────────── 主页面 ─────────────────────────────

type DashboardTab = "overview" | "fans" | "promotion" | "content";

export default function MerchantDashboardPage() {
  const { t } = useTranslation();
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  // 沿用 /me/merchant 主页相同的来源, SWR 会复用缓存避免重复拉取.
  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    Number.isFinite(merchantId) ? ["my-merchants-manage"] : null,
    () => storeMerchantService.getMyMerchants(1, 50),
  );
  const merchant = useMemo(
    () => myMerchants?.merchants.find((m) => m.id === merchantId) ?? null,
    [myMerchants, merchantId],
  );

  const enabled = !!merchant && merchant.status === "APPROVED";

  const overviewSWR = useSWR<InsightsOverview>(
    enabled ? ["merchant-insights-overview", merchantId] : null,
    () => storeMerchantService.getInsightsOverview(merchantId),
  );
  const fansSWR = useSWR<FanProfile>(
    enabled ? ["merchant-insights-fans", merchantId] : null,
    () => storeMerchantService.getInsightsFans(merchantId),
  );
  const promotionSWR = useSWR<PromotionStats>(
    enabled ? ["merchant-insights-promotion", merchantId] : null,
    () => storeMerchantService.getInsightsPromotion(merchantId),
  );

  const [tab, setTab] = useState<DashboardTab>("overview");
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);

  if (loadingMerchants) {
    return (
      <section className="min-w-0">
        <BackLink merchantId={merchantId} />
        <div className="mt-6">
          <LoadingState />
        </div>
      </section>
    );
  }

  if (!merchant) {
    return (
      <section className="min-w-0">
        <BackLink merchantId={merchantId} />
        <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            {t("merchant.notFound")}
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            {t("merchant.notFoundDesc")}
          </div>
        </div>
      </section>
    );
  }

  if (merchant.status !== "APPROVED") {
    return (
      <section className="min-w-0">
        <BackLink merchantId={merchantId} />
        <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            {t("merchant.notApproved")}
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            {t("merchant.notApprovedDesc", { status: merchant.status })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0">
      <BackLink merchantId={merchantId} />

      <header className="mt-4 mb-6 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-2xl text-black dark:text-white md:text-3xl">
          {t("merchant.dashboardTitle")}
        </h1>
        <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.dashboardDesc")}
        </p>
      </header>

      <OverviewCards
        overview={overviewSWR.data}
        loading={overviewSWR.isLoading}
        onClickVisited={() => setVisitDialogOpen(true)}
      />

      <DashboardTabBar active={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "overview" && (
          <OverviewTab
            promotion={promotionSWR.data}
            loading={promotionSWR.isLoading}
            onClickVisited={() => setVisitDialogOpen(true)}
          />
        )}
        {tab === "fans" && (
          <FansTab profile={fansSWR.data} loading={fansSWR.isLoading} />
        )}
        {tab === "promotion" && (
          <PromotionTab
            stats={promotionSWR.data}
            loading={promotionSWR.isLoading}
            onClickVisited={() => setVisitDialogOpen(true)}
          />
        )}
        {tab === "content" && <ContentTab merchantId={merchantId} />}
      </div>

      <VisitCommentsDialog
        open={visitDialogOpen}
        onClose={() => setVisitDialogOpen(false)}
        merchantId={merchantId}
        storeId={merchant.storeId}
      />
    </section>
  );
}

// ───────────────────────────── 通用零件 ─────────────────────────────

function BackLink({ merchantId }: { merchantId: number }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/me/merchant/${merchantId}`}
      className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
    >
      {t("common.backToMerchant")}
    </Link>
  );
}

function DashboardTabBar({
  active,
  onChange,
}: {
  active: DashboardTab;
  onChange: (k: DashboardTab) => void;
}) {
  const { t } = useTranslation();
  const tabs: { key: DashboardTab; label: string }[] = [
    { key: "overview", label: t("merchant.dashboardTabOverview") },
    { key: "fans", label: t("merchant.dashboardTabFans") },
    { key: "promotion", label: t("merchant.dashboardTabPromotion") },
    { key: "content", label: t("merchant.dashboardTabContent") },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)] font-label text-[13px]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`-mb-px border-b-2 px-4 py-2 transition-colors ${
            active === tab.key
              ? "border-[var(--ink)] text-[var(--ink)]"
              : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-label text-[13px] font-semibold text-[var(--ink)]">
            {title}
          </h2>
          {hint && (
            <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
              {hint}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ───────────────────────────── Overview cards ─────────────────────────────
//
// 顶部汇总卡 —— 始终展示, 与 Tab 无关. 我想去 / 我去过 / 评分 三张卡.
// "我去过" 卡的数字可点击, 直接打开打卡评论 dialog (符合需求"点击「我去过」
// 数字可查看所有打卡评论").

function OverviewCards({
  overview,
  loading,
  onClickVisited,
}: {
  overview?: InsightsOverview;
  loading: boolean;
  onClickVisited: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <StatCard
        label={t("merchant.dashboardWantToGo")}
        value={overview?.wantToGoTotal ?? 0}
        delta={overview?.wantToGoToday}
        loading={loading}
      />
      <StatCard
        label={t("merchant.dashboardVisited")}
        value={overview?.visitedTotal ?? 0}
        delta={overview?.visitedToday}
        loading={loading}
        onClick={onClickVisited}
        clickHint={t("merchant.dashboardClickVisitedHint")}
      />
      <StatCard
        label={t("merchant.dashboardRating")}
        value={
          overview ? Number((overview.ratingAverage || 0).toFixed(1)) : 0
        }
        suffix={overview ? ` (${overview.ratingCount})` : ""}
        loading={loading}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  delta,
  loading,
  onClick,
  clickHint,
}: {
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
  loading: boolean;
  onClick?: () => void;
  clickHint?: string;
}) {
  const { t } = useTranslation();
  const inner = (
    <>
      <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-2 font-serif text-[28px] leading-none text-[var(--ink)]">
        {loading ? "—" : `${value}${suffix ?? ""}`}
      </div>
      {delta !== undefined && (
        <div className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
          {t("merchant.dashboardTodayDelta", { count: delta })}
        </div>
      )}
      {onClick && clickHint && (
        <div className="mt-2 font-label text-[11px] text-[color:var(--ink-muted)] underline-offset-2 group-hover:underline">
          {clickHint}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="group rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4 text-left transition-colors hover:border-[var(--ink-muted)]"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      {inner}
    </div>
  );
}

// ───────────────────────────── Tabs: Overview ─────────────────────────────

function OverviewTab({
  promotion,
  loading,
  onClickVisited,
}: {
  promotion?: PromotionStats;
  loading: boolean;
  onClickVisited: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6">
      <Section
        title={t("merchant.promotionTrendTitle")}
        hint={t("merchant.dashboardClickVisitedHint")}
        action={
          <Button size="sm" variant="secondary" onClick={onClickVisited}>
            {t("merchant.visitCommentsTitle")} →
          </Button>
        }
      >
        {loading || !promotion ? (
          <LoadingState />
        ) : (
          <PromotionTrendChart stats={promotion} />
        )}
      </Section>
    </div>
  );
}

// ───────────────────────────── Tabs: 粉丝画像 ─────────────────────────────

function FansTab({
  profile,
  loading,
}: {
  profile?: FanProfile;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading || !profile) {
    return <LoadingState />;
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--canvas-soft)] px-4 py-3">
        <div>
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("merchant.fansTotalLabel")}
          </div>
          <div className="mt-1 font-serif text-[20px] text-[var(--ink)]">
            {profile.fansTotal}
          </div>
          <div className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("merchant.fansSubtitle")}
          </div>
        </div>
        <div className="hidden font-label text-[11px] text-[color:var(--ink-muted)] md:block">
          {t("merchant.fansAggregateNote")}
        </div>
      </div>

      <Section
        title={t("merchant.fansCityTitle")}
        hint={t("merchant.fansCityHint")}
      >
        {profile.cityDistribution.length === 0 ? (
          <EmptyState message={t("merchant.dashboardEmpty")} />
        ) : (
          <CityBars data={profile.cityDistribution} />
        )}
      </Section>

      <Section
        title={t("merchant.fansActiveTitle")}
        hint={t("merchant.fansActiveHint")}
      >
        {profile.activeHours.every((h) => h.count === 0) ? (
          <EmptyState message={t("merchant.dashboardEmpty")} />
        ) : (
          <ActiveHoursHeatBar buckets={profile.activeHours} />
        )}
      </Section>

      <Section
        title={t("merchant.fansBrandTitle")}
        hint={t("merchant.fansBrandHint")}
      >
        {profile.preferredBrands.length === 0 ? (
          <EmptyState message={t("merchant.dashboardEmpty")} />
        ) : (
          <BrandList brands={profile.preferredBrands} />
        )}
      </Section>
    </div>
  );
}

function CityBars({
  data,
}: {
  data: { city: string; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.city} className="flex items-center gap-3">
          <div className="w-20 truncate font-label text-[12px] text-[var(--ink)]">
            {d.city}
          </div>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
            <div
              className="h-full bg-[var(--ink)] transition-all"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <div className="w-10 text-right font-label text-[12px] text-[color:var(--ink-muted)]">
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveHoursHeatBar({
  buckets,
}: {
  buckets: { hour: number; count: number }[];
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
        {buckets.map((b) => {
          const h = (b.count / max) * 100;
          // 用 ink 的不透明度叠加, 视觉上像热力条; 0 值留 4% 高度让 24 格永远可见.
          const opacity = b.count === 0 ? 0.08 : 0.25 + (b.count / max) * 0.75;
          return (
            <div
              key={b.hour}
              className="group relative flex-1"
              title={`${b.hour}:00 — ${b.count}`}
            >
              <div
                className="w-full rounded-sm bg-[var(--ink)] transition-opacity"
                style={{
                  height: `${Math.max(h, 4)}%`,
                  opacity,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-label text-[10px] text-[color:var(--ink-muted)]">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

function BrandList({
  brands,
}: {
  brands: { brandId: number; brandName: string; count: number }[];
}) {
  const max = Math.max(...brands.map((b) => b.count), 1);
  return (
    <div className="space-y-2">
      {brands.map((b, i) => (
        <div key={b.brandId} className="flex items-center gap-3">
          <div className="w-6 font-serif text-[15px] text-[color:var(--ink-muted)]">
            {i + 1}
          </div>
          <div className="w-32 truncate font-serif text-[14px] text-[var(--ink)]">
            {b.brandName}
          </div>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
            <div
              className="h-full bg-[var(--ink)] transition-all"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <div className="w-10 text-right font-label text-[12px] text-[color:var(--ink-muted)]">
            {b.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Tabs: 地推数据 ─────────────────────────────

function PromotionTab({
  stats,
  loading,
  onClickVisited,
}: {
  stats?: PromotionStats;
  loading: boolean;
  onClickVisited: () => void;
}) {
  const { t } = useTranslation();
  if (loading || !stats) return <LoadingState />;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <PromotionMetricCard
          label={t("merchant.promotionWantToGoLabel")}
          metric={stats.wantToGo}
        />
        <PromotionMetricCard
          label={t("merchant.promotionVisitedLabel")}
          metric={stats.visited}
          onClick={onClickVisited}
          clickHint={t("merchant.dashboardClickVisitedHint")}
        />
      </div>

      <Section title={t("merchant.promotionTrendTitle")}>
        <PromotionTrendChart stats={stats} />
      </Section>
    </div>
  );
}

function PromotionMetricCard({
  label,
  metric,
  onClick,
  clickHint,
}: {
  label: string;
  metric: PromotionStats["wantToGo"];
  onClick?: () => void;
  clickHint?: string;
}) {
  const { t } = useTranslation();
  const inner = (
    <>
      <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-[28px] text-[var(--ink)]">
          {metric.total}
        </span>
        <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.dashboardTodayDelta", { count: metric.today })}
        </span>
      </div>
      {onClick && clickHint && (
        <div className="mt-2 font-label text-[11px] text-[color:var(--ink-muted)] underline-offset-2 group-hover:underline">
          {clickHint}
        </div>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="group rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4 text-left transition-colors hover:border-[var(--ink-muted)]"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      {inner}
    </div>
  );
}

function PromotionTrendChart({ stats }: { stats: PromotionStats }) {
  const { t } = useTranslation();
  const labels = stats.wantToGo.trend.map((p) => p.date);
  return (
    <LineChart
      labels={labels}
      lines={[
        {
          key: "want",
          label: t("merchant.promotionWantToGoLabel"),
          values: stats.wantToGo.trend.map((p) => p.count),
        },
        {
          key: "visit",
          label: t("merchant.promotionVisitedLabel"),
          values: stats.visited.trend.map((p) => p.count),
        },
      ]}
      height={220}
    />
  );
}

// ───────────────────── 「我去过」打卡评论 dialog ─────────────────────
//
// 复用 buyer_store_comments 表的评论列表 + 回复. 商家在这里发的回复就是
// 一条 parent_id != null 的评论, 走原有 buyer-store comment API,
// 用户和商家共用通知/排序逻辑, 不引新的"店主回复"专属表/字段.

function VisitCommentsDialog({
  open,
  onClose,
  merchantId,
  storeId,
}: {
  open: boolean;
  onClose: () => void;
  merchantId: number;
  storeId: string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // 只在 dialog 打开时拉数据, 避免后台默默打 API.
  const { data, isLoading, mutate } = useSWR(
    open ? ["merchant-visit-comments", merchantId, page] : null,
    () => storeMerchantService.getVisitComments(merchantId, page, PAGE_SIZE),
  );

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <FormDialog
      open={open}
      title={`${t("merchant.visitCommentsTitle")} · ${t("merchant.visitCommentsTotal", { count: total })}`}
      onClose={onClose}
      wide
    >
      <p className="mb-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        {t("merchant.visitCommentsDesc")}
      </p>

      {isLoading ? (
        <LoadingState />
      ) : comments.length === 0 ? (
        <EmptyState message={t("merchant.visitCommentsEmpty")} />
      ) : (
        <ul className="grid gap-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              storeId={storeId}
              onChanged={() => mutate()}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between font-label text-[12px] text-[color:var(--ink-muted)]">
          <span>
            {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-[var(--border)] px-3 py-1 transition-colors hover:bg-[var(--canvas-raised)] disabled:opacity-30"
            >
              ←
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-[var(--border)] px-3 py-1 transition-colors hover:bg-[var(--canvas-raised)] disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
      )}
    </FormDialog>
  );
}

function CommentItem({
  comment,
  storeId,
  onChanged,
}: {
  comment: VisitComment;
  storeId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allReplies, setAllReplies] = useState<VisitCommentReply[] | null>(null);

  const user = useAuthStore((s) => s.user);

  const visibleReplies = showAll && allReplies ? allReplies : comment.replies;

  const onSend = async () => {
    if (!user) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    try {
      await createBuyerStoreComment(storeId, {
        userId: user.userId,
        content: text,
        parentId: comment.id,
        replyToUserId: comment.userId,
      });
      setDraft("");
      setReplying(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const onShowAll = async () => {
    if (allReplies) {
      setShowAll(true);
      return;
    }
    try {
      const list = await getBuyerStoreCommentReplies(comment.id);
      setAllReplies(list as VisitCommentReply[]);
      setShowAll(true);
    } catch {
      setShowAll(true);
    }
  };

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      <div className="flex items-start gap-3">
        <UserAvatar url={comment.userAvatar} name={comment.username} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-label text-[13px] font-medium text-[var(--ink)]">
              {comment.username}
            </span>
            <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
              {formatTime(comment.createdAt)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap font-serif text-[14px] text-[var(--ink)]">
            {comment.content}
          </p>

          <div className="mt-2 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
            <button
              onClick={() => setReplying((v) => !v)}
              className="hover:text-[var(--ink)]"
            >
              {t("merchant.visitCommentsReply")}
            </button>
            {comment.replyCount > 0 && (
              <span>· {comment.replyCount}</span>
            )}
          </div>

          {/* 回复输入区 */}
          {replying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder={t("merchant.visitCommentsReplyPlaceholder")}
                className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 font-label text-[13px] outline-none focus:border-[var(--ink-muted)]"
              />
              <div className="flex items-center justify-between font-label text-[11px]">
                <span className="text-[color:var(--ink-muted)]">
                  {t("merchant.visitCommentsReplyTo", { name: comment.username })}
                </span>
                <div className="flex items-center gap-2">
                  {err && <span className="text-red-600">{err}</span>}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setReplying(false);
                      setDraft("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    loading={sending}
                    onClick={onSend}
                    disabled={!draft.trim() || !user}
                  >
                    {sending
                      ? t("merchant.visitCommentsReplySending")
                      : t("merchant.visitCommentsReplySend")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 回复列表 */}
          {visibleReplies.length > 0 && (
            <ul className="mt-3 space-y-2 border-l border-[var(--border)] pl-3">
              {visibleReplies.map((r) => (
                <ReplyItem key={r.id} reply={r} />
              ))}
              {!showAll && comment.replyCount > visibleReplies.length && (
                <button
                  onClick={onShowAll}
                  className="font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {t("merchant.visitCommentsViewMoreReplies", {
                    count: comment.replyCount,
                  })}
                </button>
              )}
              {showAll && allReplies && allReplies.length > 0 && (
                <button
                  onClick={() => setShowAll(false)}
                  className="font-label text-[12px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {t("merchant.visitCommentsHideReplies")}
                </button>
              )}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function ReplyItem({ reply }: { reply: VisitCommentReply }) {
  return (
    <li className="flex items-start gap-2">
      <UserAvatar url={reply.userAvatar} name={reply.username} small />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2 font-label">
          <span className="text-[12px] font-medium text-[var(--ink)]">
            {reply.username}
          </span>
          {reply.replyToUsername && (
            <span className="text-[11px] text-[color:var(--ink-muted)]">
              → @{reply.replyToUsername}
            </span>
          )}
          <span className="text-[11px] text-[color:var(--ink-muted)]">
            {formatTime(reply.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap font-serif text-[13px] text-[var(--ink)]">
          {reply.content}
        </p>
      </div>
    </li>
  );
}

function UserAvatar({
  url,
  name,
  small,
}: {
  url?: string;
  name: string;
  small?: boolean;
}) {
  const size = small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-[13px]";
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return (
      <Image
        src={url}
        alt={name}
        width={36}
        height={36}
        className={`shrink-0 rounded-full object-cover ${size}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--canvas-raised)] font-label text-[var(--ink-muted)] ${size}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

// ───────────────────── 内容数据 V2 (品牌点击 & TOP 品牌) ─────────────────────
//
// 单独 Tab. 顶部时间窗口切换 (7d/30d/全部) 后, brand-stats SWR key 变化触发重拉.
// 下半部 Top 单品列表 (V3 #16 保留, 不受时间窗口影响,只看 want_count 累计列).

function ContentTab({ merchantId }: { merchantId: number }) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<BrandStatsWindow>(7);

  const brandSWR = useSWR<BrandStatsResponse>(
    ["merchant-brand-stats", merchantId, window],
    () => storeMerchantService.getBrandStats(merchantId, window, 3),
  );

  const topProductsSWR = useSWR<{
    items: TopProductItem[];
    limit: number;
  }>(["merchant-top-products", merchantId], () =>
    storeMerchantService.getTopProducts(merchantId, 10),
  );

  return (
    <div className="grid gap-6">
      <BrandStatsSection
        window={window}
        onWindowChange={setWindow}
        data={brandSWR.data}
        loading={brandSWR.isLoading}
      />

      <Section
        title={t("merchant.contentTopProductsTitle")}
        hint={t("merchant.contentTopProductsHint")}
      >
        {topProductsSWR.isLoading || !topProductsSWR.data ? (
          <LoadingState />
        ) : topProductsSWR.data.items.length === 0 ? (
          <EmptyState message={t("merchant.contentNoProducts")} />
        ) : (
          <TopProductsTable items={topProductsSWR.data.items} />
        )}
      </Section>

      <p className="font-label text-[11px] text-[color:var(--ink-muted)]">
        {t("merchant.contentCacheNote")}
      </p>
    </div>
  );
}

function BrandStatsSection({
  window,
  onWindowChange,
  data,
  loading,
}: {
  window: BrandStatsWindow;
  onWindowChange: (w: BrandStatsWindow) => void;
  data?: BrandStatsResponse;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const refreshedAt = data?.computedAt ? formatTime(data.computedAt) : null;

  return (
    <div className="grid gap-6">
      <Section
        title={t("merchant.contentTopBrandsTitle")}
        hint={t("merchant.contentTopBrandsHint")}
        action={<WindowToggle value={window} onChange={onWindowChange} />}
      >
        {loading || !data ? (
          <LoadingState />
        ) : data.topBrands.length === 0 ? (
          <EmptyState message={t("merchant.contentNoBrands")} />
        ) : (
          <div className="space-y-3">
            {data.topBrands.map((b, i) => (
              <BrandRankCard key={b.brand} brand={b} rank={i + 1} />
            ))}
          </div>
        )}
        {refreshedAt && (
          <div className="mt-3 font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("merchant.contentRefreshedAt", { time: refreshedAt })}
          </div>
        )}
      </Section>

      {data && data.allBrands.length > data.topBrands.length && (
        <Section
          title={t("merchant.contentAllBrandsTitle")}
          hint={t("merchant.contentAllBrandsHint")}
        >
          <BrandStatsTable rows={data.allBrands} />
        </Section>
      )}
    </div>
  );
}

function WindowToggle({
  value,
  onChange,
}: {
  value: BrandStatsWindow;
  onChange: (w: BrandStatsWindow) => void;
}) {
  const { t } = useTranslation();
  const opts: { value: BrandStatsWindow; label: string }[] = [
    { value: 7, label: t("merchant.contentWindow7") },
    { value: 30, label: t("merchant.contentWindow30") },
    { value: 0, label: t("merchant.contentWindowAll") },
  ];
  return (
    <div className="flex gap-1 font-label text-[12px]">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 transition-colors ${
            value === o.value
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
              : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// 单品牌排行卡: 大数字 + 5 段堆叠条 (按比例) + 5 个小标签明细.
const METRIC_KEYS = [
  { k: "wantCount", labelKey: "merchant.contentMetricWant" },
  { k: "favoriteCount", labelKey: "merchant.contentMetricFavorite" },
  { k: "likeCount", labelKey: "merchant.contentMetricLike" },
  { k: "commentCount", labelKey: "merchant.contentMetricComment" },
  { k: "viewCount", labelKey: "merchant.contentMetricView" },
] as const;

// 5 段堆叠条用 ink 透明度区分 (从最深 → 最浅), 不引彩色保持 monochrome 风格.
const SEGMENT_OPACITIES = [1, 0.78, 0.58, 0.4, 0.22];

function BrandRankCard({
  brand,
  rank,
}: {
  brand: BrandClickBreakdown;
  rank: number;
}) {
  const { t } = useTranslation();
  const segments = METRIC_KEYS.map((m) => ({
    key: m.k,
    label: t(m.labelKey),
    value: brand[m.k as keyof BrandClickBreakdown] as number,
  }));
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      <div className="flex items-baseline gap-3">
        <div className="font-serif text-[20px] text-[color:var(--ink-muted)]">
          #{rank}
        </div>
        <div className="min-w-0 flex-1 truncate font-serif text-[16px] text-[var(--ink)]">
          {brand.brand}
        </div>
        <div className="text-right">
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("merchant.contentMetricTotal")}
          </div>
          <div className="font-serif text-[22px] leading-none text-[var(--ink)]">
            {brand.totalCount}
          </div>
        </div>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[var(--canvas-raised)]">
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={s.key}
              className="bg-[var(--ink)]"
              style={{
                width: `${pct}%`,
                opacity: SEGMENT_OPACITIES[i],
              }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-label text-[11px] text-[color:var(--ink-muted)]">
        {segments.map((s, i) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm bg-[var(--ink)]"
              style={{ opacity: SEGMENT_OPACITIES[i] }}
            />
            {s.label}: <span className="text-[var(--ink)]">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BrandStatsTable({ rows }: { rows: BrandClickBreakdown[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-label text-[12px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[color:var(--ink-muted)]">
            <th className="py-2 text-left font-normal">#</th>
            <th className="py-2 text-left font-normal">
              {t("merchant.contentMetricTotal")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricWant")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricFavorite")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricLike")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricComment")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricView")}
            </th>
            <th className="py-2 pl-3 text-right font-normal">
              {t("merchant.contentMetricTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.brand}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 text-[color:var(--ink-muted)]">{i + 1}</td>
              <td className="py-2 truncate text-[var(--ink)]">{r.brand}</td>
              <td className="py-2 text-right text-[var(--ink)]">
                {r.wantCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {r.favoriteCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {r.likeCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {r.commentCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {r.viewCount}
              </td>
              <td className="py-2 pl-3 text-right font-serif text-[14px] text-[var(--ink)]">
                {r.totalCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopProductsTable({ items }: { items: TopProductItem[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-label text-[12px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[color:var(--ink-muted)]">
            <th className="py-2 text-left font-normal">#</th>
            <th className="py-2 text-left font-normal">
              {t("merchant.contentColProduct")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricWant")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricFavorite")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricLike")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricComment")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("merchant.contentMetricView")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr
              key={p.id}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 text-[color:var(--ink-muted)]">{i + 1}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <ProductThumb url={p.coverImage} alt={p.title} />
                  <div className="min-w-0">
                    <div className="truncate text-[var(--ink)]">{p.title}</div>
                    {p.brand && (
                      <div className="truncate text-[10px] text-[color:var(--ink-muted)]">
                        {p.brand}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2 text-right font-serif text-[14px] text-[var(--ink)]">
                {p.wantCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {p.favoriteCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {p.likeCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {p.commentCount}
              </td>
              <td className="py-2 text-right text-[var(--ink)]">
                {p.viewCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductThumb({ url, alt }: { url?: string | null; alt: string }) {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return (
      <Image
        src={url}
        alt={alt}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded object-cover"
      />
    );
  }
  return (
    <div className="h-8 w-8 shrink-0 rounded bg-[var(--canvas-raised)]" />
  );
}
