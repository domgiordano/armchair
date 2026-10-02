import type { CSSProperties } from "react";

import { formatScore } from "@/components/performance-card";
import type { OpenRow } from "@/lib/api/people";
import { paddle, weekShort } from "@/lib/show/couple";

const W = 320;
const H = 150;
const PAD = { left: 22, right: 10, top: 10, bottom: 20 };

const said = (n: number | null) => (n === null ? "not scored" : formatScore(n));

/** Your paddle and the judges' mean on each dance the gate has opened, on a fixed 1-10 scale. */
export function ScoreChart({ rows }: { rows: OpenRow[] }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (rows.length === 1 ? plotW / 2 : (i * plotW) / (rows.length - 1));
  const y = (v: number) => PAD.top + ((10 - v) * plotH) / 9;
  const at = (i: number) => `${250 + (i / Math.max(1, rows.length - 1)) * 900}ms`;
  const points = rows.map((r, i) => ({ r, i, you: paddle(r), judges: r.panelMean }));
  const judged = points.filter((p) => p.judges !== null);
  const yours = points.filter((p) => p.you !== null);
  const both = points.filter((p) => p.you !== null && p.judges !== null);
  const line = (ps: typeof points, pick: (p: (typeof points)[number]) => number | null) =>
    ps.map((p) => `${x(p.i)},${y(pick(p) ?? 0)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Your paddle and the judges' average: ${rows
        .map((r) => `${weekShort(r)}${r.style ? ` ${r.style}` : ""} you ${said(paddle(r))}, judges ${said(r.panelMean)}`)
        .join("; ")}`}
      className="w-full text-silver-dim"
    >
      {[2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.18} />
          <text x={PAD.left - 5} y={y(v)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
            {v}
          </text>
        </g>
      ))}
      {rows.map((r, i) => (
        <text
          key={`${r.ep}-${r.key}`}
          x={x(i)}
          y={H - 5}
          fontSize={9}
          fill="currentColor"
          textAnchor={rows.length > 1 && i === 0 ? "start" : rows.length > 1 && i === rows.length - 1 ? "end" : "middle"}
        >
          {weekShort(r)}
        </text>
      ))}
      {/* The gap on each dance, as a stem from the judges' mean to your paddle. */}
      {both.map((p) => (
        <line
          key={`gap-${p.r.ep}-${p.r.key}`}
          x1={x(p.i)}
          x2={x(p.i)}
          y1={y(p.judges ?? 0)}
          y2={y(p.you ?? 0)}
          stroke={(p.you ?? 0) >= (p.judges ?? 0) ? "var(--color-gold)" : "rgb(125 211 252)"}
          strokeOpacity={0.45}
          strokeWidth={3}
          strokeLinecap="round"
          className="animate-fade-in"
          style={{ animationDelay: at(p.i) }}
        />
      ))}
      {judged.length > 1 && (
        <polyline points={line(judged, (p) => p.judges)} pathLength={1} fill="none" stroke="currentColor" strokeWidth={1.5} className="draw" />
      )}
      {judged.map((p) => (
        <circle key={`j-${p.r.ep}-${p.r.key}`} cx={x(p.i)} cy={y(p.judges ?? 0)} r={2.5} fill="currentColor" className="pop" style={{ "--d": at(p.i) } as CSSProperties} />
      ))}
      {yours.length > 1 && (
        <polyline
          points={line(yours, (p) => p.you)}
          pathLength={1}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={2}
          strokeLinejoin="round"
          className="draw"
          style={{ "--d": "250ms" } as CSSProperties}
        />
      )}
      {yours.map((p) => (
        <circle
          key={`y-${p.r.ep}-${p.r.key}`}
          cx={x(p.i)}
          cy={y(p.you ?? 0)}
          r={3.5}
          fill="var(--color-gold)"
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          className="pop"
          style={{ "--d": at(p.i) } as CSSProperties}
        >
          <title>{`${weekShort(p.r)}${p.r.style ? ` ${p.r.style}` : ""}: you ${said(p.you)}, judges ${said(p.judges)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
