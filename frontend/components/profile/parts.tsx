import type { ReactNode } from "react";

import { CoupleAvatars } from "@/components/headshot";
import { CoupleNames } from "@/components/couple-names";
import { OUT_FADE, OUT_STRIKE } from "@/components/eliminated";
import type { Member, Season } from "@/lib/api/show";
import { episodeLabel } from "@/lib/show/schedule";
import { cn } from "@/lib/ui";

export const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export const seasonShort = (id: string) => `Season ${id.split("-")[1]}`;

/** "Week 3", or "Week 3, night 2" in a two-night week; other seasons add theirs: "S34 · Week 3". */
export function weekLabel(w: { season: string; ep: number; week: number | null }, season: Season): string {
  const e = w.season === season.season ? season.episodes.find((x) => x.ep === w.ep) : undefined;
  if (e) return episodeLabel(e, season.episodes);
  const week = w.week === null ? `Episode ${w.ep}` : `Week ${w.week}`;
  return w.season === season.season ? week : `S${w.season.split("-")[1]} · ${week}`;
}

interface TileProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** The one number the row leads with. */
  accent?: boolean;
}

/** One stat: a label, a big number, a line under it. Lives in a <dl>. */
export function Tile({ label, value, note, accent }: TileProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-28 flex-col justify-between gap-2 overflow-hidden rounded-xl border p-4",
        accent
          ? "border-gold/35 bg-gradient-to-br from-gold/[0.14] via-ballroom/70 to-ballroom/40 shadow-[0_10px_30px_-18px_rgb(232_194_104/0.7)]"
          : "border-silver/10 bg-ballroom/45",
      )}
    >
      <dt className={cn("text-xs font-semibold tracking-[0.12em] uppercase", accent ? "text-gold" : "text-silver-dim")}>
        {label}
      </dt>
      <dd className="flex flex-col gap-0.5">
        <span className="text-2xl leading-tight font-semibold text-pearl tabular-nums sm:text-3xl">{value}</span>
        {note && <span className="text-xs text-silver-dim tabular-nums">{note}</span>}
      </dd>
    </div>
  );
}

/** A heading for a block inside a tab, with an optional line under it. */
export function Heading({ id, title, note }: { id: string; title: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 id={id} className="font-semibold text-pearl">
        {title}
      </h3>
      {note && <p className="text-xs text-silver-dim">{note}</p>}
    </div>
  );
}

interface DancersProps {
  members: Member[];
  size?: number;
  /** An eliminated couple: faces drained, names struck through. */
  out?: boolean;
}

/** A couple's faces and linked names; a team dance names its celebrities instead. */
export function Dancers({ members, size = 36, out }: DancersProps) {
  const team = members.filter((m) => m.role === "celebrity").length > 1;
  if (team) {
    const stars = members.filter((m) => m.role === "celebrity");
    return <span className="font-medium text-pearl">{stars.map((m) => m.name).join(", ")}</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={cn("shrink-0", out && OUT_FADE)}>
        <CoupleAvatars members={members} size={size} />
      </span>
      <CoupleNames members={members} className={cn("min-w-0 font-medium", out ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")} />
    </span>
  );
}
