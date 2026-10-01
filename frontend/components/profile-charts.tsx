import type { CSSProperties } from "react";

import { formatScore } from "@/components/performance-card";
import type { ScoreCount, StyleAccuracy } from "@/lib/profile/season-stats";

export const off = (mae: number) => `${formatScore(Math.round(mae * 10) / 10)} off`;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

interface StyleChartProps {
  styles: StyleAccuracy[];
}

/** One bar per style, shortest (closest to the judges) first. The list reads fine without the bars. */
export function StyleChart({ styles }: StyleChartProps) {
  // A floor of 2 keeps a season of near-misses from drawing every bar full width.
  const top = Math.max(2, ...styles.map((s) => s.mae));
  return (
    <ol className="flex flex-col gap-3">
      {styles.map((s, i) => (
        <li key={s.style} className="grid grid-cols-[minmax(0,7rem)_1fr_4.5rem] items-center gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-pearl">{s.style}</span>
            <span className="text-xs text-silver-dim">{plural(s.count, "dance")}</span>
          </span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-silver/10">
            <span
              className={`grow-x block h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-gold-deep to-gold-light" : "bg-silver-dim"}`}
              style={{ width: `${Math.max(3, (s.mae / top) * 100)}%`, "--d": `${i * 60}ms` } as CSSProperties}
            />
          </span>
          <span className="text-right text-sm tabular-nums">{off(s.mae)}</span>
        </li>
      ))}
    </ol>
  );
}

const W = 320;
const H = 150;
const PAD = { left: 18, right: 4, top: 8, bottom: 20 };

// "an 8", "a 7": only 8 starts with a vowel sound among 1-10.
const withArticle = (n: number) => `${n === 8 ? "an" : "a"} ${n}`;

function mostCommon(counts: ScoreCount[], pick: (c: ScoreCount) => number): number {
  return counts.reduce((a, b) => (pick(b) > pick(a) ? b : a)).score;
}

interface DistributionChartProps {
  counts: ScoreCount[];
}

/**
 * Paired columns for each paddle 1-10: your paddles filled, the judges'
 * average outlined, so the two read apart without colour. A table carries the
 * same numbers for screen readers.
 */
export function DistributionChart({ counts }: DistributionChartProps) {
  const top = Math.max(1, ...counts.map((c) => Math.max(c.you, c.judges)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / counts.length;
  const bar = slot * 0.36;
  const y = (n: number) => PAD.top + plotH - (n / top) * plotH;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, Math.round(top / 2), top];

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="w-full text-silver-dim">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.18} />
            <text x={PAD.left - 5} y={y(t)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
              {t}
            </text>
          </g>
        ))}
        {counts.map((c, i) => {
          const x = PAD.left + i * slot + slot / 2;
          return (
            <g key={c.score}>
              <rect
                x={x - bar - 1}
                y={y(c.you)}
                width={bar}
                height={y(0) - y(c.you)}
                rx={1.5}
                className="grow-y fill-gold"
                style={{ "--d": `${i * 50}ms` } as CSSProperties}
              >
                <title>{`Paddle ${c.score}: you ${c.you}`}</title>
              </rect>
              <rect
                x={x + 1.5}
                y={y(c.judges) + 0.75}
                width={bar - 1.5}
                height={Math.max(0, y(0) - y(c.judges) - 0.75)}
                rx={1.5}
                fill="none"
                strokeWidth={1.5}
                className="grow-y stroke-silver"
                style={{ "--d": `${i * 50 + 120}ms` } as CSSProperties}
              >
                <title>{`Paddle ${c.score}: judges' average ${c.judges}`}</title>
              </rect>
              <text x={x} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor">
                {c.score}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-silver-dim">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-sm bg-gold" />
          Your paddle
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-sm border-[1.5px] border-silver" />
          Judges&apos; average, rounded
        </span>
        <span className="w-full text-silver">
          You raise {withArticle(mostCommon(counts, (c) => c.you))} most often; the judges&apos; average lands on{" "}
          {mostCommon(counts, (c) => c.judges)} most.
        </span>
      </figcaption>
      {/* On a div: a table ignores sr-only's 1px width and widens the page. */}
      <div className="sr-only">
        <table>
          <caption>Paddles you gave and the judges&apos; average, by score</caption>
          <thead>
            <tr>
              <th scope="col">Paddle</th>
              <th scope="col">You</th>
              <th scope="col">Judges&apos; average</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => (
              <tr key={c.score}>
                <th scope="row">{c.score}</th>
                <td>{c.you}</td>
                <td>{c.judges}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
