import Link from "next/link";

import { FactionBadge } from "@/components/faction-badge";
import { Headshot } from "@/components/ui/avatar";
import type { CastMember } from "@/lib/api/traitors";
import { finishText } from "@/lib/history";
import { cn, FOCUS } from "@/lib/ui";

interface CastWallProps {
  players: CastMember[];
  hrefOf: (id: string) => string;
}

/** The portrait wall: everyone in the season, crossed off as they go, each a link to their page. */
export function CastWall({ players, hrefOf }: CastWallProps) {
  return (
    <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5">
      {players.map((p) => (
        <li key={p.id}>
          <CastTile player={p} href={hrefOf(p.id)} />
        </li>
      ))}
    </ul>
  );
}

function CastTile({ player, href }: { player: CastMember; href: string }) {
  const finish = finishText(player.exit);
  const won = player.exit?.how === "winner";
  return (
    <Link
      href={href}
      aria-label={[player.name, player.faction, finish].filter(Boolean).join(", ")}
      className={`${FOCUS} group flex flex-col items-center gap-1.5 rounded-sm p-1 text-center transition-colors hover:bg-cloak/50 active:bg-cloak`}
    >
      <span aria-hidden="true">
        <Headshot
          name={player.name}
          image={player.headshot}
          exit={player.exit}
          size={84}
          className={cn(
            "shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)] transition-[box-shadow] group-hover:ring-candle",
            won && "ring-2 ring-candle",
          )}
        />
      </span>
      <span className="text-sm leading-tight text-bone group-hover:text-candle">{player.name}</span>
      {player.faction && <FactionBadge faction={player.faction} />}
      {finish && <span className={cn("text-xs leading-tight", won ? "text-candle" : "text-ash")}>{finish}</span>}
    </Link>
  );
}
