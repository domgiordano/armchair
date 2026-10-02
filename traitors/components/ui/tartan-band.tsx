import { cn } from "@/lib/ui";

interface TartanBandProps {
  className?: string;
  vertical?: boolean;
}

/** A strip of our tartan with a gilt edge: under the header, down a card, along the leaderboard. */
export function TartanBand({ className, vertical = false }: TartanBandProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "tartan block",
        vertical ? "border-r border-gilt/70" : "h-1.5 w-full border-y border-gilt/70",
        className,
      )}
    />
  );
}
