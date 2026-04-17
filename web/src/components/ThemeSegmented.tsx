"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/*
 * Three-mode Appearance control (Light / System / Dark).
 *
 * Why segmented instead of a simple icon toggle:
 *   1. Exposes the "system" option that ThemeProvider already supports via
 *      `enableSystem` — a plain icon toggle forces users into an explicit
 *      light/dark choice and loses the OS-following behavior.
 *   2. The selected state makes it obvious which mode is currently active,
 *      which is not the case with a single icon that only hints at "the
 *      mode you'd switch to" (a common UX pitfall).
 *
 * Design language: square-ish 4 px radius pills, Playfair small-caps labels,
 * hairline borders — matches the editorial look used across the site.
 */

const MODES = [
  { key: "light",  label: "Light",  icon: SunIcon },
  { key: "system", label: "Auto",   icon: SystemIcon },
  { key: "dark",   label: "Dark",   icon: MoonIcon },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const active: ModeKey | null = mounted ? ((theme as ModeKey | undefined) ?? "system") : null;

  return (
    <div
      role="radiogroup"
      aria-label="外观模式 Appearance"
      className="inline-flex items-center rounded border p-0.5
                 border-black/[0.08] bg-black/[0.02]
                 dark:border-white/[0.10] dark:bg-white/[0.03]"
    >
      {MODES.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(key)}
            className={[
              "inline-flex h-7 items-center gap-1.5 rounded-[3px] px-2.5",
              "font-label text-[10px] uppercase tracking-[0.15em]",
              "transition-colors duration-200",
              isActive
                ? "bg-white text-black shadow-sm dark:bg-white/10 dark:text-white"
                : "text-black/40 hover:text-black dark:text-white/35 dark:hover:text-white",
            ].join(" ")}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5"  />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"  />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"  />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="17" x2="12" y2="20" />
    </svg>
  );
}
