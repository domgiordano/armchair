"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PersonLink } from "@/components/couple-names";
import { Headshot } from "@/components/headshot";
import { DanceList, episodeHref } from "@/components/people/person-dances";
import { DanceChart, DancerTiles, JudgeCharts, JudgeTiles } from "@/components/people/person-stats";
import { SignedIn } from "@/components/signed-in";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError } from "@armchair/app-core/api/client";
import { getPerson, type PersonPage, type Role, type SeasonResult, type Stint } from "@/lib/api/people";
import { seasonLabel } from "@/lib/show/seasons";
import { button, EYEBROW, SECONDARY, TEXT_LINK } from "@/lib/ui";

export function PersonScreen() {
  return (
    <SignedIn title="Person" wide>
      {/* ?id= is only readable on the client in a static export. */}
      <Suspense fallback={<PersonSkeleton />}>
        <PersonRoute />
      </Suspense>
    </SignedIn>
  );
}

type Load =
  | { kind: "loading" }
  | { kind: "ready"; data: PersonPage }
  | { kind: "error"; message: string; status: number | null };

function PersonRoute() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const season = params.get("season") ?? undefined;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPerson(id, season).then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
          status: e instanceof ApiError ? e.status : null,
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, season, attempt]);

  // A new season keeps the last page up until the next one lands.
  if (load.kind === "loading") return <PersonSkeleton />;
  if (load.kind === "error") {
    if (load.status === 404 || load.status === 400) {
      return (
        <>
          <h1 className="sr-only">No one here</h1>
          <EmptyState
            title="No one here"
            action={
              <Link href="/discover/" className={SECONDARY}>
                Discover
              </Link>
            }
          >
            That link doesn&apos;t match any star, pro or judge.
          </EmptyState>
        </>
      );
    }
    return (
      <ErrorState
        what="this page"
        message={load.message}
        retry={() => {
          setLoad({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <Person key={id} data={load.data} season={season} />;
}

const ROLE: Record<Role, string> = { celebrity: "Star", pro: "Pro", judge: "Judge" };

const date = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!m) return String(y);
  return new Date(Date.UTC(y, m - 1, d ?? 1)).toLocaleDateString("en-US", {
    ...(d ? { day: "numeric" } : {}),
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

function Person({ data, season }: { data: PersonPage; season?: string }) {
  const router = useRouter();
  const pick = (s: string) => router.replace(`/people/?id=${encodeURIComponent(data.id)}&season=${encodeURIComponent(s)}`, { scroll: false });
  const danced = data.seasons.filter((s) => s.role !== "judge");
  const judged = data.seasons.filter((s) => s.role === "judge");
  const judgeFirst = data.roles[0] === "judge";
  const judgeStats = data.stats.judge && (
    <section aria-labelledby="as-judge" className="flex flex-col gap-4">
      <h2 id="as-judge" className="text-lg font-semibold text-pearl">
        On the panel
      </h2>
      <JudgeTiles stats={data.stats.judge} />
      <JudgeCharts stats={data.stats.judge} />
    </section>
  );

  return (
    <div className="flex flex-col gap-10">
      <Hero data={data} />

      {judgeFirst && judgeStats}

      {data.stats.dancer && (
        <section aria-labelledby="as-dancer" className="flex flex-col gap-4">
          <h2 id="as-dancer" className="text-lg font-semibold text-pearl">
            {data.roles.includes("celebrity") ? "On the floor" : "As a pro"}
          </h2>
          <DancerTiles stats={data.stats.dancer} />
          <DanceChart rows={data.performances} />
        </section>
      )}

      {danced.length > 0 && <Timeline stints={danced} onLoad={pick} />}

      {!judgeFirst && judgeStats}

      {data.performances.length > 0 && (
        <section aria-labelledby="dances" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="dances" className="text-lg font-semibold text-pearl">
              {season ? `Dances in ${seasonLabel(season)}` : "Every dance"}
            </h2>
            {season && (
              <Link href={`/people/?id=${encodeURIComponent(data.id)}`} className={TEXT_LINK}>
                All seasons
              </Link>
            )}
          </div>
          <DanceList rows={data.performances} self={data.id} />
        </section>
      )}

      {data.judged && (
        <section aria-labelledby="judged" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="judged" className="text-lg font-semibold text-pearl">
              Dances they judged
            </h2>
            {judged.length > 1 && (
              <Select
                label="Season"
                inline
                compact
                value={data.judged.season}
                options={[...judged].reverse().map((s) => ({ value: s.season, label: seasonLabel(s.season) }))}
                onChange={pick}
              />
            )}
          </div>
          {data.judged.rows.length === 0 ? (
            <EmptyState compact>No aired nights on the panel in {seasonLabel(data.judged.season)} yet.</EmptyState>
          ) : (
            <DanceList rows={data.judged.rows} self={data.id} judge={data.id} />
          )}
        </section>
      )}
    </div>
  );
}

function Hero({ data }: { data: PersonPage }) {
  const facts = data.facts;
  const line = [
    facts?.born && `Born ${date(facts.born)}`,
    facts?.died && `died ${date(facts.died)}`,
    facts?.nationality.join(", "),
  ].filter(Boolean);
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
      <div className="shrink-0 self-start rounded-full shadow-[0_0_40px_-8px_rgb(232_194_104/0.55)]">
        <Headshot person={{ name: data.name, headshot: data.headshot }} size={128} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {data.roles.map((r) => (
              <Badge key={r} tone={r === "judge" ? "magenta" : "gold"}>
                {ROLE[r]}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-pearl sm:text-4xl">{data.name}</h1>
          {data.bio?.description && <p className="text-silver first-letter:uppercase">{data.bio.description}</p>}
          {line.length > 0 && <p className="text-sm text-silver-dim">{line.join(" · ")}</p>}
          {facts && facts.occupations.length > 0 && (
            <p className="text-sm text-silver-dim">{facts.occupations.join(", ")}</p>
          )}
        </div>
        {data.bio && (
          <div className="flex max-w-2xl flex-col gap-1.5">
            <p className="leading-relaxed text-silver">{data.bio.extract}</p>
            <p className="text-xs text-silver-dim">
              <a href={data.bio.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                From Wikipedia
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              , under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className={TEXT_LINK}
              >
                CC BY-SA 4.0
              </a>
            </p>
          </div>
        )}
      </div>
    </header>
  );
}

function resultText(result: SeasonResult | null | undefined): string | null {
  if (!result || "locked" in result) return null;
  if (result.status === "out") return result.week === null ? "Out" : `Out in week ${result.week}`;
  if (result.status === "dancing") return "Still dancing";
  return "Made the finale";
}

function Timeline({ stints, onLoad }: { stints: Stint[]; onLoad: (season: string) => void }) {
  const unscored = [...stints].reverse().filter((s) => !s.loaded);
  return (
    <section aria-labelledby="seasons" className="flex flex-col gap-3">
      <h2 id="seasons" className="text-lg font-semibold text-pearl">
        Seasons
      </h2>
      <ol className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...stints].reverse().filter((s) => s.loaded).map((s) => {
          const result = s.result;
          const text = resultText(result);
          return (
            <li key={`${s.season}-${s.role}`} className="flex flex-col gap-2 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className={EYEBROW}>{seasonLabel(s.season)}</p>
                {text && <Badge tone={result && "status" in result && result.status === "out" ? "muted" : "gold"}>{text}</Badge>}
              </div>
              {s.partners && s.partners.length > 0 && (
                <p className="text-sm text-pearl">
                  with{" "}
                  {s.partners.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " & "}
                      <PersonLink id={p.id} name={p.name} />
                    </span>
                  ))}
                </p>
              )}
              {result && "locked" in result && (
                <Link href={episodeHref(result.season, result.ep)} prefetch={false} className={`${TEXT_LINK} self-start text-xs`}>
                  Finish episode {result.ep} to see how they did
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {unscored.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-sm text-silver-dim">
            More seasons. Open one to see their dances and results.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {unscored.map((s) => (
              <li key={`${s.season}-${s.role}`}>
                <button
                  type="button"
                  onClick={() => onLoad(s.season)}
                  className={`${button("secondary", "sm")} gap-1.5`}
                >
                  {seasonLabel(s.season)}
                  {s.partners?.[0] && <span className="text-silver-dim">with {s.partners[0].name}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PersonSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading...</span>
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        <Skeleton className="size-32 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-16 w-full max-w-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
