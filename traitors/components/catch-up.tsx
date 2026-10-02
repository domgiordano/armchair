"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SeasonEpisode } from "@/lib/api/traitors";
import { unfinishedBefore } from "@/lib/schedule";
import { cn, EYEBROW, HEADING } from "@/lib/ui";

interface CatchUpProps {
  episodes: SeasonEpisode[];
  episode: SeasonEpisode;
  now: number;
  onCatchUp: (ep: number) => void;
  children: ReactNode;
}

/**
 * Asks before opening episode N while earlier episodes still have calls to make:
 * N's roster gives away who left before it. Go back and call them, or open N anyway.
 */
export function CatchUp({ episodes, episode, now, onCatchUp, children }: CatchUpProps) {
  const [dismissed, setDismissed] = useState(false);
  const open = unfinishedBefore(episodes, episode.ep, now);
  if (dismissed || open.length === 0) return children;

  const count = `${open.length} earlier ${open.length === 1 ? "episode" : "episodes"}`;
  return (
    <Card as="section" tone="cloak" tartan aria-labelledby="catch-up-title" className="flex flex-col gap-4 p-5 animate-pop-in">
      <p className={cn(EYEBROW, "text-ember")}>Spoiler ahead</p>
      <h2 id="catch-up-title" className={cn(HEADING, "text-2xl")}>
        You have calls to make in {count}
      </h2>
      <ul aria-label="Unfinished episodes" className="flex flex-wrap gap-2">
        {open.map((e) => (
          <li key={e.ep} className="rounded-sm border border-gilt/40 px-2.5 py-1 text-sm text-parchment">
            Episode {e.ep} · <span className="nums">{e.answered}</span> of <span className="nums">{e.events}</span>
          </li>
        ))}
      </ul>
      <p className="leading-relaxed text-parchment">
        Opening episode {episode.ep} shows who is still in the castle, which gives away what happened
        before it. Make those calls first, or open this one and come back later.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="gold" onClick={() => onCatchUp(open[0].ep)}>
          Back to episode {open[0].ep}
        </Button>
        <Button variant="outline" onClick={() => setDismissed(true)}>
          Open it anyway
        </Button>
      </div>
    </Card>
  );
}
