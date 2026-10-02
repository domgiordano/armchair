"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Ballot } from "@/components/ballot";
import { PICK_PROMPT, useBet } from "@/components/bet";
import { CatchUp } from "@/components/catch-up";
import { GroupPicker } from "@/components/group-picker";
import { useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { useGroupFilter } from "@/lib/group-filter";
import { defaultEpisode, episodeLabel, formatRelease } from "@/lib/schedule";
import { withSeason } from "@/lib/seasons";
import { useNow } from "@armchair/app-core/show/use-now";

export function EpisodeScreen() {
  const { view, reload } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const bet = useBet();
  const filter = useGroupFilter();
  const router = useRouter();
  const now = useNow();
  const asked = Number(useSearchParams().get("ep"));
  // Chosen once: sealing an episode's last call moves the default on, and the screen shouldn't follow.
  const [fallback] = useState(() => defaultEpisode(view.episodes, now)?.ep);
  const episode = view.episodes.find((e) => e.ep === (asked || fallback));
  if (!episode) {
    return <EmptyState title="No episodes yet">The schedule appears once the season is announced.</EmptyState>;
  }

  const go = (ep: number) => router.replace(withSeason(`/episode/?ep=${ep}`, view.season));
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 md:items-end">
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
        <GroupPicker {...filter} />
      </div>
      <CatchUp key={episode.ep} episodes={view.episodes} episode={episode} now={now} onCatchUp={go}>
        <Ballot
          key={episode.ep}
          season={view.season}
          episode={episode}
          group={filter.group}
          members={filter.groups?.find((g) => g.id === filter.group)?.members ?? null}
          seasonTitle={name.title}
          onNeedBet={() => bet.open(PICK_PROMPT)}
          onSealed={reload}
        />
      </CatchUp>
    </>
  );
}
