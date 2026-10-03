"use client";

import { useState, type CSSProperties } from "react";

import { PersonLink } from "@/components/couple-names";
import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { avg, nights, Nudge, type Night } from "@/components/people/person-dances";
import { Badge } from "@/components/ui/badge";
import type { Average, OpenRow, PerformanceRow } from "@/lib/api/people";
import type { Episode, Judge } from "@/lib/api/show";
import { paddle } from "@/lib/show/couple";
import { useReducedMotion } from "@/lib/motion";
import { cn, EYEBROW, FOCUS } from "@/lib/ui";

interface CoupleDancesProps {
  rows: PerformanceRow[];
  /** The couple's own dancer ids, left out of a team dance's "with". */
  self: string[];
  judges: Judge[];
  episodes: Episode[];
}

const cellId = (ep: number) => `night-${ep}`;

/**
 * The season as a compact rail of nights over a grid of dance cards: two or
 * three across on wider screens, one or two on phones. A night still to score
 * folds into one nudge cell. Tapping a stop on the rail brings its first cell up.
 */
export function CoupleDances({ rows, self, judges, episodes }: CoupleDancesProps) {
  const list = nights(rows).flatMap((s) => s.nights);
  const [picked, setPicked] = useState<number | null>(null);
  const still = useReducedMotion();

  const jump = (ep: number) => {
    setPicked(ep);
    const target = document.getElementById(cellId(ep));
    target?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <Rail list={list} picked={picked} onPick={jump} />
      <ol
        aria-label="Dances, night by night"
        className="stagger grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2 xl:grid-cols-3"
      >
        {list.flatMap((night) =>
          cells(night, episodes).map((cell, i) => (
            <li
              key={`${night.ep}-${cell.kind === "dance" ? cell.row.key : "nudge"}`}
              id={i === 0 ? cellId(night.ep) : undefined}
              tabIndex={i === 0 ? -1 : undefined}
              className={cn(
                "rounded-xl outline-none transition-shadow duration-500",
                picked === night.ep && "shadow-[0_0_0_2px_rgb(232_194_104/0.55),0_0_28px_-6px_rgb(232_194_104/0.6)]",
                cell.kind === "nudge" && "min-[30rem]:col-span-2 xl:col-span-1",
              )}
            >
              {cell.kind === "dance" ? (
                <DanceCard row={cell.row} night={night} theme={cell.theme} self={self} judges={judges} />
              ) : (
                <Nudge night={night} count={cell.count} partial={cell.partial} />
              )}
            </li>
          )),
        )}
      </ol>
    </div>
  );
}

type Cell = { kind: "dance"; row: OpenRow; theme: string | null } | { kind: "nudge"; count: number; partial: boolean };

function cells(night: Night, episodes: Episode[]): Cell[] {
  const open = night.rows.filter((r): r is OpenRow => !r.locked);
  const locked = night.rows.length - open.length;
  const theme = episodes.find((e) => e.ep === night.ep)?.theme ?? null;
  const out: Cell[] = open.map((row) => ({ kind: "dance", row, theme }));
  if (locked > 0) out.push({ kind: "nudge", count: locked, partial: open.length > 0 });
  return out;
}

