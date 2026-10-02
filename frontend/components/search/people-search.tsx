"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { Avatar } from "@/components/avatar";
import { Headshot } from "@/components/headshot";
import { Spinner } from "@/components/ui/spinner";
import { profileHref, SEARCH_MAX, SEARCH_MIN, type PersonHit, type Role, type SearchResults } from "@/lib/api/people";
import type { Match } from "@armchair/app-core/api/social";
import { fold } from "@/lib/search/match";
import { knownMembers, loadContacts, loadIndex, mergeUsers, searchIndex, searchMembers, startsWith } from "@/lib/search/people";
import { personHref } from "@/lib/show/people";
import { cn, EYEBROW, FOCUS, INPUT } from "@/lib/ui";

const DELAY_MS = 200;

export interface Hit {
  id: string;
  href: string;
  name: string;
  detail: string;
  picture?: string | null;
  image?: string | null;
}

export interface Section {
  label: string;
  hits: Hit[];
}

const RELATION: Record<NonNullable<Match["status"]>, string> = {
  friend: "Friend",
  incoming: "Wants to be friends",
  outgoing: "Request sent",
};

const ROLE: Record<Role, string> = { celebrity: "Star", pro: "Pro", judge: "Judge" };

export function seasonsText(seasons: number[]): string {
  if (seasons.length === 1) return `Season ${seasons[0]}`;
  if (seasons.length === 2) return `Seasons ${seasons[0]} and ${seasons[1]}`;
  return `${seasons.length} seasons`;
}

