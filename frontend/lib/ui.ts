/** Joins class names, dropping the falsy ones. */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const FOCUS = "focus-ring";

export const BUTTON = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-medium whitespace-nowrap transition-colors duration-150 select-none ${FOCUS} disabled:cursor-not-allowed disabled:opacity-50`;

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "sequin text-ink",
  secondary:
    "border border-silver/30 bg-ballroom/40 text-pearl hover:border-silver/55 hover:bg-silver/10 active:bg-silver/15 aria-expanded:bg-silver/10",
  ghost: "text-silver hover:bg-silver/10 hover:text-pearl active:bg-silver/15",
  danger: "border border-red-300/30 bg-red-400/10 text-red-200 hover:bg-red-400/20 active:bg-red-400/25",
};

const SIZES: Record<ButtonSize, string> = { md: "", sm: "min-h-10 px-3 text-sm" };

/** Classes for a button, or a link that looks like one. */
export const button = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  cn(BUTTON, VARIANTS[variant], SIZES[size]);

export const PRIMARY = button("primary");
export const SECONDARY = button("secondary");
export const GHOST = button("ghost");

/** An inline text link: silver, underlined, gold on hover. */
export const TEXT_LINK = `rounded-sm text-sm text-silver underline decoration-silver/40 underline-offset-4 transition-colors hover:text-gold-light hover:decoration-gold-light ${FOCUS}`;

/** The text field every form shares. */
export const INPUT = `min-h-11 w-full rounded-md border border-silver/20 bg-ink/60 px-3 text-base text-pearl placeholder:text-silver-dim/70 transition-colors hover:border-silver/40 focus-visible:border-gold/70 ${FOCUS} aria-invalid:border-red-300/70 disabled:opacity-50`;

/** Small caps over a list: "MEMBERS 4". */
export const EYEBROW = "text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase";

/** Our own page headings in chrome display type. Never for show names, themes or people. */
export const DISPLAY = "font-display font-normal tracking-[-0.04em] text-pearl";
