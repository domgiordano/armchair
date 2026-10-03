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
    <section aria-labelledby="shows-title" className="rise flex flex-col gap-5" style={step(index)}>
      <h2 id="shows-title" className="text-center text-lg font-bold tracking-tight">
        Your shows
      </h2>
      {/* Wrapping flex, not a grid, so a short last row sits in the middle instead of at the left. */}
      <ul className="flex flex-wrap justify-center gap-5">
        <Slot>
          <DwtsCard />
        </Slot>
        <TraitorsCards />
        <Slot>
          <ShowCard theme="survivor" title="Survivor" eyebrow="COMING SOON">
            <p className={`text-sm ${THEMES.survivor.soft}`}>Torches, tribal council and blindsides. In rehearsal.</p>
          </ShowCard>
        </Slot>
      </ul>
    </section>
  );
}

function Slot({ children }: { children: ReactNode }) {
  return <li className="flex w-full sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]">{children}</li>;
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
  survivor: {
    card: "border-[#5a2a10] from-[#3a1606] to-[#140803] text-[#ffe2c4] opacity-80",
    glow: "bg-[radial-gradient(closest-side,rgb(255_154_61/0.16),transparent)]",
    soft: "text-[#ffe2c4]/75",
    faint: "text-[#ffe2c4]/60",
    rule: "divide-[#ffe2c4]/15",
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
  eyebrow?: string;
  /** Without one, the show isn't open yet and the card has no way in. */
  href?: string;
  action?: string;
  children?: ReactNode;
}

function ShowCard({ theme, title, subtitle, eyebrow = "LIVE NOW", href, action = "Open", children }: ShowCardProps) {
  const t = THEMES[theme];
  return (
    <article
      aria-label={title}
      className={`relative flex min-h-60 w-full flex-col overflow-hidden rounded-2xl border bg-linear-to-br p-5 ${t.card} ${
        href ? "transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-night motion-reduce:transition-none motion-reduce:hover:translate-y-0" : ""
      }`}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -top-16 -right-10 size-56 rounded-full ${t.glow}`} />
      <div className="relative min-w-0">
        <p className={`text-[10px] font-bold tracking-[0.25em] ${href ? "text-gold" : t.faint}`}>{eyebrow}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{title}</h3>
        {subtitle && <p className={`text-sm ${t.soft}`}>{subtitle}</p>}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
      {href && (
        <div className="relative mt-auto pt-5">
          <a href={href} className={PRIMARY}>
            {action}
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      )}
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
      <Slot>
        <ShowCard theme="traitors" title="The Traitors" subtitle="US and UK" href={traitorsLink()}>
          <Loading what="your Traitors seasons" />
        </ShowCard>
      </Slot>
    );
  }
  if (load.kind === "error" || load.value.length === 0) {
    return (
      <Slot>
        <ShowCard theme="traitors" title="The Traitors" subtitle="US and UK" href={traitorsLink()} />
      </Slot>
    );
  }
  return load.value.map((card) => (
    <Slot key={card.season.id}>
      <TraitorsCard card={card} />
    </Slot>
  ));
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
