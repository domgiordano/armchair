import Link from "next/link";

import { CoupleLink, CoupleNames, PersonLink } from "@/components/couple-names";
import { Headshot } from "@/components/headshot";
import { episodeHref } from "@/components/people/person-dances";
import { Badge } from "@/components/ui/badge";
import type { JudgeStats, PersonPage, SimilarCelebrity, SimilarReason, Stint } from "@/lib/api/people";
import type { Member } from "@/lib/api/show";
import { placeText } from "@/lib/show/couple";
import { personHref } from "@/lib/show/people";
import { seasonLabel } from "@/lib/show/seasons";
import { button, cn, EYEBROW, FOCUS, TEXT_LINK } from "@/lib/ui";

const CARD =
  "relative flex flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5 transition-[border-color,background-color,transform] duration-200";

/** How a stint went, as far as the caller may know: the gate's result for a loaded season, else a finished season's place. */
function finish(s: Stint): { text: string; won: boolean } | null {
  const placed =
    s.place !== undefined && s.cast !== undefined ? { text: placeText(s.place, s.cast), won: s.place === 1 } : null;
  const r = s.result;
  if (!r || "locked" in r) return placed;
  if (r.status === "dancing") return { text: "Still dancing", won: false };
  if (placed) return placed;
  if (r.status === "out") return { text: r.week === null ? "Out" : `Out in week ${r.week}`, won: false };
  return { text: "Made the finale", won: false };
}

