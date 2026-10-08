"use client";

import type { ReactNode } from "react";

import { APP_NAMES, type ActivityEvent, type AppName } from "@/lib/api/admin";

export const CARD = "rounded-3xl border border-line bg-night-2/70 p-5 sm:p-6";
export const TABLE_WRAP = "-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6";
export const TH = "px-2 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase";
export const TD = "px-2 py-2 align-top tabular-nums";

const DATE_TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
// Date-only values are UTC days; formatting them in the viewer's zone would move them a day back in the US.
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const when = (iso: string | null | undefined) => (iso ? DATE_TIME.format(new Date(iso)) : "--");
export const day = (iso: string | null | undefined) => (iso ? DATE.format(new Date(iso)) : "--");
export const pct = (share: number) => `${Math.round(share * 100)}%`;

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-night/60 px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

const APP_TINT: Record<AppName, string> = {
  dwts: "border-magenta/40 text-magenta",
  traitors: "border-gold/40 text-gold",
  hub: "border-blue/50 text-blue",
};

export function AppBadge({ app }: { app: AppName }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${APP_TINT[app]}`}>
      {APP_NAMES[app]}
    </span>
  );
}

const KIND_TINT: Record<ActivityEvent["kind"], string> = {
  view: "text-muted",
  action: "text-text font-semibold",
  error: "text-magenta font-semibold",
};

/** One event as a line: what happened, where. */
export function EventLine({ event }: { event: ActivityEvent }) {
  const what = event.kind === "view" ? "viewed" : event.kind === "error" ? `error ${event.name}` : event.name;
  const props = event.props ? Object.entries(event.props).map(([k, v]) => `${k}=${v}`).join(" ") : "";
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <AppBadge app={event.app} />
      <span className={KIND_TINT[event.kind]}>{what}</span>
      <code className="min-w-0 truncate text-xs text-muted">{event.route}</code>
      {props && <span className="text-xs text-muted">{props}</span>}
    </span>
  );
}

interface Bar {
  label: string;
  values: number[];
  muted?: boolean;
}

/** Grouped vertical bars, one group per label. `series` names each value, in order. */
export function BarChart({ bars, series, title }: { bars: Bar[]; series: { name: string; className: string }[]; title: string }) {
  const max = Math.max(1, ...bars.flatMap((b) => b.values));
  const groupW = 100 / Math.max(1, bars.length);
  // A few bars across the full width would each be a slab; cap them and centre each group.
  const barW = Math.min((groupW * 0.7) / series.length, 5);
  const inset = (groupW - barW * series.length) / 2;
  // Every label for a few bars, every other week for a quarter, one a week for a month of days.
  const labelStep = bars.length > 14 ? 7 : bars.length > 8 ? 2 : 1;
  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label={title}>
        {bars.map((b, i) =>
          b.values.map((v, j) => {
            const h = (v / max) * 46;
            return (
              <rect
                key={`${i}-${j}`}
                x={i * groupW + inset + j * barW}
                y={50 - h}
                width={barW * 0.9}
                height={h}
                rx={0.6}
                className={`${series[j].className} ${b.muted ? "opacity-30" : ""}`}
              >
                <title>{`${b.label}: ${v} ${series[j].name}`}</title>
              </rect>
            );
          }),
        )}
      </svg>
      <div className="grid text-center text-[10px] text-muted tabular-nums" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b, i) => (
          <span key={b.label} className={`whitespace-nowrap ${i % labelStep ? "invisible" : ""}`}>
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
              <rect width="10" height="10" rx="2" className={s.className} />
            </svg>
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** A compact rendering of an audit entry's before or after. */
export function Detail({ value }: { value: Record<string, unknown> | undefined }) {
  if (!value) return <span className="text-muted">--</span>;
  return (
    <code className="block text-xs break-all whitespace-pre-wrap text-muted">
      {Object.entries(value)
        .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
        .join("\n")}
    </code>
  );
}
