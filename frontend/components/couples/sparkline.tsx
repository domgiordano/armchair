import type { WeekScore } from "@/lib/show/couples-board";

interface SparklineProps {
  weeks: WeekScore[];
  /** The board's week: the right edge, so every row's weeks line up. */
  through: number;
  /** The bottom of the scale, shared by every row so their lines compare. */
  floor: number;
  className?: string;
}

const W = 72;
const H = 24;
const PAD = 3;

/** A couple's weekly judges' mean, up to a perfect 10. Decorative: the row says the numbers. */
export function Sparkline({ weeks, through, floor, className }: SparklineProps) {
  if (weeks.length === 0) return null;
  const x = (week: number) => (through <= 1 ? W / 2 : PAD + ((week - 1) * (W - 2 * PAD)) / (through - 1));
  const y = (score: number) => PAD + ((10 - score) * (H - 2 * PAD)) / (10 - floor);
  const last = weeks[weeks.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className={className}>
      <line x1={PAD} x2={W - PAD} y1={y(10)} y2={y(10)} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="2 3" />
      {weeks.length > 1 && (
        <polyline
          points={weeks.map((w) => `${x(w.week)},${y(w.score)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-silver"
        />
      )}
      <circle cx={x(last.week)} cy={y(last.score)} r={2.5} className="fill-gold" />
    </svg>
  );
}
