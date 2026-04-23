"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavItem {
  href: string;
  label: string;
  group: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin",                label: "概览",       group: "管理面板" },

  { href: "/admin/posts/pending",  label: "待审核帖子", group: "内容审核" },
  { href: "/admin/posts",          label: "帖子管理",   group: "内容审核" },
  { href: "/admin/comments",       label: "评论管理",   group: "内容审核" },

  { href: "/admin/users",          label: "用户管理",   group: "用户系统" },
  { href: "/admin/reports",        label: "举报管理",   group: "用户系统" },

  { href: "/admin/communities",    label: "社区管理",   group: "社区与品牌" },
  { href: "/admin/brands",         label: "品牌管理",   group: "社区与品牌" },
  { href: "/admin/brands/submissions", label: "品牌审核", group: "社区与品牌" },
  { href: "/admin/brands/images",  label: "品牌图片审核", group: "社区与品牌" },

  { href: "/admin/shows",          label: "秀场管理",   group: "秀场与买手店" },
  { href: "/admin/shows/review",   label: "秀场审核",   group: "秀场与买手店" },
  { href: "/admin/stores",         label: "买手店管理", group: "秀场与买手店" },

  { href: "/admin/banners",        label: "Banner",    group: "运营配置" },
  { href: "/admin/broadcast",      label: "广播通知",   group: "运营配置" },
  { href: "/admin/customer-service", label: "客服设置", group: "运营配置" },
  { href: "/admin/recommend",      label: "推荐配置",   group: "运营配置" },
  { href: "/admin/maintenance",    label: "维护模式",   group: "运营配置" },
];

export function AdminNav() {
  const pathname = usePathname();

  const groups = ADMIN_NAV.reduce<Record<string, AdminNavItem[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});

  const activeHref = ADMIN_NAV
    .filter((it) => pathname === it.href || pathname?.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const isActive = (href: string) => href === activeHref;

  return (
    <nav className="flex flex-col gap-5 font-label text-[13px]">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <div className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
            {group}
          </div>
          <ul className="flex flex-col gap-0.5">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`block rounded px-3 py-2 transition-colors ${
                      active
                        ? "bg-[var(--canvas-raised)] text-[var(--ink)]"
                        : "text-[color:var(--ink-muted)] hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
