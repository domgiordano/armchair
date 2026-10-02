"use client";

import { getSnapshot, type Snapshot } from "@/lib/api/dwts";
import { getCurrentPoints, seasonLabel } from "@/lib/api/traitors";
import { dwtsLink, traitorsLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { ErrorNote, PRIMARY, Skeleton, step } from "./ui";

export function AppsPanel({ index }: { index: number }) {
  return (
    // Unboxed, unlike the panels: the app tiles are the cards here.
    <section aria-labelledby="apps-title" className="rise flex flex-col gap-4" style={step(index)}>
      <h2 id="apps-title" className="text-lg font-bold tracking-tight">
        Your apps
      </h2>
      <DwtsCard />
      <TraitorsCard />
      <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#5a2a10] bg-linear-to-b from-[#3a1606] to-[#140803] p-4 text-[#ffe2c4] opacity-70">
        <span className="text-sm leading-tight font-semibold">Survivor</span>
        <span className="text-[10px] font-bold tracking-[0.2em]">COMING SOON</span>
      </div>
    </section>
  );
}

function DwtsCard() {
  const [load, retry] = useLoad(getSnapshot);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2b3a7a] bg-linear-to-br from-[#16245e] to-[#060b26] p-5 text-[#f3e6c0]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_201_60/0.22),transparent)]"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-gold">LIVE NOW</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight">Dancing with the Stars</h3>
          {load.kind === "ready" && load.value && (
            <p className="text-sm text-[#f3e6c0]/75">
              Season {load.value.season.number} &middot; {load.value.season.year}
            </p>
          )}
        </div>
        <OpenLink href={dwtsLink()} />
      </div>
      <div className="relative mt-5">
        {load.kind === "loading" && (
          <div role="status" className="grid grid-cols-3 gap-3">
            <span className="sr-only">Loading your season...</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-text/5" />
            ))}
          </div>
        )}
        {load.kind === "error" && <ErrorNote what="your season" message={load.message} retry={retry} />}
        {load.kind === "ready" && load.value && <Stats snapshot={load.value} />}
        {load.kind === "ready" && !load.value && <p className="text-sm text-[#f3e6c0]/75">No season is open yet.</p>}
      </div>
    </div>
  );
}

function OpenLink({ href }: { href: string }) {
  return (
    <a href={href} className={`${PRIMARY} shrink-0`}>
      Open
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

// Points are a bonus here: a season the API won't show, or a failed load, leaves just the link.
function TraitorsCard() {
  const [load] = useLoad(getCurrentPoints);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1c3a2a] bg-linear-to-br from-[#0b2418] to-[#040d08] p-5 text-[#e9dcc0]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_140_60/0.18),transparent)]"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-gold">LIVE NOW</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight">The Traitors</h3>
          <p className="text-sm text-[#e9dcc0]/75">US and UK</p>
        </div>
        <OpenLink href={traitorsLink()} />
      </div>
      {load.kind === "loading" && (
        <div role="status" className="relative mt-5">
          <span className="sr-only">Loading your points...</span>
          <Skeleton className="h-12 rounded-xl bg-text/5" />
        </div>
      )}
      {load.kind === "ready" && load.value.length > 0 && (
        <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          {load.value.map(({ season, points }) => (
            <div key={season.id} className="flex min-w-0 flex-col">
              <dt className="order-2 text-[11px] leading-tight font-medium tracking-wide text-[#e9dcc0]/70">
                {seasonLabel(season)}
              </dt>
              <dd className="order-1 text-2xl font-extrabold tracking-tight text-text tabular-nums">
                {points} <span className="text-sm font-semibold text-[#e9dcc0]/70">pts</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Stats({ snapshot }: { snapshot: Snapshot }) {
  const { count, mae, rank, ranked, minDances } = snapshot;
  const left = Math.max(0, minDances - count);
  const stats = [
    { label: "Dances scored", value: String(count), note: null },
    {
      label: "Accuracy",
      value: mae === null ? "--" : mae.toFixed(2),
      note: mae === null ? "Score a dance to start" : "points off the judges",
    },
    {
      label: "Rank",
      value: rank === null ? "--" : `#${rank}`,
      note: rank === null ? `${left} more ${left === 1 ? "dance" : "dances"} to rank` : `of ${ranked}`,
    },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-[#f3e6c0]/15">
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col px-3 first:pl-0">
          <dt className="order-2 text-[11px] leading-tight font-medium tracking-wide text-[#f3e6c0]/70">{s.label}</dt>
          <dd className="order-1 text-2xl font-extrabold tracking-tight text-text tabular-nums">{s.value}</dd>
          {s.note && <dd className="order-3 mt-0.5 text-[11px] leading-tight text-[#f3e6c0]/60">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

