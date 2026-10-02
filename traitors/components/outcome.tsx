import { Fragment } from "react";

import { FactionWord } from "@/components/faction-word";
import { PlayerLink } from "@/components/player-link";
import type { EpisodeEvent, Player } from "@/lib/api/traitors";
import { nameOf } from "@/lib/players";

interface OutcomeProps {
  event: EpisodeEvent;
  roster: Player[];
  /** Names link to each player's page in this season. */
  season: string;
}

/** What happened at one event, in words: who, and for a banishment, which side. */
export function Outcome({ event, roster, season }: OutcomeProps) {
  if (!event.result) return <span className="text-ash italic">Awaiting the castle</span>;
  const name = (id: string) => (
    <PlayerLink season={season} id={id} className="text-bone">
      {nameOf(id, roster)}
    </PlayerLink>
  );
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
