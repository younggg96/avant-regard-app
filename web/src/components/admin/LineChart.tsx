"use client";

/**
 * Minimal monochrome SVG line chart.
 * No external dependencies — just path math.
 */

import { useMemo, useState } from "react";

export interface ChartLine {
  key: string;
  label: string;
  values: number[];
}

interface Props {
  labels: string[];
  lines: ChartLine[];
  height?: number;
}

const STROKES = [
  "var(--ink)",
  "var(--ink-muted)",
  "var(--border)",
];

const DASH_PATTERNS = [
  "none",
  "4 3",
  "2 2",
];

export function LineChart({ labels, lines, height = 200 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { maxVal, points, xStep } = useMemo(() => {
    const allVals = lines.flatMap((l) => l.values);
    const max = Math.max(...allVals, 1);
    const count = labels.length;
    const padLeft = 0;
    const padRight = 0;
    const usableW = 100 - padLeft - padRight;
    const step = count > 1 ? usableW / (count - 1) : usableW;

    const pts = lines.map((line) =>
      line.values.map((v, i) => ({
        x: padLeft + i * step,
        y: 100 - (v / max) * 85 - 8,
      })),
    );

    return { maxVal: max, points: pts, xStep: step };
  }, [labels, lines]);

  const makePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  };

  const formatLabel = (s: string) => {
    const parts = s.split("-");
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : s;
  };

  const xLabelsEvery = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <div className="font-label">
      <div className="flex items-center gap-4 mb-3">
        {lines.map((line, i) => (
          <div key={line.key} className="flex items-center gap-1.5 text-[11px] text-[color:var(--ink-muted)]">
            <svg width="16" height="2">
              <line
                x1="0" y1="1" x2="16" y2="1"
                stroke={STROKES[i % STROKES.length]}
                strokeWidth="1.5"
                strokeDasharray={DASH_PATTERNS[i % DASH_PATTERNS.length]}
              />
            </svg>
            {line.label}
          </div>
        ))}
      </div>

      <div
        className="relative"
        style={{ height }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width * 100;
            const idx = Math.round(pct / xStep);
            setHoverIdx(Math.max(0, Math.min(labels.length - 1, idx)));
          }}
        >
          {/* grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = 100 - pct * 85 - 8;
            return (
              <line
                key={pct}
                x1="0" y1={y} x2="100" y2={y}
                stroke="var(--border)"
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* lines */}
          {points.map((pts, i) => (
            <path
              key={lines[i].key}
              d={makePath(pts)}
              fill="none"
              stroke={STROKES[i % STROKES.length]}
              strokeWidth="1.5"
              strokeDasharray={DASH_PATTERNS[i % DASH_PATTERNS.length]}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* hover column */}
          {hoverIdx !== null && (
            <line
              x1={hoverIdx * xStep}
              y1="0"
              x2={hoverIdx * xStep}
              y2="100"
              stroke="var(--ink-muted)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          )}

        </svg>

        {/* dots on hover — rendered outside SVG to avoid non-uniform scaling distortion */}
        {hoverIdx !== null &&
          points.map((pts, i) =>
            pts[hoverIdx] ? (
              <span
                key={lines[i].key}
                className="pointer-events-none absolute h-[7px] w-[7px] rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${pts[hoverIdx].x}%`,
                  top: `${pts[hoverIdx].y}%`,
                  backgroundColor: STROKES[i % STROKES.length],
                }}
              />
            ) : null,
          )}

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between py-1 text-[10px] text-[color:var(--ink-muted)] pointer-events-none">
          <span>{maxVal}</span>
          <span>{Math.round(maxVal / 2)}</span>
          <span>0</span>
        </div>

        {/* tooltip */}
        {hoverIdx !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded border border-[var(--border)] bg-[var(--canvas)] px-2.5 py-1.5 text-[11px] shadow-soft"
            style={{
              left: `${Math.min(80, Math.max(5, (hoverIdx / (labels.length - 1 || 1)) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-[color:var(--ink-muted)]">{formatLabel(labels[hoverIdx])}</div>
            {lines.map((line, i) => (
              <div key={line.key}>
                {line.label}: {line.values[hoverIdx]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between text-[10px] text-[color:var(--ink-muted)]">
        {labels.map((l, i) =>
          i % xLabelsEvery === 0 || i === labels.length - 1 ? (
            <span key={i}>{formatLabel(l)}</span>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}
