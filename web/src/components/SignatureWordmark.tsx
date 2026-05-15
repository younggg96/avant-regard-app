"use client";

import { useMemo, type CSSProperties } from "react";

/**
 * Cinematic brand wordmark used as the homepage "wow" moment.
 *
 * Each glyph is composed of four overlapping layers:
 *  - a top-half slice that drops in from above
 *  - a bottom-half slice that lifts in from below
 *  - 3 ghost shard copies that converge from random directions
 *
 * On hover, the converged shards displace by their shard vector,
 * giving the wordmark a soft "shatter" without disrupting the
 * primary glyph silhouette. All entrance animation is CSS-only
 * (works during SSR, respects `prefers-reduced-motion`).
 */

interface Shard {
  dx: number;
  dy: number;
  rot: number;
  opacity: number;
}

/** Deterministic pseudo-random shards so SSR & client markup match. */
function makeShards(seed: number, count = 3): Shard[] {
  const r = (n: number) => {
    const x = Math.sin(seed * 9301.17 + n * 49297.31 + 1.61803) * 233280;
    return x - Math.floor(x);
  };
  return Array.from({ length: count }, (_, i) => ({
    dx: (r(i * 4 + 1) - 0.5) * 22,
    dy: (r(i * 4 + 2) - 0.5) * 16,
    rot: (r(i * 4 + 3) - 0.5) * 7,
    opacity: 0.1 + r(i * 4 + 4) * 0.18,
  }));
}

export interface SignatureWordmarkProps {
  text?: string;
  className?: string;
}

export function SignatureWordmark({
  text = "AVANT REGARD",
  className = "",
}: SignatureWordmarkProps) {
  const chars = useMemo(() => Array.from(text), [text]);
  const shardsByChar = useMemo(
    () => chars.map((_, i) => makeShards(i + 1)),
    [chars]
  );

  return (
    <h1
      className={`signature-wordmark relative font-serif italic font-bold leading-[0.95] tracking-[-0.025em] text-black dark:text-white ${className}`}
      aria-label={text}
    >
      <span className="block whitespace-nowrap text-center" aria-hidden>
        {chars.map((char, i) => {
          if (char === " ") {
            return (
              <span key={i} className="inline-block w-[0.42em]">
                {" "}
              </span>
            );
          }
          return (
            <CharShatter
              key={i}
              char={char}
              shards={shardsByChar[i]}
              stagger={i * 65}
            />
          );
        })}
      </span>
    </h1>
  );
}

interface CharShatterProps {
  char: string;
  shards: Shard[];
  stagger: number;
}

function CharShatter({ char, shards, stagger }: CharShatterProps) {
  return (
    <span className="relative inline-block">
      {/* Layout spacer keeps the line height stable */}
      <span aria-hidden className="invisible block">
        {char}
      </span>

      {shards.map((shard, j) => {
        const outerStyle: CSSProperties = {
          ["--shard-x" as never]: `${shard.dx * 6}px`,
          ["--shard-y" as never]: `${shard.dy * 6}px`,
          ["--shard-r" as never]: `${shard.rot * 5}deg`,
          ["--shard-o" as never]: `${shard.opacity}`,
          animation: `signature-shard-in 1100ms ${
            stagger + j * 30
          }ms cubic-bezier(0.2,0.8,0.25,1) both`,
        };
        const innerStyle: CSSProperties = {
          ["--hover-x" as never]: `${shard.dx}px`,
          ["--hover-y" as never]: `${shard.dy}px`,
          ["--hover-r" as never]: `${shard.rot}deg`,
        };
        return (
          <span
            key={j}
            aria-hidden
            className="signature-shard pointer-events-none absolute inset-0 will-change-transform"
            style={outerStyle}
          >
            <span
              className="signature-shard-hover block will-change-transform"
              style={innerStyle}
            >
              {char}
            </span>
          </span>
        );
      })}

      {/* Master glyph: top half slides down, bottom half slides up — they "click" together */}
      <span
        aria-hidden
        className="absolute inset-0 will-change-[transform,opacity]"
        style={{
          clipPath: "inset(0 0 50% 0)",
          animation: `signature-half-top 950ms ${stagger}ms cubic-bezier(0.2,0.8,0.25,1) both`,
        }}
      >
        {char}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 will-change-[transform,opacity]"
        style={{
          clipPath: "inset(50% 0 0 0)",
          animation: `signature-half-bottom 950ms ${stagger}ms cubic-bezier(0.2,0.8,0.25,1) both`,
        }}
      >
        {char}
      </span>

      {/* Hairline scar runs along the seam after the glyph settles, then dissolves */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-px origin-left bg-current opacity-20"
        style={{
          animation: `signature-seam 900ms ${
            stagger + 700
          }ms cubic-bezier(0.2,0.8,0.25,1) both`,
        }}
      />
    </span>
  );
}
