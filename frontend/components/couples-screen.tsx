"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PerformersView } from "@/components/couples-performers";
import { WeekBoardView } from "@/components/couples-week-board";
import { PageLoader } from "@/components/disco-loader";
import { GroupPicker } from "@/components/group-picker";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import type { Season } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { withSeason } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";

type View = "performers" | "week";

const VIEWS = [
  { id: "performers", label: "Your couples" },
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

function Couples({ season }: { season: Season }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = useGroupFilter();
  const view: View = params.get("view") === "week" ? "week" : "performers";

  return (
    <>
      <PageHeader title="Couples">How you score every couple, and how the week shakes out by the judges, you and your friends.</PageHeader>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="md:w-80">
          <Tabs
            label="Couples view"
            tabs={VIEWS}
            value={view}
            onChange={(v) => router.replace(withSeason(v === "week" ? "/couples/?view=week" : "/couples/", season.season))}
            panelId={PANEL}
          />
        </div>
        <div className="md:w-80">
          <GroupPicker {...filter} />
        </div>
      </div>
      <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, view)} className="flex flex-1 flex-col gap-4">
        {view === "week" ? (
          <WeekBoardView key={season.season} season={season} group={filter.group} />
        ) : (
          <PerformersView key={season.season} season={season} group={filter.group} />
        )}
      </div>
    </>
  );
}
