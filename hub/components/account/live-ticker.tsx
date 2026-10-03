"use client";

import { Ticker } from "@/components/ticker";
import { useLoad } from "@/lib/load";
import { getTickerItems, staticTickerItems } from "@/lib/ticker";

/** The dashboard's band: the member's next episodes and boards, or the general one if those won't load. */
export function LiveTicker() {
  const [load] = useLoad(getTickerItems);

  if (load.kind === "loading") {
    return (
      <div role="status" className="flex min-h-11 items-center justify-center border-y border-line/70 bg-night-2/70">
        <span className="sr-only">Loading what&rsquo;s on...</span>
        <span aria-hidden="true" className="skeleton block h-3 w-2/3 max-w-xl rounded-full" />
      </div>
    );
  }
  const items = load.kind === "ready" && load.value.length > 0 ? load.value : staticTickerItems();
  return <Ticker label="What's on" items={items} />;
}
