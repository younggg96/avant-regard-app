"use client";

/**
 * Vertical sidebar nav for /me and /settings sections.
 *
 * Driven by a flat config so new sub-pages (reports, blocked) can be added
 * with one line. Highlight logic uses `startsWith` so nested pages like
 * `/me/chats/123` still light up their parent entry.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MeNavItem {
  href: string;
  label: string;
  group?: string;
}

export function MeNav({ items }: { items: MeNavItem[] }) {
  const pathname = usePathname();

  const groups = items.reduce<Record<string, MeNavItem[]>>((acc, it) => {
    const g = it.group ?? "";
    (acc[g] ||= []).push(it);
    return acc;
  }, {});

  return (
    <nav className="sticky top-20 flex flex-col gap-6 pr-6 font-label text-[13px]">
      {Object.entries(groups).map(([group, list]) => (
        <div key={group}>
          {group && (
            <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
              {group}
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {list.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/me" && pathname?.startsWith(it.href));
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