export function rolesText(roles: Role[]): string {
  const words = roles.map((r) => ROLE[r]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)!.toLowerCase()}` : words[0];
}

const personHit = (p: PersonHit): Hit => ({
  id: `p-${p.id}`,
  href: personHref(p.id),
  name: p.name,
  detail: `${rolesText(p.roles)} · ${seasonsText(p.seasons)}`,
  image: p.headshot,
});

/** The results as the list shows them: non-empty groups in a fixed order. */
export function sections(r: SearchResults): Section[] {
  return [
    {
      label: "People",
      hits: r.users.map((u) => ({
        id: `u-${u.sub}`,
        href: profileHref(u.sub),
        name: u.name ?? "Someone",
        detail: u.status ? RELATION[u.status] : "Armchair judge",
        picture: u.picture,
      })),
    },
    { label: "Stars", hits: r.stars.map(personHit) },
    { label: "Pros", hits: r.pros.map(personHit) },
    { label: "Judges", hits: r.judges.map(personHit) },
  ].filter((s) => s.hits.length > 0);
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

interface Members {
  q: string;
  list: Match[];
  error: string | null;
}

/**
 * Stars, pros, judges and your contacts match here as you type; other members
 * come from the server after a pause. Until they do, the last member list stays
 * up, narrowed to the new query, so rows don't flicker.
 */
export function useSearch(q: string) {
  const raw = q.trim();
  const query = fold(q);
  const short = query.length < SEARCH_MIN;
  const [people, setPeople] = useState<PersonHit[] | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Match[]>([]);
  const [members, setMembers] = useState<Members>({ q: "", list: [], error: null });
  const known = short ? undefined : knownMembers(raw);
  const ask = !short && !known;

  useEffect(() => {
    let cancelled = false;
    loadIndex().then(
      (p) => !cancelled && setPeople(p),
      (e: unknown) => !cancelled && setIndexError(message(e)),
    );
    // Contacts only put friends first and find them mid-name; the server finds
    // them by prefix anyway, so search works on without them.
    loadContacts().then(
      (c) => !cancelled && setContacts(c),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ask) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchMembers(raw).then(
        (list) => !cancelled && setMembers({ q: raw, list, error: null }),
        (e: unknown) => !cancelled && setMembers({ q: raw, list: [], error: message(e) }),
      );
    }, DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [raw, ask]);

  const pending = ask && members.q !== raw;
  const found = known ?? (pending ? members.list.filter((m) => startsWith(m, raw)) : members.list);
  const local = useMemo(() => (people && !short ? searchIndex(people, query) : null), [people, query, short]);

  if (short) return { short, busy: false, results: null, error: null };
  return {
    short,
    busy: pending || (people === null && indexError === null),
    results: {
      users: mergeUsers(contacts, found, query),
      ...(local ?? { stars: [], pros: [], judges: [] }),
    },
    error: indexError ?? (ask && !pending ? members.error : null),
  };
}

interface SearchBoxProps {
  /** "popover" floats the results under the field; "inline" lists them in place. */
  variant: "popover" | "inline";
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  /** After a result is picked. */
  onNavigate?: () => void;
  /** Escape on an empty field. */
  onEscape?: () => void;
  /** Beside the field, like the phone sheet's Cancel. */
  aside?: ReactNode;
  className?: string;
}

/** A combobox over users, stars, pros and judges: arrow keys walk the results, Enter opens one. */
export function SearchBox({ variant, inputRef, autoFocus, onNavigate, onEscape, aside, className }: SearchBoxProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(variant === "inline");
  const [active, setActive] = useState(-1);
  const { short, busy, results, error } = useSearch(q);
  const listId = useId();
  const labelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const groups = results ? sections(results) : [];
  const hits = groups.flatMap((g) => g.hits);
  const optionId = (i: number) => `${listId}-${i}`;

  // A new list starts with nothing picked.
  const listed = hits.map((h) => h.id).join(" ");
  const [seen, setSeen] = useState(listed);
  if (seen !== listed) {
    setSeen(listed);
    setActive(-1);
  }

  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  useEffect(() => {
    if (variant !== "popover" || !open) return;
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [variant, open]);

  const picked = () => {
    setQ("");
    if (variant === "popover") setOpen(false);
    onNavigate?.();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (q) setQ("");
      else if (variant === "popover" && open) setOpen(false);
      else onEscape?.();
      return;
    }
    if (e.key === "Enter") {
      const hit = hits[Math.max(active, 0)];
      if (!hit) return;
      e.preventDefault();
      router.push(hit.href);
      picked();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step === undefined || hits.length === 0) return;
    e.preventDefault();
    setOpen(true);
    setActive((a) => (a < 0 ? (step > 0 ? 0 : hits.length - 1) : (a + step + hits.length) % hits.length));
  };

  const expanded = open && !short && (results !== null || error !== null);
  const panel = (
    <Results
      id={listId}
      labelId={labelId}
      groups={groups}
      active={active}
      optionId={optionId}
      onPick={picked}
      empty={results !== null && !busy && hits.length === 0}
      error={error}
      q={q.trim()}
    />
  );

  return (
    <div ref={root} className={cn("relative", className)}>
      <label id={labelId} htmlFor={`${listId}-input`} className="sr-only">
        Search people, stars, pros and judges
      </label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
        <SearchIcon />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={SEARCH_MAX}
          placeholder="Search people, stars, judges"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className={cn(
            INPUT,
            "pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden",
            variant === "popover" &&
              "min-h-10 w-48 animate-search-open rounded-full bg-ink/40 text-sm transition-[width,background-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)] focus:w-80 focus:bg-ink/80 lg:w-60 lg:focus:w-96 motion-reduce:animate-none motion-reduce:transition-none",
          )}
        />
        {busy && hits.length === 0 && <Spinner className="absolute top-1/2 right-3.5 -translate-y-1/2" />}
        </div>
        {aside}
      </div>
      {variant === "inline" && short && (
        <p className="px-1 pt-6 text-sm text-silver-dim">Find friends by name, or any star, pro or judge from every season.</p>
      )}
      {expanded &&
        (variant === "popover" ? (
          <div className="absolute top-full right-0 z-30 mt-2 max-h-[min(70vh,34rem)] w-[min(26rem,calc(100vw-2rem))] origin-top-right overflow-y-auto overscroll-contain rounded-lg border border-silver/15 bg-ballroom p-1.5 shadow-xl shadow-ink/70 animate-pop-in">
            {panel}
          </div>
        ) : (
          <div className="pt-3">{panel}</div>
        ))}
      <p aria-live="polite" className="sr-only">
        {results && !short ? `${hits.length} ${hits.length === 1 ? "result" : "results"}` : ""}
      </p>
    </div>
  );
}

interface ResultsProps {
  id: string;
  labelId: string;
  groups: Section[];
  active: number;
  optionId: (i: number) => string;
  onPick: () => void;
  empty: boolean;
  error: string | null;
  q: string;
}

function Results({ id, labelId, groups, active, optionId, onPick, empty, error, q }: ResultsProps) {
  // Each group's first option index in the flat list the arrow keys walk.
  const starts = groups.map((_, k) => groups.slice(0, k).reduce((n, g) => n + g.hits.length, 0));
  return (
    <div id={id} role="listbox" aria-labelledby={labelId} className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="px-2.5 py-2 text-sm text-red-300">
          Search failed: {error}
        </p>
      )}
      {empty && <p className="px-2.5 py-3 text-sm text-silver-dim">No one matches &ldquo;{q}&rdquo;.</p>}
      {groups.map((g, k) => (
        <div key={g.label} role="group" aria-labelledby={`${id}-${g.label}`} className="flex flex-col">
          <p id={`${id}-${g.label}`} role="presentation" className={`${EYEBROW} px-2.5 pt-1.5 pb-1`}>
            {g.label}
          </p>
          {g.hits.map((h, j) => (
            <Option
              key={h.id}
              id={optionId(starts[k] + j)}
              hit={h}
              active={starts[k] + j === active}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Option({ id, hit, active, onPick }: { id: string; hit: Hit; active: boolean; onPick: () => void }) {
  let face: ReactNode;
  if (hit.image !== undefined) {
    const headshot = hit.image ? { image: hit.image, author: "", license: "", sourceUrl: null } : null;
    face = <Headshot person={{ name: hit.name, headshot }} size={36} />;
  } else {
    face = <Avatar name={hit.name} email="" picture={hit.picture ?? null} size={36} />;
  }
  return (
    <Link
      id={id}
      href={hit.href}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      prefetch={false}
      onClick={onPick}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors hover:bg-silver/10",
        active && "bg-silver/10 shadow-[inset_2px_0_0_var(--color-gold)]",
        FOCUS,
      )}
    >
      <span aria-hidden="true" className="contents">
        {face}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-pearl">{hit.name}</span>
        <span className="truncate text-xs text-silver-dim">{hit.detail}</span>
      </span>
    </Link>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-silver-dim", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.2 13.2 3.8 3.8" />
    </svg>
  );
}
