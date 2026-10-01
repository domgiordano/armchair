import Link from "next/link";

import { judgeName } from "@/components/leaderboard-screen";
import { off } from "@/components/profile-charts";
import { Stat } from "@/components/profile-season";
import type { Profile } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { episodeLabel } from "@/lib/show/schedule";
import { TEXT_LINK } from "@/lib/ui";

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** Every season together, then the episodes they scored most recently. */
export function ProfileAllTime({ season, profile }: { season: Season; profile: Profile }) {
  const all = profile.allTime;
  const recent = profile.recent ?? [];
  if (!all && recent.length === 0) return null;
  const label = (ep: number) => {
    const e = season.episodes.find((x) => x.ep === ep);
    return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {all && (
        <section aria-labelledby="all-time-heading" className="flex flex-col gap-3">
          <h2 id="all-time-heading" className="text-lg font-semibold tracking-tight text-pearl">
            All-time
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-silver/10 bg-silver/10 md:grid-cols-3">
            <Stat label="Dances scored" value={all.count} />
            <Stat label="Gap to the judges" value={all.mae === null ? "None yet" : off(all.mae)} />
            <div className="col-span-2 md:col-span-1">
              <Stat
                label="Closest judge"
                value={all.closestJudge ? judgeName(all.closestJudge.id, season.judges) : "None yet"}
                note={all.closestJudge ? off(all.closestJudge.mae) : undefined}
              />
            </div>
          </dl>
        </section>
      )}
      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-tight text-pearl">
            Recent activity
          </h2>
          <ol className="stagger flex flex-col divide-y divide-silver/10 rounded-xl border border-silver/10 bg-ballroom/45">
            {recent.map((a) => (
              <li key={a.ep} className="px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <Link
                    href={`/episode/?season=${encodeURIComponent(season.season)}&ep=${String(a.ep).padStart(2, "0")}`}
                    prefetch={false}
                    className={`${TEXT_LINK} self-start text-pearl no-underline`}
                  >
                    {label(a.ep)}
                    {a.theme && <span className="text-silver-dim"> · {a.theme}</span>}
                  </Link>
                  <span className="text-xs text-silver-dim">
                    {plural(a.scored, "dance")} scored
                    {a.answered > a.scored && `, ${a.answered - a.scored} revealed`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
