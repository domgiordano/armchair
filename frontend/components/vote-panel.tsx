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
import { Badge } from "@/components/ui/badge";
import { button, TEXT_LINK } from "@/lib/ui";

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
    <section
      aria-labelledby="vote-heading"
      className="flex flex-col gap-3 rounded-xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-transparent p-4"
    >
      <h2 id="vote-heading" className="text-lg font-semibold tracking-tight text-pearl">
        Vote
      </h2>
      <div aria-live="polite" className="text-sm leading-relaxed text-silver-dim">
        {phase === "before" &&
          `Voting opens at ${clockTime(episode.start)} Eastern and runs only during the live East Coast broadcast.`}
        {phase === "closed" && (
          <>
            <p className="font-medium text-pearl">Voting is closed.</p>
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
      <p className="text-sm leading-relaxed text-silver-dim">
        Voting is open. Each tap opens Messages with the couple&apos;s keyword to {SMS_NUMBER}. ABC counts{" "}
        {MAX_VOTES} texts per couple, plus {MAX_VOTES} more at{" "}
        <a
          href={VOTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={TEXT_LINK}
        >
          dwtsvote.abc.com
        </a>
        . The tally is kept on this device.
      </p>
      <ul className="stagger grid divide-y divide-silver/10 md:grid-cols-2 md:gap-x-8 md:divide-y-0 xl:grid-cols-3">
        {couples.map((c) => {
          const celebrity = c.members.find((m) => m.role === "celebrity")?.name ?? c.id;
          const pro = c.members.find((m) => m.role === "pro")?.name;
          const sent = votes[c.id] ?? 0;
          return (
            <li key={c.id} className="flex items-center gap-2 border-silver/10 py-3 md:border-b">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-pearl">{pro ? `${celebrity} & ${pro}` : celebrity}</p>
                <p className="text-sm text-silver-dim">
                  <span className="rounded bg-ink/60 px-1.5 py-0.5 font-mono text-xs text-gold-light">{c.keyword}</span>
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
                  className={button("ghost", "sm")}
                >
                  Undo
                </button>
              )}
              {sent < MAX_VOTES ? (
                <a href={smsHref(c.keyword, userAgent)} onClick={() => change(c.id, 1)} className={button("primary", "sm")}>
                  Text{" "}
                  <span className="sr-only">
                    {c.keyword} to {SMS_NUMBER}
                  </span>
                </a>
              ) : (
                <span className="flex min-h-11 items-center px-2">
                  <Badge tone="gold">Done</Badge>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
