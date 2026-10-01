import Link from "next/link";

import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { off } from "@/components/profile-charts";
import { Heading, plural, seasonShort, Tile, weekLabel } from "@/components/profile/parts";
import { TrendChart } from "@/components/profile/trend-chart";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import type { Place, Profile } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { closestJudge } from "@/lib/profile/season-stats";
import { TEXT_LINK, button } from "@/lib/ui";

// Mirrors users_get.MIN_DANCES: below it the API sends no error, and no place, for someone else.
export const MIN_DANCES = 5;

interface OverviewTabProps {
  season: Season;
  profile: Profile;
  own: boolean;
}

const tenths = (n: number) => Math.round(n * 10) / 10;

/** The headline numbers for the season or all-time, how the gap moved week to week, and recent episodes. */
export function OverviewTab({ season, profile, own }: OverviewTabProps) {
  const { count, mae, judges } = profile.season;
  const all = profile.season.season === "all";
  const judgeId = closestJudge(judges);
  const weeks = profile.detail.weeks.filter((w) => w.mae !== null);

  return (
    <div className="flex flex-col gap-6">
      <dl className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Gap to the judges"
          accent
          value={mae === null ? "None yet" : <CountUp value={tenths(mae)} format={(n) => `${formatScore(n)} off`} />}
          note={mae === null ? undefined : "average per dance"}
        />
        <Tile
          label="Dances scored"
          value={<CountUp value={count} />}
          note={all ? "Every season" : seasonShort(profile.season.season)}
        />
        <Tile
          label="Closest judge"
          value={judgeId ? judgeName(judgeId, season.judges) : "None yet"}
          note={judgeId ? off(judges[judgeId].mae) : undefined}
        />
        <Tile label="Leaderboard" {...placeTile(profile.season, count)} />
      </dl>

      {!own && mae === null && count > 0 && (
        <p className="text-sm text-silver-dim">
          Their accuracy shows once they&apos;ve scored {MIN_DANCES} dances the judges have confirmed.
        </p>
      )}
      {own && count === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-silver/15 bg-ink/30 p-4">
          <p className="text-sm text-silver">
            Nothing to compare yet. A dance counts here once you&apos;ve scored it and every judge&apos;s score is
            confirmed.
          </p>
          <Link href="/episode/" className={button("primary", "sm")}>
            Score this week&apos;s dances
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        {weeks.length > 0 && (
          <Card
            id="trend-heading"
            title="Accuracy trend"
            note={
              own
                ? "Points off the judges' average, week by week."
                : `Over the ${plural(profile.detail.count, "dance")} you've both scored.`
            }
          >
            <TrendChart
              points={weeks.map((w) => ({
                label: weekLabel(w, season),
                short: w.week === null ? `E${w.ep}` : `W${w.week}`,
                value: w.mae ?? 0,
              }))}
              caption="Lower is closer. The lit dot is the best week."
            />
          </Card>
        )}
        <div className="flex flex-col gap-4">
          {!all && <AllTimeStrip profile={profile} season={season} />}
          <Recent profile={profile} season={season} />
        </div>
      </div>
    </div>
  );
}

function placeTile(place: Place, count: number) {
  if (place.rank !== null) {
    return {
      value: <CountUp value={place.rank} format={(n) => `#${Math.round(n)}`} />,
      note: `of ${plural(place.ranked, "ranked player")}`,
    };
  }
  return {
    value: "Unranked",
    note: `${Math.min(count, MIN_DANCES)} of ${MIN_DANCES} dances to rank`,
  };
}

function AllTimeStrip({ profile, season }: { profile: Profile; season: Season }) {
  const a = profile.allTime;
  if (a.count === 0) return null;
  return (
    <section
      aria-labelledby="all-time-heading"
      className="flex flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-4"
    >
      <Heading id="all-time-heading" title="All-time" note="Every season together." />
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs text-silver-dim">Dances</dt>
          <dd className="text-lg font-semibold text-pearl tabular-nums">{a.count}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-silver-dim">Gap</dt>
          <dd className="text-lg font-semibold text-pearl tabular-nums">{a.mae === null ? "–" : off(a.mae)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-silver-dim">Place</dt>
          <dd className="text-lg font-semibold text-pearl tabular-nums">{a.rank === null ? "–" : `#${a.rank}`}</dd>
        </div>
      </dl>
      {a.closestJudge && (
        <p className="text-xs text-silver-dim">
          Closest to {judgeName(a.closestJudge.id, season.judges)}, {off(a.closestJudge.mae)}.
        </p>
      )}
    </section>
  );
}

function Recent({ profile, season }: { profile: Profile; season: Season }) {
  if (profile.recent.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
      <h3 id="recent-heading" className="font-semibold text-pearl">
        Recent activity
      </h3>
      <ol className="stagger flex flex-col divide-y divide-silver/10 rounded-xl border border-silver/10 bg-ballroom/45">
        {profile.recent.map((a) => (
          <li key={`${a.season}-${a.ep}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-col">
              <Link
                href={`/episode/?season=${encodeURIComponent(a.season)}&ep=${String(a.ep).padStart(2, "0")}`}
                prefetch={false}
                className={`${TEXT_LINK} self-start text-pearl no-underline`}
              >
                {weekLabel(a, season)}
                {a.theme && <span className="text-silver-dim"> · {a.theme}</span>}
              </Link>
              <span className="text-xs text-silver-dim">
                {plural(a.scored, "dance")} scored
                {a.answered > a.scored && `, ${a.answered - a.scored} revealed`}
              </span>
            </span>
            <span aria-hidden="true" className="text-lg font-semibold text-gold tabular-nums">
              {a.scored}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
