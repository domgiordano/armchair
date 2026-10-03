"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { FactionWord } from "@/components/faction-word";
import { FocusCard } from "@/components/focus-card";
import { CloakToken, DaggerToken, EmptyChair, Hood, ShieldMark, SlateToken, TableTop, Tally } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import type { EventType, Exit, Faction, Player } from "@/lib/api/traitors";
import { finishText } from "@/lib/history";
import { firstName, nameOf } from "@/lib/players";
import { arcOf, HEAD, headShare, offset, perimeter, pointAt, ringFor, SEAT, wrap, type Point, type Ring } from "@/lib/spin";
import { button, cn, FOCUS } from "@/lib/ui";
import { useSpin } from "@/lib/use-spin";

export interface TableResult {
  banished?: string;
  faction?: Faction;
  victims?: string[];
  recruits?: string[];
}

/** A player at the table; the cast view also knows how they left and, once out, their side. */
export type Seated = Player & { exit?: Exit | null; faction?: Faction | null };

/** The three calls, plus the winner bet, which picks up to three seats too. */
export type TableKind = EventType | "WINNER";

type SeatState = "banished" | "murdered" | "recruited" | null;

interface RoundTableProps {
  roster: Seated[];
  kind: TableKind;
  /** For the focus card: the edition and season, and whose page to read. */
  season: string;
  /** Your selection, or your sealed call, in rank order. */
  chosen: string[];
  /** Present while you're picking: a tap on the seat at the head of the table. */
  onTap?: (id: string) => void;
  /** While you're picking, the focus card's buttons for whoever is at the head. */
  actions?: (player: Seated) => ReactNode;
  /** A full slate: in the list, seats not on it can't be tapped. */
  full?: boolean;
  result?: TableResult | null;
  /** How many others called each player, or in a past season, the votes each drew. */
  tallies?: Record<string, number> | null;
  tallyLabel?: (count: number) => string;
  /** Names the table when a page shows more than one. */
  label?: string;
  /** Read-only seats link to each player's page. */
  hrefOf?: (id: string) => string;
  /** Voter id to target id: drawn as chalk arrows across the table. */
  ballots?: Record<string, string> | null;
  /** Who held a shield: a badge on their seat. */
  shields?: string[];
  /** The whole cast: the out are crossed off with how they left, unmasked Traitors ringed in red. */
  cast?: boolean;
  /** Always offer the list view, not only for a crowded table. */
  listToggle?: boolean;
  /** What the list view shows instead of the plain list of seats. */
  list?: ReactNode;
}

// From here a table is a lot of turning: offer a list to scan instead.
const CROWDED = 20;

const RANKS = ["first", "second", "third"];
const LABELS: Record<TableKind, string> = {
  MURDER: "Who is murdered",
  RT: "The round table vote",
  RECRUIT: "Who is recruited",
  WINNER: "Pick your winners",
};

/** What a seat says about its player, for its label and the focus card. */
interface Notes {
  rank: number;
  /** Calls or votes chalked by the seat. */
  count: number;
  state: SeatState;
  status: string[];
  unmasked: boolean;
  won: boolean;
}

/**
 * The castle's table seen from above, sized to the screen. It turns: whoever is
 * at its head, the top, is read about in the focus card beside it, and that's
 * where your call is made. Tap a seat to turn it to the head, or turn the table
 * with the arrows, a drag or the arrow keys. A crowded table offers a list.
 */
