"use client";

import { useEffect, useState } from "react";

import { getRecent, type ActivityEvent } from "@/lib/api/admin";
import type { Person } from "@/lib/api/social";
import { message } from "@/lib/load";

import { Avatar, FOCUS, SECONDARY, SkeletonRows } from "../account/ui";
import { CARD, EventLine, when } from "./parts";

export const POLL_MS = 10_000;

type Feed = { events: ActivityEvent[]; people: Record<string, Person> };

export function LiveTab({ onOpen }: { onOpen: (sub: string) => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    let live = true;
    const tick = () =>
      getRecent(50).then(
        (f) => {
          if (!live) return;
          setFeed(f);
          setError(null);
        },
        (e: unknown) => live && setError(message(e)),
      );
    void tick();
    // A hidden tab skips its turn; the next visible tick catches up.
    const timer = setInterval(() => document.visibilityState === "visible" && void tick(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [paused]);

  return (
    <section aria-labelledby="live-title" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="live-title" className="text-lg font-bold">
            Live activity
          </h2>
          <p className="text-xs text-muted">The last 50 events, refreshed every 10 seconds.</p>
        </div>
        <button type="button" onClick={() => setPaused((p) => !p)} className={SECONDARY} aria-pressed={paused}>
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-magenta">
          Couldn&rsquo;t refresh: {error}
        </p>
      )}
      {!feed && !error && <SkeletonRows label="Loading activity" rows={6} />}
      {feed && (
        <ol aria-live="polite" className="flex flex-col divide-y divide-line/70">
          {feed.events.map((e) => {
            const who = e.sub ? feed.people[e.sub] : null;
            return (
              <li key={e.sk ?? `${e.at}${e.uid}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 sm:flex-nowrap">
                {who ? (
                  <button type="button" onClick={() => onOpen(who.sub)} className={`flex w-full shrink-0 items-center gap-2 rounded-xl text-left sm:w-40 ${FOCUS}`}>
                    <Avatar name={who.name} picture={who.picture} size={28} decorative />
                    <span className="truncate text-sm font-medium">{who.name ?? "No name"}</span>
                  </button>
                ) : (
                  <span className="w-full shrink-0 truncate text-sm text-muted sm:w-40">Signed out · {e.did.slice(0, 6)}</span>
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <EventLine event={e} />
                </span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">{e.device}</span>
                <time dateTime={e.at} className="shrink-0 text-xs text-muted tabular-nums">
                  {when(e.at)}
                </time>
              </li>
            );
          })}
          {!feed.events.length && <li className="py-4 text-sm text-muted">No activity yet today or yesterday.</li>}
        </ol>
      )}
    </section>
  );
}
