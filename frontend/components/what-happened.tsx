import { Headshot } from "@/components/headshot";
import { judgeName } from "@/components/leaderboard-screen";
import type { Judge, LockedWriteup, Writeup } from "@/lib/api/show";
import { cn, FOCUS } from "@/lib/ui";

interface WhatHappenedProps {
  writeup: Writeup | LockedWriteup | null | undefined;
  judges: Judge[];
  className?: string;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * A dance's AI write-up, folded away until asked for. A locked one shows only
 * that it exists: the judges' reactions open with the dance, like their scores.
 */
export function WhatHappened({ writeup, judges, className }: WhatHappenedProps) {
  if (!writeup) return null;
  if ("locked" in writeup) {
    return (
      <p className={cn("flex items-center gap-2 text-xs text-silver-dim", className)}>
        <LockGlyph />
        <span>
          <span className="font-semibold text-silver">What happened</span> opens once you score this dance, with
          what the judges said.
        </span>
      </p>
    );
  }
  return (
    <details className={cn("group rounded-lg border border-silver/10 bg-ink/30", className)}>
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium text-pearl select-none [&::-webkit-details-marker]:hidden",
          FOCUS,
        )}
      >
        What happened
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="size-4 text-silver-dim transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 text-sm">
        {writeup.summary && <p className="leading-relaxed text-silver">{writeup.summary}</p>}
        {writeup.judges.length > 0 && (
          <ul aria-label="What the judges said" className="flex flex-col gap-2.5">
            {writeup.judges.map((j) => {
              const judge = judges.find((x) => x.id === j.id);
              const name = judge?.name ?? judgeName(j.id, judges);
              return (
                <li key={j.id} className="flex items-start gap-2.5">
                  <Headshot person={{ name, headshot: judge?.headshot ?? null }} size={32} />
                  <p className="min-w-0 text-silver">
                    <span className="font-semibold text-pearl">{name}</span>{" "}
                    {j.text}
                    {j.quote && <span className="text-gold-light"> &ldquo;{j.quote}&rdquo;</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {writeup.highlights.length > 0 && (
          <ul aria-label="Highlights" className="flex flex-wrap gap-1.5">
            {writeup.highlights.map((h) => (
              <li key={h} className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold-light">
                {h}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-silver-dim">
          Summary written by AI from published recaps
          {writeup.sources.length > 0 && ": "}
          {writeup.sources.map((url, i) => (
            <span key={url}>
              {i > 0 && ", "}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("underline decoration-silver/40 underline-offset-2 hover:text-gold-light", FOCUS)}
              >
                {host(url)}
              </a>
            </span>
          ))}
        </p>
      </div>
    </details>
  );
}

function LockGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-3.5 shrink-0 text-gold/80"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
