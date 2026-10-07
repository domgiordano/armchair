"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getOverview, type Overview } from "@/lib/api/overview";
import { saveGroup } from "@/lib/show/group-filter";
import { showTime } from "@/lib/show/overview";
import { episodeLabel, formatAirDate } from "@/lib/show/schedule";
import { scoreTarget, type ScoreTarget } from "@/lib/show/score-target";
import { useSeasonId, withSeason } from "@/lib/show/seasons";
import { useNow } from "@armchair/app-core/show/use-now";
import { button, cn } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; overview: Overview } | { kind: "error" };

/**
 * This week's show for the season in the URL. The overview read is cached, so
 * every CTA on a page shares one request; a page holding the overview passes it.
 */
export function useScoreTarget(given?: Overview): {
  load: Load["kind"];
  target: ScoreTarget | null;
  overview: Overview | null;
  season: string;
} {
  const season = useSeasonId();
  const now = useNow();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    if (given) return;
    let cancelled = false;
    getOverview(season).then(
      (overview) => !cancelled && setLoad({ kind: "ready", overview }),
      // The CTA is a shortcut, not the page: without the overview it just stays out of the way.
      () => !cancelled && setLoad({ kind: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, given]);

  const overview = given ?? (load.kind === "ready" ? load.overview : null);
  return { load: given ? "ready" : load.kind, target: overview && scoreTarget(overview, now), overview, season };
}

interface ScoreCtaProps {
  /** The page's own copy, when it has one. */
  overview?: Overview;
  /** Opening the scorecard from a group compares it with that group. */
  group?: string;
  /** Names the group on the compact row, so a list of group cards doesn't repeat one label. */
  groupName?: string;
  /** A line under the headline saying why to score, e.g. what it takes to rank. */
  note?: ReactNode;
  /** A one-line row for cards and lists, instead of the full panel. */
  compact?: boolean;
  /** Render nothing unless there's a dance left to score. */
  onlyToScore?: boolean;
  className?: string;
}

/** "Score this week's show", with your progress, wherever people land before they've scored. */
export function ScoreCta({ overview: given, group, groupName, note, compact = false, onlyToScore = false, className }: ScoreCtaProps) {
  const { load, target, overview, season } = useScoreTarget(given);

  if (load === "loading") {
    if (onlyToScore) return null;
    return compact ? (
      <Skeleton className={cn("h-11 w-full rounded-lg", className)} />
    ) : (
      <Skeleton className={cn("h-36 w-full rounded-xl", className)} />
    );
  }
  if (!target || !overview || (onlyToScore && target.kind !== "score")) return null;

  const href = (ep: number) => withSeason(`/episode/?ep=${ep}`, season);
  const remember = group ? () => saveGroup(group) : undefined;
  const name = (e: { week: number; ep: number; theme: string | null }) => {
    const label = episodeLabel(overview.episodes.find((o) => o.ep === e.ep) ?? e, overview.episodes);
    return e.theme ? `${label} · ${e.theme}` : label;
  };
  const when = (n: NonNullable<Overview["next"]>) => `${formatAirDate(n.airDate)}, ${showTime(n.startsAt, overview.timezone)}`;

  if (compact) return <CompactCta target={target} groupName={groupName} name={name} when={when} href={href} onGo={remember} className={className} />;

  let eyebrow: ReactNode = "This week's show";
  let title: string;
  let body: ReactNode;
  let action: ReactNode = null;
  let progress: { answered: number; rateable: number } | null = null;

  if (target.kind === "score") {
    const { episode, answered, rateable } = target;
    title = name(episode);
    const started = answered !== null && answered > 0;
    if (target.live) {
      eyebrow = (
        <>
          <span aria-hidden="true" className="size-2 rounded-full bg-brand-magenta motion-safe:animate-pulse" />
          Live now
        </>
      );
    }
    if (rateable) progress = { answered: answered ?? 0, rateable };
    body = rateable
      ? `${rateable - (answered ?? 0)} of ${rateable} dances still need your paddle.`
      : "Dances appear as the running order comes in.";
    action = (
      <Link href={href(episode.ep)} onClick={remember} className={cn(button("primary"), "group")}>
        {started ? "Keep scoring" : "Score this week's show"}
        <Arrow />
      </Link>
    );
  } else if (target.kind === "done") {
    title = name(target.episode);
    body = target.next
      ? `Every dance is scored. ${name(target.next)} airs ${when(target.next)}.`
      : "Every dance is scored.";
    progress = target.episode.rateable ? { answered: target.episode.rateable, rateable: target.episode.rateable } : null;
    action = (
      <Link href={href(target.episode.ep)} onClick={remember} className={button("secondary")}>
        See your scorecard
      </Link>
    );
  } else {
    eyebrow = "Up next";
    title = name(target.next);
    body = `Airs ${when(target.next)}. Paddles open at showtime.`;
  }

  return (
    <section
      aria-label="This week's show"
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:p-5",
        target.kind === "score"
          ? "border-gold/40 bg-gradient-to-br from-gold/[0.09] via-ballroom/60 to-ballroom/40 shadow-[0_10px_40px_-24px_rgb(232_194_104/0.7)]"
          : "border-silver/10 bg-ballroom/45",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-gold uppercase">{eyebrow}</p>
          <h2 className="text-lg leading-tight font-semibold text-pearl">{title}</h2>
        </div>
        {progress && (
          <p className="shrink-0 text-right text-sm text-silver-dim tabular-nums">
            <span className="text-xl font-semibold text-pearl">{progress.answered}</span>/{progress.rateable}
            <span className="block text-xs">scored</span>
          </p>
        )}
      </div>
      {progress && (
        <div
          role="progressbar"
          aria-label="Your dances scored this week"
          aria-valuemin={0}
          aria-valuemax={progress.rateable}
          aria-valuenow={progress.answered}
          className="h-1.5 overflow-hidden rounded-full bg-silver/10"
        >
          <div
            className="grow-x h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-light"
            style={{ width: `${(progress.answered / progress.rateable) * 100}%` }}
          />
        </div>
      )}
      <p className="text-sm text-silver-dim">{body}</p>
      {note && <p className="text-sm text-silver">{note}</p>}
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </section>
  );
}

interface CompactCtaProps {
  target: ScoreTarget;
  groupName?: string;
  name: (e: { week: number; ep: number; theme: string | null }) => string;
  when: (n: NonNullable<Overview["next"]>) => string;
  href: (ep: number) => string;
  onGo?: () => void;
  className?: string;
}

function CompactCta({ target, groupName, name, when, href, onGo, className }: CompactCtaProps) {
  const box = "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm";
  if (target.kind === "upcoming") {
    return (
      <p className={cn(box, "border-silver/10 bg-ink/40 text-silver-dim", className)}>
        {name(target.next)} airs {when(target.next)}
      </p>
    );
  }
  const done = target.kind === "done";
  const { answered, rateable } = done
    ? { answered: target.episode.rateable ?? null, rateable: target.episode.rateable ?? null }
    : target;

  return (
    <Link
      href={href(target.episode.ep)}
      onClick={onGo}
      className={cn(
        box,
        "group/cta transition-colors focus-ring",
        done
          ? "border-silver/10 bg-ink/40 text-silver hover:border-silver/25 hover:bg-ballroom/60"
          : "border-gold/40 bg-gold/10 text-gold-light hover:border-gold/70 hover:bg-gold/15 active:bg-gold/20",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">
        {done
          ? `${name(target.episode)}: all scored`
          : groupName
            ? `Score week ${target.episode.week} with ${groupName}`
            : `Score ${name(target.episode)}`}
      </span>
      {rateable ? (
        <span className="shrink-0 tabular-nums text-silver-dim">
          {answered ?? 0}/{rateable}
        </span>
      ) : null}
      <Arrow />
    </Link>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover/cta:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
