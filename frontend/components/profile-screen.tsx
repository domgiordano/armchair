"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PageLoader } from "@/components/disco-loader";
import { AccuracyTab } from "@/components/profile/accuracy-tab";
import { FavoritesTab } from "@/components/profile/favorites-tab";
import { HistoryTab } from "@/components/profile/history-tab";
import { OverviewTab } from "@/components/profile/overview-tab";
import { ProfileHeader, type HeaderSocial } from "@/components/profile/profile-header";
import { relationOf, useLoad as useFetch } from "@/components/social/parts";
import { OwnSocialSheet, TheirSocialSheet, type SocialView } from "@/components/social/social-sheet";
import { SignedIn } from "@/components/signed-in";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, tabId, type TabItem } from "@/components/ui/tabs";
import { ApiError } from "@armchair/app-core/api/client";
import { getMyProfile, getProfile, type MyProfile, type Profile } from "@/lib/api/profile";
import type { Season } from "@/lib/api/show";
import { getFriends, type Relation } from "@armchair/app-core/api/social";
import { useNotifications } from "@armchair/app-core/social/notifications";
import { seasonLabel } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { SECONDARY } from "@/lib/ui";

export function ProfileScreen() {
  return (
    <SignedIn title="Profile" wide>
      {/* ?u= is only readable on the client in a static export. */}
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileRoute />
      </Suspense>
    </SignedIn>
  );
}

const VIEWS: SocialView[] = ["friends", "groups", "requests"];

function ProfileRoute() {
  const params = useSearchParams();
  const sub = params.get("u");
  // /profile/?sheet=groups opens a list straight away: old Friends & Groups links land there.
  const sheet = VIEWS.find((v) => v === params.get("sheet")) ?? null;
  const load = useSeason();
  if (load.kind === "loading") return <PageLoader label="Loading the profile" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <ProfileView key={`${sub}|${load.season.season}`} season={load.season} sub={sub} sheet={sheet} />;
}

type Load<T> =
  { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error"; message: string; status: number | null };

const failed = (e: unknown) => ({
  kind: "error" as const,
  message: e instanceof Error ? e.message : "Request failed",
  status: e instanceof ApiError ? e.status : null,
});

/** Runs `fetcher` when `key` changes, or never while it's null. */
function useLoad<T>(fetcher: () => Promise<T>, key: string | null): [Load<T>, () => void, (data: T) => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) => !cancelled && setLoad(failed(e)),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names everything the fetch depends on
  }, [key, attempt]);

  const retry = () => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  };
  return [load, retry, (data: T) => setLoad({ kind: "ready", data })];
}

interface Base {
  profile: Profile;
  /** Set when the profile is the caller's own: the API sends a group count only then. */
  me: MyProfile | null;
}

async function loadBase(season: string, sub: string | null): Promise<Base> {
  const [profile, me] = await Promise.all([getProfile(season, sub), sub ? null : getMyProfile()]);
  if (profile.groupCount === undefined) return { profile, me: null };
  return { profile, me: me ?? (await getMyProfile()) };
}

type Tab = "overview" | "favorites" | "accuracy" | "history";

const TABS: readonly TabItem<Tab>[] = [
  { id: "overview", label: "Overview" },
  { id: "favorites", label: "Favorites" },
  { id: "accuracy", label: "Accuracy" },
  { id: "history", label: "History" },
];

// Tabs whose numbers follow the season picker; History spans everything.
const SCOPED: Tab[] = ["overview", "favorites", "accuracy"];
const PANEL = "profile-panel";
const ALL = "all";