export function RoundTable({
  roster,
  kind,
  season,
  chosen,
  onTap,
  actions,
  full = false,
  result = null,
  tallies = null,
  tallyLabel = (n) => `${n} called`,
  label,
  hrefOf,
  ballots = null,
  shields = [],
  cast = false,
  listToggle = false,
  list,
}: RoundTableProps) {
  const [view, setView] = useState<"table" | "list">("table");
  const name = label ?? LABELS[kind];
  const notesOf = (p: Seated): Notes => {
    const rank = chosen.indexOf(p.id);
    const state = stateOf(kind, result, p.id);
    const finish = cast ? finishText(p.exit ?? null) : null;
    const tally = tallies?.[p.id] ? tallyLabel(tallies[p.id]) : null;
    const votedFor = ballots?.[p.id] ? nameOf(ballots[p.id], roster) : null;
    const status = [
      cast && p.faction,
      finish,
      rank >= 0 && (kind === "RT" ? `your ${RANKS[rank]}` : "your pick"),
      state === "banished" && `banished${result?.faction ? `, ${result.faction}` : ""}`,
      state === "murdered" && "murdered",
      state === "recruited" && "recruited",
      tally,
      votedFor && `voted for ${votedFor}`,
      shields.includes(p.id) && "held a shield",
    ].filter((s): s is string => Boolean(s));
    return {
      rank,
      count: tallies?.[p.id] ?? 0,
      state,
      status,
      unmasked: (cast && p.faction === "Traitor" && Boolean(p.exit)) || (state === "banished" && result?.faction === "Traitor"),
      won: cast && p.exit?.how === "winner",
    };
  };

  const toggle = (listToggle || roster.length >= CROWDED) && (
    <div role="group" aria-label={`${name}: view`} className="flex justify-end gap-1">
      {(["table", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={button(view === v ? "primary" : "ghost", "sm")}
        >
          {v === "table" ? "Table" : "List"}
        </button>
      ))}
    </div>
  );

  if (view === "list") {
    return (
      <div className="flex flex-col gap-3">
        {toggle}
        {list ?? (
          <ul aria-label={name} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {roster.map((p) => (
              <li key={p.id}>
                <ListSeat
                  player={p}
                  kind={kind}
                  notes={notesOf(p)}
                  onTap={onTap}
                  disabled={full && !chosen.includes(p.id)}
                  href={hrefOf?.(p.id)}
                  shield={shields.includes(p.id)}
                  cast={cast}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toggle}
      <Table
        roster={roster}
        name={name}
        kind={kind}
        season={season}
        notesOf={notesOf}
        faction={result?.faction}
        onTap={onTap}
        actions={actions}
        hrefOf={hrefOf}
        ballots={ballots}
        shields={shields}
        cast={cast}
      />
    </div>
  );
}

function stateOf(kind: TableKind, result: TableResult | null, id: string): SeatState {
  if (!result) return null;
  if (kind === "RT" && result.banished === id) return "banished";
  if (kind === "MURDER" && result.victims?.includes(id)) return "murdered";
  if (kind === "RECRUIT" && result.recruits?.includes(id)) return "recruited";
  return null;
}

const labelOf = (p: Seated, notes: Notes) => [p.name, ...notes.status].join(", ");

/** The table's width in px, kept live. Before it's measured, a phone's. */
function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(343);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth > 0) setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** A point `share` of the way from a seat to the table's middle, for what's set in front of it. */
const toward = (r: Ring, p: Point, share: number) => ({
  x: p.x + (r.cx - p.x) * share,
  y: p.y + (r.cy - p.y) * share,
});

interface TableProps {
  roster: Seated[];
  name: string;
  kind: TableKind;
  season: string;
  notesOf: (p: Seated) => Notes;
  faction: Faction | undefined;
  onTap?: (id: string) => void;
  actions?: (player: Seated) => ReactNode;
  hrefOf?: (id: string) => string;
  ballots: Record<string, string> | null;
  shields: string[];
  cast: boolean;
}

function Table({ roster, name, kind, season, notesOf, faction, onTap, actions, hrefOf, ballots, shields, cast }: TableProps) {
  const stage = useRef<HTMLDivElement>(null);
  const keyed = useRef(false);
  const hint = useId();
  const n = roster.length;
  const width = useWidth(stage);
  const ring = useMemo(() => ringFor(width, n), [width, n]);
  // A night with a result opens on it: the banished, the murdered or the recruit at the head.
  const spin = useSpin(n, Math.max(0, roster.findIndex((p) => notesOf(p).state !== null)));
  const head = wrap(spin.head, n);
  const spots = roster.map((_, i) => {
    const k = offset(i, spin.turn, n);
    return { k, ...pointAt(ring, arcOf(ring, k, n)) };
  });
  const lead = roster.at(head);

  // Arrow keys moved the head while a seat had focus: keep focus on the head.
  useEffect(() => {
    if (!keyed.current) return;
    keyed.current = false;
    stage.current?.querySelector<HTMLElement>(`[data-seat="${head}"]`)?.focus({ preventScroll: true });
  }, [head]);

  if (!lead) return null;
  const leadNotes = notesOf(lead);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    keyed.current = e.target !== e.currentTarget;
    spin.step(by);
  };

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-6">
      <FocusCard
        id={lead.id}
        name={lead.name}
        season={season}
        status={leadNotes.status}
        unmasked={leadNotes.unmasked}
        href={hrefOf?.(lead.id)}
        actions={actions?.(lead)}
        className="md:order-2 md:pt-2"
      />
      <div className="flex flex-col gap-1 md:order-1">
        <div
          ref={stage}
          role="group"
          aria-label={name}
          aria-describedby={hint}
          tabIndex={0}
          onKeyDown={onKeyDown}
          {...spin.bind(perimeter(ring) / n)}
          className={cn(FOCUS, "relative w-full touch-pan-y rounded-sm select-none")}
          style={{ height: ring.height }}
        >
          <p id={hint} className="sr-only">
            Left and right arrow keys turn the table.
          </p>
          <TableTop ring={ring} angle={(-spin.turn / n) * 360} seats={spots} />
          {ballots && !spin.moving && <VoteLines roster={roster} ring={ring} spots={spots} ballots={ballots} />}
          {roster.map((p, i) => {
            const notes = notesOf(p);
            return (
              <div key={p.id}>
                {/* With the votes drawn, your slate tokens would sit on the arrows; the slate below still lists them. */}
                {notes.rank >= 0 && !ballots && (
                  <Placed at={toward(ring, spots[i], 0.3 + 0.2 * headShare(spots[i].k))} z={5}>
                    <Token kind={kind} rank={notes.rank} />
                  </Placed>
                )}
                {notes.count > 0 && (
                  <Placed at={toward(ring, spots[i], 0.5 + 0.15 * headShare(spots[i].k))} z={4}>
                    <Tally count={notes.count} />
                  </Placed>
                )}
              </div>
            );
          })}
          {roster.map((p, i) => (
            <TableSeat
              key={p.id}
              index={i}
              player={p}
              spot={spots[i]}
              notes={notesOf(p)}
              head={i === head}
              faction={faction}
              voting={Boolean(onTap)}
              href={hrefOf?.(p.id)}
              shield={shields.includes(p.id)}
              cast={cast}
              onTap={() => (i === head ? onTap?.(p.id) : spin.rotateTo(i))}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <SpinButton label="Turn to the previous player" onClick={() => spin.step(-1)}>
            <path d="m15 6-6 6 6 6" />
          </SpinButton>
          <p aria-live="polite" className="min-w-0 truncate text-center text-sm text-ash">
            <span className="sr-only">{lead.name} at the head of the table. </span>
            <span aria-hidden="true">
              <span className="nums">{head + 1}</span> of <span className="nums">{n}</span>
            </span>
          </p>
          <SpinButton label="Turn to the next player" onClick={() => spin.step(1)}>
            <path d="m9 6 6 6-6 6" />
          </SpinButton>
        </div>
      </div>
    </div>
  );
}

function SpinButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        FOCUS,
        "flex size-11 shrink-0 items-center justify-center rounded-full border border-gilt/60 bg-stone text-candle transition-colors hover:border-candle hover:bg-cloak active:bg-cloak-500",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

const unit = (from: Point, to: Point) => {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
};

interface VoteLinesProps {
  roster: Player[];
  ring: Ring;
  spots: (Point & { k: number })[];
  ballots: Record<string, string>;
}

/**
 * Each vote as a chalk arrow from voter to target, bowed toward the middle of the
 * table so votes for one player fan in rather than lie on top of each other.
 * Taken off while the table turns and drawn again once it stops.
 */
function VoteLines({ roster, ring, spots, ballots }: VoteLinesProps) {
  const filter = useId();
  const seat = new Map(roster.map((p, i) => [p.id, i]));
  // Ends stop at the face's rim.
  const face = (i: number) => ({ ...spots[i], r: (SEAT + (HEAD - SEAT) * headShare(spots[i].k)) / 2 + 3 });
  const centre = { x: ring.cx, y: ring.cy };
  const paths = Object.entries(ballots).flatMap(([voter, target]) => {
    const a = seat.get(voter);
    const b = seat.get(target);
    if (a === undefined || b === undefined || a === b) return [];
    const p0 = face(a);
    const p2 = face(b);
    const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
    const c = { x: mid.x + (centre.x - mid.x) * 0.35, y: mid.y + (centre.y - mid.y) * 0.35 };
    const out = unit(p0, c);
    const into = unit(c, p2);
    const s = { x: p0.x + out.x * p0.r, y: p0.y + out.y * p0.r };
    const e = { x: p2.x - into.x * p2.r, y: p2.y - into.y * p2.r };
    const barb = (turn: number) => {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      return { x: e.x - 10 * (into.x * cos - into.y * sin), y: e.y - 10 * (into.x * sin + into.y * cos) };
    };
    const l = barb(0.5);
    const r = barb(-0.5);
    const f = (n: number) => n.toFixed(1);
    return [
      {
        voter,
        d: `M${f(s.x)} ${f(s.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}M${f(l.x)} ${f(l.y)}L${f(e.x)} ${f(e.y)}L${f(r.x)} ${f(r.y)}`,
      },
    ];
  });

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
      width={ring.width}
      height={ring.height}
      viewBox={`0 0 ${ring.width} ${ring.height}`}
    >
      <defs>
        <filter id={filter}>
          <feTurbulence type="fractalNoise" baseFrequency={1.1} numOctaves={1} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={2} />
        </filter>
      </defs>
      <g
        filter={`url(#${filter})`}
        fill="none"
        stroke="var(--bone)"
        strokeOpacity={0.88}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((p, i) => (
          <path
            key={p.voter}
            d={p.d}
            pathLength={1}
            strokeDasharray={1}
            className="animate-draw"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </g>
    </svg>
  );
}

function Placed({ at, z, children }: { at: Point; z: number; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y, zIndex: z }}
    >
      {children}
    </span>
  );
}

function Token({ kind, rank }: { kind: TableKind; rank: number }) {
  if (kind === "MURDER") return <DaggerToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
  if (kind === "RECRUIT") return <CloakToken className="size-9 animate-stamp drop-shadow-[0_3px_4px_rgb(0_0_0/0.7)]" />;
  return <SlateToken rank={rank} className="animate-stamp" />;
}

interface FaceProps {
  player: Seated;
  notes: Notes;
  size: number;
  cast: boolean;
}

function Face({ player, notes, size, cast }: FaceProps) {
  return (
    <>
      {notes.state === "murdered" ? (
        <EmptyChair className="size-full" />
      ) : (
        <Headshot
          round
          name={player.name}
          image={player.headshot}
          size={size}
          // The hood drops away to show the portrait crossed out, not an empty seat.
          exit={notes.state === "banished" ? (player.exit ?? { how: "banished" }) : cast ? player.exit : null}
        />
      )}
      {notes.state === "banished" && (
        <span className="absolute inset-0 animate-hood-drop">
          <Hood className="size-full" />
        </span>
      )}
      {notes.state === "recruited" && (
        <span className="absolute inset-0 animate-fade-in [animation-duration:900ms]">
          <Hood className="size-full" />
        </span>
      )}
    </>
  );
}

interface TableSeatProps {
  index: number;
  player: Seated;
  spot: Point & { k: number };
  notes: Notes;
  head: boolean;
  faction: Faction | undefined;
  voting: boolean;
  href?: string;
  shield: boolean;
  cast: boolean;
  onTap: () => void;
}

/**
 * A face on the rim, drawn at the head's size and shrunk to a 44px tap target
 * elsewhere, so a face coming round to the head grows without going soft.
 * Only the head shows a name; the rest carry theirs in their label.
 */
function TableSeat({ index, player, spot, notes, head, faction, voting, href, shield, cast, onTap }: TableSeatProps) {
  const share = headShare(spot.k);
  const size = SEAT + (HEAD - SEAT) * share;
  const picked = notes.rank >= 0;
  const ring = cn(
    "absolute inset-0 rounded-full ring-[3px] transition-shadow duration-150",
    picked || notes.won ? "ring-candle shadow-[0_0_18px_3px_rgb(233_185_73/0.5)]" : notes.unmasked ? "ring-blood" : "ring-gilt/80",
    "group-hover:ring-candle",
  );
  const box = cn(
    FOCUS,
    "group absolute block rounded-full bg-night shadow-[0_6px_14px_-4px_rgb(0_0_0/0.9)] active:brightness-90",
  );
  const style = {
    left: spot.x,
    top: spot.y,
    width: HEAD,
    height: HEAD,
    transform: `translate(-50%, -50%) scale(${(size / HEAD).toFixed(4)})`,
    // The head on top, then the nearest to it, so a neighbour never covers the face coming round.
    zIndex: 10 + Math.round(share * 20),
  };
  const body = (
    <>
      <span className="absolute inset-0 overflow-hidden rounded-full">
        <Face player={player} notes={notes} size={HEAD} cast={cast} />
      </span>
      <span aria-hidden="true" className={ring} />
      {shield && <ShieldMark className="absolute -top-1 -right-1 h-8 w-7 drop-shadow-[0_2px_2px_rgb(0_0_0/0.8)]" />}
    </>
  );
  // The reveal word shows only at the head, on the wood below the name; by the rim it ran off the screen.
  const caption = share > 0 && (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-[31] flex -translate-x-1/2 flex-col items-center"
      style={{ left: spot.x, top: spot.y + size / 2 + 2, opacity: share }}
    >
      <span
        className={cn(
          "max-w-24 truncate font-display text-xs leading-tight font-semibold tracking-[0.08em] uppercase",
          picked || notes.won ? "text-candle" : "text-bone",
        )}
      >
        {firstName(player.name)}
      </span>
      {notes.state === "banished" && faction && (
        <FactionWord faction={faction} className="text-sm whitespace-nowrap [animation-delay:1.2s]" />
      )}
    </span>
  );
  const label = labelOf(player, notes);
  const common = { "data-seat": index, "aria-label": label, "aria-current": head ? ("true" as const) : undefined, style };

  if (!voting && href) {
    // Away from the head, a plain tap turns the table; a modified click still opens the page.
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
      if (head || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      onTap();
    };
    return (
      <>
        <Link href={href} onClick={onClick} className={box} {...common}>
          {body}
        </Link>
        {caption}
      </>
    );
  }
  return (
    <>
      <button type="button" aria-pressed={voting ? picked : undefined} onClick={onTap} className={box} {...common}>
        {body}
      </button>
      {caption}
    </>
  );
}

interface ListSeatProps {
  player: Seated;
  kind: TableKind;
  notes: Notes;
  onTap?: (id: string) => void;
  disabled: boolean;
  href?: string;
  shield: boolean;
  cast: boolean;
}

/** A row in the list view: face, full name, how they left. Tapping picks straight away. */
function ListSeat({ player, kind, notes, onTap, disabled, href, shield, cast }: ListSeatProps) {
  const picked = notes.rank >= 0;
  const finish = cast ? finishText(player.exit ?? null) : null;
  const label = labelOf(player, notes);
  const body = (
    <>
      <span
        className={cn(
          "relative block size-11 shrink-0 overflow-hidden rounded-full bg-night ring-2",
          picked || notes.won ? "ring-candle" : notes.unmasked ? "ring-blood" : "ring-gilt/80",
        )}
      >
        <Face player={player} notes={notes} size={44} cast={cast} />
      </span>
      {shield && <ShieldMark className="h-5 w-4 shrink-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.8)]" />}
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "min-w-0 truncate font-display text-xs font-semibold tracking-[0.08em] uppercase",
            picked || notes.won ? "text-candle" : "text-bone",
          )}
        >
          {player.name}
        </span>
        {finish && <span className="text-xs text-ash">{finish}</span>}
      </span>
      {picked && (
        <span aria-hidden="true" className="ml-auto shrink-0 font-display text-sm text-candle">
          {kind === "RT" || kind === "WINNER" ? ["I", "II", "III"][notes.rank] : "Pick"}
        </span>
      )}
    </>
  );
  const box = "flex min-h-14 w-full items-center gap-2.5 rounded-sm border border-gilt/25 bg-stone/80 p-1.5 text-left";
  const hover = "transition-colors hover:border-gilt hover:bg-cloak active:bg-cloak-500";

  if (!onTap && href) {
    return (
      <Link href={href} aria-label={label} className={cn(box, FOCUS, hover)}>
        {body}
      </Link>
    );
  }
  if (!onTap) {
    return (
      <div role="img" aria-label={label} className={box}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={picked}
      disabled={disabled}
      onClick={() => onTap(player.id)}
      className={cn(box, FOCUS, "disabled:cursor-not-allowed disabled:opacity-45", hover)}
    >
      {body}
    </button>
  );
}
