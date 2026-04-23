"use client";

import { useEffect, useState } from "react";
import {
  postsApi,
  commentsApi,
  usersApi,
  reportsApi,
  statsApi,
  type AdminPost,
  type GrowthPoint,
  type DemographicsResponse,
} from "@/lib/services/admin";
import { PageHeader, LoadingState } from "@/components/admin/ui";
import { LineChart } from "@/components/admin/LineChart";

interface StatCard {
  label: string;
  value: number | string;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "男", FEMALE: "女", OTHER: "未设置",
};
const GENDER_COLOR: Record<string, string> = {
  MALE: "var(--ink)", FEMALE: "var(--ink-muted)", OTHER: "var(--border)",
};

function GenderPie({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const radius = 40;
  const cx = 50;
  const cy = 50;
  let startAngle = -90;

  const slices = entries.map(([key, val]) => {
    const pct = val / total;
    const angle = pct * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const rad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(rad(startAngle));
    const y1 = cy + radius * Math.sin(rad(startAngle));
    const x2 = cx + radius * Math.cos(rad(endAngle));
    const y2 = cy + radius * Math.sin(rad(endAngle));
    const d = `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
    startAngle = endAngle;
    return { key, val, pct, d };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-[120px] w-[120px] shrink-0">
        {slices.map((s) => (
          <path key={s.key} d={s.d} fill={GENDER_COLOR[s.key] ?? "var(--border)"} />
        ))}
      </svg>
      <div className="space-y-1.5 font-label text-[12px]">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: GENDER_COLOR[s.key] ?? "var(--border)" }}
            />
            <span>{GENDER_LABEL[s.key] ?? s.key}</span>
            <span className="text-[color:var(--ink-muted)]">
              {s.val} ({Math.round(s.pct * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((r) => r.count), 1);
  return (
    <div className="space-y-1.5 font-label text-[12px]">
      {items.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-right text-[color:var(--ink-muted)]">
            {r.name}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--canvas-raised)]">
            <div
              className="absolute inset-y-0 left-0 rounded bg-[var(--ink)]"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 tabular-nums text-[color:var(--ink-muted)]">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [pendingPosts, setPendingPosts] = useState<AdminPost[]>([]);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [demo, setDemo] = useState<DemographicsResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pending, allPosts, comments, users, reports, growthData, demoData] =
          await Promise.allSettled([
            postsApi.getPending(),
            postsApi.getAll({ page: 1, pageSize: 1 }),
            commentsApi.getAll(1, 1),
            usersApi.getAll(undefined, 1, 1),
            reportsApi.getAll("PENDING", 1, 1),
            statsApi.getGrowth(30),
            statsApi.getDemographics(),
          ]);

        const pendingCount = pending.status === "fulfilled" ? pending.value.length : 0;
        const postsTotal = allPosts.status === "fulfilled" ? allPosts.value.total : 0;
        const commentsTotal = comments.status === "fulfilled" ? comments.value.total : 0;
        const usersTotal = users.status === "fulfilled" ? users.value.total : 0;
        const reportsTotal = reports.status === "fulfilled" ? reports.value.total : 0;

        if (pending.status === "fulfilled") {
          setPendingPosts(pending.value.slice(0, 5));
        }

        if (growthData.status === "fulfilled") {
          setGrowth(growthData.value.series);
        }

        if (demoData.status === "fulfilled") {
          setDemo(demoData.value);
        }

        setStats([
          { label: "待审核", value: pendingCount },
          { label: "帖子", value: postsTotal },
          { label: "评论", value: commentsTotal },
          { label: "用户", value: usersTotal },
          { label: "举报", value: reportsTotal },
        ]);
      } catch {
        /* partial data is fine */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const ageBrackets = demo?.ageBrackets ?? {};
  const ageBracketLabels = Object.keys(ageBrackets);
  const ageBracketValues = Object.values(ageBrackets);

  return (
    <div>
      <PageHeader title="管理面板" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[var(--border)] p-4"
          >
            <span className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {s.label}
            </span>
            <div className="mt-1.5 font-label text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {growth.length > 0 && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] p-5">
            <h2 className="mb-4 font-label text-[13px] text-[color:var(--ink-muted)]">
              累计用户数
            </h2>
            <LineChart
              labels={growth.map((g) => g.date)}
              lines={[
                { key: "totalUsers", label: "总用户", values: growth.map((g) => g.totalUsers) },
              ]}
              height={180}
            />
          </div>
          <div className="rounded-lg border border-[var(--border)] p-5">
            <h2 className="mb-4 font-label text-[13px] text-[color:var(--ink-muted)]">
              每日新增
            </h2>
            <LineChart
              labels={growth.map((g) => g.date)}
              lines={[
                { key: "users", label: "用户", values: growth.map((g) => g.users) },
                { key: "posts", label: "帖子", values: growth.map((g) => g.posts) },
                { key: "comments", label: "评论", values: growth.map((g) => g.comments) },
              ]}
              height={180}
            />
          </div>
        </div>
      )}

      {demo && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] p-5">
            <h2 className="mb-4 font-label text-[13px] text-[color:var(--ink-muted)]">
              性别分布
            </h2>
            <GenderPie data={demo.gender} />
          </div>
          <div className="rounded-lg border border-[var(--border)] p-5">
            <h2 className="mb-4 font-label text-[13px] text-[color:var(--ink-muted)]">
              年龄分布
            </h2>
            <LineChart
              labels={ageBracketLabels}
              lines={[{ key: "age", label: "人数", values: ageBracketValues }]}
              height={160}
            />
          </div>
          <div className="rounded-lg border border-[var(--border)] p-5">
            <h2 className="mb-4 font-label text-[13px] text-[color:var(--ink-muted)]">
              地区分布 Top 15
            </h2>
            <BarChart items={demo.regions} />
          </div>
        </div>
      )}

      {pendingPosts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-label text-[13px] text-[color:var(--ink-muted)]">最新待审核</h2>
          <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {pendingPosts.map((post) => (
              <div key={post.id} className="flex items-center gap-4 px-4 py-3 font-label text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{post.title || "无标题"}</div>
                  <div className="text-[12px] text-[color:var(--ink-muted)]">
                    @{post.username} · {post.postType}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] text-[color:var(--ink-muted)]">
                  {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
