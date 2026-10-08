import Link from "next/link";
import type { ReactNode } from "react";

import { CoupleAvatars } from "@/components/headshot";
import type { Member } from "@/lib/api/show";
import { celebrityName, type BoardCouple, type Dance, type Highlights } from "@/lib/show/couples-board";
import { ordinal } from "@/lib/show/couples";
import { coupleHref } from "@/lib/show/people";
import { cn, EYEBROW, FOCUS } from "@/lib/ui";

interface BoardHighlightsProps {
  highlights: Highlights;
  week: number;
  season: string;
  /** Members by couple id, to name the best dance's couple. */
  roster: { id: string; members: Member[] }[];
}

/** The board's header: the judges' top three, who moved most since last week, and the season's best dance so far. */
export function BoardHighlights({ highlights: h, week, season, roster }: BoardHighlightsProps) {
  const top = h.top && roster.find((c) => c.id === h.top?.couple);
  return (
    <section aria-label={`Week ${week} highlights`} className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Podium couples={h.podium} season={season} />
      <div className="grid grid-cols-1 gap-2">
        <Fact
          label="Biggest climber"
          couple={h.climber}
          season={season}
          value={h.climber && <Move by={h.climber.move ?? 0} />}
          empty={week === 1 ? "Moves start in week 2" : "Nobody climbed"}
          detail={`since week ${week - 1}`}
        />
        <Fact
          label="Biggest faller"
          couple={h.faller}
          season={season}
          value={h.faller && <Move by={h.faller.move ?? 0} />}
          empty={week === 1 ? "Moves start in week 2" : "Nobody fell"}
          detail={`since week ${week - 1}`}
        />
        <Fact
          label="Highest score"
          couple={top ?? null}
          season={season}
          value={h.top && <span className="text-gold-light">{h.top.score.toFixed(1)}</span>}
          empty="No scores yet"
          detail={h.top ? danceLine(h.top) : ""}
        />
      </div>
    </section>
  );
}

const danceLine = (d: Dance) => `${d.style ?? "Dance"}, week ${d.week}${d.perfect ? ", perfect" : ""}`;

// In place order for screen readers; `order` stands them second, first, third, the tallest step in the middle.
const STEPS = [
  { at: 0, order: 0, height: "h-16", tone: "from-gold/35 to-gold/5 border-gold/50" },
  { at: 1, order: -1, height: "h-12", tone: "from-silver/25 to-silver/5 border-silver/30" },
  { at: 2, order: 1, height: "h-9", tone: "from-gold-deep/30 to-gold-deep/5 border-gold-deep/40" },
];

function Podium({ couples, season }: { couples: BoardCouple[]; season: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/20 bg-gradient-to-b from-ballroom/80 to-ink/60 p-4">
      <h3 className={EYEBROW}>Judges&apos; leaders</h3>
      {couples.length === 0 ? (
        <p className="text-sm text-silver-dim">Nobody has a judges&apos; score yet.</p>
      ) : (
        <ol className="grid grid-cols-3 items-end gap-2">
          {STEPS.map(({ at, order, height, tone }) => {
            const c = couples[at];
            if (!c) return <li key={at} aria-hidden="true" style={{ order }} />;
            return (
              <li key={c.id} style={{ order }} className="flex min-w-0 flex-col items-center gap-1.5">
                <Link
                  href={coupleHref(c.members, season)}
                  prefetch={false}
                  className={cn("group flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 text-center", FOCUS)}
                >
                  <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
                    <CoupleAvatars members={c.members} size={at === 0 ? 48 : 40} />
                  </span>
                  <span className="w-full truncate text-sm font-medium text-pearl group-hover:text-gold-light">{celebrityName(c.members)}</span>
                  <span className="text-xs text-silver-dim tabular-nums">
                    {c.average === null ? "–" : `${c.average.toFixed(1)} avg`}
                  </span>
                </Link>
                <span
                  className={cn(
                    "flex w-full items-start justify-center rounded-t-lg border border-b-0 bg-gradient-to-b pt-1.5 font-display text-lg text-pearl",
                    height,
                    tone,
                  )}
                >
                  {ordinal(c.rank ?? at + 1)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface FactProps {
  label: string;
  couple: { members: Member[] } | null;
  season: string;
  value: ReactNode;
  empty: string;
  detail: string;
}

function Fact({ label, couple, season, value, empty, detail }: FactProps) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-silver/10 bg-ballroom/45 px-3 py-2">
      {couple ? (
        <>
          <Link href={coupleHref(couple.members, season)} prefetch={false} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg", FOCUS)}>
            <CoupleAvatars members={couple.members} size={32} />
            <span className="flex min-w-0 flex-col">
              <span className={EYEBROW}>{label}</span>
              <span className="truncate text-sm font-medium text-pearl">{celebrityName(couple.members)}</span>
              <span className="truncate text-xs text-silver-dim">{detail}</span>
            </span>
          </Link>
          <span className="shrink-0 text-xl font-semibold tabular-nums">{value}</span>
        </>
      ) : (
        <span className="flex flex-col">
          <span className={EYEBROW}>{label}</span>
          <span className="text-sm text-silver-dim">{empty}</span>
        </span>
      )}
    </div>
  );
}

function Move({ by }: { by: number }) {
  const up = by > 0;
  return (
    <span className={cn("flex items-center gap-1", up ? "text-emerald-300" : "text-rose-300")}>
      <svg viewBox="0 0 10 10" width={12} height={12} aria-hidden="true" className={up ? "" : "rotate-180"}>
        <path d="M5 1 9 8H1Z" fill="currentColor" />
      </svg>
      {Math.abs(by)}
      <span className="sr-only">{` ${Math.abs(by) === 1 ? "place" : "places"} ${up ? "up" : "down"}`}</span>
    </span>
  );
}
