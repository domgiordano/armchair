import { cn } from "@/lib/ui";

export type PaddleTone = "judge" | "you" | "pending";

interface PaddleProps {
  /** What's on the face: a score, or "-" while pending. */
  face: string;
  tone?: PaddleTone;
  /** An unconfirmed score: dashed rim. */
  dashed?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const FACES: Record<PaddleTone, string> = {
  judge: "border-gold-deep bg-gradient-to-b from-paddle via-pearl to-paddle-shade text-ink",
  you: "border-gold-deep bg-gradient-to-b from-gold-light via-gold to-gold-shade text-ink",
  pending: "border-silver/20 bg-ballroom text-silver-dim",
};

/**
 * A judge's score paddle: a rounded face with a gold rim, a brass collar and a
 * lacquered handle. Decorative; the caller says the score in words.
 */
export function Paddle({ face, tone = "judge", dashed = false, size = "md", className }: PaddleProps) {
  const sm = size === "sm";
  return (
    <span aria-hidden="true" className={cn("flex flex-col items-center", className)}>
      <span
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-[10px] border-2 font-extrabold tabular-nums shadow-[0_3px_0_rgb(2_8_30/0.5),inset_0_1px_0_rgb(251_250_245/0.6)]",
          sm ? "h-10 text-lg" : "h-14 text-2xl",
          FACES[tone],
          dashed && "border-dashed",
        )}
      >
        {/* The lacquer's shine across the top of the face. */}
        {tone !== "pending" && (
          <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-t-[7px] bg-gradient-to-b from-paddle/70 to-transparent" />
        )}
        <span className="relative">{face}</span>
      </span>
      <span className={cn("rounded-sm", sm ? "h-1 w-3" : "h-1.5 w-4", tone === "pending" ? "bg-silver/20" : "bg-gradient-to-b from-gold-light to-gold-deep")} />
      <span
        className={cn(
          "rounded-b-md",
          sm ? "h-2.5 w-1.5" : "h-4 w-2.5",
          tone === "pending" ? "bg-silver/15" : "bg-gradient-to-r from-lacquer-deep via-lacquer to-lacquer-deep",
        )}
      />
    </span>
  );
}
