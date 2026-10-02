import { request } from "@armchair/app-core/api/client";

import type { SeasonSummary, Show } from "@/lib/seasons";

export const getSeasons = (show: Show) =>
  request<{ show: Show; seasons: SeasonSummary[] }>(`/seasons/list?show=${show}`).then((r) => r.seasons);
