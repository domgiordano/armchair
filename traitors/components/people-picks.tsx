import { PlayerChip } from "@/components/player-chip";
import { seasonPlayerHref } from "@/components/player-link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { CallWhy, EpisodeEvent, GroupPick, Person, Player } from "@/lib/api/traitors";
import { playerOf, roman } from "@/lib/players";
import { cn, EYEBROW } from "@/lib/ui";

export const WHY: Record<CallWhy, string> = {
  banished: "banished",
  exact: "right place",
  top3: "in the top 3",
  hit: "called it",
  miss: "missed",
  void: "didn't happen",
};

interface PeoplePicksProps {
  season: string;
  event: EpisodeEvent;
  roster: Player[];
  people: Map<string, Person>;
  /** "Your group" or "Your friends". */
  title: string;
}

/** Each friend's or group member's call on one event, with the points each pick earned and why. */
export function PeoplePicks({ season, event, roster, people, title }: PeoplePicksProps) {
  const rows = [...(event.group ?? [])].sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
  const id = `people-${event.type}`;
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className={EYEBROW}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-ash">Nobody else here has made this call yet.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((g) => (
            <PersonRow key={g.sub} season={season} kind={event.type} pick={g} roster={roster} who={people.get(g.sub)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function PersonRow({
  season,
  kind,
  pick,
  roster,
  who,
}: {
  season: string;
  kind: EpisodeEvent["type"];
  pick: GroupPick;
  roster: Player[];
  who: Person | undefined;
}) {
  const name = who?.name ?? "Someone";
  return (
    <li className="flex flex-col gap-1.5 border-b border-bone/10 py-2.5 last:border-b-0">
      <span className="flex items-center gap-3">
        <Avatar name={who?.name ?? null} picture={who?.picture ?? null} size={32} />
        <span className="min-w-0 flex-1 truncate text-bone">{name}</span>
        {pick.points !== undefined && (
          <span className={cn("font-display text-lg font-semibold nums", pick.points > 0 ? "text-candle" : "text-ash")}>
            +{pick.points}
          </span>
        )}
      </span>
      {pick.picks ? (
        <ol aria-label={`${name}'s call`} className="flex flex-wrap gap-x-4 gap-y-1 pl-11">
          {pick.picks.map((p, i) => {
            const call = pick.calls?.[i];
            return (
              <li key={p} className="flex items-center gap-1.5">
                {kind === "RT" && <span className="font-display text-sm text-gilt">{roman(i + 1)}</span>}
                <PlayerChip player={playerOf(p, roster)} href={seasonPlayerHref(season)(p)} size={22} />
                {call && (
                  <span className={cn("text-sm", call.points > 0 ? "text-candle" : "text-ash")}>
                    {call.points > 0 ? `+${call.points} ` : ""}
                    {WHY[call.why]}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <span className="pl-11 text-ash italic">No pick</span>
      )}
    </li>
  );
}
