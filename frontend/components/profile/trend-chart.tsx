import type { CSSProperties } from "react";

import { formatScore } from "@/components/performance-card";

export interface TrendPoint {
  label: string;
  /** Under the axis: "W3". */
  short: string;
  /** Points off the judges' average; lower is closer. */
  value: number;
}

/**
 * The gap to the judges week by week as a line wiped in left to right, the
 * best week lit. The plot stretches to its box while labels and dots stay HTML,
 * so text keeps its size at any width. A table carries the numbers for screen readers.
 */
export function TrendChart({ points, caption }: { points: TrendPoint[]; caption: string }) {
  const top = Math.max(2, Math.ceil(Math.max(...points.map((p) => p.value)) * 1.1));
  // Percent of the plot box; a lone point sits in the middle.
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const best = points.reduce((b, p, i) => (p.value < points[b].value ? i : b), 0);
  // Every label at a phone's width would collide past about eight weeks.
  const every = Math.ceil(points.length / 8);

  return (
    <figure className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex gap-2">
        <div className="flex w-4 flex-col justify-between pb-6 text-right text-[10px] leading-none text-silver-dim tabular-nums">
          {[top, top / 2, 0].map((t) => (
            <span key={t} className="-translate-y-1/2 last:translate-y-1/2">
              {formatScore(t)}
            </span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="relative h-40 sm:h-48">
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2].map((t) => (
                <span key={t} className={t === 2 ? "h-px bg-silver-dim/50" : "h-px bg-silver-dim/15"} />
              ))}
            </div>
            {points.length > 1 && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="wipe absolute inset-0 size-full overflow-visible"
              >
                <defs>
                  <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.3" />
                    <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${line} L100,100 L0,100 Z`} fill="url(#trend-fill)" />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {points.map((p, i) => (
              <span
                key={i}
                className={
                  i === best
                    ? "pop absolute size-3 -translate-1/2 rounded-full bg-gold-light shadow-[0_0_14px_-1px_rgb(247_226_164/0.8)]"
                    : "pop absolute size-2.5 -translate-1/2 rounded-full border-2 border-gold bg-ink"
                }
                style={
                  {
                    left: `${x(i)}%`,
                    top: `${y(p.value)}%`,
                    "--d": `${200 + (x(i) / 100) * 900}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="relative h-4 text-[10px] leading-4 text-silver-dim">
            {points.map((p, i) =>
              i % every === 0 ? (
                <span key={i} className="absolute -translate-x-1/2" style={{ left: `${x(i)}%` }}>
                  {p.short}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <figcaption className="text-xs text-silver-dim">{caption}</figcaption>
      {/* On a div: a table ignores sr-only's 1px width and widens the page. */}
      <div className="sr-only">
        <table>
          <caption>Average points off the judges by week</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td>{formatScore(p.value)} off</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
