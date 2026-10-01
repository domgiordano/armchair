"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { GroupsPanel } from "@/components/friends/groups-panel";
import {
  ConfirmButton,
  CopyLink,
  Empty,
  INPUT,
  PersonRow,
  QUIET,
  SECTION_TITLE,
  SMALL_PRIMARY,
  SMALL_SECONDARY,
  SPLIT,
  displayName,
  message,
  useAction,
  useLoad,
} from "@/components/friends/parts";
import { ErrorState } from "@/components/ui/states";
import { SignedIn } from "@/components/signed-in";
import {
  acceptFriend,
  addFriend,
  friendLink,
  getFriends,
  removeFriend,
  searchPeople,
  setBlocked,
  type Contact,
  type Friends,
  type Match,
  type Person,
} from "@/lib/api/social";
import { useNotifications } from "@/lib/social/notifications";

const TABS = [
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "groups", label: "Groups" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function FriendsScreen() {
  return (
    <SignedIn title="Friends & Groups" wide>
      <FriendsAndGroups />
    </SignedIn>
  );
}

function FriendsAndGroups() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "friends";
  const [friends, reload] = useLoad(getFriends);
  const { items } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending").length;
  const incoming = friends.kind === "ready" ? friends.value.incoming.length : 0;
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (id: TabId) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    next.delete("group");
    router.replace(`/friends/?${next}`, { scroll: false });
  };

  // Arrow keys move between tabs, as the tabs pattern promises.
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const next = (i + step + TABS.length) % TABS.length;
    go(TABS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Friends &amp; Groups</h1>
      <AddByLink onAdded={reload} />
      <div role="tablist" aria-label="Friends and groups" className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-900 p-1 md:max-w-md">
        {TABS.map((t, i) => {
          const count = t.id === "requests" ? incoming + invites : 0;
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-${t.id}`}
              aria-label={count > 0 ? `${t.label}, ${count} waiting` : undefined}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => go(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                selected ? "bg-ballroom text-gold-light shadow" : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="rounded-full bg-brand-magenta px-1.5 text-[11px] leading-4 font-semibold text-pearl tabular-nums"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <section role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`} className="flex flex-col gap-6">
        {friends.kind === "loading" && <p className="text-neutral-400">Loading...</p>}
        {friends.kind === "error" && <ErrorState what="your friends" message={friends.message} retry={reload} />}
        {friends.kind === "ready" && tab === "friends" && <FriendsTab data={friends.value} reload={reload} />}
        {friends.kind === "ready" && tab === "requests" && <RequestsTab data={friends.value} reload={reload} />}
        {friends.kind === "ready" && tab === "groups" && <GroupsPanel friends={friends.value.friends} />}
      </section>
    </>
  );
}

/** Opened from someone's invite link: sends them a request, then tidies the URL. */
function AddByLink({ onAdded }: { onAdded: () => void }) {
  const router = useRouter();
  const code = useSearchParams().get("add");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    addFriend({ code }).then(
      ({ status, user }) => {
        if (cancelled) return;
        const name = displayName(user);
        setResult({
          ok: true,
          text: status === "friend" ? `You and ${name} are friends.` : `Friend request sent to ${name}.`,
        });
        onAdded();
        router.replace("/friends/", { scroll: false });
      },
      (e: unknown) => !cancelled && setResult({ ok: false, text: `Couldn't use that invite link: ${message(e)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [code, onAdded, router]);

  if (code && result === null) return <p className="text-sm text-neutral-400">Sending a friend request...</p>;
  if (result === null) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`rounded-lg border p-3 text-sm ${
        result.ok ? "border-gold/40 bg-ballroom text-gold-light" : "border-amber-300/40 text-amber-200"
      }`}
    >
      {result.text}
    </p>
  );
}

function FriendsTab({ data, reload }: { data: Friends; reload: () => void }) {
  return (
    <div className={`${SPLIT} gap-6`}>
      <div className="flex flex-col gap-6">
        <FindPeople onChange={reload} />
        <div className="rounded-lg border border-neutral-800 p-4">
          <CopyLink label="Or send your invite link" link={friendLink(data.inviteCode)} />
        </div>
      </div>
      <div className="flex flex-col">
        <h2 className={SECTION_TITLE}>
          Your friends <span className="text-neutral-500 tabular-nums">{data.friends.length}</span>
        </h2>
        {data.friends.length === 0 ? (
          <div className="pt-2">
            <Empty>No friends yet. Find someone by name or send your link.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {data.friends.map((f) => (
              <li key={f.sub}>
                <FriendRow friend={f} reload={reload} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FriendRow({ friend, reload }: { friend: Contact; reload: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <PersonRow person={friend} error={error}>
      <ConfirmButton
        label="Remove"
        confirm="Unfriend"
        busy={busy !== null}
        onConfirm={() => void run("remove", () => removeFriend(friend.sub).then(reload))}
      />
      <ConfirmButton
        label="Block"
        confirm="Block"
        busy={busy !== null}
        onConfirm={() => void run("block", () => setBlocked(friend.sub, true).then(reload))}
      />
    </PersonRow>
  );
}

const SEARCH_DELAY_MS = 250;

function FindPeople({ onChange }: { onChange: () => void }) {
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
      <label className="flex flex-col gap-1 text-sm text-neutral-400">
        Find people by name
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="At least 2 letters"
          autoComplete="off"
          maxLength={40}
          className={INPUT}
        />
      </label>
      {error !== null && (
        <p role="alert" className="text-sm text-amber-200">
          Search failed: {error}
        </p>
      )}
      {shown && (
        <div aria-live="polite">
          {shown.length === 0 ? (
            <p className="py-2 text-sm text-neutral-400">Nobody by that name yet. Send them your link instead.</p>
          ) : (
            <ul aria-label="Search results" className="divide-y divide-neutral-800">
              {shown.map((m) => (
                <li key={m.sub}>
                  <MatchRow match={m} onUpdate={update} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
        <button type="button" disabled={busy !== null} onClick={() => void add()} className={SMALL_PRIMARY}>
          {busy ? "Adding..." : "Add friend"}
        </button>
      )}
      {match.status === "incoming" && (
        <button type="button" disabled={busy !== null} onClick={() => void accept()} className={SMALL_PRIMARY}>
          Accept
        </button>
      )}
      {match.status === "outgoing" && <span className="px-3 text-sm text-neutral-400">Requested</span>}
      {match.status === "friend" && <span className="px-3 text-sm text-gold">Friends</span>}
    </PersonRow>
  );
}

function RequestsTab({ data, reload }: { data: Friends; reload: () => void }) {
  const { items, answer } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending");
  const nothing = data.incoming.length + data.outgoing.length + invites.length === 0;

  return (
    <div className="flex flex-col gap-6 lg:max-w-2xl">
      {nothing && <Empty>No requests right now.</Empty>}
      {data.incoming.length > 0 && (
        <RequestList title="Friend requests" people={data.incoming}>
          {(p, act) => (
            <>
              <button
                type="button"
                disabled={act.busy !== null}
                onClick={() => void act.run("accept", () => acceptFriend(p.sub).then(reload))}
                className={SMALL_PRIMARY}
              >
                Accept
              </button>
              <button
                type="button"
                disabled={act.busy !== null}
                onClick={() => void act.run("decline", () => removeFriend(p.sub).then(reload))}
                className={SMALL_SECONDARY}
              >
                Decline
              </button>
            </>
          )}
        </RequestList>
      )}
      {invites.length > 0 && (
        <div className="flex flex-col">
          <h2 className={SECTION_TITLE}>Group invites</h2>
          <ul className="divide-y divide-neutral-800">
            {invites.map((n) => (
              <li key={n.id}>
                <InviteRow
                  person={n.from}
                  group={n.group?.name ?? "a group"}
                  onAnswer={(yes) => answer(n, yes)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.outgoing.length > 0 && (
        <RequestList title="Sent" people={data.outgoing}>
          {(p, act) => (
            <button
              type="button"
              disabled={act.busy !== null}
              onClick={() => void act.run("cancel", () => removeFriend(p.sub).then(reload))}
              className={QUIET}
            >
              Cancel
            </button>
          )}
        </RequestList>
      )}
      {data.blocked.length > 0 && (
        <RequestList title="Blocked" people={data.blocked}>
          {(p, act) => (
            <button
              type="button"
              disabled={act.busy !== null}
              onClick={() => void act.run("unblock", () => setBlocked(p.sub, false).then(reload))}
              className={QUIET}
            >
              Unblock
            </button>
          )}
        </RequestList>
      )}
    </div>
  );
}

type Act = ReturnType<typeof useAction>;

function RequestList({
  title,
  people,
  children,
}: {
  title: string;
  people: Person[];
  children: (p: Person, act: Act) => ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <h2 className={SECTION_TITLE}>
        {title} <span className="text-neutral-500 tabular-nums">{people.length}</span>
      </h2>
      <ul className="divide-y divide-neutral-800">
        {people.map((p) => (
          <li key={p.sub}>
            <RequestRow person={p}>{children}</RequestRow>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestRow({ person, children }: { person: Person; children: (p: Person, act: Act) => ReactNode }) {
  const act = useAction();
  return (
    <PersonRow person={person} error={act.error}>
      {children(person, act)}
    </PersonRow>
  );
}

function InviteRow({
  person,
  group,
  onAnswer,
}: {
  person: Person;
  group: string;
  onAnswer: (yes: boolean) => Promise<void>;
}) {
  const { busy, error, run } = useAction();
  return (
    <PersonRow person={person} detail={`Invited you to ${group}`} error={error}>
      <button type="button" disabled={busy !== null} onClick={() => void run("join", () => onAnswer(true))} className={SMALL_PRIMARY}>
        Join
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run("decline", () => onAnswer(false))}
        className={SMALL_SECONDARY}
      >
        Decline
      </button>
    </PersonRow>
  );
}
