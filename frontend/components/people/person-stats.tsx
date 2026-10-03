import type { CSSProperties, ReactNode } from "react";

import { PersonLink } from "@/components/couple-names";
import { formatScore } from "@/components/performance-card";
import { avg } from "@/components/people/person-dances";
import { Card } from "@/components/ui/card";
import type { DancerStats, Extreme, JudgeStats, OpenRow, PerformanceRow } from "@/lib/api/people";
import { seasonLabel } from "@/lib/show/seasons";
import { EYEBROW } from "@/lib/ui";

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "0.4 above the judges", "0.4 harsher": a signed gap in words. */
export function gapText(gap: number | null, up: string, down: string): string {
  if (gap === null) return "–";
  if (Math.abs(gap) < 0.05) return "level";
  return `${Math.abs(gap).toFixed(1)} ${gap > 0 ? up : down}`;
}

/** "+0.4", "−0.4", or a dash. */
export const signed = (n: number | null) => (n === null ? "–" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`);

export function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5">
      <p className={EYEBROW}>{label}</p>
      <p className="text-2xl font-semibold text-pearl tabular-nums">{value}</p>
      {note && <p className="text-xs text-silver-dim">{note}</p>}
    </div>
  );
}

const TILES = "stagger grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6";

export function DancerTiles({ stats }: { stats: DancerStats }) {
  const seen = stats.dances - stats.locked;
  return (
    <div className={TILES}>
      <Tile label="Dances" value={`${seen}/${stats.dances}`} note={stats.locked ? `${stats.locked} still to score` : "All scored"} />
      <Tile label="Judges' avg" value={avg(stats.judges.mean)} note={`over ${plural(stats.judges.count, "dance")}`} />
      <Tile
        label="Your avg"
        value={avg(stats.mine.mean)}
        note={stats.mine.gap === null ? `${plural(stats.mine.count, "paddle")}` : gapText(stats.mine.gap, "above the judges", "below the judges")}
      />
      <Tile label="Friends' avg" value={stats.friends.count ? avg(stats.friends.mean) : "–"} note={plural(stats.friends.count, "paddle")} />
      <Tile label="Everyone" value={stats.everyone.count ? avg(stats.everyone.mean) : "–"} note={plural(stats.everyone.count, "paddle")} />
      <Tile
        label="Best dance"
        value={stats.best ? formatScore(stats.best.panelMean) : "–"}
        note={stats.best ? `${stats.best.style ?? "Dance"}, ${seasonLabel(stats.best.season)} wk ${stats.best.week ?? "?"}` : "None revealed yet"}
      />
    </div>
  );
}

export function JudgeTiles({ stats }: { stats: JudgeStats }) {
  return (
    <div className={TILES}>
      <Tile label="Average given" value={avg(stats.mean)} note={`over ${plural(stats.count, "dance")} you've seen`} />
      <Tile label="Rest of panel" value={avg(stats.panelMean)} note="on the same dances" />
      <Tile label="Vs the panel" value={signed(stats.vsPanel)} note={stats.vsPanel === null ? "Not enough yet" : gapText(stats.vsPanel, "more generous", "harsher")} />
      <Tile label="You vs them" value={stats.mine.mae === null ? "–" : `${stats.mine.mae.toFixed(1)}`} note={stats.mine.mae === null ? "Score some dances" : "off, on average"} />
      <Tile label="Your lean" value={signed(stats.mine.gap)} note={gapText(stats.mine.gap, "above them", "below them")} />
      <Tile label="To score" value={stats.locked} note={`of ${plural(stats.dances, "dance")} they judged`} />
    </div>
  );
}

