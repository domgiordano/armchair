import type { CSSProperties } from "react";

export interface Bar {
  label: string;
  value: number;
  count: number;
}

const W = 320;
const H = 150;
const PAD = { left: 26, right: 10, top: 12, bottom: 22 };

/**
 * Points off per episode, lower is better, so the axis runs 0 at the bottom.
 * The top is the next whole point above the worst week, so a good season
 * doesn't look flat against a fixed 0-9 scale.
 */
export function TrendChart({ points }: { points: { label: string; mae: number }[] }) {
  const top = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.mae))));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const y = (v: number) => PAD.top + ((top - v) * plotH) / top;
  const ticks = Array.from({ length: top + 1 }, (_, i) => i).filter((t) => top <= 4 || t % 2 === 0);
  const path = points.map((p, i) => `${x(i)},${y(p.mae)}`).join(" ");
  const area = `${x(0)},${y(0)} ${path} ${x(points.length - 1)},${y(0)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Points off per episode: ${points.map((p) => `${p.label} ${p.mae.toFixed(2)}`).join(", ")}`}
      className="w-full text-silver-dim"
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.18} />
          <text x={PAD.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
            {t}
          </text>
        </g>
      ))}
      {points.length > 1 && (
        <polygon points={area} fill="url(#trend-fill)" className="animate-fade-in [animation-delay:700ms] [animation-duration:600ms]" />
      )}
      <polyline
        points={path}
        pathLength={1}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={2}
        strokeLinejoin="round"
        className="draw"
      />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle
            cx={x(i)}
            cy={y(p.mae)}
            r={3}
            fill="var(--color-gold)"
            stroke="var(--color-ink)"
            strokeWidth={1.5}
            className="pop"
            style={{ "--d": `${200 + (i / Math.max(1, points.length - 1)) * 900}ms` } as CSSProperties}
          >
            <title>{`${p.label}: ${p.mae.toFixed(2)} off`}</title>
          </circle>
          <text
            x={x(i)}
            y={H - 6}
            fontSize={9}
            fill="currentColor"
            textAnchor={points.length > 1 && i === 0 ? "start" : points.length > 1 && i === points.length - 1 ? "end" : "middle"}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Horizontal bars on a shared 0-based scale, labelled directly. The closest bar is highlighted. */
export function BarList({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(...bars.map((b) => b.value), 0.01);
  const best = Math.min(...bars.map((b) => b.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {bars.map((b, i) => (
        <li key={b.label} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-pearl">{b.label}</span>
            <span className="shrink-0 text-silver-dim tabular-nums">
              <span className="text-pearl">{b.value.toFixed(2)}</span> off · {b.count}
            </span>
          </span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-silver/10">
            <span
              className={`grow-x block h-full rounded-full ${b.value === best ? "bg-gradient-to-r from-gold-deep to-gold-light" : "bg-silver-dim/70"}`}
              style={{ width: `${Math.max(2, (b.value / max) * 100)}%`, "--d": `${i * 60}ms` } as CSSProperties}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

const HW = 320;
const HH = 140;
const HPAD = { left: 8, right: 8, top: 10, bottom: 18 };

/** Paired columns per paddle value: yours in gold, the judges' in silver, as shares of each. */
export function Histogram({ bins }: { bins: { value: number; mine: number; judges: number }[] }) {
  const top = Math.max(...bins.flatMap((b) => [b.mine, b.judges]), 0.01);
  const slot = (HW - HPAD.left - HPAD.right) / bins.length;
  const barW = slot * 0.36;
  const plotH = HH - HPAD.top - HPAD.bottom;
  const h = (v: number) => (v / top) * plotH;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <svg
      viewBox={`0 0 ${HW} ${HH}`}
      role="img"
      aria-label={`Share of scores at each value, you then judges: ${bins
        .filter((b) => b.mine || b.judges)
        .map((b) => `${b.value}: ${pct(b.mine)} and ${pct(b.judges)}`)
        .join(", ")}`}
      className="w-full text-silver-dim"
    >
      <line
        x1={HPAD.left}
        x2={HW - HPAD.right}
        y1={HH - HPAD.bottom}
        y2={HH - HPAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.3}
      />
      {bins.map((b, i) => {
        const cx = HPAD.left + slot * i + slot / 2;
        const base = HH - HPAD.bottom;
        return (
          <g key={b.value}>
            <rect
              x={cx - barW - 0.5}
              y={base - h(b.mine)}
              width={barW}
              height={h(b.mine)}
              rx={1.5}
              fill="var(--color-gold)"
              className="grow-y"
              style={{ "--d": `${i * 50}ms` } as CSSProperties}
            >
              <title>{`${b.value}: you ${pct(b.mine)}`}</title>
            </rect>
            <rect
              x={cx + 0.5}
              y={base - h(b.judges)}
              width={barW}
              height={h(b.judges)}
              rx={1.5}
              fill="var(--color-silver-dim)"
              className="grow-y"
              style={{ "--d": `${i * 50 + 120}ms` } as CSSProperties}
            >
              <title>{`${b.value}: judges ${pct(b.judges)}`}</title>
            </rect>
            <text x={cx} y={HH - 5} fontSize={9} textAnchor="middle" fill="currentColor">
              {b.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <p className="flex gap-4 text-xs text-silver-dim">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block size-2.5 rounded-sm ${i.swatch}`} />
          {i.label}
        </span>
      ))}
    </p>
  );
}
