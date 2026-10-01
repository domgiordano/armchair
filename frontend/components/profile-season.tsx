import Link from "next/link";

import { CoupleAvatars, coupleName } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { DistributionChart, StyleChart, off } from "@/components/profile-charts";
import type { Profile, ProfileDance } from "@/lib/api/profile";
import type { Contestant, Season } from "@/lib/api/show";
import { byStyle, calls, closestJudge, distribution } from "@/lib/profile/season-stats";
import { episodeLabel } from "@/lib/show/schedule";

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
        <span className="text-lg font-semibold tracking-tight">{seasonTitle(profile.season.season)}</span>
        <span className="text-xs font-medium tracking-[0.14em] text-gold uppercase">Accuracy</span>
      </h2>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 md:grid-cols-3">
        <Stat label="Dances scored" value={String(count)} />
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
        <p className="text-sm text-neutral-400">
          Accuracy shows once they&apos;ve scored {MIN_DANCES} dances the judges have confirmed.
        </p>
      )}
      {own && count === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-neutral-700 p-4">
          <p className="text-sm text-neutral-300">
            Nothing to compare yet. A dance counts here once you&apos;ve scored it and every judge&apos;s score is
            confirmed.
          </p>
          <Link
            href="/episode/"
            className="rounded-md text-sm font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Score this week&apos;s dances
          </Link>
        </div>
      )}
      {own && dances.length > 0 && <Breakdown season={season} dances={dances} />}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex h-full flex-col gap-1 bg-ink p-4">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {note && <span className="text-xs text-neutral-400 tabular-nums">{note}</span>}
      </dd>
    </div>
  );
}

function Breakdown({ season, dances }: { season: Season; dances: ProfileDance[] }) {
  const styles = byStyle(dances);
  const pair = calls(dances);
  const couple = (key: string) => season.contestants.find((x) => x.id === key.slice(0, key.lastIndexOf("#")));
  // A team dance's key names every member couple, "a+b+c#1", so no one couple matches it.
  const team = (key: string) =>
    key
      .slice(0, key.lastIndexOf("#"))
      .split("+")
      .map((id) => season.contestants.find((x) => x.id === id)?.members.find((m) => m.role === "celebrity")?.name ?? id)
      .join(", ");
  const week = (ep: number) => {
    const e = season.episodes.find((x) => x.ep === ep);
    return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
  };

  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
      {styles.length > 0 && (
        <section aria-labelledby="by-style" className="flex flex-col gap-3">
          <div>
            <h3 id="by-style" className="font-semibold">
              By dance style
            </h3>
            <p className="text-xs text-neutral-400">Average gap to the judges. Shorter is closer.</p>
          </div>
          <StyleChart styles={styles} />
        </section>
      )}

      <section aria-labelledby="distribution" className="flex flex-col gap-3">
        <h3 id="distribution" className="font-semibold">
          Paddles you raised
        </h3>
        <DistributionChart counts={distribution(dances)} />
      </section>

      {pair && (
        <section aria-labelledby="calls" className="flex flex-col gap-3 md:col-span-2">
          <h3 id="calls" className="font-semibold">
            Best and worst calls
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            <Call
              title="Best call"
              tone="best"
              dance={pair.best}
              couple={couple(pair.best.key)}
              name={team(pair.best.key)}
              when={week(pair.best.ep)}
            />
            {pair.worst !== pair.best && (
              <Call
                title="Worst call"
                tone="worst"
                dance={pair.worst}
                couple={couple(pair.worst.key)}
                name={team(pair.worst.key)}
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
  couple: Contestant | undefined;
  // Shown when no one couple matches: a team dance.
  name: string;
  when: string;
}

function Call({ title, tone, dance, couple, name, when }: CallProps) {
  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border p-4 ${tone === "best" ? "border-amber-300/50 bg-amber-300/[0.06]" : "border-neutral-700"}`}
    >
      <p
        className={`text-xs font-semibold tracking-[0.12em] uppercase ${tone === "best" ? "text-amber-300" : "text-neutral-400"}`}
      >
        {title}
      </p>
      <div className="flex items-center gap-3">
        {couple && <CoupleAvatars members={couple.members} size={36} />}
        <p className="min-w-0 font-medium">
          {couple ? coupleName(couple) : name}
          <span className="block text-sm font-normal text-neutral-400">
            {[dance.style, when].filter(Boolean).join(" · ")}
          </span>
        </p>
      </div>
      <p className="flex items-baseline gap-3 text-sm tabular-nums">
        <span>
          You <span className="text-lg font-semibold">{dance.paddle}</span>
        </span>
        <span className="text-neutral-400">
          Judges <span className="text-lg font-semibold text-neutral-100">{formatScore(dance.panelMean)}</span>
        </span>
        <span className="ml-auto text-neutral-400">{off(dance.error)}</span>
      </p>
    </li>
  );
}
