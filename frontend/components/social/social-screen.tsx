"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { SignedIn } from "@/components/signed-in";
import {
  ConfirmButton,
  CopyLink,
  Empty,
  ListSection,
  PersonRow,
  QUIET,
  SECTION_TITLE,
  SMALL_PRIMARY,
  SMALL_SECONDARY,
  displayName,
  message,
  useAction,
  useLoad,
  useWaiting,
} from "@/components/social/parts";
import { GroupCard } from "@/components/groups/group-card";
import { GroupInviteCard, JoinByLink, StartGroup } from "@/components/groups/group-actions";
import { ShowIcon } from "@/components/show-icon";
import { FriendTag, type SocialView } from "@/components/social/social-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { tabId, Tabs, type TabItem } from "@/components/ui/tabs";
import { getGroupDetails } from "@armchair/app-core/api/groups";
import { appLink } from "@armchair/app-core/apps";
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
import { cn, TEXT_LINK } from "@/lib/ui";

const VIEWS: SocialView[] = ["friends", "groups", "requests"];
const PANEL = "social-panel";
const SEARCH_DELAY_MS = 250;

/** /social/: your friends, groups and requests. ?view= picks the list; ?find=1 starts you in the search. */
export function SocialScreen() {
  return (
    <SignedIn title="Friends & Groups" wide>
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
  const waiting = useWaiting(friends);
  const tabs: TabItem<SocialView>[] = [
    { id: "friends", label: "Friends" },
    { id: "groups", label: "Groups" },
    { id: "requests", label: "Requests", badge: waiting || undefined },
  ];

  return (
    <>
      <div className="md:max-w-md">
        <Tabs
          label="Your people"
          tabs={tabs}
          value={view}
          onChange={(v) => router.replace(`/social/?view=${v}`, { scroll: false })}
          panelId={PANEL}
        />
      </div>
      <div
        key={view}
        role="tabpanel"
        id={PANEL}
        aria-labelledby={tabId(PANEL, view)}
        className={cn("flex flex-col gap-5 animate-fade-in", view !== "groups" && "max-w-2xl")}
      >
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
      <SearchInput
        label="Search friends or find someone new"
        value={q}
        onChange={setQ}
        maxLength={40}
        autoFocus={find}
      />
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
          share={{
            title: "Add me on Armchair Judge",
            text: "Add me on Armchair Judge so we can compare Dancing with the Stars scores.",
          }}
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
  const [me] = useLoad(mySub);
  const { items } = useNotifications();
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending");

  return (
    <>
      {invites.length > 0 && (
        <div className="stagger flex flex-col gap-3">
          {invites.map((n) => (
            <GroupInviteCard key={n.id} invite={n} />
          ))}
        </div>
      )}
      {groups.kind === "loading" && <GroupCardsSkeleton />}
      {groups.kind === "error" && <ErrorState what="your groups" message={groups.message} retry={reload} />}
      {groups.kind === "ready" && groups.value.length > 0 && (
        <section aria-labelledby="your-groups" className="flex flex-col gap-3">
          <h2 id="your-groups" className={SECTION_TITLE}>
            Your groups <span className="text-gold tabular-nums">{groups.value.length}</span>
          </h2>
          <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.value.map((g) => (
              <li key={g.id}>
                <GroupCard group={g} me={me.kind === "ready" ? me.value : null} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {groups.kind === "ready" && groups.value.length === 0 && invites.length === 0 && (
        <Empty>
          You&apos;re not in a group yet. Start one for the people you watch with, or paste a link someone sent you.
        </Empty>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StartGroup />
        <JoinByLink />
      </div>
      <CrossApp />
    </>
  );
}

/** Groups belong to the account, not the show: say so, and where else they count. */
function CrossApp() {
  const traitors = appLink("traitors", "/leaderboard/");
  return (
    <p className="flex items-start gap-2 text-sm text-silver-dim">
      <ShowIcon show="dwts" size={20} className="mt-0.5 shrink-0" />
      <span>
        Groups and friends carry across every Armchair Judge show. Here you see each group on Dancing with the Stars;
        The Traitors keeps its own leaderboard for the same people
        {traitors && (
          <>
            {" "}
            (
            <a href={traitors} className={TEXT_LINK}>
              see it there
            </a>
            )
          </>
        )}
        .
      </span>
    </p>
  );
}

function GroupCardsSkeleton() {
  return (
    <div role="status" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <span className="sr-only">Loading your groups...</span>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-2xl border border-silver/10 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-2 rounded-full" />
        </div>
      ))}
    </div>
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
