"use client";

import { useEffect, useRef, useState } from "react";

import { Headshot } from "@/components/headshot";
import { SearchInput } from "@/components/ui/field";
import type { Card, Contestant, Member } from "@/lib/api/show";
import { useReducedMotion } from "@/lib/motion";
import { CUE_LABEL, type Cue } from "@/lib/show/running";
import { cn, FOCUS } from "@/lib/ui";

interface FindCoupleProps {
  /** The cards the query leaves, in the order the page lists them. */
  cards: Card[];
  contestants: Map<string, Contestant>;
  cues: Map<string, Cue>;
  query: string;
  onQuery: (q: string) => void;
}

/** The DOM id of a dance's list item, which a chip scrolls to. */
export const danceId = (key: string) => `dance-${key}`;

const faceOf = (card: Card, contestants: Map<string, Contestant>): Member | undefined => {
  const members = contestants.get(card.contestants[0])?.members;
  return members?.find((m) => m.role === "celebrity") ?? members?.[0];
};

/** The shell's sticky header, which this bar sits under. */
function useHeaderHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setHeight(header.getBoundingClientRect().height);
    measure();
    // The header only changes height across the md breakpoint, where it gains the tab row.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return height;
}

/**
 * Sticks under the header over a night's cards: type a celebrity or pro to narrow
 * them, or tap a face to jump to that dance. Faces run in the page's order, with
 * the running order's number and whoever is on now.
 */
export function FindCouple({ cards, contestants, cues, query, onQuery }: FindCoupleProps) {
  const bar = useRef<HTMLDivElement>(null);
  const top = useHeaderHeight();
  const reduced = useReducedMotion();

  const jump = (key: string) => {
    const target = document.getElementById(danceId(key));
    if (!target) return;
    const offset = top + (bar.current?.getBoundingClientRect().height ?? 0) + 12;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - offset,
      behavior: reduced ? "auto" : "smooth",
    });
    target.focus({ preventScroll: true });
  };

  return (
    <div
      ref={bar}
      role="search"
      aria-label="Find a couple"
      style={{ top }}
      className="sticky z-10 flex min-w-0 flex-col gap-2 rounded-xl border border-silver/10 bg-ink/90 p-2 shadow-[0_12px_32px_-16px_rgb(2_8_30/0.9)] backdrop-blur-md"
    >
      <SearchInput
        label="Find a couple"
        hideLabel
        value={query}
        onChange={onQuery}
        placeholder="Find a celebrity or pro"
        maxLength={40}
      />
      <ul
        aria-label="Jump to a dance"
        className="flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {cards.map((c) => {
          const face = faceOf(c, contestants);
          const cue = cues.get(c.key);
          const name = c.contestants
            .map((id) => contestants.get(id)?.members.find((m) => m.role === "celebrity")?.name ?? id)
            .join(", ");
          return (
            <li key={c.key} className="shrink-0">
              <button
                type="button"
                onClick={() => jump(c.key)}
                aria-label={[`Jump to ${name}`, c.order && `number ${c.order}`, cue && CUE_LABEL[cue]]
                  .filter(Boolean)
                  .join(", ")}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm text-silver transition-colors hover:border-silver/40 hover:text-pearl active:bg-silver/10",
                  cue === "on" ? "border-gold/70 bg-gold/10 text-pearl" : "border-silver/15 bg-ballroom/50",
                  FOCUS,
                )}
              >
                {face && <Headshot person={face} size={32} />}
                {c.order !== undefined && <span className="font-semibold text-gold-light tabular-nums">{c.order}</span>}
                <span className="max-w-[7rem] truncate">{name.split(" ")[0]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
