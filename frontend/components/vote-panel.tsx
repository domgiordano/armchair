"use client";

import { useEffect, useState } from "react";

import { getVoting, type Couple, type Voting } from "@/lib/api/client";
import {
  airTime,
  MAX_VOTES,
  readVotes,
  SMS_NUMBER,
  smsHref,
  VOTE_URL,
  voteWindow,
  writeVotes,
  type AirEpisode,
} from "@/lib/voting";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const BUTTON = `flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 font-medium ${FOCUS}`;

type VotingState = { kind: "loading" } | { kind: "ready"; voting: Voting } | { kind: "error"; message: string };

/**
 * ABC's SMS vote, one row per couple while the live window is open. The
 * list is every couple in the season: which ones are out is gated per caller,
 * so narrowing it belongs to the episode screen.
 */
export function VotePanel() {
  const [state, setState] = useState<VotingState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getVoting().then(
      (voting) => !cancelled && setState({ kind: "ready", voting }),
      (e: unknown) =>
        !cancelled && setState({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const voting = state.kind === "ready" ? state.voting : null;
  const vote = voting && voteWindow(voting.episodes, voting.timezone, now);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <section aria-labelledby="vote-heading" className="flex flex-col gap-3">
      <h2 id="vote-heading" className="text-xl font-semibold tracking-tight">
        Vote
      </h2>
      <div aria-live="polite" className="flex flex-col gap-1">
        {state.kind === "loading" && <p className="text-neutral-400">Checking the voting window...</p>}
        {state.kind === "error" && <p>Could not load voting: {state.message}</p>}
        {vote && !vote.open && <Closed next={vote.next} />}
      </div>
      {state.kind === "error" && (
        <button
          type="button"
          onClick={retry}
          className={`${BUTTON} self-start border border-neutral-600 hover:bg-neutral-800 active:bg-neutral-700`}
        >
          Try again
        </button>
      )}
      {vote?.open && voting && <VoteList key={vote.episode.ep} episode={vote.episode} couples={voting.couples} />}
    </section>
  );
}

interface ClosedProps {
  next: AirEpisode | null;
}

function Closed({ next }: ClosedProps) {
  return (
    <>
      <p className="font-medium">Voting is closed.</p>
      <p className="text-neutral-400">
        {next
          ? `ABC only counts votes during the live East Coast broadcast. The next one starts ${airTime(next)} Eastern.`
          : "Voting is over for this season."}
      </p>
    </>
  );
}

interface VoteListProps {
  episode: AirEpisode;
  couples: Couple[];
}

function VoteList({ episode, couples }: VoteListProps) {
  // Keyed by episode, so a new episode starts every couple back at 0.
  const [votes, setVotes] = useState(() => readVotes(episode.ep));
  const userAgent = navigator.userAgent;

  const change = (cid: string, delta: number) => {
    const count = Math.min(MAX_VOTES, Math.max(0, (votes[cid] ?? 0) + delta));
    const next = { ...votes, [cid]: count };
    setVotes(next);
    writeVotes(episode.ep, next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-neutral-400">
        Voting is open. Each tap opens Messages with the couple&apos;s keyword to {SMS_NUMBER}. ABC counts{" "}
        {MAX_VOTES} texts per couple, plus {MAX_VOTES} more at{" "}
        <a
          href={VOTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 ${FOCUS}`}
        >
          dwtsvote.abc.com
        </a>
        . The tally is kept on this device.
      </p>
      <ul className="flex flex-col divide-y divide-neutral-800">
        {couples.map((c) => {
          const sent = votes[c.cid] ?? 0;
          return (
            <li key={c.cid} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.celebrity} and {c.pro}
                </p>
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
                  onClick={() => change(c.cid, -1)}
                  aria-label={`Undo one text for ${c.celebrity}`}
                  className={`${BUTTON} text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700`}
                >
                  Undo
                </button>
              )}
              {sent < MAX_VOTES ? (
                <a
                  href={smsHref(c.keyword, userAgent)}
                  onClick={() => change(c.cid, 1)}
                  className={`${BUTTON} bg-amber-300 text-amber-950 hover:bg-amber-200 active:bg-amber-400`}
                >
                  Text{" "}
                  <span className="sr-only">
                    {c.keyword} to {SMS_NUMBER}
                  </span>
                </a>
              ) : (
                <span className="flex min-h-11 items-center px-4 text-sm text-neutral-400">Done</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
