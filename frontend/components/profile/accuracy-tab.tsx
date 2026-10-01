import type { CSSProperties } from "react";

import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { DistributionChart, StyleChart, off } from "@/components/profile-charts";
import { Dancers, plural, Tile, weekLabel } from "@/components/profile/parts";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/states";
import type { Call, Detail, WeekDetail } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { gapTone, signed } from "@/lib/show/couples";
import { closestJudge } from "@/lib/profile/season-stats";
import { cn } from "@/lib/ui";

interface AccuracyTabProps {
  season: Season;
  detail: Detail;
  own: boolean;
}

const TENDENCY = {
  over: "More generous",
  under: "Tougher",
  level: "In step",
} as const;

/** Every way of measuring the gap to the judges: per judge, style and week, the paddles, the best and worst calls. */
export function AccuracyTab({ season, detail, own }: AccuracyTabProps) {
  if (detail.count === 0) {
    return (
      <EmptyState title="Nothing to compare yet">
        {own
          ? "A dance counts once you've scored it and every judge's score is confirmed."
          : "Accuracy here covers dances you've both scored. Score the same dances to compare."}
      </EmptyState>
    );
  }

  const judgeId = closestJudge(detail.judges);
  const judges = Object.entries(detail.judges)
    .map(([id, j]) => ({
      style: judgeName(id, season.judges),
      count: j.count,
      mae: j.mae,
    }))
    .sort((a, b) => a.mae - b.mae);
  const styles = detail.styles.flatMap((s) => (s.mae === null ? [] : [{ style: s.style, count: s.count, mae: s.mae }]));
  const tone = gapTone(detail.gap);

  return (
    <div className="flex flex-col gap-6">
      {!own && (
        <p className="text-sm text-silver-dim">Over the {plural(detail.count, "dance")} you&apos;ve both scored.</p>
      )}

      <dl className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Average gap"
          accent
          value={
            detail.mae === null ? (
              "–"
            ) : (
              <CountUp value={Math.round(detail.mae * 10) / 10} format={(n) => `${formatScore(n)} off`} />
            )
          }
          note="points per dance"
        />
        <Tile
          label="Tendency"
          value={TENDENCY[tone]}
          note={detail.gap === null ? undefined : `${signed(detail.gap)} against the judges`}
        />
        <Tile
          label="Closest judge"
          value={judgeId ? judgeName(judgeId, season.judges) : "–"}
          note={judgeId ? off(detail.judges[judgeId].mae) : undefined}
        />
        <Tile label="Dances compared" value={<CountUp value={detail.count} />} note="judges confirmed" />
      </dl>

      {/* Columns, not grid rows: the cards differ in height and a row would pad the short ones. */}
      <div className="gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        <Card id="per-judge" title="Per judge" note="Average gap to each judge. Shorter is closer.">
          <StyleChart styles={judges} />
        </Card>
        {styles.length > 0 && (
          <Card id="by-style" title="By dance style" note="Average gap to the judges. Shorter is closer.">
            <StyleChart styles={styles} />
          </Card>
        )}
        {detail.weeks.length > 0 && (
          <Card id="by-week" title="By week" note="Average gap per episode. The lit bar is the closest.">
            <WeekBars weeks={detail.weeks} season={season} />
          </Card>
        )}
        <Card id="paddles" title={own ? "Paddles you raised" : "Paddles they raised"}>
          <DistributionChart counts={detail.distribution} own={own} />
        </Card>
      </div>

      {detail.best && detail.worst && (
        <section aria-labelledby="calls" className="flex flex-col gap-3">
          <h3 id="calls" className="font-semibold text-pearl">
            Best and worst calls
          </h3>
          <ul className="stagger grid gap-3 md:grid-cols-2">
            <CallCard title="Best call" tone="best" call={detail.best} season={season} own={own} />
            {detail.worst.key !== detail.best.key || detail.worst.ep !== detail.best.ep ? (
              <CallCard title="Worst call" tone="worst" call={detail.worst} season={season} own={own} />
            ) : null}
          </ul>
        </section>
      )}
    </div>
  );
}

function WeekBars({ weeks, season }: { weeks: WeekDetail[]; season: Season }) {
  const gaps = weeks.flatMap((w) => (w.mae === null ? [] : [w.mae]));
  const top = Math.max(2, Math.ceil(Math.max(...gaps) * 1.15));
  const best = gaps.length > 1 ? Math.min(...gaps) : null;
  return (
    <figure className="flex flex-col gap-2">
      <ol aria-hidden="true" className="flex h-40 items-stretch gap-1 sm:gap-2">
        {weeks.map((w, i) => (
          <li key={`${w.season}-${w.ep}`} className="flex min-w-0 flex-1 flex-col items-center">
            <span className="flex w-full flex-1 flex-col items-center justify-end">
              {w.mae !== null && (
                <>
                  <span
                    style={{ animationDelay: `${i * 60 + 450}ms` }}
                    className="mb-1 animate-rise-in text-[10px] leading-none font-semibold text-pearl tabular-nums"
                  >
                    {formatScore(Math.round(w.mae * 10) / 10)}
                  </span>
                  <span
                    className={cn(
                      "grow-y w-full max-w-8 rounded-t-sm",
                      w.mae === best
                        ? "bg-gradient-to-t from-gold to-gold-light shadow-[0_0_14px_-2px_rgb(247_226_164/0.6)]"
                        : "bg-gradient-to-t from-gold-deep/70 to-gold/80",
                    )}
                    style={
                      {
                        height: `${Math.max(2, (w.mae / top) * 100)}%`,
                        "--d": `${i * 60}ms`,
                      } as CSSProperties
                    }
                  />
                </>
              )}
            </span>
            <span className="mt-1 h-4 truncate text-[10px] leading-4 text-silver-dim">
              {w.week === null ? `E${w.ep}` : `W${w.week}`}
            </span>
          </li>
        ))}
      </ol>
      <div className="sr-only">
        <table>
          <caption>Average gap to the judges by episode</caption>
          <tbody>
            {weeks.map((w) => (
              <tr key={`${w.season}-${w.ep}`}>
                <th scope="row">{weekLabel(w, season)}</th>
                <td>{w.mae === null ? "not scored" : off(w.mae)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

interface CallCardProps {
  title: string;
  tone: "best" | "worst";
  call: Call;
  season: Season;
  own: boolean;
}

function CallCard({ title, tone, call, season, own }: CallCardProps) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        tone === "best" ? "border-gold/45 bg-gold/[0.07]" : "border-silver/15 bg-ballroom/40",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold tracking-[0.12em] uppercase",
          tone === "best" ? "text-gold" : "text-silver-dim",
        )}
      >
        {title}
      </p>
      <Dancers members={call.members} />
      <p className="text-sm text-silver-dim">{[call.style, weekLabel(call, season)].filter(Boolean).join(" · ")}</p>
      <p className="flex items-baseline gap-3 text-sm tabular-nums">
        <span>
          {own ? "You" : "Them"} <span className="text-lg font-semibold">{call.paddle}</span>
        </span>
        <span className="text-silver-dim">
          Judges <span className="text-lg font-semibold text-pearl">{formatScore(call.panelMean)}</span>
        </span>
        <span className="ml-auto text-silver-dim">{off(call.error)}</span>
      </p>
    </li>
  );
}
