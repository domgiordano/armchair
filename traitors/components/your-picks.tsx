import { Headshot } from "@/components/ui/avatar";
import type { EventType, Player, SeasonEpisode } from "@/lib/api/traitors";
import { firstName, playerOf, roman } from "@/lib/players";
import { cn } from "@/lib/ui";

const SHORT: Record<EventType, string> = { MURDER: "Murder", RT: "Banish", RECRUIT: "Recruit" };
const ORDER: EventType[] = ["MURDER", "RT", "RECRUIT"];

/** "You picked": your calls in one episode as small faces, for lists. No links, so it can sit inside one. */
export function YourPicks({ mine, players, className }: { mine: SeasonEpisode["mine"]; players: Player[]; className?: string }) {
  const kinds = ORDER.filter((k) => mine?.[k]);
  if (!mine || kinds.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-parchment", className)}>
      <span className="text-ash">You picked</span>
      {kinds.map((k) => {
        const call = mine[k];
        if (!call) return null;
        return (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="font-display text-xs tracking-[0.1em] text-ash uppercase">{SHORT[k]}</span>
            {call.picks ? (
              call.picks.map((id, i) => {
                const p = playerOf(id, players);
                return (
                  <span key={id} className="inline-flex items-center gap-0.5">
                    {k === "RT" && <span className="font-display text-xs text-gilt">{roman(i + 1)}</span>}
                    <span aria-hidden="true" className="inline-flex">
                      <Headshot name={p.name} image={p.headshot} size={18} round />
                    </span>
                    <span className="text-bone">{firstName(p.name)}</span>
                  </span>
                );
              })
            ) : (
              <span className="italic">no pick</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
