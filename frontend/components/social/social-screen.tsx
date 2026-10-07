"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { SignedIn } from "@/components/signed-in";
import {
  ConfirmButton,
  CopyLink,
  Empty,
  ListSection,
  PersonRow,
  QUIET,
  SMALL_PRIMARY,
  SMALL_SECONDARY,
  displayName,
  message,
  useAction,
  useLoad,
} from "@/components/social/parts";
import { FriendTag, GroupLink, type SocialView } from "@/components/social/social-sheet";
import { Badge } from "@/components/ui/badge";
import { Input, SearchInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { tabId, Tabs, type TabItem } from "@/components/ui/tabs";
import { createGroup, getGroupDetails, groupHref } from "@armchair/app-core/api/groups";
import {
  acceptFriend,
  addFriend,
  friendLink,
  getFriends,
  mySub,
  removeFriend,
  searchPeople,
  setBlocked,
  type Friends,
  type Match,
  type Person,
} from "@armchair/app-core/api/social";
import { search } from "@/lib/search/match";
import { useNotifications } from "@armchair/app-core/social/notifications";
import { PRIMARY, TEXT_LINK } from "@/lib/ui";

const VIEWS: SocialView[] = ["friends", "groups", "requests"];
const PANEL = "social-panel";
const NAME_MAX = 40;
const SEARCH_DELAY_MS = 250;

/** /social/: your friends, groups and requests. ?view= picks the list; ?find=1 starts you in the search. */
export function SocialScreen() {
  return (
    <SignedIn title="Friends & Groups">
      <PageHeader title="Friends & Groups" />
      {/* ?view= is only readable on the client in a static export. */}
      <Suspense fallback={<SkeletonList label="Loading your friends" rows={5} avatar />}>
        <SocialRoute />
      </Suspense>
    </SignedIn>
  );
}

function SocialRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const view = VIEWS.find((v) => v === params.get("view")) ?? "friends";
  const [friends, reload] = useLoad(getFriends);
  const { items } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending").length;
  const waiting = (friends.kind === "ready" ? friends.value.incoming.length : 0) + invites;
  const tabs: TabItem<SocialView>[] = [
    { id: "friends", label: "Friends" },
    { id: "groups", label: "Groups" },
    { id: "requests", label: "Requests", badge: waiting || undefined },
  ];

  return (
    <>
      <Tabs
        label="Your people"
        tabs={tabs}
        value={view}
        onChange={(v) => router.replace(`/social/?view=${v}`, { scroll: false })}
        panelId={PANEL}
      />
      <div key={view} role="tabpanel" id={PANEL} aria-labelledby={tabId(PANEL, view)} className="flex flex-col gap-5 animate-fade-in">
        {friends.kind === "loading" && <SkeletonList label="Loading your friends" rows={5} avatar />}
        {friends.kind === "error" && <ErrorState what="your friends" message={friends.message} retry={reload} />}
        {friends.kind === "ready" && view === "friends" && (
          <FriendsView data={friends.value} reload={reload} find={params.get("find") === "1"} />
        )}
        {view === "groups" && <GroupsView />}
        {friends.kind === "ready" && view === "requests" && <RequestsView data={friends.value} reload={reload} />}
      </div>
    </>
  );
}

function FriendsView({ data, reload, find }: { data: Friends; reload: () => void; find: boolean }) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const mine = query ? search(data.friends, query, displayName, data.friends.length) : data.friends;

  return (
    <>
      <SearchInput label="Search friends or find someone new" value={q} onChange={setQ} maxLength={40} autoFocus={find} />
      {data.friends.length === 0 && !query && (
        <Empty>No friends yet. Search for someone by name, or send your invite link.</Empty>
      )}
      {mine.length > 0 && (
        <ListSection title={query ? "Your friends" : "Friends"} count={mine.length}>
          {mine.map((f) => (
            <li key={f.sub}>
              <FriendRow friend={f} reload={reload} />
            </li>
          ))}
        </ListSection>
      )}
      {query.length >= 2 && <MoreMatches q={query} skip={data.friends} onChange={reload} />}
      <div className="flex flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-4">
        <CopyLink
          label="Your invite link"
          link={friendLink(data.inviteCode)}
          share={{ title: "Add me on Armchair Judge", text: "Add me on Armchair Judge so we can compare Dancing with the Stars scores." }}
        />
        <Link href="/discover/" className={`${TEXT_LINK} self-start`}>
          Browse people on Discover
        </Link>
      </div>
    </>
  );
}

function FriendRow({ friend, reload }: { friend: Person; reload: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <PersonRow person={friend} error={error}>
      <ConfirmButton
        label="Remove"
        confirm="Unfriend"
        busy={busy !== null}
        onConfirm={() => void run("remove", () => removeFriend(friend.sub).then(reload))}
      />
    </PersonRow>
  );
}

