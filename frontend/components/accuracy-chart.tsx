import { formatScore } from "@/components/performance-card";
import type { OverviewEpisode } from "@/lib/api/overview";
import { shortLabel } from "@/lib/show/overview";

interface AccuracyChartProps {
  episodes: OverviewEpisode[];
}

/**
 * Average gap to the judges per aired episode, one bar each. HTML rather than
 * SVG so the labels stay legible at phone widths; the table beside it carries
 * the same numbers for screen readers.
 */
export function AccuracyChart({ episodes }: AccuracyChartProps) {
  const aired = episodes.filter((e) => e.aired);
  const gaps = aired.flatMap((e) => (e.mae == null ? [] : [e.mae]));
  // Headroom over the tallest bar leaves its label inside the plot.
  const top = Math.max(3, Math.ceil(Math.max(0, ...gaps) * 1.15));
  const ticks = Array.from({ length: top + 1 }, (_, i) => i);
  const best = gaps.length > 1 ? Math.min(...gaps) : null;

  return (
    <figure className="relative flex flex-col gap-3">
      <div aria-hidden="true" className="flex gap-2">
        <div className="relative flex w-4 flex-col-reverse justify-between pb-6 text-right text-[10px] leading-none text-silver-dim tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-1/2">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between">
            {ticks.map((t) => (
              <span key={t} className={`h-px ${t === 0 ? "bg-silver-dim/60" : "bg-silver-dim/15"}`} />
            ))}
          </div>
          <ol className="relative flex h-44 items-stretch gap-1 sm:gap-2">
            {aired.map((e) => (
              <li key={e.ep} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="flex w-full flex-1 flex-col items-center justify-end">
                  {e.mae == null ? (
                    <span className="mb-1 text-[10px] text-silver-dim/70">-</span>
                  ) : (
                    <>
                      <span className="mb-1 text-[11px] leading-none font-semibold text-pearl tabular-nums">
                        {formatScore(e.mae)}
                      </span>
                      <span
                        className={`w-full max-w-9 rounded-t-sm ${e.mae === best ? "bg-gold-light" : "bg-gold"}`}
                        style={{ height: `${Math.max(2, (e.mae / top) * 100)}%` }}
                      />
                    </>
                  )}
                </div>
                <span className="flex h-6 items-end text-[10px] leading-none text-silver-dim">
                  {shortLabel(e, episodes)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="text-xs text-silver-dim">
        Points off the judges&apos; average per dance, by week. Shorter is closer.
        {best !== null && " Your best week is the lighter bar."}
      </figcaption>
      {/* sr-only on the table itself doesn't clip: tables ignore width and overflow. */}
      <div className="sr-only">
        <table>
        <caption>Your average gap to the judges by episode</caption>
        <thead>
          <tr>
            <th scope="col">Episode</th>
            <th scope="col">Average gap</th>
          </tr>
        </thead>
        <tbody>
          {aired.map((e) => (
            <tr key={e.ep}>
              <th scope="row">{`Week ${e.week}${e.theme ? `, ${e.theme}` : ""}`}</th>
              <td>{e.mae == null ? "not scored" : `${formatScore(e.mae)} off`}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}
