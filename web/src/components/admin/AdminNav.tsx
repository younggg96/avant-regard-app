"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

interface AdminNavItem {
  href: string;
  labelKey: string;
  groupKey: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin",                labelKey: "admin.overview",         groupKey: "admin.navGroupDashboard" },

  { href: "/admin/posts/pending",  labelKey: "admin.pendingPosts",     groupKey: "admin.navGroupContent" },
  { href: "/admin/posts",          labelKey: "admin.postsManagement",  groupKey: "admin.navGroupContent" },
  { href: "/admin/comments",       labelKey: "admin.comments",         groupKey: "admin.navGroupContent" },

  { href: "/admin/users",          labelKey: "admin.users",            groupKey: "admin.navGroupUsers" },
  { href: "/admin/reports",        labelKey: "admin.reports",          groupKey: "admin.navGroupUsers" },
  { href: "/admin/levels",         labelKey: "admin.levels",           groupKey: "admin.navGroupUsers" },
  { href: "/admin/lottery",        labelKey: "admin.lottery",          groupKey: "admin.navGroupUsers" },

  { href: "/admin/communities",    labelKey: "admin.communities",      groupKey: "admin.navGroupCommunity" },
  { href: "/admin/brands",         labelKey: "admin.brands",           groupKey: "admin.navGroupCommunity" },
  { href: "/admin/brands/submissions", labelKey: "admin.brandSubmissions", groupKey: "admin.navGroupCommunity" },
  { href: "/admin/brands/images",  labelKey: "admin.brandImages",      groupKey: "admin.navGroupCommunity" },
  { href: "/admin/styles",         labelKey: "admin.styles",           groupKey: "admin.navGroupCommunity" },

  { href: "/admin/shows",          labelKey: "admin.shows",            groupKey: "admin.navGroupShows" },
  { href: "/admin/shows/review",   labelKey: "admin.showReview",       groupKey: "admin.navGroupShows" },
  { href: "/admin/stores",         labelKey: "admin.stores",           groupKey: "admin.navGroupShows" },

  { href: "/admin/banners",        labelKey: "admin.banners",          groupKey: "admin.navGroupOps" },
  { href: "/admin/broadcast",      labelKey: "admin.broadcast",        groupKey: "admin.navGroupOps" },
  { href: "/admin/customer-service", labelKey: "admin.customerService", groupKey: "admin.navGroupOps" },
  { href: "/admin/recommend",      labelKey: "admin.recommend",        groupKey: "admin.navGroupOps" },
  { href: "/admin/ai-prompts",     labelKey: "admin.aiPrompts.menu",   groupKey: "admin.navGroupOps" },
  { href: "/admin/maintenance",    labelKey: "admin.maintenance",      groupKey: "admin.navGroupOps" },
];

export function AdminNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const groups = ADMIN_NAV.reduce<Record<string, AdminNavItem[]>>((acc, it) => {
    const groupLabel = t(it.groupKey);
    (acc[groupLabel] ||= []).push(it);
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
                    {t(it.labelKey)}
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