/** Week by week: the panel's mean as a bar, your paddle as a gold dot. Locked weeks are gaps. */
export function DanceChart({ rows }: { rows: PerformanceRow[] }) {
  const open = rows.filter((r): r is OpenRow => !r.locked && r.panelMean !== null);
  if (open.length < 2) return null;
  return (
    <Card id="person-chart" title="Judges and you, dance by dance" note="Bars are the panel's average; the dot is your paddle.">
      <figure>
        <ol className="flex h-36 items-end gap-1.5" aria-label="Scores by dance">
          {open.map((r, i) => {
            const mine = r.mine && "value" in r.mine ? r.mine.value : null;
            return (
              <li key={`${r.season}-${r.key}-${r.ep}`} className="relative flex h-full max-w-12 min-w-0 flex-1 flex-col justify-end">
                <span className="sr-only">
                  {seasonLabel(r.season)} week {r.week}, {r.style}: judges {avg(r.panelMean)}
                  {mine !== null ? `, you ${mine}` : ""}
                </span>
                <span
                  aria-hidden="true"
                  className="grow-y block w-full rounded-t-md bg-gradient-to-t from-silver/15 to-silver/35"
                  style={{ height: `${(r.panelMean! / 10) * 100}%`, "--d": `${i * 40}ms` } as CSSProperties}
                />
                {mine !== null && (
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-gold shadow-[0_0_8px_rgb(232_194_104/0.8)]"
                    style={{ bottom: `${(mine / 10) * 100}%` }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </figure>
    </Card>
  );
}

export function JudgeCharts({ stats }: { stats: JudgeStats }) {
  if (stats.count === 0) return null;
  const values = Object.entries(stats.distribution).sort(([a], [b]) => Number(a) - Number(b));
  const top = Math.max(...values.map(([, n]) => n));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card id="judge-distribution" title="Scores they give" note="How often each score, on dances you've seen.">
        <ol className="flex h-32 items-end gap-2">
          {values.map(([v, n], i) => (
            <li key={v} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-silver tabular-nums">{n}</span>
              <span
                aria-hidden="true"
                className="grow-y block w-full rounded-t-md bg-gradient-to-t from-gold-deep to-gold-light"
                style={{ height: `${(n / top) * 80}%`, "--d": `${i * 40}ms` } as CSSProperties}
              />
              <span className="text-xs font-semibold text-pearl tabular-nums">
                <span className="sr-only">score </span>
                {v}
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <Card id="judge-styles" title="By dance style" note="Their average for each style.">
        <ol className="flex flex-col gap-2.5">
          {stats.byStyle.slice(0, 8).map((s, i) => (
            <li key={s.style} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-pearl">{s.style}</span>
                <span className="text-xs text-silver-dim">{plural(s.count, "dance")}</span>
              </span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-silver/10">
                <span
                  className="grow-x block h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-light"
                  style={{ width: `${((s.mean ?? 0) / 10) * 100}%`, "--d": `${i * 50}ms` } as CSSProperties}
                />
              </span>
              <span className="text-right text-sm text-pearl tabular-nums">{avg(s.mean)}</span>
            </li>
          ))}
        </ol>
      </Card>
      {(stats.harshest.length > 0 || stats.generous.length > 0) && (
        <Card id="judge-extremes" title="Against the panel" note="Where they parted most from the other judges." className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <ExtremeList title="Harshest" items={stats.harshest} />
            <ExtremeList title="Most generous" items={stats.generous} />
          </div>
        </Card>
      )}
    </div>
  );
}

function ExtremeList({ title, items }: { title: string; items: Extreme[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={EYEBROW}>{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-silver-dim">None yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((x) => (
            <li key={`${x.season}-${x.ep}-${x.dancers.map((d) => d.id).join("+")}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-pearl">
                  {x.dancers
                    .filter((d) => d.role === "celebrity")
                    .map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && ", "}
                        <PersonLink id={d.id} name={d.name} />
                      </span>
                    ))}
                </span>
                <span className="block truncate text-xs text-silver-dim">
                  {x.style ?? "Dance"}, {seasonLabel(x.season)} week {x.week ?? "?"}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="font-semibold text-pearl">{formatScore(x.value)}</span>
                <span className="text-xs text-silver-dim"> ({signed(x.vsPanel)})</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
