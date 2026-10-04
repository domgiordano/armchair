import Link from "next/link";

import { Headshot } from "@/components/ui/avatar";
import type { Player } from "@/lib/api/traitors";
import { cn, FOCUS } from "@/lib/ui";

interface PlayerChipProps {
  player: Player;
  href: string;
  size?: number;
  className?: string;
  nameClassName?: string;
}

/** A player's photo and name, linked to their page. Sits inline in a sentence. */
export function PlayerChip({ player, href, size = 28, className, nameClassName }: PlayerChipProps) {
  return (
    <Link
      href={href}
      className={cn(FOCUS, "group inline-flex items-center gap-1.5 rounded-sm pr-1 align-middle hover:text-candle", className)}
    >
      <span aria-hidden="true" className="inline-flex">
        <Headshot name={player.name} image={player.headshot} size={size} round />
      </span>
      <span className={cn("text-bone group-hover:text-candle", nameClassName)}>{player.name}</span>
    </Link>
  );
}
