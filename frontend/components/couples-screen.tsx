"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PerformersView } from "@/components/couples-performers";
import { WeekBoardView } from "@/components/couples-week-board";
import { RosterView, type RosterMode } from "@/components/couples/roster-view";
import { PageLoader } from "@/components/disco-loader";
import { GroupPicker } from "@/components/group-picker";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import type { Season } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { seasonLabel, withSeason } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { cn, EYEBROW } from "@/lib/ui";

type Compare = "off" | "season" | "week";

const COMPARE = [
  { id: "off", label: "Off" },
  { id: "season", label: "Season" },
  { id: "week", label: "Week" },
] as const;
const MODES = [
  { id: "list", label: "List" },
  { id: "cards", label: "Cards" },
] as const;
const PANEL = "couples-panel";

export function CouplesScreen() {
  return (
    <SignedIn title="Couples" wide>
      <SeasonLoader />
    </SignedIn>
  );
}

function SeasonLoader() {
  const load = useSeason();
  if (load.kind === "loading") return <PageLoader label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <Couples season={load.season} />;
}

/** `?compare=season|week` and `?view=cards`; the old `?view=week` still opens the week board. */
function readView(params: URLSearchParams): { compare: Compare; mode: RosterMode } {
  const view = params.get("view");
  const asked = params.get("compare");
  const compare: Compare = asked === "season" || asked === "week" ? asked : view === "week" ? "week" : "off";
  return { compare, mode: view === "cards" ? "cards" : "list" };
}

export function couplesHref(compare: Compare, mode: RosterMode, season: string): string {
  const query = new URLSearchParams();
  if (compare !== "off") query.set("compare", compare);
  if (mode === "cards") query.set("view", "cards");
  const qs = query.toString();
  return withSeason(qs ? `/couples/?${qs}` : "/couples/", season);
}

function Couples({ season }: { season: Season }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = useGroupFilter();
  const { compare, mode } = readView(params);
  const go = (c: Compare, m: RosterMode) => router.replace(couplesHref(c, m, season.season), { scroll: false });

  return (
    <>
      <PageHeader title="Couples">
        Every couple in {seasonLabel(season.season)}. Open one for their whole season, or compare how you and the judges score them.
      </PageHeader>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-end gap-2 md:flex md:justify-between md:gap-3">
        {compare === "off" ? (
          <div className="flex flex-col gap-1.5 md:w-56">
            <span className={EYEBROW}>Layout</span>
            <Tabs label="Layout" tabs={MODES} value={mode} onChange={(m) => go("off", m)} panelId={PANEL} />
          </div>
        ) : (
          <div className="col-span-2 row-start-2 animate-fade-in md:w-80">
            <GroupPicker {...filter} />
          </div>
        )}
        <div className={cn("flex flex-col gap-1.5 md:w-80", compare !== "off" && "col-span-2 row-start-1")}>
          <span className={EYEBROW}>Compare</span>
          <Tabs label="Compare" tabs={COMPARE} value={compare} onChange={(c) => go(c, mode)} panelId={PANEL} />
        </div>
      </div>
      <div
        id={PANEL}
        role="tabpanel"
        aria-labelledby={tabId(PANEL, compare === "off" ? mode : compare)}
        className="flex flex-1 animate-fade-in flex-col gap-4"
        key={compare === "off" ? mode : compare}
      >
        {compare === "week" ? (
          <WeekBoardView key={season.season} season={season} group={filter.group} />
        ) : compare === "season" ? (
          <PerformersView key={season.season} season={season} group={filter.group} />
        ) : (
          <RosterView key={season.season} season={season} mode={mode} />
        )}
      </div>
    </>
  );
}
