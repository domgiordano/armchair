import { Toggle } from "@/components/ui/field";
import type { Elimination } from "@/lib/api/couples";
import { eliminatedWhen } from "@/lib/show/eliminated";
import { cn } from "@/lib/ui";

/** What an eliminated couple's card puts on its faces and numbers: drained, not hidden. */
export const OUT_FADE = "opacity-55 grayscale";

/** A red rule through an eliminated couple's names. */
export const OUT_STRIKE = "line-through decoration-stamp decoration-2";

interface StampProps {
  out: Elimination;
  /** `sm` fits over a list row's faces; `md` is struck across a card. */
  size?: "sm" | "md";
  className?: string;
}

/** The "ELIMINATED · WEEK 4" rubber stamp. */
export function EliminatedStamp({ out, size = "md", className }: StampProps) {
  return (
    <span
      className={cn(
        "ink-stamp pointer-events-none inline-flex shrink-0 flex-col items-center select-none",
        size === "md" ? "gap-1 px-3 py-1.5 text-sm" : "gap-0.5 px-2 py-1 text-[11px] [--tilt:-6deg]",
        className,
      )}
    >
      <span>Eliminated</span>
      <span className="sr-only"> · </span>
      <span className={cn("tracking-[0.22em]", size === "md" ? "text-[10px]" : "text-[8px]")}>{eliminatedWhen(out)}</span>
    </span>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Eliminated couples in the view, hidden or not. */
  count: number;
}

/** The "Show eliminated" switch. Nothing to switch until someone has gone home. */
export function ShowEliminated({ checked, onChange, count }: ToggleProps) {
  if (count === 0) return null;
  return (
    <div className="rounded-xl border border-silver/10 bg-ballroom/30 px-3 sm:max-w-xs">
      <Toggle
        label="Show eliminated"
        hint={`${count} ${count === 1 ? "couple has" : "couples have"} gone home`}
        checked={checked}
        onChange={onChange}
      />
    </div>
  );
}
