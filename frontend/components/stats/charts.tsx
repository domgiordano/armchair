import type { CSSProperties, ReactNode } from "react";

import { formatScore } from "@/components/performance-card";
import { cn } from "@/lib/ui";

/** Line colours in draw order: gold is always the first series, which is you or your group. */
export const SERIES = [
  "var(--color-gold)",
  "#8ea2ff",
  "var(--color-brand-magenta)",
  "#5fd3b5",
  "var(--color-brand-orange)",
  "var(--color-silver)",
  "#c08bff",
  "var(--color-crown)",
];

export interface Series {
  id: string;
  label: string;
  values: (number | null)[];
  color?: string;
  dashed?: boolean;
}

const W = 340;
const PAD = { left: 26, right: 10, top: 10, bottom: 22 };

interface LineChartProps {
  label: string;
  /** One per point, under the axis; thinned on a crowded axis. */
  ticks: string[];
  series: Series[];
  domain: [number, number];
  /** Rank charts: 1 at the top. */
  invert?: boolean;
  height?: number;
  format?: (v: number) => string;
}

/**
 * Lines over shared x ticks, breaking where a value is missing. SVG on a fixed
 * viewBox at full width, so it scales to any card without scrolling.
 */
export function LineChart({ label, ticks, series, domain, invert = false, height = 170, format = formatScore }: LineChartProps) {
  const [lo, hi] = domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain;
  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = ticks.length;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + (invert ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)) * plotH;
  const grid = gridLines(lo, hi);
  const every = Math.ceil(n / 8);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="w-full text-silver-dim">
      {grid.map((g) => (
        <g key={g}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.16} />
          <text x={PAD.left - 5} y={y(g)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
            {invert ? `#${g}` : Number.isInteger(g) ? g : g.toFixed(1)}
          </text>
        </g>
      ))}
      {ticks.map((t, i) =>
        i % every === 0 || i === n - 1 ? (
          <text
            key={`${t}-${i}`}
            x={x(i)}
            y={height - 6}
            fontSize={9}
            fill="currentColor"
            textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}
          >
            {t}
          </text>
        ) : null,
      )}
      {series.map((s, k) => {
        const color = s.color ?? SERIES[k % SERIES.length];
        return (
          <g key={s.id} style={{ color }}>
            {segments(s.values).map((run) => (
              <polyline
                key={run[0]}
                points={run.map((i) => `${x(i)},${y(s.values[i] as number)}`).join(" ")}
                // The draw-in animation dashes a path of length 1, which would swallow a real dash pattern.
                pathLength={s.dashed ? undefined : 1}
                fill="none"
                stroke="currentColor"
                strokeWidth={k === 0 ? 2.25 : 1.75}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                strokeLinejoin="round"
                className={s.dashed ? "animate-fade-in" : "draw"}
                style={{ "--d": `${k * 120}ms` } as CSSProperties}
              />
            ))}
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={k === 0 ? 3 : 2.25} fill="currentColor" stroke="var(--color-ink)" strokeWidth={1}>
                  <title>{`${s.label}, ${ticks[i]}: ${invert ? `#${v}` : format(v)}`}</title>
                </circle>
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Indexes of each unbroken run of values. */
function segments(values: (number | null)[]): number[][] {
  const runs: number[][] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const last = runs.at(-1);
    if (last && last.at(-1) === i - 1) last.push(i);
    else runs.push([i]);
  });
  return runs;
}

function gridLines(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 2 ? 0.5 : span <= 5 ? 1 : span <= 12 ? 2 : Math.ceil(span / 5);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-dim">
      {series.map((s, k) => (
        <li key={s.id} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 shrink-0 rounded-full"
            style={{ background: s.color ?? SERIES[k % SERIES.length] }}
          />
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface Lean {
  key: string;
  label: ReactNode;
  value: number;
  note?: string;
}

/**
 * Bars either side of zero: above the judges to the right in gold, below to
 * the left in blue. For "scores higher or lower than the judges" by anything.
 */
export function DivergingBars({ rows, label }: { rows: Lean[]; label: string }) {
  const max = Math.max(0.5, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {rows.map((r, i) => {
        const width = `${(Math.abs(r.value) / max) * 50}%`;
        return (
          <li key={r.key} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-pearl">{r.label}</span>
              <span className="shrink-0 text-silver-dim tabular-nums">
                <span className="text-pearl">{signed(r.value)}</span>
                {r.note && ` · ${r.note}`}
              </span>
            </span>
            <span aria-hidden="true" className="relative h-2 rounded-full bg-silver/10">
              <span className="absolute inset-y-[-2px] left-1/2 w-px bg-silver-dim/50" />
              <span
                className={cn("grow-x absolute inset-y-0 rounded-full", r.value >= 0 ? "left-1/2 bg-gold" : "right-1/2 bg-[#8ea2ff]")}
                style={{ width, "--d": `${i * 50}ms` } as CSSProperties}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "+0.42", "-1.10", "0.00": a gap with its direction. */
export const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(2)}`;

/** Gold above the judges, blue below, stronger the further off; a point is full strength. */
export function deltaColor(d: number | null): string | undefined {
  if (d === null) return undefined;
  const a = 0.18 + Math.min(1, Math.abs(d)) * 0.77;
  return d >= 0 ? `rgb(232 194 104 / ${a})` : `rgb(126 150 255 / ${a})`;
}

export function DeltaScale() {
  return (
    <p className="flex items-center gap-2 text-xs text-silver-dim">
      <span>Below the judges</span>
      <span
        aria-hidden="true"
        className="h-2 flex-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${deltaColor(-1)}, ${deltaColor(0)}, ${deltaColor(1)})` }}
      />
      <span>Above</span>
    </p>
  );
}

export interface HeatRow {
  id: string;
  label: ReactNode;
  cells: ({ value: number | null; title: string } | null)[];
}

/**
 * Rows by columns of colour: one row per couple, one column per week. A real
 * table, fixed layout at full width, so it never pushes the page sideways;
 * the numbers show from sm up and live in each cell's title below that.
 */
export function Heatmap({ rows, cols, caption }: { rows: HeatRow[]; cols: string[]; caption: string }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0.5 text-[10px] sm:text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="w-[34%] sm:w-44">
            <span className="sr-only">Couple</span>
          </th>
          {cols.map((c) => (
            <th key={c} scope="col" className="truncate pb-1 text-center font-normal text-silver-dim">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row" className="truncate pr-1 text-left font-normal text-pearl">
              {r.label}
            </th>
            {r.cells.map((c, i) => (
              <td
                key={i}
                title={c?.title}
                className={cn(
                  "h-7 rounded-sm text-center tabular-nums",
                  !c && "bg-silver/[0.04]",
                  c && c.value !== null && c.value > 0.6 ? "text-ink" : "text-pearl",
                )}
                // A week with too few raters to show is striped, unlike a week the couple didn't dance.
                style={{
                  background: c
                    ? (deltaColor(c.value) ??
                      "repeating-linear-gradient(135deg, rgb(213 219 234 / 0.12) 0 3px, transparent 3px 6px)")
                    : undefined,
                }}
              >
                <span aria-hidden="true" className="hidden sm:inline">
                  {c && c.value !== null ? signed(c.value) : ""}
                </span>
                {c && <span className="sr-only">{c.title}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
