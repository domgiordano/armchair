"use client";

import { Avatar } from "@/components/avatar";
import { useGroupBoard } from "@/components/groups/use-group-board";
import { timeAgo } from "@/components/notifications";
import { ScoreCta } from "@/components/score-cta";
import { displayName } from "@/components/social/parts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserLink } from "@/components/user-link";
import type { GroupDetail, GroupPerson } from "@armchair/app-core/api/groups";
import { joins, weekProgress } from "@/lib/social/group-summary";
import { useSeasonId } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { EYEBROW } from "@/lib/ui";

/** Who in the group has scored this week's show, then your own way in. */
export function GroupWeek({ group, me }: { group: GroupDetail; me: string | null }) {
  const season = useSeasonId();
  const [load] = useGroupBoard(group.id, season);
  const catalog = useSeason();
  const week = load.kind === "ready" ? weekProgress(group, load.board) : null;
  const episode = week && catalog.kind === "ready" ? catalog.season.episodes.find((e) => e.ep === week.ep) : undefined;

  if (load.kind === "loading") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl border border-silver/10 p-4">
        <span className="sr-only">Loading this week...</span>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 rounded-full" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (!week) return <ScoreCta group={group.id} />;

  const title = `Week ${week.week ?? week.ep}${episode?.theme ? ` · ${episode.theme}` : ""}`;
  const n = group.members.length;
  return (
    <Card
      id="group-week"
      title={title}
      note={`${week.done.length} of ${n} ${n === 1 ? "has" : "have"} scored every dance.`}
    >
      <span
        role="progressbar"
        aria-label="Members who scored the whole show"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={week.done.length}
        className="-mt-1 flex h-1.5 overflow-hidden rounded-full bg-silver/10"
      >
        <span
          className="grow-x h-full bg-gradient-to-r from-gold-deep to-gold-light"
          style={{ width: `${(week.done.length / n) * 100}%` }}
        />
        <span className="h-full bg-gold/30" style={{ width: `${(week.started.length / n) * 100}%` }} />
      </span>
      <Bucket label="Scored the show" people={week.done} me={me} />
      <Bucket label="Partway" people={week.started} me={me} />
      <Bucket label="Not started" people={week.waiting} me={me} />
      <ScoreCta compact onlyToScore group={group.id} />
    </Card>
  );
}

function Bucket({ label, people, me }: { label: string; people: GroupPerson[]; me: string | null }) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className={EYEBROW}>
        {label} <span className="text-gold tabular-nums">{people.length}</span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <li
            key={p.sub}
            className="flex items-center gap-1.5 rounded-full border border-silver/15 bg-ink/40 py-0.5 pr-2.5 pl-0.5 text-sm"
          >
            <Avatar name={displayName(p)} email="" picture={p.picture} size={22} />
            <UserLink sub={p.sub} className="text-pearl">
              {p.sub === me ? "You" : displayName(p).split(" ")[0]}
            </UserLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SHOWN = 6;

/** Joins, newest first, and what's waiting on the owner. */
export function GroupActivity({ group, me, owner }: { group: GroupDetail; me: string | null; owner: boolean }) {
  const recent = joins(group).slice(0, SHOWN);
  const founder = recent.at(-1)?.member.sub === group.owner && recent.length === group.members.length;
  return (
    <Card id="group-activity" title="Activity">
      <ol className="flex flex-col gap-3">
        {owner &&
          group.requests.map((p) => (
            <Line key={`r-${p.sub}`} person={p} me={me} text="asked to join" note="Answer under Members" />
          ))}
        {group.invited.map((p) => (
          <Line key={`i-${p.sub}`} person={p} me={me} text="was invited" note="Hasn't answered yet" />
        ))}
        {recent.map(({ member, at }, i) => (
          <Line
            key={member.sub}
            person={member}
            me={me}
            text={founder && i === recent.length - 1 ? "started the group" : "joined"}
            note={timeAgo(at)}
          />
        ))}
      </ol>
      {recent.length === 0 && group.invited.length === 0 && <p className="text-sm text-silver-dim">Nothing yet.</p>}
    </Card>
  );
}

function Line({ person, me, text, note }: { person: GroupPerson; me: string | null; text: string; note: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <Avatar name={displayName(person)} email="" picture={person.picture} size={28} />
      <span className="min-w-0 flex-1">
        <span className="text-pearl">
          {person.sub === me ? "You" : <UserLink sub={person.sub}>{displayName(person)}</UserLink>}
        </span>{" "}
        <span className="text-silver">{text}</span>
        <span className="block text-xs text-silver-dim">{note}</span>
      </span>
    </li>
  );
}
