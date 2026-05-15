"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

/**
 * Hero headline phrases — every line follows the pattern `为 X / 而生的 Y。`
 * and is kept at the same character count so the two-line layout stays
 * perfectly stable during the crossfade (no reflow / no jumping baselines).
 */
type Phrase = readonly [string, string];

const PHRASES: ReadonlyArray<Phrase> = [
  ["为先锋时装", "而生的社区。"],
  ["为独立设计", "而生的档案。"],
  ["为小众美学", "而生的入口。"],
  ["为日常穿搭", "而生的灵感。"],
  ["为秀场现场", "而生的记忆。"],
];

const HOLD_MS = 3000;
const FADE_MS = 700;

interface RotatingHeadlineProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Drop-in replacement for the hero `<h1>`. Cycles through {@link PHRASES}
 * with a soft opacity + translate crossfade, respects `prefers-reduced-motion`
 * via the global CSS rule, and degrades gracefully on the server (the first
 * phrase is rendered as the visible layer on both server and client).
 */
export function RotatingHeadline({ className = "", style }: RotatingHeadlineProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const phrases: ReadonlyArray<Phrase> = [
    [t("marketing.rotatingPhrase1Top"), t("marketing.rotatingPhrase1Bottom")],
    [t("marketing.rotatingPhrase2Top"), t("marketing.rotatingPhrase2Bottom")],
    [t("marketing.rotatingPhrase3Top"), t("marketing.rotatingPhrase3Bottom")],
    [t("marketing.rotatingPhrase4Top"), t("marketing.rotatingPhrase4Bottom")],
    [t("marketing.rotatingPhrase5Top"), t("marketing.rotatingPhrase5Bottom")],
  ];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, HOLD_MS + FADE_MS);
    return () => window.clearInterval(id);
  }, [phrases.length]);

  return (
    <h1
      className={`relative ${className}`}
      style={style}
      aria-label={phrases[0].join("")}
    >
      <span aria-hidden className="invisible block">
        <span className="block whitespace-nowrap">{phrases[0][0]}</span>
        <span className="block whitespace-nowrap">{phrases[0][1]}</span>
      </span>

      {phrases.map(([top, bottom], i) => {
        const active = i === index;
        return (
          <span
            key={i}
            aria-hidden={!active}
            className="absolute inset-0 transition-[opacity,transform] ease-out will-change-transform"
            style={{
              transitionDuration: `${FADE_MS}ms`,
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0)" : "translateY(14px)",
            }}
          >
            <span className="block whitespace-nowrap">{top}</span>
            <span className="block whitespace-nowrap">{bottom}</span>
          </span>
        );
      })}
    </h1>
  );
}
