"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { CatchUp } from "@/components/catch-up";
import { ComingSoon } from "@/components/coming-soon";
import { useSeasonView } from "@/components/season-data";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { defaultEpisode, episodeLabel, formatRelease } from "@/lib/schedule";
import { withSeason } from "@/lib/seasons";
import { useNow } from "@armchair/app-core/show/use-now";

export function EpisodeScreen() {
  const { view } = useSeasonView();
  const router = useRouter();
  const now = useNow();
  const asked = Number(useSearchParams().get("ep"));
  const episode = view.episodes.find((e) => e.ep === asked) ?? defaultEpisode(view.episodes, now);
  if (!episode) return <EmptyState title="No episodes yet">The schedule appears once the season is announced.</EmptyState>;

  const go = (ep: number) => router.replace(withSeason(`/episode/?ep=${ep}`, view.season));
  return (
    <>
      <Select
        label="Episode"
        value={String(episode.ep)}
        options={view.episodes.map((e) => ({
          value: String(e.ep),
          label: e.title ? `${e.ep}. ${e.title}` : episodeLabel(e),
          detail: formatRelease(e.releaseAt),
        }))}
        onChange={(ep) => go(Number(ep))}
      />
      <CatchUp key={episode.ep} episodes={view.episodes} episode={episode} now={now} onCatchUp={go}>
        <ComingSoon what="The ballot" />
      </CatchUp>
    </>
  );
}
