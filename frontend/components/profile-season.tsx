import Link from "next/link";
import type { ReactNode } from "react";

import { formatScore } from "@/components/performance-card";
import { DistributionChart, StyleChart, off } from "@/components/profile-charts";
import { CountUp } from "@/components/ui/count-up";
import type { Profile, ProfileDance } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { byStyle, calls, closestJudge, distribution } from "@/lib/profile/season-stats";
import { episodeLabel } from "@/lib/show/schedule";
import { TEXT_LINK } from "@/lib/ui";

// Mirrors users_get.MIN_DANCES: below it the API sends no error for someone else.
const MIN_DANCES = 5;

interface ProfileSeasonProps {
  season: Season;
  profile: Profile;
  own: boolean;
}

export const seasonTitle = (id: string) => `Season ${id.split("-")[1]}`;

/** Season numbers for any profile; your own adds the style, distribution and best/worst breakdowns. */
export function ProfileSeason({ season, profile, own }: ProfileSeasonProps) {
  const { count, mae, judges } = profile.season;
  const judgeId = closestJudge(judges);
  const judgeName = judgeId ? (season.judges.find((j) => j.id === judgeId)?.name ?? judgeId) : null;
  const dances = profile.dances ?? [];

  return (
    <section aria-labelledby="season-heading" className="flex flex-col gap-5">
      <h2 id="season-heading" className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight text-pearl">{seasonTitle(profile.season.season)}</span>
        <span className="text-xs font-medium tracking-[0.14em] text-gold uppercase">Accuracy</span>
      </h2>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-silver/10 bg-silver/10 md:grid-cols-3">
        <Stat label="Dances scored" value={<CountUp value={count} />} />
        <Stat
          label="Gap to the judges"
          value={mae === null ? "None yet" : off(mae)}
          note={mae === null ? undefined : "average per dance"}
        />
        <div className="col-span-2 md:col-span-1">
          <Stat
            label="Closest judge"
            value={judgeName ?? "None yet"}
            note={judgeId ? off(judges[judgeId].mae) : undefined}
          />
        </div>
      </dl>

      {!own && mae === null && count > 0 && (
        <p className="text-sm text-silver-dim">
          Accuracy shows once they&apos;ve scored {MIN_DANCES} dances the judges have confirmed.
        </p>
      )}
      {own && count === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-silver/15 bg-ink/30 p-4">
          <p className="text-sm text-silver">
            Nothing to compare yet. A dance counts here once you&apos;ve scored it and every judge&apos;s score is
            confirmed.
          </p>
          <Link
            href="/episode/"
            className={`${TEXT_LINK} inline-flex min-h-11 items-center font-medium`}
          >
            Score this week&apos;s dances
          </Link>
        </div>
      )}
      {own && dances.length > 0 && <Breakdown season={season} dances={dances} />}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex h-full flex-col gap-1 bg-ballroom/90 p-4">
      <dt className="text-xs font-medium tracking-[0.12em] text-silver-dim uppercase">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold text-pearl tabular-nums">{value}</span>
        {note && <span className="text-xs text-silver-dim tabular-nums">{note}</span>}
      </dd>
    </div>
  );
}

function Breakdown({ season, dances }: { season: Season; dances: ProfileDance[] }) {
  const styles = byStyle(dances);
  const pair = calls(dances);
  const celebrity = (key: string) => {
    const cid = key.slice(0, key.lastIndexOf("#"));
    const c = season.contestants.find((x) => x.id === cid);
    return c?.members.find((m) => m.role === "celebrity")?.name ?? cid;
  };
  const week = (ep: number) => {
    const e = season.episodes.find((x) => x.ep === ep);
    return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
  };

  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
      {styles.length > 0 && (
        <section aria-labelledby="by-style" className="flex flex-col gap-3">
          <div>
            <h3 id="by-style" className="font-semibold text-pearl">
              By dance style
            </h3>
            <p className="text-xs text-silver-dim">Average gap to the judges. Shorter is closer.</p>
          </div>
          <StyleChart styles={styles} />
        </section>
      )}

      <section aria-labelledby="distribution" className="flex flex-col gap-3">
        <h3 id="distribution" className="font-semibold text-pearl">
          Paddles you raised
        </h3>
        <DistributionChart counts={distribution(dances)} />
      </section>

      {pair && (
        <section aria-labelledby="calls" className="flex flex-col gap-3 md:col-span-2">
          <h3 id="calls" className="font-semibold text-pearl">
            Best and worst calls
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            <Call
              title="Best call"
              tone="best"
              dance={pair.best}
              who={celebrity(pair.best.key)}
              when={week(pair.best.ep)}
            />
            {pair.worst !== pair.best && (
              <Call
                title="Worst call"
                tone="worst"
                dance={pair.worst}
                who={celebrity(pair.worst.key)}
                when={week(pair.worst.ep)}
              />
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

interface CallProps {
  title: string;
  tone: "best" | "worst";
  dance: ProfileDance;
  who: string;
  when: string;
}

function Call({ title, tone, dance, who, when }: CallProps) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border p-4 ${tone === "best" ? "border-gold/45 bg-gold/[0.07]" : "border-silver/15 bg-ballroom/40"}`}
    >
      <p className={`text-xs font-semibold tracking-[0.12em] uppercase ${tone === "best" ? "text-gold" : "text-silver-dim"}`}>
        {title}
      </p>
      <p className="font-medium text-pearl">
        {who}
        <span className="block text-sm font-normal text-silver-dim">
          {[dance.style, when].filter(Boolean).join(" · ")}
        </span>
      </p>
      <p className="flex items-baseline gap-3 text-sm tabular-nums">
        <span>
          You <span className="text-lg font-semibold">{dance.paddle}</span>
        </span>
        <span className="text-silver-dim">
          Judges <span className="text-lg font-semibold text-pearl">{formatScore(dance.panelMean)}</span>
        </span>
        <span className="ml-auto text-silver-dim">{off(dance.error)}</span>
      </p>
    </li>
  );
}
