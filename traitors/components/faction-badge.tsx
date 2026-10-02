import type { Faction } from "@/lib/api/traitors";
import { cn } from "@/lib/ui";

/** A quiet label for a known faction; FactionWord is the loud reveal. Bone on blood is 5.6:1, on cloak 8.5:1. */
export function FactionBadge({ faction, className }: { faction: Faction; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-display text-[10px] leading-none font-semibold tracking-[0.14em] text-bone uppercase",
        faction === "Traitor" ? "border-blood-hi/70 bg-blood" : "border-moss/60 bg-cloak-500",
        className,
      )}
    >
      {faction}
    </span>
  );
}
