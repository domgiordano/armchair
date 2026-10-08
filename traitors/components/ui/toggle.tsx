import { useId } from "react";

import { cn, FOCUS } from "@/lib/ui";

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch that applies as it flips: a candle-gold track when on. */
export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1">
      <span className="flex flex-col">
        <span id={`${id}-label`} className="text-bone">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="text-sm text-ash">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={cn("group relative flex h-11 w-14 shrink-0 items-center rounded-full", FOCUS)}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-7 w-full rounded-full border transition-colors duration-200",
            checked ? "border-gilt bg-candle/85" : "border-ash-dim bg-night group-hover:border-gilt/60",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-1 size-5 rounded-full shadow transition-transform duration-200",
            checked ? "translate-x-7 bg-bone" : "translate-x-0 bg-ash",
          )}
        />
      </button>
    </div>
  );
}
