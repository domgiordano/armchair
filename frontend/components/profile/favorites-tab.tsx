"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

import { PersonLink } from "@/components/couple-names";
import { Headshot } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { Dancers, Heading, plural } from "@/components/profile/parts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  getFavorites,
  type CoupleSummary,
  type Performers,
  type PersonStats,
  type StyleStats,
} from "@/lib/api/couples";
import { gapTone, signed } from "@/lib/show/couples";
import { personSlug } from "@/lib/show/people";
import { seasonLabel } from "@/lib/show/seasons";
import { button, cn } from "@/lib/ui";

const TOP = 3;

type Load =
  { kind: "loading" } | { kind: "ready"; data: Performers<CoupleSummary> } | { kind: "error"; message: string };

interface FavoritesTabProps {
  /** A season id or "all". */
  scope: string;
  /** Null on your own profile. */
  sub: string | null;
}

/** Who and what they score highest, and where they part ways with the judges. */
export function FavoritesTab({ scope, sub }: FavoritesTabProps) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getFavorites(scope, sub).then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [scope, sub, attempt]);

  if (load.kind === "loading") return <FavoritesSkeleton />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="favorites" message={load.message} retry={retry} />;
  }

  const { data } = load;
  const own = sub === null;
  if (data.couples.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        action={
          own ? (
            <Link href="/episode/" className={button("primary", "sm")}>
              Score a dance
            </Link>
          ) : undefined
        }
      >
        {own
          ? "Score a few dances and your favorite couples, stars, pros and styles show up here."
          : "Favorites come from dances you've both scored. Score the same dances to compare."}
      </EmptyState>
    );
  }

  const byRef = new Map(data.couples.map((c) => [c.ref, c]));
  const pick = (refs: string[]) => refs.flatMap((r) => byRef.get(r) ?? []);
  const multi = data.season === "all";
  const dances = data.couples.reduce((n, c) => n + c.dances, 0);

  return (
    <div className="flex flex-col gap-6">
      {!own && <p className="text-sm text-silver-dim">From the {plural(dances, "dance")} you&apos;ve both scored.</p>}

      <section aria-labelledby="fav-couples" className="flex flex-col gap-3">
        <Heading id="fav-couples" title="Favorite couples" note="Highest average paddle." />
        <ol className="stagger grid gap-3 md:grid-cols-3">
          {pick(data.favorites).map((c, i) => (
            <li
              key={c.ref}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4",
                i === 0
                  ? "border-gold/40 bg-gradient-to-br from-gold/[0.14] via-ballroom/70 to-ballroom/40 shadow-[0_10px_30px_-18px_rgb(232_194_104/0.8)]"
                  : "border-silver/10 bg-ballroom/45",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn("font-display text-2xl tabular-nums", i === 0 ? "text-gold-light" : "text-silver-dim")}
                >
                  {i + 1}
                </span>
                <span className="text-xs text-silver-dim">
                  {plural(c.dances, "dance")}
                  {multi && ` · ${seasonLabel(c.season)}`}
                </span>
              </div>
              <Dancers members={c.members} size={40} />
              <p className="flex items-baseline gap-3 text-sm tabular-nums">
                <span className="text-silver-dim">
                  Avg <span className="text-2xl font-semibold text-pearl">{formatScore(c.you)}</span>
                </span>
                <span className="text-silver-dim">Judges {c.judges === null ? "–" : formatScore(c.judges)}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PeopleCard id="fav-stars" title="Favorite stars" people={data.celebrities.slice(0, TOP)} />
        <PeopleCard id="fav-pros" title="Favorite pros" people={data.pros.slice(0, TOP)} />
        <GapCard
          id="overrated"
          title="Most overrated"
          note={own ? "You score them higher than the judges do." : "They score them higher than the judges do."}
          couples={pick(data.softerOn)}
        />
        <GapCard
          id="underrated"
          title="Most underrated"
          note={own ? "You score them lower than the judges do." : "They score them lower than the judges do."}
          couples={pick(data.tougherOn)}
        />
      </div>

      {data.styles.length > 0 && (
        <Card id="fav-styles" title="Favorite dance styles" note="Average paddle by style, out of 10.">
          <StyleBars styles={data.styles} />
        </Card>
      )}
    </div>
  );
}

function GapChip({ gap }: { gap: number | null }) {
  const tone = gapTone(gap);
  return (
    <span
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        tone === "over" && "border-gold/40 bg-gold/10 text-gold-light",
        tone === "under" && "border-sky-300/40 bg-sky-400/10 text-sky-200",
        tone === "level" && "border-silver/20 bg-silver/5 text-silver",
      )}
    >
      {gap === null ? "–" : signed(gap)}
      <span className="sr-only"> against the judges</span>
    </span>
  );
}

function PeopleCard({ id, title, people }: { id: string; title: string; people: PersonStats[] }) {
  return (
    <Card id={id} title={title} note="Highest average paddle.">
      {people.length === 0 ? (
        <p className="text-sm text-silver-dim">Nobody yet.</p>
      ) : (
        <ol className="stagger flex flex-col divide-y divide-silver/10">
          {people.map((p) => (
            <li key={p.name} className="flex items-center gap-3 py-2.5">
              <Headshot person={p} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <PersonLink id={personSlug(p.name)} name={p.name} className="truncate font-medium text-pearl" />
                <span className="truncate text-xs text-silver-dim">
                  {plural(p.dances, "dance")}
                  {p.seasons.length > 1 && ` · ${p.seasons.length} seasons`}
                </span>
              </span>
              <span className="text-lg font-semibold text-pearl tabular-nums">{formatScore(p.you)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function GapCard({ id, title, note, couples }: { id: string; title: string; note: string; couples: CoupleSummary[] }) {
  return (
    <Card id={id} title={title} note={note}>
      {couples.length === 0 ? (
        <p className="text-sm text-silver-dim">Nobody yet: in step with the judges.</p>
      ) : (
        <ol className="stagger flex flex-col gap-3">
          {couples.map((c) => (
            <li key={c.ref} className="flex items-center justify-between gap-3">
              <Dancers members={c.members} size={32} />
              <GapChip gap={c.gap} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** One bar per style, filled to the average paddle out of 10; the highest is lit. */
function StyleBars({ styles }: { styles: StyleStats[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {styles.map((s, i) => (
        <li key={s.style} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-pearl">{s.style}</span>
            <span className="text-xs text-silver-dim">{plural(s.dances, "dance")}</span>
          </span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-silver/10">
            <span
              className={cn(
                "grow-x block h-full rounded-full",
                i === 0
                  ? "bg-gradient-to-r from-gold-deep to-gold-light"
                  : "bg-gradient-to-r from-silver-dim/60 to-silver-dim",
              )}
              style={
                {
                  width: `${(s.you / 10) * 100}%`,
                  "--d": `${i * 60}ms`,
                } as CSSProperties
              }
            />
          </span>
          <span className="text-right text-sm font-semibold tabular-nums">{formatScore(s.you)}</span>
        </li>
      ))}
    </ol>
  );
}

function FavoritesSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading favorites...</span>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
