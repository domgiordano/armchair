import type { Contestant, EpisodeResults } from "@/lib/api/show";
import { bonusGroups } from "@/lib/show/bonus";

interface BonusPointsProps {
  results: EpisodeResults;
  contestants: Map<string, Contestant>;
}

const celebrity = (contestants: Map<string, Contestant>, id: string) =>
  contestants.get(id)?.members.find((m) => m.role === "celebrity")?.name ?? id;

/** The night's marathon and dance-off results, beside who went home. */
export function BonusPoints({ results, contestants }: BonusPointsProps) {
  const groups = bonusGroups(results);
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-silver/15 bg-ink/40 px-3 py-2.5 text-sm text-silver">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">{group.label}</h2>
          <ol className="flex flex-col gap-1">
            {group.rows.map((row) => (
              <li key={row.contestants.join("+")} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-pearl">
                  {row.contestants.map((id) => celebrity(contestants, id)).join(", ")}
                </span>
                <span className="shrink-0 font-semibold text-gold-light tabular-nums">
                  {row.points !== null ? `+${row.points}` : row.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
