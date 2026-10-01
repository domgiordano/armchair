import { cn } from "@/lib/ui";

/** A gold ring spinning beside a status line. Decorative: the text says what's happening. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-silver/25 border-t-gold", className)}
    />
  );
}
