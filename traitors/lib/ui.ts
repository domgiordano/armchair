/** Joins class names, dropping the falsy ones. */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const FOCUS = "focus-ring";

export type ButtonVariant = "primary" | "gold" | "blood" | "outline" | "ghost";
export type ButtonSize = "md" | "sm";

const BASE = `${FOCUS} inline-flex min-h-11 items-center justify-center gap-2.5 rounded-sm font-display font-semibold tracking-[0.12em] uppercase whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0`;

// candle and ember fills take night text (10.7 and 6.2:1), never white.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-gilt bg-cloak-500 text-bone hover:border-candle hover:bg-cloak-500/80 active:bg-cloak",
  gold: "border border-flame/70 bg-candle text-night hover:bg-flame active:bg-gilt",
  blood: "border border-blood-hi/70 bg-blood text-bone hover:bg-blood/85 active:bg-oxblood",
  outline: "border border-ash-dim text-parchment hover:border-gilt hover:text-bone active:bg-cloak/60",
  ghost: "text-parchment hover:bg-cloak hover:text-bone active:bg-cloak/70",
};

const SIZES: Record<ButtonSize, string> = { md: "px-5 text-sm", sm: "px-3 text-xs" };

/** Classes for a button, or a link that looks like one. */
export const button = (variant: ButtonVariant = "primary", size: ButtonSize = "md") =>
  cn(BASE, VARIANTS[variant], SIZES[size]);

export const BUTTON = button();

export const TEXT_LINK = `${FOCUS} rounded-sm text-parchment underline decoration-gilt/50 underline-offset-4 transition-colors hover:text-candle hover:decoration-candle`;

/** Small caps over a section: "ROUND TABLE". */
export const EYEBROW = "font-display text-xs font-semibold tracking-[0.18em] text-gilt uppercase";

/** Our own headings. Never the show's wordmark. */
export const HEADING = "font-display font-semibold tracking-[0.06em] text-bone";
