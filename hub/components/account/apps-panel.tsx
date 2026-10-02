"use client";

import type { ReactNode } from "react";

import { getSnapshot, type Snapshot } from "@/lib/api/dwts";
import { EDITION_NAMES, getSeasonCards, type SeasonCard } from "@/lib/api/traitors";
import { dwtsLink, traitorsLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { ErrorNote, PRIMARY, Skeleton, step } from "./ui";

/** A card per live show, then the ones still coming. */
export function AppsPanel({ index }: { index: number }) {
  return (
    // Unboxed, unlike the panels: the show cards are the cards here.
    <section aria-labelledby="shows-title" className="rise flex flex-col gap-4" style={step(index)}>
      <h2 id="shows-title" className="text-lg font-bold tracking-tight">
        Your shows
      </h2>
      <DwtsCard />
      <TraitorsCards />
      <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#5a2a10] bg-linear-to-b from-[#3a1606] to-[#140803] p-4 text-[#ffe2c4] opacity-70">
        <span className="text-sm leading-tight font-semibold">Survivor</span>
        <span className="text-[10px] font-bold tracking-[0.2em]">COMING SOON</span>
      </div>
    </section>
  );
}

// Each show keeps its app tile's colours; text tints are the tile's ink at lower opacity.
const THEMES = {
  dwts: {
    card: "border-[#2b3a7a] from-[#16245e] to-[#060b26] text-[#f3e6c0]",
    glow: "bg-[radial-gradient(closest-side,rgb(255_201_60/0.22),transparent)]",
    soft: "text-[#f3e6c0]/75",
    faint: "text-[#f3e6c0]/60",
    rule: "divide-[#f3e6c0]/15",
  },
  traitors: {
    card: "border-[#1c3a2a] from-[#0b2418] to-[#040d08] text-[#e9dcc0]",
    glow: "bg-[radial-gradient(closest-side,rgb(255_140_60/0.18),transparent)]",
    soft: "text-[#e9dcc0]/75",
    faint: "text-[#e9dcc0]/60",
    rule: "divide-[#e9dcc0]/15",
  },
};

type Theme = keyof typeof THEMES;

interface Figure {
  label: string;
  value: string;
  note?: string;
}

interface ShowCardProps {
  theme: Theme;
  title: string;
  subtitle?: string;
  href: string;
  action?: string;
  children?: ReactNode;
}

function ShowCard({ theme, title, subtitle, href, action = "Open", children }: ShowCardProps) {
  const t = THEMES[theme];
  return (
    <article aria-label={title} className={`relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 ${t.card}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -top-16 -right-10 size-56 rounded-full ${t.glow}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.25em] text-gold">LIVE NOW</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight">{title}</h3>
          {subtitle && <p className={`text-sm ${t.soft}`}>{subtitle}</p>}
        </div>
        <a href={href} className={`${PRIMARY} shrink-0`}>
          {action}
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </article>
  );
}

function Figures({ theme, figures }: { theme: Theme; figures: Figure[] }) {
  const t = THEMES[theme];
  return (
    <dl className={`grid grid-cols-3 divide-x ${t.rule}`}>
      {figures.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col px-3 first:pl-0">
          <dt className={`order-2 text-[11px] leading-tight font-medium tracking-wide ${t.soft}`}>{f.label}</dt>
          <dd className="order-1 truncate text-2xl font-extrabold tracking-tight text-text tabular-nums">{f.value}</dd>
          {f.note && <dd className={`order-3 mt-0.5 text-[11px] leading-tight ${t.faint}`}>{f.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <div role="status" className="grid grid-cols-3 gap-3">
      <span className="sr-only">Loading {what}...</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 rounded-xl bg-text/5" />
      ))}
    </div>
  );
}

const day = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
// Noon, so a calendar date never slips a day in the viewer's timezone.
const airDay = (airDate: string) => day(new Date(`${airDate}T12:00:00`));
const releaseTime = (at: string) =>
  `${day(new Date(at))}, ${new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

function DwtsCard() {
  const [load, retry] = useLoad(getSnapshot);
  const season = load.kind === "ready" && load.value ? load.value.season : null;

  return (
    <ShowCard
      theme="dwts"
      title="Dancing with the Stars"
      subtitle={season ? `Season ${season.number} · ${season.year}` : undefined}
      href={dwtsLink()}
    >
      {load.kind === "loading" && <Loading what="your season" />}
      {load.kind === "error" && <ErrorNote what="your season" message={load.message} retry={retry} />}
      {load.kind === "ready" && load.value && <DwtsFigures snapshot={load.value} />}
      {load.kind === "ready" && !load.value && <p className={`text-sm ${THEMES.dwts.soft}`}>No season is open yet.</p>}
    </ShowCard>
  );
}

function DwtsFigures({ snapshot }: { snapshot: Snapshot }) {
  const { count, mae, rank, ranked, minDances, next } = snapshot;
  const left = Math.max(0, minDances - count);
  return (
    <Figures
      theme="dwts"
      figures={[
        {
          label: "Accuracy",
          value: mae === null ? "--" : mae.toFixed(2),
          note: mae === null ? "Score a dance to start" : `points off over ${count} ${count === 1 ? "dance" : "dances"}`,
        },
        {
          label: "Rank",
          value: rank === null ? "--" : `#${rank}`,
          note: rank === null ? `${left} more ${left === 1 ? "dance" : "dances"} to rank` : `of ${ranked}`,
        },
        { label: "Next episode", value: next ? `E${next.ep}` : "--", note: next ? airDay(next.airDate) : "None scheduled" },
      ]}
    />
  );
}

// Points are a bonus here: if the seasons can't load, the card is still the way into the app.
function TraitorsCards() {
  const [load] = useLoad(getSeasonCards);

  if (load.kind === "loading") {
    return (
      <ShowCard theme="traitors" title="The Traitors" subtitle="US and UK" href={traitorsLink()}>
        <Loading what="your Traitors seasons" />
      </ShowCard>
    );
  }
  if (load.kind === "error" || load.value.length === 0) {
    return <ShowCard theme="traitors" title="The Traitors" subtitle="US and UK" href={traitorsLink()} />;
  }
  return load.value.map((card) => <TraitorsCard key={card.season.id} card={card} />);
}

function TraitorsCard({ card }: { card: SeasonCard }) {
  const { season, points, rank, total, needsBet, next } = card;
  const props = {
    theme: "traitors" as const,
    title: `The Traitors ${EDITION_NAMES[season.show]}`,
    subtitle: `Season ${season.number} · ${season.year}`,
    href: traitorsLink(),
  };
  if (needsBet) {
    return (
      <ShowCard {...props} action="Lock in your winners">
        <p className={`text-sm ${THEMES.traitors.soft}`}>
          Pick up to two winners to open the season&rsquo;s episodes. Your bet stays hidden until the finale.
        </p>
      </ShowCard>
    );
  }
  return (
    <ShowCard {...props}>
      <Figures
        theme="traitors"
        figures={[
          { label: "Points", value: String(points) },
          { label: "Rank", value: rank === null ? "--" : `#${rank}`, note: rank === null ? "After your first call" : `of ${total}` },
          { label: "Next episode", value: next ? `E${next.ep}` : "--", note: next ? releaseTime(next.releaseAt) : "None scheduled" },
        ]}
      />
    </ShowCard>
  );
}
