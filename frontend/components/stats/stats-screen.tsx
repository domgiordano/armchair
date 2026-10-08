"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageLoader } from "@/components/disco-loader";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { groupHref } from "@armchair/app-core/api/groups";
import type { Season } from "@/lib/api/show";
import { getCrowdStats, getPersonStats, type CrowdScope, type CrowdStats, type PersonStats } from "@/lib/api/stats";
import { useGroupFilter, type GroupFilter } from "@/lib/show/group-filter";
import { hasAired } from "@/lib/show/schedule";
import { useSeason } from "@/lib/show/use-season";
import { button, TEXT_LINK } from "@/lib/ui";

import { CrowdView } from "./crowd-view";
import { weekName } from "./parts";
import { useFetch } from "./use-fetch";
import { PersonView } from "./person-view";

export function StatsScreen() {
  return (
    <SignedIn title="Stats" wide>
      <SeasonLoader />
    </SignedIn>
  );
}

function SeasonLoader() {
  const load = useSeason();
  if (load.kind === "loading") return <PageLoader label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <StatsPage season={load.season} />;
}

type View = "me" | "groups" | "global";
const VIEWS: View[] = ["me", "groups", "global"];
const PANEL = "stats-panel";

/** The query string is the state, so a link opens the same view: ?view=, ?sub=, ?ep=. */
function useStatsParams() {
  const params = useSearchParams();
  const router = useRouter();
  const ep = Number(params.get("ep")) || null;
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const q = next.toString();
    router.replace(q ? `/stats/?${q}` : "/stats/", { scroll: false });
  };
  const view: View = params.get("sub") ? "me" : VIEWS.includes(params.get("view") as View) ? (params.get("view") as View) : "me";
  return { sub: params.get("sub"), ep, view, set };
}

function StatsPage({ season }: { season: Season }) {
  const { sub, ep, view, set } = useStatsParams();
  const [name, setName] = useState<string | null>(null);
  const [now] = useState(Date.now);
  const aired = season.episodes.filter((e) => season.open || hasAired(e, season.timezone, now));
  const filter = useGroupFilter();

  return (
    <>
      <PageHeader
        title={sub ? (name ? `${name}'s stats` : "Their stats") : "Stats"}
        action={
          <Select
            label="Week"
            hideLabel
            className="w-48"
            value={ep === null ? "all" : String(ep)}
            options={[
              { value: "all", label: "All season" },
              ...[...aired].reverse().map((e) => ({ value: String(e.ep), label: weekName(season, e.ep), detail: e.theme ?? undefined })),
            ]}
            onChange={(v) => set({ ep: v === "all" ? null : v })}
          />
        }
      >
        {sub ? (
          <>
            Over the dances you&apos;ve both scored.{" "}
            <Link href="/stats/" className={TEXT_LINK}>
              Your stats
            </Link>
          </>
        ) : (
          "Every number covers the dances you've scored, against the judges."
        )}
      </PageHeader>
      {!sub && (
        <div className="md:max-w-md">
          <Tabs
            label="Whose stats"
            tabs={[
              { id: "me", label: "Me" },
              { id: "groups", label: "Groups" },
              { id: "global", label: "Global" },
            ]}
            value={view}
            onChange={(v) => set({ view: v === "me" ? null : v })}
            panelId={PANEL}
          />
        </div>
      )}
      <div key={view} role="tabpanel" id={PANEL} aria-labelledby={sub ? undefined : tabId(PANEL, view)} className="flex flex-col gap-4 animate-fade-in">
        {view === "me" && <PersonFetcher season={season} sub={sub} ep={ep} onName={setName} />}
        {view === "groups" && <GroupsPanel season={season} ep={ep} filter={filter} />}
        {view === "global" && <CrowdFetcher season={season} scope="global" group={null} ep={ep} name="Everyone" />}
      </div>
    </>
  );
}

function GroupsPanel({ season, ep, filter }: { season: Season; ep: number | null; filter: GroupFilter }) {
  const { groups, failed, group, pick } = filter;
  if (failed) return <ErrorState what="your groups" message="Couldn't load your groups" retry={() => window.location.reload()} />;
  if (groups === null) return <StatsSkeleton label="Loading your groups" />;
  if (groups.length === 0) {
    return (
      <EmptyState
        title="No groups yet"
        action={
          <Link href="/social/?view=groups" className={button("primary", "sm")}>
            Start a group
          </Link>
        }
      >
        Start a group with the people you watch with to compare week by week.
      </EmptyState>
    );
  }
  const current = groups.find((g) => g.id === group) ?? groups[0];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          label="Group"
          hideLabel
          className="w-56"
          value={current.id}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          onChange={pick}
        />
        <Link href={groupHref(current.id)} className={TEXT_LINK}>
          Group page
        </Link>
      </div>
      <CrowdFetcher key={current.id} season={season} scope="group" group={current.id} ep={ep} name={current.name} />
    </>
  );
}

function CrowdFetcher({
  season,
  scope,
  group,
  ep,
  name,
}: {
  season: Season;
  scope: CrowdScope;
  group: string | null;
  ep: number | null;
  name: string;
}) {
  const key = `${season.season}|${scope}|${group}|${ep}`;
  const [load, retry] = useFetch<[CrowdStats, PersonStats | null]>(
    () => Promise.all([getCrowdStats(season.season, scope, group, ep), getPersonStats(season.season, null, ep).catch(() => null)]),
    key,
  );
  if (load.kind === "loading") return <StatsSkeleton label={`Loading ${name.toLowerCase() === "everyone" ? "everyone's" : name} stats`} />;
  if (load.kind === "error") return <ErrorState what="the stats" message={load.message} retry={retry} />;
  return <CrowdView season={season} crowd={load.value[0]} me={load.value[1]} name={name} />;
}

function PersonFetcher({
  season,
  sub,
  ep,
  onName,
}: {
  season: Season;
  sub: string | null;
  ep: number | null;
  onName: (name: string | null) => void;
}) {
  const [load, retry] = useFetch<PersonStats>(() => getPersonStats(season.season, sub, ep), `${season.season}|${sub}|${ep}`);
  const name = load.kind === "ready" && sub ? (load.value.person.name ?? null) : null;
  useEffect(() => onName(name), [name, onName]);

  if (load.kind === "loading") return <StatsSkeleton label="Loading stats" />;
  if (load.kind === "error") return <ErrorState what="the stats" message={load.message} retry={retry} />;
  return <PersonView season={season} stats={load.value} mine={sub === null} />;
}

export function StatsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}...</span>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