/** One stop a night: the week, then the judges' best average that night, or a lock. */
function Rail({ list, picked, onPick }: { list: Night[]; picked: number | null; onPick: (ep: number) => void }) {
  return (
    <nav
      aria-label="Jump to a night"
      className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <ol className="relative flex w-max min-w-full gap-1 before:absolute before:top-[22px] before:right-4 before:left-4 before:h-px before:bg-gradient-to-r before:from-gold/50 before:via-silver/20 before:to-silver/5">
        {list.map((night, i) => {
          const open = night.rows.filter((r): r is OpenRow => !r.locked);
          const means = open.flatMap((r) => (r.panelMean === null ? [] : [r.panelMean]));
          const best = means.length ? Math.max(...means) : null;
          const locked = open.length < night.rows.length;
          const short = night.week === null ? `Ep ${night.ep}` : `W${night.week}`;
          return (
            <li
              key={night.ep}
              style={{ "--d": `${i * 35}ms` } as CSSProperties}
              className="relative animate-[rise-in_480ms_cubic-bezier(0.2,0.8,0.3,1)_backwards] [animation-delay:var(--d)]"
            >
              <button
                type="button"
                onClick={() => onPick(night.ep)}
                aria-current={picked === night.ep ? "true" : undefined}
                aria-label={`${night.label}${best !== null ? `, judges' best ${avg(best)}` : locked ? ", still to score" : ""}`}
                className={cn(
                  "group flex min-h-11 min-w-12 flex-col items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:bg-silver/5 active:bg-silver/10",
                  FOCUS,
                )}
              >
                <span
                  className={cn(
                    EYEBROW,
                    "tracking-[0.08em] transition-colors group-hover:text-pearl",
                    picked === night.ep && "text-gold-light",
                  )}
                >
                  {short}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 size-3 rounded-full border-2 transition-transform duration-200 group-hover:scale-125",
                    open.length
                      ? "border-gold bg-ink shadow-[0_0_10px_rgb(232_194_104/0.6)]"
                      : "border-dashed border-silver/40 bg-ink",
                    picked === night.ep && "scale-125 bg-gold",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn("text-xs tabular-nums", best === null ? "text-silver-dim" : "font-semibold text-pearl")}
                >
                  {best !== null ? avg(best) : locked ? <LockGlyph /> : "–"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const crowd = (a: Average) => (a.count ? avg(a.mean) : "–");

interface DanceCardProps {
  row: OpenRow;
  night: Night;
  theme: string | null;
  self: string[];
  judges: Judge[];
}

function DanceCard({ row, night, theme, self, judges }: DanceCardProps) {
  const mine = paddle(row);
  const others = row.dancers.filter((d) => !self.includes(d.id));
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-silver/25">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-silver-dim">
            <span className="font-semibold tracking-wide text-gold/90 uppercase">{night.label}</span>
            {theme && ` · ${theme}`}
          </p>
          <h3 className="mt-0.5 font-medium text-pearl">{row.style ?? "Dance"}</h3>
          {row.song && <p className="truncate text-xs text-silver-dim">{row.song}</p>}
          {others.length > 0 && (
            <p className="mt-0.5 text-xs text-silver">
              with{" "}
              {others.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <PersonLink id={d.id} name={d.name} />
                </span>
              ))}
            </p>
          )}
        </div>
        {others.length > 0 && <Badge tone="muted">Team</Badge>}
      </header>
      <dl className="mt-auto grid grid-cols-4 gap-1.5 text-center">
        <Figure label="Judges" value={avg(row.panelMean)} strong />
        <Figure
          label="You"
          value={mine !== null ? String(mine) : row.mine ? "Skip" : "–"}
          accent={mine !== null}
          strong
        />
        <Figure label="Friends" value={crowd(row.friends)} />
        <Figure label="Everyone" value={crowd(row.everyone)} />
      </dl>
      <ul aria-label="Judges' scores" className="flex flex-wrap gap-1.5">
        {row.judges.map((j) => (
          <li
            key={j.id}
            className="flex items-center gap-1.5 rounded-full border border-silver/10 bg-ink/40 py-0.5 pr-2.5 pl-2 text-xs"
          >
            <span className="text-silver-dim">{judgeName(j.id, judges).split(" ")[0]}</span>
            <span className={cn("font-semibold tabular-nums", j.value === null ? "text-silver-dim" : "text-pearl")}>
              {j.value === null ? "–" : formatScore(j.value)}
            </span>
            {j.state !== "confirmed" && <span className="sr-only">({j.state})</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Figure({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={cn("flex flex-col-reverse rounded-lg px-1 py-1.5", accent ? "bg-gold/10" : "bg-ink/40")}>
      <dt className="text-[11px] tracking-wide text-silver-dim uppercase">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold" : "text-base",
          accent ? "text-gold-light" : strong ? "text-pearl" : "text-silver",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline size-3.5 text-gold/80"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
