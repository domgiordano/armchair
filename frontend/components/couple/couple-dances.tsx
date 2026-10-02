import { PersonLink } from "@/components/couple-names";
import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { avg, nights, Nudge } from "@/components/people/person-dances";
import { Badge } from "@/components/ui/badge";
import type { Average, OpenRow, PerformanceRow } from "@/lib/api/people";
import type { Episode, Judge } from "@/lib/api/show";
import { paddle } from "@/lib/show/couple";
import { cn } from "@/lib/ui";

interface CoupleDancesProps {
  rows: PerformanceRow[];
  /** The couple's own dancer ids, left out of a team dance's "with". */
  self: string[];
  judges: Judge[];
  episodes: Episode[];
}

/** The season as a timeline: one stop a night, its dances as cards, unanswered ones folded into a nudge. */
export function CoupleDances({ rows, self, judges, episodes }: CoupleDancesProps) {
  const list = nights(rows).flatMap((s) => s.nights);
  return (
    <ol className="stagger relative flex flex-col gap-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-gradient-to-b before:from-gold/50 before:via-silver/15 before:to-transparent">
      {list.map((night) => {
        const open = night.rows.filter((r): r is OpenRow => !r.locked);
        const locked = night.rows.length - open.length;
        const theme = episodes.find((e) => e.ep === night.ep)?.theme;
        return (
          <li key={night.ep} className="relative flex flex-col gap-2.5 pl-7">
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 left-0 size-[15px] rounded-full border-2",
                open.length ? "border-gold bg-ink shadow-[0_0_10px_rgb(232_194_104/0.6)]" : "border-silver/30 bg-ink",
              )}
            />
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-pearl">
              {night.label}
              {theme && <span className="text-xs font-normal text-silver-dim">{theme}</span>}
            </h3>
            {open.length > 0 && (
              <ul className="grid gap-2 lg:grid-cols-2">
                {open.map((r) => (
                  <li key={r.key}>
                    <DanceCard row={r} self={self} judges={judges} />
                  </li>
                ))}
              </ul>
            )}
            {locked > 0 && <Nudge night={night} count={locked} partial={open.length > 0} />}
          </li>
        );
      })}
    </ol>
  );
}

const crowd = (a: Average) => (a.count ? avg(a.mean) : "–");

function DanceCard({ row, self, judges }: { row: OpenRow; self: string[]; judges: Judge[] }) {
  const mine = paddle(row);
  const others = row.dancers.filter((d) => !self.includes(d.id));
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5 transition-colors hover:border-silver/25">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-pearl">{row.style ?? "Dance"}</p>
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
      <dl className="grid grid-cols-4 gap-1.5 text-center">
        <Figure label="Judges" value={avg(row.panelMean)} strong />
        <Figure label="You" value={mine !== null ? String(mine) : row.mine ? "Skip" : "–"} accent={mine !== null} strong />
        <Figure label="Friends" value={crowd(row.friends)} />
        <Figure label="Everyone" value={crowd(row.everyone)} />
      </dl>
      <ul aria-label="Judges' scores" className="flex flex-wrap gap-1.5">
        {row.judges.map((j) => (
          <li key={j.id} className="flex items-center gap-1.5 rounded-full border border-silver/10 bg-ink/40 py-0.5 pr-2.5 pl-2 text-xs">
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

function Figure({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn("flex flex-col-reverse rounded-lg px-1 py-1.5", accent ? "bg-gold/10" : "bg-ink/40")}>
      <dt className="text-[11px] tracking-wide text-silver-dim uppercase">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-lg font-semibold" : "text-base", accent ? "text-gold-light" : strong ? "text-pearl" : "text-silver")}>
        {value}
      </dd>
    </div>
  );
}
