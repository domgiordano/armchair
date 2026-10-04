import { Fragment } from "react";

import { FactionWord } from "@/components/faction-word";
import { PlayerChip } from "@/components/player-chip";
import { seasonPlayerHref } from "@/components/player-link";
import type { EpisodeEvent, Player } from "@/lib/api/traitors";
import { playerOf } from "@/lib/players";

interface OutcomeProps {
  event: EpisodeEvent;
  roster: Player[];
  /** Names link to each player's page in this season. */
  season: string;
}

/** What happened at one event: who, with their photo, and for a banishment, which side. */
export function Outcome({ event, roster, season }: OutcomeProps) {
  if (!event.result) return <span className="text-ash italic">Awaiting the castle</span>;
  const name = (id: string) => <PlayerChip player={playerOf(id, roster)} href={seasonPlayerHref(season)(id)} size={28} />;
  const names = (ids: string[] | undefined) =>
    ids?.length
      ? ids.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && ", "}
            {name(id)}
          </Fragment>
        ))
      : null;
  switch (event.type) {
    case "RT":
      return event.result.banished ? (
        <>
          {name(event.result.banished)}{" "}
          {event.result.faction && <FactionWord faction={event.result.faction} className="ml-1" />}
        </>
      ) : (
        <span className="text-ash">Nobody</span>
      );
    case "MURDER":
      return names(event.result.victims) ?? <span className="text-ash">Nobody</span>;
    case "RECRUIT":
      return names(event.result.recruits) ?? <span className="text-ash">Nobody</span>;
  }
}
