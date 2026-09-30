"use client";

import { useState } from "react";

import type { Contestant, Episode } from "@/lib/api/show";
import {
  clockTime,
  MAX_VOTES,
  readVotes,
  SMS_NUMBER,
  smsHref,
  VOTE_URL,
  votePhase,
  writeVotes,
} from "@/lib/show/voting";
import { BUTTON, PRIMARY } from "@/lib/ui";

interface VotePanelProps {
  episode: Episode;
  tz: string;
  /** The couples still in that night, as the gated episode state lists them. */
  couples: Contestant[];
  now: number;
}

/** ABC's SMS vote on the episode's air date. Nothing on any other day. */
export function VotePanel({ episode, tz, couples, now }: VotePanelProps) {
  const phase = votePhase(episode, tz, now);
  if (phase === null) return null;

  return (
    <section aria-labelledby="vote-heading" className="flex flex-col gap-2">
      <h2 id="vote-heading" className="text-lg font-semibold tracking-tight">
        Vote
      </h2>
      <div aria-live="polite" className="text-neutral-400">
        {phase === "before" &&
          `Voting opens at ${clockTime(episode.start)} Eastern and runs only during the live East Coast broadcast.`}
        {phase === "closed" && (
          <>
            <p className="font-medium text-neutral-100">Voting is closed.</p>
            <p>ABC only counts votes during the live East Coast broadcast.</p>
          </>
        )}
      </div>
      {phase === "open" && <VoteList key={episode.ep} ep={episode.ep} couples={couples} />}
    </section>
  );
}

interface VoteListProps {
  ep: number;
  couples: Contestant[];
}

function VoteList({ ep, couples }: VoteListProps) {
  // Keyed by episode, so a new episode starts every couple back at 0.
  const [votes, setVotes] = useState(() => readVotes(ep));
  const userAgent = navigator.userAgent;

  const change = (cid: string, delta: number) => {
    const next = { ...votes, [cid]: Math.min(MAX_VOTES, Math.max(0, (votes[cid] ?? 0) + delta)) };
    setVotes(next);
    writeVotes(ep, next);
  };

  return (
    <>
      <p className="text-neutral-400">
        Voting is open. Each tap opens Messages with the couple&apos;s keyword to {SMS_NUMBER}. ABC counts{" "}
        {MAX_VOTES} texts per couple, plus {MAX_VOTES} more at{" "}
        <a
          href={VOTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          dwtsvote.abc.com
        </a>
        . The tally is kept on this device.
      </p>
      <ul className="grid divide-y divide-neutral-800 md:grid-cols-2 md:gap-x-8 md:divide-y-0 xl:grid-cols-3">
        {couples.map((c) => {
          const celebrity = c.members.find((m) => m.role === "celebrity")?.name ?? c.id;
          const pro = c.members.find((m) => m.role === "pro")?.name;
          const sent = votes[c.id] ?? 0;
          return (
            <li key={c.id} className="flex items-center gap-2 border-neutral-800 py-3 md:border-b">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{pro ? `${celebrity} & ${pro}` : celebrity}</p>
                <p className="text-sm text-neutral-400">
                  <span className="font-mono text-neutral-200">{c.keyword}</span>
                  {" · "}
                  <span>
                    {sent} of {MAX_VOTES} sent
                  </span>
                </p>
              </div>
              {sent > 0 && (
                <button
                  type="button"
                  onClick={() => change(c.id, -1)}
                  aria-label={`Undo one text for ${celebrity}`}
                  className={`${BUTTON} text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700`}
                >
                  Undo
                </button>
              )}
              {sent < MAX_VOTES ? (
                <a href={smsHref(c.keyword, userAgent)} onClick={() => change(c.id, 1)} className={PRIMARY}>
                  Text{" "}
                  <span className="sr-only">
                    {c.keyword} to {SMS_NUMBER}
                  </span>
                </a>
              ) : (
                <span className="flex min-h-11 items-center px-3 text-sm text-neutral-400">Done</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