function ProfileView({ season, sub, sheet }: { season: Season; sub: string | null; sheet: SocialView | null }) {
  const [load, retry, setBase] = useLoad(() => loadBase(season.season, sub), "base");
  const [friends, reloadFriends] = useFetch(getFriends);
  const { items } = useNotifications();
  const [open, setOpen] = useState(sheet !== null);
  const [view, setView] = useState<SocialView>(sheet ?? "friends");
  // What a friend action just changed it to, over what the list said on load.
  const [relation, setRelation] = useState<Relation | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<"season" | "all">("season");
  // All-time is fetched the first time it's picked, then kept.
  const [wantAll, setWantAll] = useState(false);
  // Someone else's id, or null on your own.
  const target = load.kind === "ready" && !load.data.me ? load.data.profile.sub : null;
  const [allLoad, retryAll] = useLoad(() => getProfile(ALL, target), wantAll && load.kind === "ready" ? ALL : null);

  if (load.kind === "loading") return <ProfileSkeleton />;
  if (load.kind === "error") {
    if (load.status === 404) return <NoOne />;
    return <ErrorState what="this profile" message={load.message} retry={retry} />;
  }

  const { profile, me } = load.data;
  const own = me !== null;
  const scoped = range === ALL ? allLoad : ({ kind: "ready", data: profile } as const);

  const panel = () => {
    if (tab === "history") return <HistoryTab history={profile.history} allTime={profile.allTime} own={own} />;
    if (tab === "favorites") return <FavoritesTab scope={range === ALL ? ALL : season.season} sub={target} />;
    if (scoped.kind === "loading") return <PanelSkeleton />;
    if (scoped.kind === "error")
      return <ErrorState what="all-time numbers" message={scoped.message} retry={retryAll} />;
    if (tab === "accuracy") return <AccuracyTab season={season} detail={scoped.data.detail} own={own} />;
    return <OverviewTab season={season} profile={scoped.data} own={own} />;
  };

  const show = (v: SocialView) => {
    setView(v);
    setOpen(true);
  };
  const listed = friends.kind === "ready" ? relationOf(friends.value, profile.sub) : undefined;
  // Null is a relation (strangers), so ?? would skip it.
  const now = relation !== undefined ? relation : listed;
  // Their count moves with yours as you friend or unfriend them, without a refetch.
  const shift = listed === undefined || now === undefined ? 0 : Number(now === "friend") - Number(listed === "friend");
  const invites = items.filter((n) => n.type === "group_invite" && n.state === "pending").length;
  const waiting = (friends.kind === "ready" ? friends.value.incoming.length : 0) + invites;
  const social: HeaderSocial = own
    ? {
        own: true,
        friends: friends.kind === "ready" ? friends.value.friends.length : profile.friendCount,
        groups: profile.groupCount ?? 0,
        waiting,
        open: show,
      }
    : {
        own: false,
        friends: profile.friendCount + shift,
        groups: profile.mutual?.groups.length ?? 0,
        relation: now,
        onRelation: (next) => {
          setRelation(next);
          reloadFriends();
        },
        open: show,
      };

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={profile} me={me} onMe={(next) => setBase({ profile, me: next })} social={social} />
      {own ? (
        <OwnSocialSheet
          open={open}
          view={view}
          onView={setView}
          onClose={() => setOpen(false)}
          friends={friends}
          reload={reloadFriends}
          waiting={waiting}
        />
      ) : (
        <TheirSocialSheet
          open={open}
          view={view}
          onView={setView}
          onClose={() => setOpen(false)}
          name={profile.name ?? "They"}
          friendCount={social.friends}
          mutual={profile.mutual ?? { friends: [], groups: [] }}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 sm:max-w-xl sm:flex-1">
          <Tabs label="Profile sections" tabs={TABS} value={tab} onChange={setTab} panelId={PANEL} scroll />
        </div>
        {SCOPED.includes(tab) && (
          <Select
            label="Seasons"
            hideLabel
            className="sm:w-44"
            value={range}
            options={[
              { value: "season", label: seasonLabel(season.season) },
              { value: ALL, label: "All-time" },
            ]}
            onChange={(v) => {
              setRange(v === ALL ? ALL : "season");
              if (v === ALL) setWantAll(true);
            }}
          />
        )}
      </div>

      <div
        key={`${tab}|${range}`}
        role="tabpanel"
        id={PANEL}
        aria-labelledby={tabId(PANEL, tab)}
        className="animate-fade-in"
      >
        {panel()}
      </div>
    </div>
  );
}

function NoOne() {
  return (
    <>
      <h1 className="sr-only">No one here</h1>
      <EmptyState
        title="No one here"
        action={
          <Link href="/profile/" className={SECONDARY}>
            Your profile
          </Link>
        }
      >
        That profile link doesn&apos;t match anyone who has signed in.
      </EmptyState>
    </>
  );
}

function PanelSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading the numbers...</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the profile...</span>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-silver/10 p-5 sm:flex-row sm:gap-7 sm:p-7">
        <Skeleton className="size-[118px] shrink-0 rounded-full" />
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-12 rounded-lg sm:max-w-xl" />
      <PanelSkeleton />
    </div>
  );
}
