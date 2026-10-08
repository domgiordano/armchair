import Link from "next/link";
import type { ReactNode } from "react";

import { CoupleLink, CoupleNames } from "@/components/couple-names";
import { OUT_FADE } from "@/components/eliminated";
import { formatScore } from "@/components/performance-card";
import type { Elimination } from "@/lib/api/couples";
import type { Season } from "@/lib/api/show";
import { episodeLabel } from "@/lib/show/schedule";
import { cn, EYEBROW, FOCUS } from "@/lib/ui";

/** A gap to the judges, always to two places: "0.70", "1.00". */
export const gap = (v: number) => v.toFixed(2);

export const pct = (share: number | null) => (share === null ? "-" : `${Math.round(share * 100)}%`);

/** "Over by 0.42", "Under by 0.30", "Even": which way someone leans against the judges. */
export function lean(bias: number | null): string {
  if (bias === null) return "-";
  if (Math.abs(bias) < 0.05) return "Even";
  return `${bias > 0 ? "Over" : "Under"} by ${Math.abs(bias).toFixed(2)}`;
}

/** "W3", "W1/2" in a two-night week: for axes. */
export function weekTick(season: Season, ep: number): string {
  const e = season.episodes.find((x) => x.ep === ep);
  return e ? episodeLabel(e, season.episodes).replace("Week ", "W").replace(", night ", "/") : `E${ep}`;
}

export function weekName(season: Season, ep: number): string {
  const e = season.episodes.find((x) => x.ep === ep);
  return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
}

/** A celebrity's name for a couple id, or the id when the roster lacks it. */
export function celebrity(season: Season, id: string): string {
  return season.contestants.find((c) => c.id === id)?.members.find((m) => m.role === "celebrity")?.name ?? id;
}

/** A couple's faces and names, linked to the couple, faded once they've gone home. */
export function Couple({
  season,
  id,
  out,
  size = 32,
  children,
}: {
  season: Season;
  id: string;
  out?: Elimination;
  size?: number;
  children?: ReactNode;
}) {
  const c = season.contestants.find((x) => x.id === id);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {c && (
        <span className={cn("shrink-0", out && OUT_FADE)}>
          <CoupleLink members={c.members} season={season.season} size={size} />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className={cn("truncate", out ? "text-silver-dim" : "text-pearl")}>
          {c ? <CoupleNames members={c.members} /> : id}
        </span>
        {children && <span className="truncate text-xs text-silver-dim">{children}</span>}
      </span>
    </span>
  );
}

/** Every couple of a dance by celebrity: one name, or a team's. */
export const danceName = (season: Season, couples: string[]) => couples.map((id) => celebrity(season, id)).join(", ");

/** A link to the episode a dance was on, where its card is. */
export function DanceLink({ ep, children }: { ep: number; children: ReactNode }) {
  return (
    <Link
      href={`/episode/?ep=${ep}`}
      className={cn("rounded-sm underline-offset-4 decoration-gold/50 hover:text-gold-light hover:underline", FOCUS)}
    >
      {children}
    </Link>
  );
}

/** "You 8 · judges 7.33": two means side by side. */
export const versus = (left: string, a: number | null, right: string, b: number | null) =>
  `${left} ${a === null ? "-" : formatScore(a)} · ${right} ${b === null ? "-" : formatScore(b)}`;

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className={EYEBROW}>{children}</h3>;
}
