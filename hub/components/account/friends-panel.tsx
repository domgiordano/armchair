"use client";

import { useEffect, useId, useState } from "react";

import { track } from "@armchair/app-core/activity/track";

import {
  acceptFriend,
  addFriend,
  getFriends,
  removeFriend,
  searchPeople,
  type Contact,
  type Friends,
  type Match,
} from "@/lib/api/social";
import { dwtsLink, friendInviteLink } from "@/lib/links";
import { message, useAction, useLoad } from "@/lib/load";
import { onAnswered } from "@/lib/notifications";

import { Empty, ErrorNote, EYEBROW, INPUT, Panel, PersonRow, PRIMARY, QUIET, SECONDARY, SkeletonRows } from "./ui";

// Enough to recognise the list; the rest is a tap away in the DWTS app.
const SHOWN = 6;
const SEARCH_DELAY_MS = 250;

export function FriendsPanel({ index }: { index: number }) {
  const [load, reload] = useLoad(getFriends);
  useEffect(() => onAnswered(reload), [reload]);
  const incoming = load.kind === "ready" ? load.value.incoming.length : 0;

  return (
    <Panel
      id="friends"
      title="Friends"
      count={incoming}
      countLabel="friend requests"
      index={index}
      action={
        <a href={dwtsLink("/friends/")} className={QUIET}>
          Manage
        </a>
      }
    >
      <FindPeople onChange={reload} />
      {load.kind === "loading" && <SkeletonRows label="Loading your friends" />}
      {load.kind === "error" && <ErrorNote what="your friends" message={load.message} retry={reload} />}
      {load.kind === "ready" && <FriendLists data={load.value} reload={reload} />}
    </Panel>
  );
}

function FriendLists({ data, reload }: { data: Friends; reload: () => void }) {
  const rest = data.friends.length - SHOWN;
  return (
    <>
      {data.incoming.length > 0 && (
        <div>
          <h3 className={EYEBROW}>Requests</h3>
          <ul className="divide-y divide-line/70">
            {data.incoming.map((p) => (
              <li key={p.sub}>
                <RequestRow person={p} reload={reload} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className={EYEBROW}>
          Your friends <span className="text-gold tabular-nums">{data.friends.length}</span>
        </h3>
        {data.friends.length === 0 ? (
          <div className="pt-2">
            <Empty>No friends yet. Find someone by name or send your link.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {data.friends.slice(0, SHOWN).map((f) => (
              <li key={f.sub}>
                <PersonRow person={f} />
              </li>
            ))}
          </ul>
        )}
        {rest > 0 && (
          <a href={dwtsLink("/friends/")} className={`${QUIET} -ml-3`}>
            See all {data.friends.length}
          </a>
        )}
      </div>
      <InviteLink link={friendInviteLink(data.inviteCode)} />
    </>
  );
}

function RequestRow({ person, reload }: { person: Contact; reload: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <PersonRow person={person} detail="Wants to be friends" error={error}>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run("accept", () => acceptFriend(person.sub).then(reload))}
        className={PRIMARY}
      >
        {busy === "accept" ? "Accepting..." : "Accept"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run("decline", () => removeFriend(person.sub).then(reload))}
        className={SECONDARY}
      >
        Decline
      </button>
    </PersonRow>
  );
}

function FindPeople({ onChange }: { onChange: () => void }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmed = q.trim();
  const short = trimmed.length < 2;

  useEffect(() => {
    if (short) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchPeople(trimmed).then(
        (r) => {
          if (cancelled) return;
          setResults(r);
          setError(null);
        },
        (e: unknown) => !cancelled && setError(message(e)),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, short]);

  const shown = short ? null : results;
  const update = (sub: string, status: Match["status"]) => {
    setResults((rs) => rs?.map((r) => (r.sub === sub ? { ...r, status } : r)) ?? null);
    onChange();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Find people by name
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setResults(null);
          setError(null);
        }}
        placeholder="At least 2 letters"
        maxLength={40}
        autoComplete="off"
        className={INPUT}
      />
      {error !== null && (
        <p role="alert" className="text-sm text-magenta">
          Search failed: {error}
        </p>
      )}
      <div aria-live="polite">
        {!short && shown === null && error === null && <p className="py-2 text-sm text-muted">Searching...</p>}
        {shown?.length === 0 && (
          <p className="py-2 text-sm text-muted">Nobody by that name yet. Send them your link instead.</p>
        )}
        {shown && shown.length > 0 && (
          <ul aria-label="Search results" className="divide-y divide-line/70">
            {shown.map((m) => (
              <li key={m.sub}>
                <MatchRow match={m} onUpdate={update} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MatchRow({ match, onUpdate }: { match: Match; onUpdate: (sub: string, s: Match["status"]) => void }) {
  const { busy, error, run } = useAction();
  const add = () =>
    run("add", async () => {
      const { status } = await addFriend({ sub: match.sub });
      onUpdate(match.sub, status === "blocked" ? null : status);
    });
  const accept = () =>
    run("accept", async () => {
      await acceptFriend(match.sub);
      onUpdate(match.sub, "friend");
    });

  return (
    <PersonRow person={match} error={error}>
      {match.status === null && (
        <button type="button" disabled={busy !== null} onClick={() => void add()} className={PRIMARY}>
          {busy ? "Adding..." : "Add friend"}
        </button>
      )}
      {match.status === "incoming" && (
        <button type="button" disabled={busy !== null} onClick={() => void accept()} className={PRIMARY}>
          Accept
        </button>
      )}
      {match.status === "outgoing" && <span className="text-sm text-muted">Requested</span>}
      {match.status === "friend" && <span className="text-sm font-medium text-gold">Friends</span>}
    </PersonRow>
  );
}

function InviteLink({ link }: { link: string }) {
  const id = useId();
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      track("action", "share", { via: "copy" });
      setCopied("yes");
    } catch {
      // Clipboard refused: the link stays on screen to copy by hand.
      setCopied("failed");
    }
  };
  return (
    <div className="flex flex-col gap-2 border-t border-line/70 pt-4">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Or send your invite link
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className={`${INPUT} min-w-0 font-mono text-sm text-muted`}
        />
        <button type="button" onClick={() => void copy()} className={`${SECONDARY} shrink-0`}>
          {copied === "yes" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {copied === "failed" && "Couldn't copy. Select the link and copy it by hand."}
      </p>
    </div>
  );
}

