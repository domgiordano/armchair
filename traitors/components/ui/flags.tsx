import { useId } from "react";

import { cn } from "@/lib/ui";

// The flags' own reds and blues; their white is our bone so they sit in candlelight.
const US_RED = "#b22234";
const US_BLUE = "#3c3b6e";
const UK_RED = "#c8102e";
const UK_BLUE = "#012169";

const STARS = Array.from({ length: 20 }, (_, i) => ({ x: 0.75 + (i % 5) * 1.55, y: 0.65 + Math.floor(i / 5) * 1.35 }));

export function UsFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 19 10" aria-hidden="true" className={cn("h-3 w-auto shrink-0 rounded-[1px]", className)}>
      <rect width={19} height={10} fill={US_RED} />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={(i * 10) / 13} width={19} height={10 / 13} fill="var(--bone)" />
      ))}
      <rect width={7.6} height={(7 * 10) / 13} fill={US_BLUE} />
      {STARS.map((s) => (
        <circle key={`${s.x}-${s.y}`} cx={s.x} cy={s.y} r={0.32} fill="var(--bone)" />
      ))}
    </svg>
  );
}

export function UkFlag({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true" className={cn("h-3 w-auto shrink-0 rounded-[1px]", className)}>
      <clipPath id={`${id}-t`}>
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <rect width={60} height={30} fill={UK_BLUE} />
      <path d="M0 0l60 30m0-30L0 30" stroke="var(--bone)" strokeWidth={6} />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${id}-t)`} stroke={UK_RED} strokeWidth={4} />
      <path d="M30 0v30M0 15h60" stroke="var(--bone)" strokeWidth={10} />
      <path d="M30 0v30M0 15h60" stroke={UK_RED} strokeWidth={6} />
    </svg>
  );
}