/** Every season they danced, newest first, each card opening that season's couple page. */
export function PersonCouples({ data }: { data: PersonPage }) {
  const stints = data.seasons.filter((s) => s.role !== "judge").sort((a, b) => b.number - a.number);
  if (stints.length === 0) return null;
  const pro = stints.some((s) => s.role === "pro");
  const titles = stints.filter((s) => s.place === 1).length;
  const partners = new Set(stints.flatMap((s) => (s.partners ?? []).map((p) => p.id))).size;
  const finals = stints.filter((s) => s.place !== undefined && s.place <= 3).length;

  return (
    <section aria-labelledby="couples" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="couples" className="text-lg font-semibold text-pearl">
          {pro ? "Partners over the years" : "Danced with"}
        </h2>
        {pro && (
          <ul aria-label="Their run" className="flex flex-wrap gap-1.5 text-xs">
            <Fact>{stints.length === 1 ? "1 season" : `${stints.length} seasons`}</Fact>
            <Fact>{partners === 1 ? "1 partner" : `${partners} partners`}</Fact>
            {titles > 0 && <Fact gold>{titles === 1 ? "1 title" : `${titles} titles`}</Fact>}
            {finals > titles && <Fact>{`${finals} top-three finishes`}</Fact>}
          </ul>
        )}
      </div>
      <ol className="stagger grid grid-cols-1 gap-2.5 min-[30rem]:grid-cols-2 lg:grid-cols-3">
        {stints.map((s) => (
          <li key={`${s.season}-${s.role}`}>
            <StintCard self={data} stint={s} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function StintCard({ self, stint }: { self: PersonPage; stint: Stint }) {
  const partner = stint.partners?.[0];
  const me: Member = { name: self.name, role: stint.role === "pro" ? "pro" : "celebrity", headshot: self.headshot };
  const them: Member | null = partner
    ? { name: partner.name, role: me.role === "pro" ? "celebrity" : "pro", headshot: partner.headshot ?? null }
    : null;
  const done = finish(stint);
  const locked = stint.result && "locked" in stint.result ? stint.result : null;

  return (
    <article
      className={cn(
        CARD,
        "group h-full hover:-translate-y-0.5 hover:border-gold/35 hover:bg-ballroom/70",
        done?.won && "border-gold/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={EYEBROW}>{seasonLabel(stint.season)}</p>
        {done && <Badge tone={done.won ? "gold" : "silver"}>{done.text}</Badge>}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0">
          <span className="relative z-[1] rounded-full ring-2 ring-ink">
            <Headshot person={me} size={44} />
          </span>
          {them && (
            <span className="-ml-3 rounded-full ring-2 ring-ink transition-transform duration-200 group-hover:translate-x-1">
              <Headshot person={them} size={44} />
            </span>
          )}
        </span>
        <p className="min-w-0 text-sm text-silver">
          with{" "}
          {stint.partners?.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " & "}
              <PersonLink id={p.id} name={p.name} className="relative z-10 font-medium text-pearl" />
            </span>
          ))}
        </p>
      </div>
      {locked ? (
        <Link
          href={episodeHref(locked.season, locked.ep)}
          prefetch={false}
          className={cn(TEXT_LINK, "relative z-10 self-start text-xs")}
        >
          Finish episode {locked.ep} to see how they did
        </Link>
      ) : null}
      {them && (
        <CoupleLink
          members={[me, them]}
          season={stint.season}
          className="mt-auto self-start text-xs font-medium text-gold-light after:absolute after:inset-0 after:rounded-xl"
        >
          Their season
          <span className="sr-only">
            : {seasonLabel(stint.season)} with {them.name}
          </span>
        </CoupleLink>
      )}
    </article>
  );
}

function Fact({ children, gold }: { children: string; gold?: boolean }) {
  return (
    <li
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-medium",
        gold ? "border-gold/40 bg-gold/10 text-gold-light" : "border-silver/15 bg-ink/40 text-silver",
      )}
    >
      {children}
    </li>
  );
}

const REASON: Record<Exclude<SimilarReason, "category">, string> = { cast: "Same season", finish: "Similar finish" };

/** Other celebrities like this one, each opening their page. */
export function SimilarCelebrities({ similar }: { similar: SimilarCelebrity[] }) {
  if (similar.length === 0) return null;
  return (
    <section aria-labelledby="similar" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="similar" className="text-lg font-semibold text-pearl">
          Similar celebrities
        </h2>
        <p className="text-sm text-silver-dim">
          The same line of work, the same cast, or a finish in the same part of the field.
        </p>
      </div>
      <ul className="stagger grid grid-cols-1 gap-2 min-[30rem]:grid-cols-2 lg:grid-cols-3">
        {similar.map((c) => (
          <li key={c.id}>
            <Link
              href={personHref(c.id)}
              prefetch={false}
              className={cn(
                CARD,
                "group min-h-16 flex-row items-center hover:-translate-y-0.5 hover:border-gold/35 hover:bg-ballroom/70 active:translate-y-0",
                FOCUS,
              )}
            >
              <Headshot person={c} size={48} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium text-pearl transition-colors group-hover:text-gold-light">
                  {c.name}
                </span>
                <span className="flex flex-wrap gap-1 text-[11px] text-silver-dim">
                  <span>{`Season ${c.season}`}</span>
                  {c.reasons.map((r) => (
                    <span key={r} className="rounded-full border border-silver/15 px-1.5">
                      {r === "category" ? (c.category ?? "Same field") : REASON[r]}
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface JudgedSeasonsProps {
  stints: Stint[];
  stats: JudgeStats | null;
  onLoad: (season: string) => void;
}

/** Every season on the panel, newest first, with the couple they scored highest where the caller has seen enough. */
export function JudgedSeasons({ stints, stats, onLoad }: JudgedSeasonsProps) {
  if (stints.length === 0) return null;
  const by = new Map((stats?.bySeason ?? []).map((s) => [s.season, s]));
  return (
    <section aria-labelledby="seasons-judged" className="flex flex-col gap-4">
      <h2 id="seasons-judged" className="text-lg font-semibold text-pearl">
        Seasons judged
      </h2>
      <ol className="stagger grid grid-cols-1 gap-2.5 min-[30rem]:grid-cols-2 lg:grid-cols-3">
        {[...stints].sort((a, b) => b.number - a.number).map((s) => {
          const numbers = by.get(s.season);
          const top = numbers?.top;
          const members: Member[] = (top?.dancers ?? []).map((d) => ({ name: d.name, role: d.role, headshot: null }));
          return (
            <li key={s.season} className={cn(CARD, "h-full")}>
              <div className="flex items-baseline justify-between gap-2">
                <p className={EYEBROW}>{seasonLabel(s.season)}</p>
                {numbers && (
                  <p className="text-xs text-silver-dim tabular-nums">
                    avg{" "}
                    <span className="font-semibold text-pearl">
                      {numbers.mean === null ? "–" : numbers.mean.toFixed(1)}
                    </span>{" "}
                    over {numbers.count}
                  </p>
                )}
              </div>
              {top && members.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] tracking-wide text-silver-dim uppercase">Scored highest</p>
                  <CoupleNames members={members} className="text-sm font-medium text-pearl" />
                  <p className="flex items-center justify-between gap-2 text-xs text-silver-dim">
                    <span className="tabular-nums">
                      {top.mean === null ? "–" : top.mean.toFixed(1)} from them,{" "}
                      {top.count === 1 ? "1 dance" : `${top.count} dances`}
                    </span>
                    <CoupleLink members={members} season={s.season} className="text-xs font-medium text-gold-light">
                      Their season<span className="sr-only">: {seasonLabel(s.season)}</span>
                    </CoupleLink>
                  </p>
                </div>
              ) : s.loaded ? (
                <p className="text-sm text-silver-dim">
                  Score their nights in {seasonLabel(s.season)} to see who they rated highest.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onLoad(s.season)}
                  className={cn(button("secondary", "sm"), "self-start")}
                >
                  Open {seasonLabel(s.season)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
