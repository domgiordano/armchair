"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { CoupleAvatars, Headshot } from "@/components/headshot";
import { SearchBox } from "@/components/search/people-search";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getMyGroups, type Group } from "@armchair/app-core/api/groups";
import { profileHref } from "@/lib/api/people";
import type { Season } from "@/lib/api/show";
import { getFriends, mySub, type Friends, type Person } from "@armchair/app-core/api/social";
import { personHref } from "@/lib/show/people";
import { seasonLabel } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { cn, FOCUS, TEXT_LINK } from "@/lib/ui";

export function DiscoverScreen() {
  return (
    <SignedIn title="Discover" wide>
      <PageHeader title="Discover" />
      <SearchBox variant="inline" className="md:max-w-xl" />
      <Browse />
    </SignedIn>
  );
}

type Load<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (value) => !cancelled && setLoad({ kind: "ready", value }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, attempt]);
  const retry = useCallback(() => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return [load, retry];
}

interface People {
  me: string | null;
  friends: Friends;
  groups: Group[];
}

const loadPeople = async (): Promise<People> => {
  const [me, friends, groups] = await Promise.all([mySub(), getFriends(), getMyGroups()]);
  return { me, friends, groups };
};

/** Group-mates who aren't friends yet, each with the first group you share. */
export function suggestions({ me, friends, groups }: People): { person: Person; group: string }[] {
  const known = new Set([me, ...friends.friends.map((f) => f.sub), ...friends.outgoing.map((f) => f.sub)]);
  const blocked = new Set(friends.blocked.map((b) => b.sub));
  const out = new Map<string, { person: Person; group: string }>();
  for (const g of groups) {
    for (const m of g.members) {
      if (!known.has(m.sub) && !blocked.has(m.sub) && !out.has(m.sub)) out.set(m.sub, { person: m, group: g.name });
    }
  }
  return [...out.values()];
}

function Browse() {
  const season = useSeason();
  const [people, retryPeople] = useLoad(loadPeople);

  return (
    <div className="mt-2 flex flex-col gap-10">
      {season.kind === "loading" && <GridSkeleton label="Loading this season's stars" />}
      {season.kind === "error" && <ErrorState what="this season" message={season.message} retry={season.retry} />}
      {season.kind === "ready" && <SeasonPeople season={season.season} />}

      {people.kind === "loading" && <GridSkeleton label="Loading your friends" />}
      {people.kind === "error" && <ErrorState what="your friends" message={people.message} retry={retryPeople} />}
      {people.kind === "ready" && <YourPeople people={people.value} />}
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={id} className="text-lg font-semibold text-pearl">
          {title}
        </h2>
        {note && <p className="text-sm text-silver-dim">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const TILE = cn(
  "group flex min-h-16 items-center gap-3 rounded-xl border border-silver/10 bg-ballroom/45 px-3 py-2.5 transition-colors hover:border-gold/35 hover:bg-ballroom/70 active:bg-ballroom",
  FOCUS,
);

function SeasonPeople({ season }: { season: Season }) {
  const stars = [...season.contestants].sort((a, b) => celebrity(a).localeCompare(celebrity(b)));
  return (
    <>
      <Section id="discover-stars" title={`Stars of ${seasonLabel(season.season)}`} note="Tap a star for their dances and your scores">
        <ul className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stars.map((c) => {
            const pro = c.members.find((m) => m.role === "pro");
            return (
              <li key={c.id}>
                <Link href={personHref(c.id)} prefetch={false} className={TILE}>
                  <CoupleAvatars members={c.members} size={40} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-pearl group-hover:text-gold-light">{celebrity(c)}</span>
                    {pro && <span className="truncate text-xs text-silver-dim">with {pro.name}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section id="discover-judges" title="Judges" note="How each of them scores">
        <ul className="stagger grid grid-cols-1 gap-2 sm:grid-cols-3">
          {season.judges.map((j) => (
            <li key={j.id}>
              <Link href={personHref(j.id)} prefetch={false} className={TILE}>
                <Headshot person={j} size={48} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-pearl group-hover:text-gold-light">{j.name}</span>
                  <span className="text-xs text-silver-dim">Judge</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

const celebrity = (c: Season["contestants"][number]) =>
  (c.members.find((m) => m.role === "celebrity") ?? c.members[0]).name;

function YourPeople({ people }: { people: People }) {
  const friends = people.friends.friends;
  const suggested = suggestions(people);
  return (
    <>
      <Section id="discover-friends" title="Your friends">
        {friends.length === 0 ? (
          <EmptyState
            compact
            action={
              <Link href="/profile/?sheet=friends" className={TEXT_LINK}>
                Find friends
              </Link>
            }
          >
            Add friends to compare scores and see their profiles here.
          </EmptyState>
        ) : (
          <UserGrid people={friends.map((f) => ({ person: f, detail: "Friend" }))} />
        )}
      </Section>
      {suggested.length > 0 && (
        <Section id="discover-suggested" title="From your groups" note="Group-mates you aren't friends with yet">
          <UserGrid people={suggested.map((s) => ({ person: s.person, detail: `In ${s.group}` }))} />
        </Section>
      )}
    </>
  );
}

function UserGrid({ people }: { people: { person: Person; detail: string }[] }) {
  return (
    <ul className="stagger grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {people.map(({ person, detail }) => (
        <li key={person.sub}>
          <Link href={profileHref(person.sub)} prefetch={false} className={TILE}>
            <Avatar name={person.name ?? "Someone"} email="" picture={person.picture} size={40} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-pearl group-hover:text-gold-light">{person.name ?? "Someone"}</span>
              <span className="truncate text-xs text-silver-dim">{detail}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GridSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}...</span>
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
