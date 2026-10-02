import type { Faction } from "@/lib/api/traitors";
import { cn } from "@/lib/ui";

/** The reveal word, burning in from below. Traitor in red fire, Faithful in green. */
export function FactionWord({ faction, className }: { faction: Faction; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block font-title font-bold animate-burn-in",
        faction === "Traitor" ? "fire-text text-blood-hi" : "text-moss [text-shadow:0_0_14px_rgb(93_182_131/0.55)]",
        className,
      )}
    >
      {faction}.
    </span>
  );
}
