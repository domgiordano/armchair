"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PerformersView } from "@/components/couples-performers";
import { WeekBoardView } from "@/components/couples-week-board";
import { LeaderboardView } from "@/components/couples/leaderboard";
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

type View = "board" | "season" | "week";

const VIEWS = [
  { id: "board", label: "Leaderboard" },
  { id: "season", label: "Your scores" },
  { id: "week", label: "Week board" },
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

/** `?compare=season|week` opens your scores or the week board; the old `?view=week` still opens the week board. */
function readView(params: URLSearchParams): View {
  const asked = params.get("compare");
  if (asked === "season" || asked === "week") return asked;
  return params.get("view") === "week" ? "week" : "board";
}

export function couplesHref(view: View, season: string): string {
  return withSeason(view === "board" ? "/couples/" : `/couples/?compare=${view}`, season);
}

function Couples({ season }: { season: Season }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = useGroupFilter();
  const view = readView(params);
  const go = (v: View) => router.replace(couplesHref(v, season.season), { scroll: false });

  return (
    <>
      <PageHeader title="Couples">
        Every couple in {seasonLabel(season.season)}, ranked by the judges as far as you&apos;ve watched. Open one for their whole season.
      </PageHeader>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-3">
        <div className="md:w-[26rem]">
          <Tabs label="View" tabs={VIEWS} value={view} onChange={go} panelId={PANEL} />
        </div>
        {view !== "board" && (
          <div className="animate-fade-in md:w-80">
            <GroupPicker {...filter} panelId={PANEL} />
          </div>
        )}
      </div>
      <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, view)} className="flex flex-1 animate-fade-in flex-col gap-4" key={view}>
        {view === "week" ? (
          <WeekBoardView key={season.season} season={season} group={filter.group} />
        ) : view === "season" ? (
          <PerformersView key={season.season} season={season} group={filter.group} />
        ) : (
          <LeaderboardView key={season.season} season={season} />
        )}
      </div>
    </>
  );
}