/** Everyone else on Armchair matching the search, with Add or Accept beside each. */
function MoreMatches({ q, skip, onChange }: { q: string; skip: Person[]; onChange: () => void }) {
  const [results, setResults] = useState<{ q: string; matches: Match[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      searchPeople(q).then(
        (matches) => {
          if (cancelled) return;
          setResults({ q, matches });
          setError(null);
        },
        (e: unknown) => !cancelled && setError(message(e)),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const known = new Set(skip.map((p) => p.sub));
  const update = (sub: string, status: Match["status"]) => {
    setResults((r) => r && { ...r, matches: r.matches.map((m) => (m.sub === sub ? { ...m, status } : m)) });
    onChange();
  };

  if (error !== null) {
    return (
      <p role="alert" className="text-sm text-red-300">
        Search failed: {error}
      </p>
    );
  }
  if (results === null || results.q !== q) return <SkeletonList label="Searching" rows={2} avatar />;
  const others = results.matches.filter((m) => !known.has(m.sub));
  return (
    <div aria-live="polite">
      {others.length === 0 ? (
        <p className="text-sm text-silver-dim">Nobody else by that name. Send them your link instead.</p>
      ) : (
        <ListSection title="People on Armchair">
          {others.map((m) => (
            <li key={m.sub}>
              <MatchRow match={m} onUpdate={update} />
            </li>
          ))}
        </ListSection>
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
          {busy ? "Adding..." : "Add"}
        </button>
      )}
      {match.status === "incoming" && (
        <button type="button" disabled={busy !== null} onClick={() => void accept()} className={SMALL_PRIMARY}>
          Accept
        </button>
      )}
      {match.status === "outgoing" && <Badge tone="muted">Requested</Badge>}
      {match.status === "friend" && <FriendTag />}
    </PersonRow>
  );
}

function GroupsView() {
  const [groups, reload] = useLoad(getGroupDetails);
  const router = useRouter();
  const [me] = useLoad(mySub);

  return (
    <>
      <NewGroup onCreated={(id) => router.push(groupHref(id))} />
      {groups.kind === "loading" && <SkeletonList label="Loading your groups" rows={3} row="h-14" avatar />}
      {groups.kind === "error" && <ErrorState what="your groups" message={groups.message} retry={reload} />}
      {groups.kind === "ready" &&
        (groups.value.length === 0 ? (
          <Empty>
            You&apos;re not in any groups yet. A group gets its own leaderboard, and narrows every scorecard to the people in it.
          </Empty>
        ) : (
          <ul className="stagger flex flex-col gap-2">
            {groups.value.map((g) => (
              <li key={g.id}>
                <GroupLink
                  id={g.id}
                  name={g.name}
                  members={g.members}
                  owner={me.kind === "ready" && g.owner === me.value}
                  waiting={g.requests.length}
                />
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

function NewGroup({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("create", async () => {
      const group = await createGroup(name.trim());
      onCreated(group.id);
    });
  };

  return (
    <form onSubmit={submit}>
      <Input
        label="Start a group"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={NAME_MAX}
        placeholder="Family, work, the group chat..."
        error={error && `Couldn't start the group: ${error}`}
        action={
          <button type="submit" disabled={busy !== null || !name.trim()} className={`${PRIMARY} shrink-0`}>
            {busy ? "Creating..." : "Create"}
          </button>
        }
      />
    </form>
  );
}

function RequestsView({ data, reload }: { data: Friends; reload: () => void }) {
  const { items, answer } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending");
  const nothing = data.incoming.length + data.outgoing.length + data.blocked.length + invites.length === 0;

  if (nothing) return <Empty>No requests right now. New ones show up here and under the bell.</Empty>;
  return (
    <>
      {data.incoming.length > 0 && (
        <ListSection title="Friend requests" count={data.incoming.length}>
          {data.incoming.map((p) => (
            <li key={p.sub}>
              <ActionRow person={p}>
                {(a) => (
                  <>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("accept", () => acceptFriend(p.sub).then(reload))}
                      className={SMALL_PRIMARY}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("decline", () => removeFriend(p.sub).then(reload))}
                      className={SMALL_SECONDARY}
                    >
                      Decline
                    </button>
                  </>
                )}
              </ActionRow>
            </li>
          ))}
        </ListSection>
      )}
      {invites.length > 0 && (
        <ListSection title="Group invites" count={invites.length}>
          {invites.map((n) => (
            <li key={n.id}>
              <ActionRow person={n.from} detail={`Invited you to ${n.group?.name ?? "a group"}`}>
                {(a) => (
                  <>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("join", () => answer(n, true))}
                      className={SMALL_PRIMARY}
                    >
                      Join
                    </button>
                    <button
                      type="button"
                      disabled={a.busy !== null}
                      onClick={() => void a.run("decline", () => answer(n, false))}
                      className={SMALL_SECONDARY}
                    >
                      Decline
                    </button>
                  </>
                )}
              </ActionRow>
            </li>
          ))}
        </ListSection>
      )}
      {data.outgoing.length > 0 && (
        <ListSection title="Sent" count={data.outgoing.length}>
          {data.outgoing.map((p) => (
            <li key={p.sub}>
              <ActionRow person={p}>
                {(a) => (
                  <button
                    type="button"
                    disabled={a.busy !== null}
                    onClick={() => void a.run("cancel", () => removeFriend(p.sub).then(reload))}
                    className={QUIET}
                  >
                    Cancel
                  </button>
                )}
              </ActionRow>
            </li>
          ))}
        </ListSection>
      )}
      {data.blocked.length > 0 && (
        <ListSection title="Blocked" count={data.blocked.length}>
          {data.blocked.map((p) => (
            <li key={p.sub}>
              <ActionRow person={p}>
                {(a) => (
                  <button
                    type="button"
                    disabled={a.busy !== null}
                    onClick={() => void a.run("unblock", () => setBlocked(p.sub, false).then(reload))}
                    className={QUIET}
                  >
                    Unblock
                  </button>
                )}
              </ActionRow>
            </li>
          ))}
        </ListSection>
      )}
    </>
  );
}

type Act = ReturnType<typeof useAction>;

function ActionRow({ person, detail, children }: { person: Person; detail?: string; children: (a: Act) => ReactNode }) {
  const act = useAction();
  return (
    <PersonRow person={person} detail={detail} error={act.error}>
      {children(act)}
    </PersonRow>
  );
}
