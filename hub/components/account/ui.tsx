"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import type { Person } from "@/lib/api/social";
import { profileLink } from "@/lib/links";

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

const BASE = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none ${FOCUS}`;

export const PRIMARY = `${BASE} bg-text text-night hover:bg-gold`;
export const SECONDARY = `${BASE} border border-line text-text hover:border-muted hover:bg-night-2`;
export const QUIET = `${BASE} px-3 text-muted hover:bg-line/50 hover:text-text`;

export const INPUT = `min-h-11 w-full rounded-xl border border-line bg-night/70 px-4 text-base text-text placeholder:text-muted/70 transition-colors hover:border-muted focus-visible:border-gold ${FOCUS} aria-invalid:border-magenta disabled:opacity-50`;

export const EYEBROW = "text-xs font-semibold tracking-[0.2em] text-muted uppercase";

export const displayName = (p: { name: string | null }) => p.name ?? "Someone";

/** Stagger index for a child of `.rise` (app/account.css). */
export const step = (i: number) => ({ "--i": i }) as CSSProperties;

interface PanelProps {
  id: string;
  title: string;
  count?: number;
  /** What the count is counting, for screen readers: "unread". */
  countLabel?: string;
  action?: ReactNode;
  index: number;
  children: ReactNode;
}

/** A dashboard section: heading row, then its content. */
export function Panel({ id, title, count, countLabel, action, index, children }: PanelProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rise flex flex-col gap-4 rounded-3xl border border-line bg-night-2/70 p-5 sm:p-6"
      style={step(index)}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 inline-flex min-w-6 justify-center rounded-full bg-magenta/20 px-2 text-sm text-magenta tabular-nums">
              {count}
              {countLabel && <span className="sr-only"> {countLabel}</span>}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />;
}

export function SkeletonRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}...</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ what, message, retry }: { what: string; message: string; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-magenta/30 bg-magenta/5 p-4">
      <p className="text-sm text-text">
        Couldn&rsquo;t load {what}. <span className="text-muted">{message}</span>
      </p>
      <button type="button" onClick={retry} className={SECONDARY}>
        Try again
      </button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

// Initials discs take a brand gradient picked from the name, so a list of them isn't one colour.
const TINTS = [
  "from-blue to-violet",
  "from-violet to-magenta",
  "from-magenta to-orange",
  "from-orange to-gold",
  "from-blue to-magenta",
];

const tint = (name: string | null) =>
  TINTS[Array.from(name ?? "").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % TINTS.length];

export function initials(name: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return (letters.map((w) => Array.from(w)[0]).join("") || "?").toUpperCase();
}

interface AvatarProps {
  name: string | null;
  picture: string | null;
  size?: number;
  /** Set when the name sits beside it, so screen readers don't hear it twice. */
  decorative?: boolean;
}

export function Avatar({ name, picture, size = 40, decorative = false }: AvatarProps) {
  // Keyed by URL so a new picture gets a fresh try after an old one failed.
  const [failed, setFailed] = useState<string | null>(null);
  const label = decorative ? "" : (name ?? "Someone");
  const box = { width: size, height: size };

  if (picture && failed !== picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatars in a static export; next/image adds nothing here
      <img
        src={picture}
        alt={label}
        width={size}
        height={size}
        // Google's photo host refuses some requests that carry a Referer.
        referrerPolicy="no-referrer"
        onError={() => setFailed(picture)}
        style={box}
        className="shrink-0 rounded-full bg-line object-cover"
      />
    );
  }
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={{ ...box, fontSize: Math.round(size * 0.38) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-bold text-text ${tint(name)}`}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}

interface PersonRowProps {
  person: Person;
  detail?: ReactNode;
  error?: string | null;
  children?: ReactNode;
}

/** Avatar and name linking to their profile, with actions on the right. */
export function PersonRow({ person, detail, error, children }: PersonRowProps) {
  const name = displayName(person);
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href={profileLink(person.sub)}
          className={`group flex min-h-11 min-w-[8rem] flex-1 items-center gap-3 rounded-xl ${FOCUS}`}
        >
          <Avatar name={name} picture={person.picture} decorative />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text decoration-gold underline-offset-4 group-hover:underline">
              {name}
            </span>
            {detail && <span className="block text-xs text-muted">{detail}</span>}
          </span>
        </a>
        {children && <div className="ml-auto flex shrink-0 items-center gap-1.5">{children}</div>}
      </div>
      {error && (
        <p role="alert" className="pl-13 text-sm text-magenta">
          {error}
        </p>
      )}
    </div>
  );
}
