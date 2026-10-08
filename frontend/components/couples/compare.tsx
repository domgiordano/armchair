"use client";

import Link from "next/link";
import { useState } from "react";

import { EliminatedStamp } from "@/components/eliminated";
import { CoupleAvatars } from "@/components/headshot";
import { Sheet } from "@/components/ui/sheet";
import { signed } from "@/lib/show/couples";
import { celebrityName, type BoardCouple } from "@/lib/show/couples-board";
import { coupleHref } from "@/lib/show/people";
import { button, cn, EYEBROW } from "@/lib/ui";

export const MAX_COMPARE = 3;

// Colour and dash both tell the lines apart, so the chart doesn't lean on colour alone.
const LINES = [
  { stroke: "text-gold", dot: "bg-gold", dash: undefined },
  { stroke: "text-brand-magenta", dot: "bg-brand-magenta", dash: "5 3" },
  { stroke: "text-sky-300", dot: "bg-sky-300", dash: "1.5 3" },
];

interface CompareBarProps {
  picked: BoardCouple[];
  week: number;
  season: string;
  onClear: () => void;
}

/** Pinned under the board once a couple is ticked: who's picked, and Compare once there are two. */
export function CompareBar({ picked, week, season, onClear }: CompareBarProps) {
  const [open, setOpen] = useState(false);
  if (picked.length === 0) return null;
  const ready = picked.length >= 2;
  return (
    <>
      <div
        role="region"
        aria-label="Compare couples"
        className="sticky bottom-0 z-10 -mx-4 flex animate-fade-in items-center gap-3 border-t border-gold/40 bg-ballroom/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-12px_rgb(2_8_30/0.9)] backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-t-xl lg:border-x"
      >
        <span className="flex shrink-0 -space-x-2">
          {picked.map((c) => (
            <CoupleAvatars key={c.id} members={c.members.filter((m) => m.role === "celebrity")} size={32} />
          ))}
        </span>
        <span aria-live="polite" className="min-w-0 flex-1 truncate text-sm text-silver">
          {ready ? picked.map((c) => celebrityName(c.members)).join(", ") : "Pick one more to compare"}
        </span>
        <button type="button" onClick={onClear} className={button("ghost", "sm")}>
          Clear
        </button>
        <button type="button" disabled={!ready} onClick={() => setOpen(true)} className={button("primary", "sm")}>
          Compare {picked.length}
        </button>
      </div>
      <Sheet open={open && ready} onClose={() => setOpen(false)} label="Compare couples">
        {open && ready && <CompareSheet picked={picked} week={week} season={season} />}
      </Sheet>
    </>
  );
}

type Row = { label: string; value: (c: BoardCouple) => number | null; format?: (n: number) => string; low?: boolean };

const one = (n: number) => n.toFixed(1);

const ROWS: Row[] = [
  { label: "Place", value: (c) => c.rank, format: String, low: true },
  { label: "Judges' avg", value: (c) => c.average },
  { label: "This week", value: (c) => c.last },
  { label: "Best", value: (c) => c.best },
  { label: "Crowd", value: (c) => c.crowd },
  { label: "Crowd vs judges", value: (c) => c.delta, format: signed },
  { label: "Trend", value: (c) => c.trend, format: signed },
  { label: "Dances", value: (c) => c.dances, format: String },
  { label: "Perfect", value: (c) => c.perfect, format: String },
];

function CompareSheet({ picked, week, season }: Omit<CompareBarProps, "onClear">) {
  // The chart's floor from these couples alone, so their lines spread out.
  const floor = Math.max(1, Math.floor(Math.min(10, ...picked.flatMap((c) => c.weeks.map((w) => w.score)))) - 1);
  return (
    <div className="flex flex-col gap-5">
      <h2 className="pr-10 text-lg font-semibold text-pearl">{`Side by side, as of week ${week}`}</h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{`${picked.map((c) => celebrityName(c.members)).join(", ")} compared`}</caption>
        <thead>
          <tr>
            <td className="w-24 sm:w-32" />
            {picked.map((c, i) => (
              <th key={c.id} scope="col" className="px-1 pb-3 align-bottom font-normal">
                <Link href={coupleHref(c.members, season)} prefetch={false} className="group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-lg text-center focus-ring">
                  <CoupleAvatars members={c.members} size={40} />
                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", LINES[i].dot)} />
                  <span className="line-clamp-2 w-full text-sm leading-tight font-medium break-words text-pearl group-hover:text-gold-light">
                    {celebrityName(c.members)}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const values = picked.map(r.value);
            const known = values.filter((v): v is number => v !== null);
            // No winner to mark when they all match.
            const lead = new Set(known).size > 1 ? (r.low ? Math.min(...known) : Math.max(...known)) : null;
            return (
              <tr key={r.label} className="border-t border-silver/10">
                <th scope="row" className="py-2 pr-2 text-left text-xs font-normal text-silver-dim">
                  {r.label}
                </th>
                {values.map((v, i) => (
                  <td key={picked[i].id} className={cn("py-2 text-center tabular-nums", v !== null && v === lead ? "font-semibold text-gold-light" : "text-pearl")}>
                    {v === null ? "–" : (r.format ?? one)(v)}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t border-silver/10">
            <th scope="row" className="py-2 pr-2 text-left text-xs font-normal text-silver-dim">
              Status
            </th>
            {picked.map((c) => (
              <td key={c.id} className="py-2 text-center">
                {c.eliminated ? <EliminatedStamp out={c.eliminated} size="sm" /> : <span className="text-xs text-silver">Dancing</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <WeeksChart picked={picked} week={week} floor={floor} />
    </div>
  );
}

const W = 320;
const H = 140;
const PAD = { left: 22, right: 8, top: 8, bottom: 18 };

/** Each picked couple's weekly judges' mean, one line each. */
function WeeksChart({ picked, week, floor }: { picked: BoardCouple[]; week: number; floor: number }) {
  const x = (w: number) => PAD.left + (week <= 1 ? (W - PAD.left - PAD.right) / 2 : ((w - 1) * (W - PAD.left - PAD.right)) / (week - 1));
  const y = (v: number) => PAD.top + ((10 - v) * (H - PAD.top - PAD.bottom)) / (10 - floor);
  const ticks = [floor, Math.round((floor + 10) / 2), 10];
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className={EYEBROW}>Judges&apos; average by week</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={picked.map((c) => `${celebrityName(c.members)}: ${c.weeks.map((w) => `week ${w.week} ${one(w.score)}`).join(", ")}`).join("; ")}
        className="w-full text-silver-dim"
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.18} />
            <text x={PAD.left - 5} y={y(v)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: week }, (_, i) => i + 1).map((w) => (
          <text key={w} x={x(w)} y={H - 4} fontSize={9} textAnchor="middle" fill="currentColor">
            {`W${w}`}
          </text>
        ))}
        {picked.map((c, i) => (
          <g key={c.id} className={LINES[i].stroke}>
            {c.weeks.length > 1 && (
              <polyline
                points={c.weeks.map((w) => `${x(w.week)},${y(w.score)}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={LINES[i].dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {c.weeks.map((w) => (
              <circle key={w.week} cx={x(w.week)} cy={y(w.score)} r={2.5} fill="currentColor" />
            ))}
          </g>
        ))}
      </svg>
    </figure>
  );
}
