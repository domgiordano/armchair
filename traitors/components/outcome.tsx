import { FactionWord } from "@/components/faction-word";
import type { EpisodeEvent, Player } from "@/lib/api/traitors";
import { nameOf } from "@/lib/players";

/** What happened at one event, in words: who, and for a banishment, which side. */
export function Outcome({ event, roster }: { event: EpisodeEvent; roster: Player[] }) {
  if (!event.result) return <span className="text-ash italic">Awaiting the castle</span>;
  const names = (ids: string[] | undefined) => (ids?.length ? ids.map((id) => nameOf(id, roster)).join(", ") : null);
  switch (event.type) {
    case "RT":
      return event.result.banished ? (
        <>
          {nameOf(event.result.banished, roster)} {event.result.faction && <FactionWord faction={event.result.faction} className="ml-1" />}
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
