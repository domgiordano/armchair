import Link from "next/link";
import type { CSSProperties } from "react";

import { off } from "@/components/profile-charts";
import { plural, seasonShort } from "@/components/profile/parts";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { AllTime, HistoryRow } from "@/lib/api/profile";
import { cn, FOCUS } from "@/lib/ui";

interface HistoryTabProps {
  history: HistoryRow[];
  allTime: AllTime;
  own: boolean;
}

/** Every season they've scored, newest first: dances, gap and leaderboard place, all-time on top. */
export function HistoryTab({ history, allTime, own }: HistoryTabProps) {
  if (history.length === 0) {
    return (
      <EmptyState title="No seasons yet">
        {own
          ? "A season shows here once one of your dances counts."
          : "A season shows here once one of their dances counts."}
      </EmptyState>
    );
  }
  const gaps = history.flatMap((h) => (h.mae === null ? [] : [h.mae]));
  const best = gaps.length > 1 ? Math.min(...gaps) : null;
  const top = Math.max(2, ...gaps);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/[0.1] to-transparent px-4 py-3 text-sm">
        <span className="text-xs font-semibold tracking-[0.12em] text-gold uppercase">All-time</span>
        <span className="text-pearl tabular-nums">{plural(allTime.count, "dance")}</span>
        {allTime.mae !== null && <span className="text-pearl tabular-nums">{off(allTime.mae)}</span>}
        {allTime.rank !== null && (
          <span className="text-pearl tabular-nums">
            #{allTime.rank} <span className="text-silver-dim">of {allTime.ranked}</span>
          </span>
        )}
      </div>

      <ol className="stagger flex flex-col gap-2">
        {history.map((h, i) => (
          <li key={h.season}>
            <Link
              href={`/leaderboard/?season=${encodeURIComponent(h.season)}`}
              prefetch={false}
              className={cn(
                "group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-xl border border-silver/10 bg-ballroom/45 p-4 transition-colors hover:border-gold/35 hover:bg-ballroom/70 active:bg-ballroom sm:grid-cols-[10rem_1fr_6rem_6rem]",
                FOCUS,
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold text-pearl">{seasonShort(h.season)}</span>
                {h.mae !== null && h.mae === best && <Badge tone="gold">Best</Badge>}
              </span>
              <span className="text-right text-sm text-silver-dim tabular-nums sm:order-last">
                {h.rank === null ? (
                  "Unranked"
                ) : (
                  <>
                    <span className={cn("text-lg font-semibold", h.rank <= 3 ? "text-gold-light" : "text-pearl")}>
                      #{h.rank}
                    </span>{" "}
                    of {h.ranked}
                  </>
                )}
              </span>
              <span
                aria-hidden="true"
                className="col-span-2 h-1.5 overflow-hidden rounded-full bg-silver/10 sm:col-span-1"
              >
                {h.mae !== null && (
                  <span
                    className={cn(
                      "grow-x block h-full rounded-full",
                      h.mae === best ? "bg-gradient-to-r from-gold-deep to-gold-light" : "bg-silver-dim",
                    )}
                    style={
                      {
                        width: `${Math.max(3, (h.mae / top) * 100)}%`,
                        "--d": `${i * 60}ms`,
                      } as CSSProperties
                    }
                  />
                )}
              </span>
              <span className="text-sm text-silver tabular-nums">
                {plural(h.count, "dance")}
                {h.mae !== null && <span className="text-silver-dim"> · {off(h.mae)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
